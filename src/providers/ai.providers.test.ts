// Tests for AI Providers
import { LocalModelProvider } from '../providers/local.provider';
import { AIProviderError } from '../types/ai.types';

describe('AI Providers', () => {
  describe('LocalModelProvider', () => {
    it('should initialize successfully', async () => {
      const provider = new LocalModelProvider();

      await provider.initialize({
        provider: 'local',
        model: 'test-model',
      });

      expect(provider.isReady()).toBe(true);
      expect(provider.getName()).toBe('Local Model');
    });

    it('should throw error for invalid provider type', async () => {
      const provider = new LocalModelProvider();

      await expect(
        provider.initialize({
          provider: 'openai' as any,
        })
      ).rejects.toThrow(AIProviderError);
    });

    it('should classify a PDF file', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      });

      expect(result).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.tags).toBeDefined();
      expect(Array.isArray(result.tags)).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.contentType).toBe('document');
    });

    it('should classify an image file', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        fileSize: 4096,
      });

      expect(result.contentType).toBe('image');
      expect(result.categories).toContain('media');
      expect(result.tags).toContain('image');
    });

    it('should classify a video file', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        fileSize: 10240,
      });

      expect(result.contentType).toBe('video');
      expect(result.categories).toContain('media');
    });

    it('should classify a code file', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'script.js',
        mimeType: 'text/javascript',
        fileSize: 512,
      });

      expect(result.contentType).toBe('code');
      expect(result.categories).toContain('code');
    });

    it('should detect invoice files', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'invoice_2024.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      });

      expect(result.tags).toContain('invoice');
      expect(result.categories).toContain('financial');
    });

    it('should detect contract files', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'employment_contract.pdf',
        mimeType: 'application/pdf',
        fileSize: 3072,
      });

      expect(result.tags).toContain('contract');
      expect(result.categories).toContain('legal');
    });

    it('should detect PII in content', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const contentWithPII = 'SSN: 123-45-6789, Email: test@example.com';

      const result = await provider.classify({
        fileName: 'personal_info.txt',
        mimeType: 'text/plain',
        fileSize: contentWithPII.length,
        content: contentWithPII,
      });

      expect(result.isPII).toBe(true);
    });

    it('should detect language in content', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const englishContent = 'This is a test document with English content that should be detected.';

      const result = await provider.classify({
        fileName: 'document.txt',
        mimeType: 'text/plain',
        fileSize: englishContent.length,
        content: englishContent,
      });

      expect(result.language).toBe('en');
    });

    it('should suggest folders based on file type', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
      });

      expect(result.suggestedFolder).toBeDefined();
      expect(result.suggestedFolder).toContain('/documents');
    });

    it('should throw error when not initialized', async () => {
      const provider = new LocalModelProvider();

      await expect(
        provider.classify({
          fileName: 'test.pdf',
          mimeType: 'application/pdf',
          fileSize: 1024,
        })
      ).rejects.toThrow(AIProviderError);
    });

    it('should have at least one category', async () => {
      const provider = new LocalModelProvider();
      await provider.initialize({ provider: 'local' });

      const result = await provider.classify({
        fileName: 'unknown.xyz',
        mimeType: 'application/octet-stream',
        fileSize: 1024,
      });

      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.tags.length).toBeGreaterThan(0);
    });
  });

  // Note: OpenAI and Azure OpenAI provider tests would require actual API keys
  // or mocked HTTP responses. For now, we test the local provider which doesn't
  // require external dependencies.
});
