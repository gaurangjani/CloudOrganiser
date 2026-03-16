// Tests for AIClassificationService
import { AIClassificationService } from '../services/AIClassificationService';
import { AIProviderFactory } from '../providers/ai.factory';
import { AIProviderError } from '../types/ai.types';

// Mock heavy dependencies
jest.mock('../providers/ai.factory');
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockAIResponse = {
  categories: ['financial'],
  tags: ['invoice', 'financial'],
  confidence: 0.92,
  suggestedFolder: '/documents/financial/invoices',
  contentType: 'document',
  isPII: false,
  language: 'en',
  reasoning: 'Invoice PDF detected based on file name and content.',
};

function makePdfBuffer(): Buffer {
  // Starts with %PDF magic bytes
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
}

function makeJpegBuffer(): Buffer {
  // JPEG magic bytes: FF D8 FF
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

function makeTextBuffer(content = 'Hello, this is a plain-text document.'): Buffer {
  return Buffer.from(content, 'utf-8');
}

describe('AIClassificationService', () => {
  let service: AIClassificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no primary provider configured (local only)
    service = new AIClassificationService({ provider: 'local' });
  });

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------
  describe('initialize', () => {
    it('should initialise with local provider when provider is "local"', async () => {
      await service.initialize();
      // Should not throw – local provider always succeeds
    });

    it('should fall back to local when primary provider initialisation fails', async () => {
      (AIProviderFactory.createProvider as jest.Mock).mockRejectedValue(
        new AIProviderError('API key missing', 'openai')
      );

      const svc = new AIClassificationService({ provider: 'openai', apiKey: 'bad-key' });
      // Should not throw even when primary setup fails
      await expect(svc.initialize()).resolves.not.toThrow();
    });

    it('should initialise primary provider when it succeeds', async () => {
      const mockProvider = {
        classify: jest.fn().mockResolvedValue(mockAIResponse),
        isReady: jest.fn().mockReturnValue(true),
        getName: jest.fn().mockReturnValue('OpenAI'),
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      (AIProviderFactory.createProvider as jest.Mock).mockResolvedValue(mockProvider);

      const svc = new AIClassificationService({ provider: 'openai', apiKey: 'sk-test' });
      await svc.initialize();

      expect(AIProviderFactory.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'openai' })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // classify – using local provider (no primary)
  // ---------------------------------------------------------------------------
  describe('classify (local fallback)', () => {
    it('should return a valid result for a PDF buffer', async () => {
      const result = await service.classify({
        buffer: makePdfBuffer(),
        fileName: 'invoice_2024.pdf',
      });

      expect(result).toBeDefined();
      expect(typeof result.fileCategory).toBe('string');
      expect(result.fileCategory.length).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(typeof result.suggestedFilename).toBe('string');
      expect(result.suggestedFilename.length).toBeGreaterThan(0);
      expect(typeof result.suggestedFolderPath).toBe('string');
      expect(result.suggestedFolderPath.length).toBeGreaterThan(0);
    });

    it('should return a valid result for an image buffer', async () => {
      const result = await service.classify({
        buffer: makeJpegBuffer(),
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
      });

      expect(result.fileCategory).toBeDefined();
      expect(result.contentType).toBe('image');
    });

    it('should return a valid result for a plain-text buffer', async () => {
      const result = await service.classify({
        buffer: makeTextBuffer('Hello world, the quick brown fox.'),
        fileName: 'notes.txt',
      });

      expect(result.fileCategory).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThan(0);
    });

    it('should detect the financial category for invoice files', async () => {
      const result = await service.classify({
        buffer: makePdfBuffer(),
        fileName: 'invoice_march.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.fileCategory).toBeDefined();
      expect(result.tags).toContain('invoice');
    });

    it('should use provided mimeType instead of auto-detection', async () => {
      const result = await service.classify({
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03]),
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
      });

      expect(result.contentType).toBe('video');
    });

    it('should work without an optional fileName', async () => {
      const result = await service.classify({
        buffer: makePdfBuffer(),
        mimeType: 'application/pdf',
      });

      expect(result).toBeDefined();
      expect(result.suggestedFilename).toBeDefined();
    });

    it('should include the original extension in suggestedFilename', async () => {
      const result = await service.classify({
        buffer: makePdfBuffer(),
        fileName: 'document.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.suggestedFilename).toMatch(/\.pdf$/);
    });

    it('should return an isPII flag', async () => {
      const piiText = 'SSN: 123-45-6789, Email: test@example.com';
      const result = await service.classify({
        buffer: makeTextBuffer(piiText),
        fileName: 'personal.txt',
        mimeType: 'text/plain',
      });

      expect(result.isPII).toBe(true);
    });

    it('should auto-initialise on first classify call', async () => {
      const freshService = new AIClassificationService({ provider: 'local' });
      // Do NOT call initialize() explicitly
      const result = await freshService.classify({
        buffer: makePdfBuffer(),
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      });

      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // classify – with primary provider
  // ---------------------------------------------------------------------------
  describe('classify (with primary provider)', () => {
    it('should use primary provider when available', async () => {
      const mockProvider = {
        classify: jest.fn().mockResolvedValue(mockAIResponse),
        isReady: jest.fn().mockReturnValue(true),
        getName: jest.fn().mockReturnValue('OpenAI'),
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      (AIProviderFactory.createProvider as jest.Mock).mockResolvedValue(mockProvider);

      const svc = new AIClassificationService({ provider: 'openai', apiKey: 'sk-test' });
      await svc.initialize();

      const result = await svc.classify({
        buffer: makePdfBuffer(),
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
      });

      expect(mockProvider.classify).toHaveBeenCalledTimes(1);
      expect(result.fileCategory).toBe('financial');
      expect(result.confidenceScore).toBe(0.92);
      expect(result.suggestedFolderPath).toBe('/documents/financial/invoices');
    });

    it('should fall back to local when primary provider classify throws', async () => {
      const mockProvider = {
        classify: jest.fn().mockRejectedValue(new AIProviderError('API rate limit', 'openai')),
        isReady: jest.fn().mockReturnValue(true),
        getName: jest.fn().mockReturnValue('OpenAI'),
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      (AIProviderFactory.createProvider as jest.Mock).mockResolvedValue(mockProvider);

      const svc = new AIClassificationService({ provider: 'openai', apiKey: 'sk-test' });
      await svc.initialize();

      // Should not throw – local fallback takes over
      const result = await svc.classify({
        buffer: makePdfBuffer(),
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
      });

      expect(result).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // MIME type detection
  // ---------------------------------------------------------------------------
  describe('MIME type detection', () => {
    it('should detect JPEG from magic bytes', async () => {
      const result = await service.classify({ buffer: makeJpegBuffer() });
      expect(result.contentType).toBe('image');
    });

    it('should detect PDF from magic bytes', async () => {
      const result = await service.classify({ buffer: makePdfBuffer() });
      expect(result.contentType).toBe('document');
    });

    it('should detect plain text from printable ASCII', async () => {
      const result = await service.classify({
        buffer: makeTextBuffer('The quick brown fox jumps over the lazy dog.'),
      });
      // Local provider classifies text/plain as 'uncategorized' but should succeed
      expect(result).toBeDefined();
      expect(result.fileCategory).toBeDefined();
    });

    it('should handle very small buffers gracefully', async () => {
      const result = await service.classify({ buffer: Buffer.from([0x00, 0x01]) });
      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Suggested filename generation
  // ---------------------------------------------------------------------------
  describe('suggestedFilename', () => {
    it('should include today\'s date in the suggested filename', async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await service.classify({
        buffer: makePdfBuffer(),
        fileName: 'contract.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.suggestedFilename).toContain(today);
    });

    it('should produce a filename without special characters', async () => {
      const result = await service.classify({
        buffer: makePdfBuffer(),
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
      });

      expect(result.suggestedFilename).toMatch(/^[a-z0-9_-]+_\d{4}-\d{2}-\d{2}\.[a-z]+$/i);
    });

    it('should not include an extension when no fileName is provided', async () => {
      const result = await service.classify({
        buffer: makePdfBuffer(),
        mimeType: 'application/pdf',
      });

      // Filename without extension should still be valid
      expect(result.suggestedFilename).toMatch(/^[a-z0-9_-]+_\d{4}-\d{2}-\d{2}$/i);
    });
  });
});
