// AIClassificationService: classifies a file buffer using AI providers
import {
  AIProvider,
  AIProviderConfig,
  AIClassificationRequest,
  AIClassificationResponse,
  FileClassificationInput,
  FileClassificationResult,
} from '../types/ai.types';
import { AIProviderFactory } from '../providers/ai.factory';
import { LocalModelProvider } from '../providers/local.provider';
import { config } from '../config';
import { logger } from '../config/logger';

/**
 * AIClassificationService classifies raw file buffers and returns a structured result
 * containing the file category, confidence score, suggested filename and folder path.
 *
 * It first attempts to use the configured AI provider (OpenAI or Azure OpenAI) and
 * automatically falls back to the local rule-based classifier on any failure.
 */
export class AIClassificationService {
  private primaryProvider?: AIProvider;
  private fallbackProvider?: AIProvider;
  private initialized = false;

  /**
   * @param providerConfig - Optional provider configuration. When omitted the
   *   application config (environment variables) is used.
   */
  constructor(private readonly providerConfig?: AIProviderConfig) {}

  /**
   * Lazily initialise AI providers.
   * Can be called explicitly to pre-warm providers; otherwise it is called
   * automatically on the first `classify` invocation.
   */
  async initialize(): Promise<void> {
    const aiConfig: AIProviderConfig = this.providerConfig ?? {
      provider: config.ai.provider,
      apiKey: config.ai.apiKey,
      endpoint: config.ai.endpoint,
      model: config.ai.model,
      maxTokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      timeout: config.ai.timeout,
      retryAttempts: config.ai.retryAttempts,
    };

    // Only set a primary provider when the configured provider is not 'local'
    if (aiConfig.provider !== 'local') {
      try {
        this.primaryProvider = await AIProviderFactory.createProvider(aiConfig);
        logger.info(`AI primary provider initialised: ${this.primaryProvider.getName()}`);
      } catch (error) {
        logger.warn('Primary AI provider initialisation failed, falling back to local classifier', { error });
      }
    }

    // Local provider is always available as the fallback
    const localProvider = new LocalModelProvider();
    await localProvider.initialize({ provider: 'local' });
    this.fallbackProvider = localProvider;

    this.initialized = true;
  }

  /**
   * Classify a raw file buffer.
   *
   * @param input - Buffer plus optional filename / MIME-type hints
   * @returns Structured classification result
   */
  async classify(input: FileClassificationInput): Promise<FileClassificationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const request = this.buildRequest(input);

    // Attempt primary provider (OpenAI / Azure OpenAI)
    if (this.primaryProvider?.isReady()) {
      try {
        const response = await this.primaryProvider.classify(request);
        logger.debug(`File classified by ${this.primaryProvider.getName()}`, {
          fileName: request.fileName,
          confidence: response.confidence,
        });
        return this.mapToResult(response, input);
      } catch (error) {
        logger.warn('Primary AI provider classification failed, falling back to local classifier', {
          error,
          fileName: request.fileName,
        });
      }
    }

    // Fallback to local classifier
    const response = await this.fallbackProvider!.classify(request);
    logger.debug('File classified by local classifier', {
      fileName: request.fileName,
      confidence: response.confidence,
    });
    return this.mapToResult(response, input);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build an AIClassificationRequest from the raw input buffer.
   */
  private buildRequest(input: FileClassificationInput): AIClassificationRequest {
    const mimeType = input.mimeType ?? this.detectMimeType(input.buffer);
    const fileName = input.fileName ?? 'unknown';
    const fileSize = input.buffer.length;
    const content = this.extractTextContent(input.buffer, mimeType);

    return { fileName, mimeType, fileSize, content };
  }

  /**
   * Detect MIME type from buffer magic bytes.
   * Falls back to 'text/plain' for printable ASCII content and
   * 'application/octet-stream' for binary blobs.
   */
  private detectMimeType(buffer: Buffer): string {
    if (buffer.length < 4) {
      return 'application/octet-stream';
    }

    const b = buffer;

    // JPEG  FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    // PNG   89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    // GIF   47 49 46
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
    // WebP  52 49 46 46 ... 57 45 42 50
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && buffer.length >= 12 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    // PDF   25 50 44 46
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
    // ZIP / Office Open XML  50 4B 03 04
    if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'application/zip';
    // MP4 ftyp box at offset 4
    if (buffer.length >= 12 &&
        b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
    // MP3 frame sync FF Exx  or  ID3 tag 49 44 33
    if ((b[0] === 0xff && (b[1] & 0xe0) === 0xe0) ||
        (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33)) return 'audio/mpeg';

    // Heuristic: assume text/plain if the first 512 bytes are all printable
    const sample = buffer.slice(0, Math.min(512, buffer.length));
    const isPrintable = sample.every(
      (byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e) || byte >= 0x80
    );
    if (isPrintable) return 'text/plain';

    return 'application/octet-stream';
  }

  /**
   * Extract a UTF-8 text preview from the buffer for text-based MIME types.
   * Returns undefined for binary formats (images, video, audio, PDF, etc.).
   */
  private extractTextContent(buffer: Buffer, mimeType: string): string | undefined {
    const textMimeTypes = ['text/', 'application/json', 'application/xml', 'application/javascript'];
    const isText = textMimeTypes.some((prefix) => mimeType.startsWith(prefix));
    if (!isText) {
      return undefined;
    }

    try {
      return buffer.toString('utf-8').substring(0, 3000);
    } catch {
      return undefined;
    }
  }

  /**
   * Map an AIClassificationResponse to the public FileClassificationResult shape.
   */
  private mapToResult(
    response: AIClassificationResponse,
    input: FileClassificationInput
  ): FileClassificationResult {
    const fileCategory = response.categories[0] ?? response.contentType;
    const suggestedFolderPath = response.suggestedFolder ?? `/${response.contentType}`;
    const suggestedFilename = this.generateSuggestedFilename(input.fileName, response);

    return {
      fileCategory,
      confidenceScore: response.confidence,
      suggestedFilename,
      suggestedFolderPath,
      tags: response.tags,
      contentType: response.contentType,
      isPII: response.isPII ?? false,
      language: response.language,
      reasoning: response.reasoning,
    };
  }

  /**
   * Generate a human-readable suggested filename from the classification result.
   *
   * Format: `<primary-tag>_<YYYY-MM-DD><original-extension>`
   * e.g. `invoice_2024-03-16.pdf`
   */
  private generateSuggestedFilename(
    originalName: string | undefined,
    response: AIClassificationResponse
  ): string {
    const extension = originalName ? this.extractExtension(originalName) : '';
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Use the first tag, falling back to category or content type for the stem
    const stem = (response.tags[0] ?? response.categories[0] ?? response.contentType)
      .replace(/[^a-z0-9_-]/gi, '_')
      .toLowerCase();

    return `${stem}_${date}${extension}`;
  }

  /**
   * Extract the file extension including the leading dot from a filename.
   * Returns an empty string when no extension is found.
   */
  private extractExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot) : '';
  }
}
