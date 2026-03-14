// AI Provider Factory
import { AIProvider, AIProviderConfig, AIProviderError } from '../types/ai.types';
import { OpenAIProvider } from './openai.provider';
import { AzureOpenAIProvider } from './azure-openai.provider';
import { LocalModelProvider } from './local.provider';
import { config } from '../config';

/**
 * AIProviderFactory creates and initializes AI providers
 */
export class AIProviderFactory {
  /**
   * Create and initialize an AI provider based on configuration
   * @param config - The provider configuration
   * @returns Promise resolving to an initialized AI provider
   */
  static async createProvider(providerConfig: AIProviderConfig): Promise<AIProvider> {
    let provider: AIProvider;

    switch (providerConfig.provider) {
      case 'openai':
        provider = new OpenAIProvider();
        break;

      case 'azure-openai':
        provider = new AzureOpenAIProvider();
        break;

      case 'local':
        provider = new LocalModelProvider();
        break;

      default:
        throw new AIProviderError(`Unsupported provider type: ${providerConfig.provider}`, 'factory');
    }

    await provider.initialize(providerConfig);

    if (!provider.isReady()) {
      throw new AIProviderError(`Provider ${providerConfig.provider} failed to initialize`, 'factory');
    }

    return provider;
  }

  /**
   * Create a provider from application configuration (validated environment variables)
   * @returns Promise resolving to an initialized AI provider
   */
  static async createFromEnv(): Promise<AIProvider> {
    const aiConfig: AIProviderConfig = {
      provider: config.ai.provider,
      apiKey: config.ai.apiKey,
      endpoint: config.ai.endpoint,
      model: config.ai.model,
      maxTokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      timeout: config.ai.timeout,
      retryAttempts: config.ai.retryAttempts,
    };

    return this.createProvider(aiConfig);
  }
}
