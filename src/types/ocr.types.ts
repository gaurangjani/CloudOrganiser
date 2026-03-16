// OCR (Optical Character Recognition) service type definitions

/**
 * Supported OCR provider types
 */
export const OCR_PROVIDER_TYPES = ['tesseract', 'azure-document-intelligence'] as const;

/**
 * Union type derived from the supported OCR provider types
 */
export type OCRProviderType = (typeof OCR_PROVIDER_TYPES)[number];

/**
 * OCRProviderConfig holds configuration for an OCR provider
 */
export interface OCRProviderConfig {
  provider: OCRProviderType;
  /** Azure Document Intelligence endpoint (required for 'azure-document-intelligence') */
  endpoint?: string;
  /** API key for the provider (required for 'azure-document-intelligence') */
  apiKey?: string;
  /** Language hint for Tesseract (e.g. 'eng', 'deu'). Defaults to 'eng'. */
  language?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * OCRRequest describes the input to the OCR service
 */
export interface OCRRequest {
  /** Raw binary content of the file (image or PDF) */
  content: Buffer;
  /** MIME type of the file, e.g. 'image/png' or 'application/pdf' */
  mimeType: string;
  /** Original file name – used for logging and metadata */
  fileName: string;
  /** Optional language hint for better accuracy (ISO 639-1, e.g. 'en') */
  language?: string;
}

/**
 * OCRWord is a single recognised word with positional data
 */
export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox?: OCRBoundingBox;
}

/**
 * OCRLine is a line of text made up of recognised words
 */
export interface OCRLine {
  text: string;
  confidence: number;
  words: OCRWord[];
  boundingBox?: OCRBoundingBox;
}

/**
 * OCRPage contains the OCR results for a single page
 */
export interface OCRPage {
  pageNumber: number;
  text: string;
  confidence: number;
  lines: OCRLine[];
  width?: number;
  height?: number;
}

/**
 * OCRBoundingBox describes the position of a recognised element
 */
export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * OCRKeyValuePair represents a structured key-value pair extracted from a document
 * (e.g. form fields detected by Azure Document Intelligence)
 */
export interface OCRKeyValuePair {
  key: string;
  value: string;
  confidence: number;
}

/**
 * OCRTable represents a table structure extracted from a document
 */
export interface OCRTable {
  rowCount: number;
  columnCount: number;
  cells: OCRTableCell[];
}

/**
 * OCRTableCell is a single cell within an extracted table
 */
export interface OCRTableCell {
  rowIndex: number;
  columnIndex: number;
  text: string;
  confidence: number;
}

/**
 * OCRMetadata holds structured information derived from the OCR result
 */
export interface OCRMetadata {
  /** Overall confidence score (0–1) */
  confidence: number;
  /** Detected language (ISO 639-1) */
  language?: string;
  /** Total number of pages processed */
  pageCount: number;
  /** Total word count across all pages */
  wordCount: number;
  /** Detected document type (e.g. 'invoice', 'receipt', 'form') */
  documentType?: string;
  /** Key-value pairs extracted from structured documents */
  keyValuePairs?: OCRKeyValuePair[];
  /** Tables extracted from the document */
  tables?: OCRTable[];
  /** Whether any PII was detected in the extracted text */
  containsPII?: boolean;
}

/**
 * OCRResult is the full response returned by the OCR service
 */
export interface OCRResult {
  /** Concatenated full text across all pages */
  text: string;
  /** Per-page OCR results */
  pages: OCRPage[];
  /** Structured metadata derived from the OCR result */
  metadata: OCRMetadata;
  /** Name of the OCR provider that produced this result */
  provider: OCRProviderType;
  /** Time taken to process the request in milliseconds */
  processingTimeMs: number;
}

/**
 * OCRProvider interface that all OCR provider implementations must satisfy
 */
export interface OCRProvider {
  /**
   * Initialise the provider with its configuration.
   * Must be called before any calls to `extractText`.
   */
  initialize(config: OCRProviderConfig): Promise<void>;

  /**
   * Extract text and structured metadata from an image or PDF.
   * @param request - The OCR request payload
   * @returns Promise resolving to a full OCR result
   */
  extractText(request: OCRRequest): Promise<OCRResult>;

  /**
   * Returns true when the provider is initialised and ready to process requests.
   */
  isReady(): boolean;

  /**
   * Returns the canonical name of this OCR provider.
   */
  getName(): OCRProviderType;
}

/**
 * OCRError wraps errors thrown by OCR providers with extra context
 */
export class OCRError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'OCRError';
  }
}
