// OCR Service – orchestrates OCR provider selection and processing
import {
  OCRProvider,
  OCRProviderConfig,
  OCRProviderType,
  OCRRequest,
  OCRResult,
  OCRError,
} from '../../types/ocr.types';
import { TesseractOCRProvider } from './providers/TesseractOCRProvider';
import { AzureDocumentIntelligenceProvider } from './providers/AzureDocumentIntelligenceProvider';
import { FileContentExtractor } from '../../utils/fileContentExtractor';
import { logger } from '../../config/logger';

/**
 * Supported MIME types that the OCR service can process.
 * Images are handled by both providers; PDFs require Tesseract ≥ 5 (not yet
 * fully stable via tesseract.js) or Azure Document Intelligence.
 */
export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'application/pdf',
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * OCRService provides a unified API for OCR processing regardless of the
 * underlying provider.  It also enriches the raw OCR result with PII
 * detection and word-count metadata.
 */
export class OCRService {
  private provider: OCRProvider;
  private initialised = false;

  constructor(provider?: OCRProvider) {
    // Default to Tesseract when no provider is supplied
    this.provider = provider ?? new TesseractOCRProvider();
  }

  /**
   * Create an OCRService pre-configured with the specified provider type.
   */
  static create(config: OCRProviderConfig): OCRService {
    const provider = OCRService.createProvider(config.provider);
    const service = new OCRService(provider);
    // Kick off initialisation (caller can await getProvider().initialize() if
    // they need to confirm readiness before the first call)
    service.initProvider(config);
    return service;
  }

  /**
   * Instantiate the correct provider implementation for the given type.
   */
  static createProvider(type: OCRProviderType): OCRProvider {
    switch (type) {
      case 'tesseract':
        return new TesseractOCRProvider();
      case 'azure-document-intelligence':
        return new AzureDocumentIntelligenceProvider();
      default: {
        const exhaustiveCheck: never = type;
        throw new OCRError(`Unknown OCR provider type: ${exhaustiveCheck}`, String(exhaustiveCheck));
      }
    }
  }

  /**
   * Initialise the underlying provider.
   */
  async initProvider(config: OCRProviderConfig): Promise<void> {
    await this.provider.initialize(config);
    this.initialised = true;
    logger.info(`OCRService initialised with provider: ${this.provider.getName()}`);
  }

  /**
   * Returns true when the service is ready to process requests.
   */
  isReady(): boolean {
    return this.initialised && this.provider.isReady();
  }

  /**
   * Returns the name of the active OCR provider.
   */
  getProviderName(): OCRProviderType {
    return this.provider.getName();
  }

  /**
   * Extract text and structured metadata from an image or PDF.
   *
   * @param request - OCR request containing the raw file buffer and metadata
   * @returns A full OCR result including per-page data and structured metadata
   * @throws OCRError when the provider is not ready or extraction fails
   */
  async extractText(request: OCRRequest): Promise<OCRResult> {
    if (!this.isReady()) {
      throw new OCRError(
        `OCR provider '${this.provider.getName()}' is not ready. Call initProvider() first.`,
        this.provider.getName()
      );
    }

    if (!this.isSupportedMimeType(request.mimeType)) {
      throw new OCRError(
        `Unsupported MIME type: ${request.mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
        this.provider.getName()
      );
    }

    logger.info(`OCR extraction started for file: ${request.fileName} (${request.mimeType})`);

    try {
      const result = await this.provider.extractText(request);

      // Enrich metadata with PII detection
      result.metadata.containsPII = FileContentExtractor.detectPII(result.text);

      logger.info(
        `OCR extraction complete for ${request.fileName}: ` +
          `${result.metadata.wordCount} words, ` +
          `confidence ${(result.metadata.confidence * 100).toFixed(1)}%, ` +
          `${result.processingTimeMs}ms`
      );

      return result;
    } catch (err) {
      if (err instanceof OCRError) {
        throw err;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      throw new OCRError(
        `OCR extraction failed for file ${request.fileName}: ${error.message}`,
        this.provider.getName(),
        error
      );
    }
  }

  /**
   * Returns true when the MIME type is supported by the OCR service.
   */
  isSupportedMimeType(mimeType: string): boolean {
    return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
  }
}
