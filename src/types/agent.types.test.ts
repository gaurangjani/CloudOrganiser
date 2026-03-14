// Tests for agent and context type definitions
import {
  Agent,
  AgentResult,
  WatcherAgent,
  ClassifierAgent,
  RenamerAgent,
  FolderAgent,
  PolicyAgent,
  LearningAgent,
  FileClassification,
  FileRenameResult,
  FolderOperation,
  PolicyCheckResult,
  LearningInsight,
} from '../types/agent.types';
import {
  FileContext,
  FileMetadata,
  FileLocation,
  DirectoryContext,
} from '../types/context.types';

describe('Type Definitions', () => {
  describe('FileContext', () => {
    it('should create a valid FileContext object', () => {
      const metadata: FileMetadata = {
        size: 1024,
        mimeType: 'application/pdf',
        createdAt: new Date(),
        modifiedAt: new Date(),
        extension: 'pdf',
      };

      const location: FileLocation = {
        provider: 'google',
        path: '/documents',
        parentPath: '/',
        fullPath: '/documents/test.pdf',
      };

      const context: FileContext = {
        id: 'file-123',
        name: 'test.pdf',
        metadata,
        location,
        userId: 'user-456',
        tags: ['important', 'work'],
        categories: ['documents'],
      };

      expect(context.id).toBe('file-123');
      expect(context.name).toBe('test.pdf');
      expect(context.metadata.size).toBe(1024);
      expect(context.location.provider).toBe('google');
      expect(context.userId).toBe('user-456');
    });
  });

  describe('AgentResult', () => {
    it('should create a successful agent result', () => {
      const result: AgentResult<string> = {
        success: true,
        data: 'test-data',
        metadata: { timestamp: new Date().toISOString() },
      };

      expect(result.success).toBe(true);
      expect(result.data).toBe('test-data');
      expect(result.metadata).toBeDefined();
    });

    it('should create a failed agent result', () => {
      const result: AgentResult = {
        success: false,
        error: 'Operation failed',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation failed');
    });
  });

  describe('Agent Interfaces', () => {
    // Mock FileContext for testing
    const mockFileContext: FileContext = {
      id: 'test-file',
      name: 'document.pdf',
      metadata: {
        size: 2048,
        mimeType: 'application/pdf',
        createdAt: new Date(),
        modifiedAt: new Date(),
        extension: 'pdf',
      },
      location: {
        provider: 'google',
        path: '/test',
        parentPath: '/',
        fullPath: '/test/document.pdf',
      },
      userId: 'user-123',
    };

    describe('WatcherAgent', () => {
      it('should implement execute method returning FileContext array', async () => {
        const watcherAgent: WatcherAgent = {
          execute: async (context: FileContext): Promise<AgentResult<FileContext[]>> => {
            return {
              success: true,
              data: [context],
            };
          },
        };

        const result = await watcherAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      });
    });

    describe('ClassifierAgent', () => {
      it('should implement execute method returning FileClassification', async () => {
        const classifierAgent: ClassifierAgent = {
          execute: async (_context: FileContext): Promise<AgentResult<FileClassification>> => {
            const classification: FileClassification = {
              categories: ['documents', 'work'],
              tags: ['pdf', 'important'],
              confidence: 0.95,
              contentType: 'document',
              suggestedFolder: '/work/documents',
            };
            return {
              success: true,
              data: classification,
            };
          },
        };

        const result = await classifierAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(result.data?.categories).toContain('documents');
        expect(result.data?.confidence).toBeGreaterThan(0);
      });
    });

    describe('RenamerAgent', () => {
      it('should implement execute method returning FileRenameResult', async () => {
        const renamerAgent: RenamerAgent = {
          execute: async (context: FileContext): Promise<AgentResult<FileRenameResult>> => {
            const renameResult: FileRenameResult = {
              originalName: context.name,
              suggestedName: 'Work_Document_2024.pdf',
              reason: 'Standardized naming convention',
              confidence: 0.9,
              applied: false,
            };
            return {
              success: true,
              data: renameResult,
            };
          },
        };

        const result = await renamerAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(result.data?.originalName).toBe('document.pdf');
        expect(result.data?.suggestedName).toBeDefined();
      });
    });

    describe('FolderAgent', () => {
      it('should implement execute method returning FolderOperation', async () => {
        const folderAgent: FolderAgent = {
          execute: async (context: FileContext): Promise<AgentResult<FolderOperation>> => {
            const operation: FolderOperation = {
              action: 'move',
              sourcePath: context.location.fullPath,
              targetPath: '/organized/documents/document.pdf',
              folderCreated: true,
              timestamp: new Date(),
            };
            return {
              success: true,
              data: operation,
            };
          },
        };

        const result = await folderAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(result.data?.action).toBe('move');
        expect(result.data?.targetPath).toBeDefined();
      });
    });

    describe('PolicyAgent', () => {
      it('should implement execute method returning PolicyCheckResult', async () => {
        const policyAgent: PolicyAgent = {
          execute: async (_context: FileContext): Promise<AgentResult<PolicyCheckResult>> => {
            const checkResult: PolicyCheckResult = {
              compliant: true,
              violations: [],
              warnings: [],
              recommendations: ['Consider adding metadata'],
            };
            return {
              success: true,
              data: checkResult,
            };
          },
        };

        const result = await policyAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(result.data?.compliant).toBe(true);
        expect(Array.isArray(result.data?.violations)).toBe(true);
      });

      it('should return policy violations when non-compliant', async () => {
        const policyAgent: PolicyAgent = {
          execute: async (_context: FileContext): Promise<AgentResult<PolicyCheckResult>> => {
            const checkResult: PolicyCheckResult = {
              compliant: false,
              violations: [
                {
                  policyId: 'naming-001',
                  policyName: 'Naming Convention',
                  severity: 'medium',
                  description: 'File name does not follow convention',
                  remediation: 'Rename file using standard format',
                },
              ],
              warnings: ['File size exceeds recommended limit'],
              recommendations: ['Add version number to filename'],
            };
            return {
              success: true,
              data: checkResult,
            };
          },
        };

        const result = await policyAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(result.data?.compliant).toBe(false);
        expect(result.data?.violations.length).toBeGreaterThan(0);
      });
    });

    describe('LearningAgent', () => {
      it('should implement execute method returning LearningInsight', async () => {
        const learningAgent: LearningAgent = {
          execute: async (_context: FileContext): Promise<AgentResult<LearningInsight>> => {
            const insight: LearningInsight = {
              patterns: [
                {
                  type: 'organization',
                  description: 'User prefers organizing PDFs by date',
                  frequency: 15,
                  lastObserved: new Date(),
                },
              ],
              adaptations: [
                {
                  ruleId: 'org-001',
                  previousBehavior: 'Organize by type',
                  newBehavior: 'Organize by date then type',
                  reason: 'User consistently reorganizes files by date',
                  appliedAt: new Date(),
                },
              ],
              confidence: 0.85,
              sampleSize: 20,
            };
            return {
              success: true,
              data: insight,
            };
          },
        };

        const result = await learningAgent.execute(mockFileContext);
        expect(result.success).toBe(true);
        expect(result.data?.patterns).toBeDefined();
        expect(result.data?.adaptations).toBeDefined();
        expect(result.data?.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('DirectoryContext', () => {
    it('should create a valid DirectoryContext object', () => {
      const dirContext: DirectoryContext = {
        id: 'dir-123',
        name: 'Documents',
        path: '/documents',
        parentPath: '/',
        createdAt: new Date(),
        modifiedAt: new Date(),
        fileCount: 42,
        totalSize: 1024000,
        userId: 'user-456',
      };

      expect(dirContext.id).toBe('dir-123');
      expect(dirContext.name).toBe('Documents');
      expect(dirContext.fileCount).toBe(42);
    });
  });

  describe('Agent Base Interface', () => {
    it('should allow generic agent implementation', async () => {
      interface CustomResult {
        message: string;
      }

      const mockContext: FileContext = {
        id: 'test-file',
        name: 'document.pdf',
        metadata: {
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date(),
          modifiedAt: new Date(),
          extension: 'pdf',
        },
        location: {
          provider: 'google',
          path: '/test',
          parentPath: '/',
          fullPath: '/test/document.pdf',
        },
        userId: 'user-123',
      };

      const customAgent: Agent<CustomResult> = {
        execute: async (context: FileContext): Promise<AgentResult<CustomResult>> => {
          return {
            success: true,
            data: {
              message: `Processed file: ${context.name}`,
            },
          };
        },
      };

      const result = await customAgent.execute(mockContext);
      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('document.pdf');
    });
  });
});
