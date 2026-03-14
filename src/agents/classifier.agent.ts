// ClassifierAgent implementation using pluggable AI providers
import {
  ClassifierAgent as IClassifierAgent,
  FileClassification,
  AgentResult,
} from '../types/agent.types';
import { FileContext } from '../types/context.types';
import {
  AIProvider,
  AIProviderConfig,
  AIClassificationRequest,
  AIProviderError,
} from '../types/ai.types';
import { FileContentExtractor } from '../utils/fileContentExtractor';
import { AIProviderFactory } from '../providers/ai.factory';

/**
 * ClassifierAgentConfig represents configuration for the ClassifierAgent
 */
export interface ClassifierAgentConfig {
  aiProvider?: AIProvider;
  aiProviderConfig?: AIProviderConfig;
  extractContent?: boolean;
  maxContentLength?: number;
}

/**
 * ClassifierAgent analyzes files and categorizes them using AI
 * Supports PDF, DOCX, images, and text files
 * Uses pluggable AI provider pattern (OpenAI, Azure OpenAI, local model)
 */
export class ClassifierAgent implements IClassifierAgent {
  private aiProvider?: AIProvider;
  private extractContent: boolean;
  private maxContentLength: number;

  constructor(config?: ClassifierAgentConfig) {
    this.aiProvider = config?.aiProvider;
    this.extractContent = config?.extractContent !== false; // Default to true
    this.maxContentLength = config?.maxContentLength || 5000;
  }

  /**
   * Initialize the classifier agent with an AI provider
   * @param config - AI provider configuration
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    this.aiProvider = await AIProviderFactory.createProvider(config);
  }

  /**
   * Initialize from environment variables
   */
  async initializeFromEnv(): Promise<void> {
    this.aiProvider = await AIProviderFactory.createFromEnv();
  }

  /**
   * Execute file classification
   * @param context - The file context to classify
   * @returns Promise resolving to classification results
   */
  async execute(context: FileContext): Promise<AgentResult<FileClassification>> {
    try {
      // Validate input
      if (!context.name || !context.metadata) {
        return {
          success: false,
          error: 'Invalid file context: missing name or metadata',
        };
      }

      // Check if AI provider is initialized
      if (!this.aiProvider || !this.aiProvider.isReady()) {
        return {
          success: false,
          error: 'AI provider not initialized. Call initialize() or initializeFromEnv() first.',
        };
      }

      // Extract content if enabled
      let content: string | undefined;
      if (this.extractContent && context.content) {
        try {
          content = await FileContentExtractor.getFileSummary(context);

          // Limit content length
          if (content.length > this.maxContentLength) {
            content = content.substring(0, this.maxContentLength) + '\n... (truncated)';
          }
        } catch (error) {
          // Continue without content if extraction fails
          content = undefined;
        }
      }

      // Build classification request
      const classificationRequest: AIClassificationRequest = {
        fileName: context.name,
        mimeType: context.metadata.mimeType,
        fileSize: context.metadata.size,
        content,
        metadata: {
          extension: context.metadata.extension,
          createdAt: context.metadata.createdAt.toISOString(),
          modifiedAt: context.metadata.modifiedAt.toISOString(),
          provider: context.location.provider,
          path: context.location.fullPath,
        },
      };

      // Call AI provider
      const aiResponse = await this.aiProvider.classify(classificationRequest);

      // Build classification result
      const classification: FileClassification = {
        categories: aiResponse.categories,
        tags: aiResponse.tags,
        confidence: aiResponse.confidence,
        suggestedFolder: aiResponse.suggestedFolder,
        contentType: aiResponse.contentType,
        isPII: aiResponse.isPII,
        language: aiResponse.language,
      };

      return {
        success: true,
        data: classification,
        metadata: {
          provider: this.aiProvider.getName(),
          timestamp: new Date().toISOString(),
          reasoning: aiResponse.reasoning,
        },
      };
    } catch (error) {
      // Handle errors
      if (error instanceof AIProviderError) {
        return {
          success: false,
          error: `AI Provider Error (${error.provider}): ${error.message}`,
          metadata: {
            provider: error.provider,
            originalError: error.originalError?.message,
          },
        };
      }

      return {
        success: false,
        error: `Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get the current AI provider
   */
  getProvider(): AIProvider | undefined {
    return this.aiProvider;
  }

  /**
   * Check if the agent is ready to classify files
   */
  isReady(): boolean {
    return this.aiProvider !== undefined && this.aiProvider.isReady();
  }
}
