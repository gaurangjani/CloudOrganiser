// Tests for ClassifierAgent
import { ClassifierAgent } from '../agents/classifier.agent';
import { FileContext, FileMetadata, FileLocation } from '../types/context.types';
import { AIProvider, AIClassificationRequest, AIClassificationResponse } from '../types/ai.types';

describe('ClassifierAgent', () => {
  // Mock AI Provider
  class MockAIProvider implements AIProvider {
    private initialized = false;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async initialize(_config: any): Promise<void> {
      this.initialized = true;
    }

    async classify(request: AIClassificationRequest): Promise<AIClassificationResponse> {
      // Return mock classification based on file type
      const categories = ['documents'];
      const tags = ['test', request.mimeType.split('/')[0]];

      return {
        categories,
        tags,
        confidence: 0.85,
        suggestedFolder: '/documents/test',
        contentType: request.mimeType.startsWith('image/') ? 'image' : 'document',
        isPII: false,
        language: 'en',
        reasoning: 'Mock classification for testing',
      };
    }

    isReady(): boolean {
      return this.initialized;
    }

    getName(): string {
      return 'Mock Provider';
    }
  }

  // Helper to create mock FileContext
  function createMockFileContext(overrides?: Partial<FileContext>): FileContext {
    const metadata: FileMetadata = {
      size: 1024,
      mimeType: 'application/pdf',
      createdAt: new Date(),
      modifiedAt: new Date(),
      extension: 'pdf',
      ...overrides?.metadata,
    };

    const location: FileLocation = {
      provider: 'google',
      path: '/documents',
      parentPath: '/',
      fullPath: '/documents/test.pdf',
      ...overrides?.location,
    };

    return {
      id: 'test-file-123',
      name: 'test.pdf',
      metadata,
      location,
      userId: 'user-456',
      ...overrides,
    };
  }

  describe('Initialization', () => {
    it('should create a ClassifierAgent with default config', () => {
      const agent = new ClassifierAgent();
      expect(agent).toBeDefined();
      expect(agent.isReady()).toBe(false);
    });

    it('should create a ClassifierAgent with custom config', () => {
      const mockProvider = new MockAIProvider();
      const agent = new ClassifierAgent({
        aiProvider: mockProvider,
        extractContent: false,
        maxContentLength: 1000,
      });

      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe(mockProvider);
    });

    it('should initialize with a provider', async () => {
      const mockProvider = new MockAIProvider();
      await mockProvider.initialize({
        provider: 'local',
      });

      const agent = new ClassifierAgent({ aiProvider: mockProvider });
      expect(agent.isReady()).toBe(true);
    });
  });

  describe('Classification', () => {
    let agent: ClassifierAgent;
    let mockProvider: MockAIProvider;

    beforeEach(async () => {
      mockProvider = new MockAIProvider();
      await mockProvider.initialize({ provider: 'local' });
      agent = new ClassifierAgent({ aiProvider: mockProvider });
    });

    it('should successfully classify a PDF file', async () => {
      const context = createMockFileContext({
        name: 'invoice.pdf',
        metadata: {
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date(),
          modifiedAt: new Date(),
          extension: 'pdf',
        },
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.categories).toContain('documents');
      expect(result.data?.confidence).toBeGreaterThan(0);
      expect(result.data?.contentType).toBeDefined();
      expect(result.metadata?.provider).toBe('Mock Provider');
    });

    it('should successfully classify a DOCX file', async () => {
      const context = createMockFileContext({
        name: 'report.docx',
        metadata: {
          size: 4096,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          createdAt: new Date(),
          modifiedAt: new Date(),
          extension: 'docx',
        },
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.confidence).toBeGreaterThan(0);
    });

    it('should successfully classify an image file', async () => {
      const context = createMockFileContext({
        name: 'photo.jpg',
        metadata: {
          size: 8192,
          mimeType: 'image/jpeg',
          createdAt: new Date(),
          modifiedAt: new Date(),
          extension: 'jpg',
        },
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.contentType).toBe('image');
    });

    it('should successfully classify a text file', async () => {
      const context = createMockFileContext({
        name: 'notes.txt',
        metadata: {
          size: 512,
          mimeType: 'text/plain',
          createdAt: new Date(),
          modifiedAt: new Date(),
          extension: 'txt',
        },
        content: 'This is a test text file with some content.',
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.tags).toBeDefined();
      expect(Array.isArray(result.data?.tags)).toBe(true);
    });

    it('should handle files without content', async () => {
      const context = createMockFileContext({
        content: undefined,
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error when provider is not initialized', async () => {
      const uninitializedAgent = new ClassifierAgent();
      const context = createMockFileContext();

      const result = await uninitializedAgent.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('AI provider not initialized');
    });

    it('should return error for invalid file context', async () => {
      const invalidContext = {
        id: 'test',
        name: '',
        userId: 'user-123',
      } as FileContext;

      const result = await agent.execute(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file context');
    });
  });

  describe('Content Extraction', () => {
    it('should extract content when enabled', async () => {
      const mockProvider = new MockAIProvider();
      await mockProvider.initialize({ provider: 'local' });

      const agent = new ClassifierAgent({
        aiProvider: mockProvider,
        extractContent: true,
      });

      const context = createMockFileContext({
        content: 'Test file content',
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
    });

    it('should skip content extraction when disabled', async () => {
      const mockProvider = new MockAIProvider();
      await mockProvider.initialize({ provider: 'local' });

      const agent = new ClassifierAgent({
        aiProvider: mockProvider,
        extractContent: false,
      });

      const context = createMockFileContext({
        content: 'Test file content',
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
    });

    it('should truncate long content', async () => {
      const mockProvider = new MockAIProvider();
      await mockProvider.initialize({ provider: 'local' });

      const agent = new ClassifierAgent({
        aiProvider: mockProvider,
        extractContent: true,
        maxContentLength: 100,
      });

      const longContent = 'A'.repeat(10000);
      const context = createMockFileContext({
        content: longContent,
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      // Mock provider that throws errors
      class ErrorProvider implements AIProvider {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async initialize(_config: any): Promise<void> {
          // initialized
        }

        async classify(): Promise<AIClassificationResponse> {
          throw new Error('Provider error');
        }

        isReady(): boolean {
          return true;
        }

        getName(): string {
          return 'Error Provider';
        }
      }

      const errorProvider = new ErrorProvider();
      await errorProvider.initialize({ provider: 'local' });

      const agent = new ClassifierAgent({ aiProvider: errorProvider });
      const context = createMockFileContext();

      const result = await agent.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Provider Management', () => {
    it('should return the current provider', async () => {
      const mockProvider = new MockAIProvider();
      await mockProvider.initialize({ provider: 'local' });

      const agent = new ClassifierAgent({ aiProvider: mockProvider });

      expect(agent.getProvider()).toBe(mockProvider);
    });

    it('should report not ready when provider is not set', () => {
      const agent = new ClassifierAgent();
      expect(agent.isReady()).toBe(false);
    });

    it('should report ready when provider is initialized', async () => {
      const mockProvider = new MockAIProvider();
      await mockProvider.initialize({ provider: 'local' });

      const agent = new ClassifierAgent({ aiProvider: mockProvider });

      expect(agent.isReady()).toBe(true);
    });
  });
});
