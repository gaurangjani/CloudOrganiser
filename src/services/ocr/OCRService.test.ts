// Tests for the OCR service
import { OCRService, SUPPORTED_MIME_TYPES } from './OCRService';
import { OCRError, OCRProvider, OCRProviderConfig, OCRRequest, OCRResult } from '../../types/ocr.types';

// Mock logger to avoid config side-effects in tests
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockProvider(overrides?: Partial<OCRProvider>): OCRProvider {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(true),
    getName: jest.fn().mockReturnValue('tesseract'),
    extractText: jest.fn().mockResolvedValue(buildMockResult()),
    ...overrides,
  };
}

function buildMockResult(text = 'Hello World'): OCRResult {
  return {
    text,
    pages: [
      {
        pageNumber: 1,
        text,
        confidence: 0.95,
        lines: [
          {
            text,
            confidence: 0.95,
            words: [
              { text: 'Hello', confidence: 0.97 },
              { text: 'World', confidence: 0.93 },
            ],
          },
        ],
      },
    ],
    metadata: {
      confidence: 0.95,
      language: 'eng',
      pageCount: 1,
      wordCount: 2,
    },
    provider: 'tesseract',
    processingTimeMs: 100,
  };
}

function makeRequest(overrides?: Partial<OCRRequest>): OCRRequest {
  return {
    content: Buffer.from('fake-image-data'),
    mimeType: 'image/png',
    fileName: 'test.png',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// OCRService
// ---------------------------------------------------------------------------

describe('OCRService', () => {
  let mockProvider: OCRProvider;
  let service: OCRService;

  beforeEach(async () => {
    mockProvider = makeMockProvider();
    service = new OCRService(mockProvider);
    await service.initProvider({ provider: 'tesseract' });
  });

  // -------------------------------------------------------------------------
  // Initialisation
  // -------------------------------------------------------------------------

  describe('initProvider', () => {
    it('should initialise the provider and become ready', () => {
      expect(service.isReady()).toBe(true);
    });

    it('should call provider.initialize with the supplied config', async () => {
      const config: OCRProviderConfig = { provider: 'tesseract', language: 'deu' };
      await service.initProvider(config);
      expect(mockProvider.initialize).toHaveBeenCalledWith(config);
    });
  });

  // -------------------------------------------------------------------------
  // isReady / getProviderName
  // -------------------------------------------------------------------------

  describe('isReady', () => {
    it('returns false before initProvider is called', () => {
      const freshService = new OCRService(makeMockProvider({ isReady: jest.fn().mockReturnValue(false) }));
      expect(freshService.isReady()).toBe(false);
    });

    it('returns true after successful initialisation', () => {
      expect(service.isReady()).toBe(true);
    });
  });

  describe('getProviderName', () => {
    it('returns the name from the underlying provider', () => {
      expect(service.getProviderName()).toBe('tesseract');
    });
  });

  // -------------------------------------------------------------------------
  // isSupportedMimeType
  // -------------------------------------------------------------------------

  describe('isSupportedMimeType', () => {
    it.each(SUPPORTED_MIME_TYPES)('returns true for supported type %s', (mime) => {
      expect(service.isSupportedMimeType(mime)).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(service.isSupportedMimeType('text/plain')).toBe(false);
      expect(service.isSupportedMimeType('video/mp4')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // extractText – happy path
  // -------------------------------------------------------------------------

  describe('extractText', () => {
    it('returns the OCR result from the provider', async () => {
      const result = await service.extractText(makeRequest());
      expect(result.text).toBe('Hello World');
      expect(result.provider).toBe('tesseract');
      expect(result.pages).toHaveLength(1);
    });

    it('adds containsPII flag to metadata', async () => {
      const result = await service.extractText(makeRequest());
      expect(result.metadata).toHaveProperty('containsPII');
    });

    it('detects PII when the extracted text contains an email address', async () => {
      const resultWithPII = buildMockResult('Contact us at user@example.com for details');
      (mockProvider.extractText as jest.Mock).mockResolvedValue(resultWithPII);
      const result = await service.extractText(makeRequest());
      expect(result.metadata.containsPII).toBe(true);
    });

    it('does not flag PII for clean text', async () => {
      const result = await service.extractText(makeRequest());
      expect(result.metadata.containsPII).toBe(false);
    });

    it('passes the request through to the underlying provider', async () => {
      const request = makeRequest({ language: 'fra' });
      await service.extractText(request);
      expect(mockProvider.extractText).toHaveBeenCalledWith(request);
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    it('throws OCRError when the provider is not ready', async () => {
      const notReadyProvider = makeMockProvider({ isReady: jest.fn().mockReturnValue(false) });
      const notReadyService = new OCRService(notReadyProvider);
      // Do NOT call initProvider – service.initialised stays false
      await expect(notReadyService.extractText(makeRequest())).rejects.toThrow(OCRError);
    });

    it('throws OCRError for an unsupported MIME type', async () => {
      await expect(
        service.extractText(makeRequest({ mimeType: 'text/plain' }))
      ).rejects.toThrow(OCRError);
    });

    it('re-throws OCRError from the provider unchanged', async () => {
      const providerError = new OCRError('provider failure', 'tesseract');
      (mockProvider.extractText as jest.Mock).mockRejectedValue(providerError);
      await expect(service.extractText(makeRequest())).rejects.toThrow(providerError);
    });

    it('wraps non-OCRError exceptions in an OCRError', async () => {
      (mockProvider.extractText as jest.Mock).mockRejectedValue(new Error('unexpected'));
      await expect(service.extractText(makeRequest())).rejects.toThrow(OCRError);
    });
  });

  // -------------------------------------------------------------------------
  // Static factory helpers
  // -------------------------------------------------------------------------

  describe('OCRService.createProvider', () => {
    it('creates a TesseractOCRProvider for "tesseract"', () => {
      const provider = OCRService.createProvider('tesseract');
      expect(provider.getName()).toBe('tesseract');
    });

    it('creates an AzureDocumentIntelligenceProvider for "azure-document-intelligence"', () => {
      const provider = OCRService.createProvider('azure-document-intelligence');
      expect(provider.getName()).toBe('azure-document-intelligence');
    });
  });
});

// ---------------------------------------------------------------------------
// OCRError
// ---------------------------------------------------------------------------

describe('OCRError', () => {
  it('sets name, message, provider, and originalError correctly', () => {
    const original = new Error('root cause');
    const err = new OCRError('something went wrong', 'tesseract', original);

    expect(err.name).toBe('OCRError');
    expect(err.message).toBe('something went wrong');
    expect(err.provider).toBe('tesseract');
    expect(err.originalError).toBe(original);
    expect(err instanceof Error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SUPPORTED_MIME_TYPES constant
// ---------------------------------------------------------------------------

describe('SUPPORTED_MIME_TYPES', () => {
  it('includes common image types and PDF', () => {
    expect(SUPPORTED_MIME_TYPES).toContain('image/jpeg');
    expect(SUPPORTED_MIME_TYPES).toContain('image/png');
    expect(SUPPORTED_MIME_TYPES).toContain('application/pdf');
  });
});
