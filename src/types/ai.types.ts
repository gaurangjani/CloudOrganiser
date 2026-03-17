// AI provider types for pluggable AI model support

/**
 * Supported AI provider types — used for Joi validation and TypeScript typing
 */
export const AI_PROVIDER_TYPES = ['openai', 'azure-openai', 'local'] as const;

/**
 * Union type derived from the supported AI provider types
 */
export type AIProviderType = (typeof AI_PROVIDER_TYPES)[number];

/**
 * AIProviderConfig represents configuration for an AI provider
 */
export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  endpoint?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * AIClassificationRequest represents a request to classify a file
 */
export interface AIClassificationRequest {
  fileName: string;
  mimeType: string;
  fileSize: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * AIClassificationResponse represents the AI's classification response
 */
export interface AIClassificationResponse {
  categories: string[];
  tags: string[];
  confidence: number;
  suggestedFolder?: string;
  contentType: string;
  isPII?: boolean;
  language?: string;
  reasoning?: string;
}

/**
 * AIProvider interface that all AI providers must implement
 */
export interface AIProvider {
  /**
   * Initialize the AI provider with configuration
   */
  initialize(config: AIProviderConfig): Promise<void>;

  /**
   * Classify a file using the AI model
   * @param request - The classification request
   * @returns Promise resolving to classification response
   */
  classify(request: AIClassificationRequest): Promise<AIClassificationResponse>;

  /**
   * Check if the provider is properly configured and ready
   * @returns true if provider is ready, false otherwise
   */
  isReady(): boolean;

  /**
   * Get the provider name
   * @returns the name of the provider
   */
  getName(): string;
}

/**
 * FileClassificationInput represents the input for buffer-based file classification
 */
export interface FileClassificationInput {
  /** Raw file contents as a Buffer */
  buffer: Buffer;
  /** Original filename, used for extension detection and name suggestions */
  fileName?: string;
  /** MIME type override; detected from buffer magic bytes when omitted */
  mimeType?: string;
}

/**
 * FileClassificationResult represents the structured result of buffer-based classification
 */
export interface FileClassificationResult {
  /** High-level category of the file (e.g. "documents", "financial", "media") */
  fileCategory: string;
  /** Classification confidence score between 0 and 1 */
  confidenceScore: number;
  /** Suggested filename based on classification (preserves original extension) */
  suggestedFilename: string;
  /** Suggested folder path for organising the file */
  suggestedFolderPath: string;
  /** Descriptive tags from the classifier */
  tags: string[];
  /** Broad content type (document, image, video, audio, code, data, other) */
  contentType: string;
  /** Whether the file likely contains personally identifiable information */
  isPII: boolean;
  /** Detected ISO 639-1 language code, if applicable */
  language?: string;
  /** Human-readable reasoning from the classifier */
  reasoning?: string;
}

/**
 * AIProviderError represents errors from AI providers
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
