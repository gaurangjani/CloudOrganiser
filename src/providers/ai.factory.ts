// AI Provider Factory
import { AIProvider, AIProviderConfig, AIProviderError } from '../types/ai.types';
import { OpenAIProvider } from './openai.provider';
import { AzureOpenAIProvider } from './azure-openai.provider';
import { LocalModelProvider } from './local.provider';

/**
 * AIProviderFactory creates and initializes AI providers
 */
export class AIProviderFactory {
  /**
   * Create and initialize an AI provider based on configuration
   * @param config - The provider configuration
   * @returns Promise resolving to an initialized AI provider
   */
  static async createProvider(config: AIProviderConfig): Promise<AIProvider> {
    let provider: AIProvider;

    switch (config.provider) {
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
        throw new AIProviderError(`Unsupported provider type: ${config.provider}`, 'factory');
    }

    await provider.initialize(config);

    if (!provider.isReady()) {
      throw new AIProviderError(`Provider ${config.provider} failed to initialize`, 'factory');
    }

    return provider;
  }

  /**
   * Create a provider from environment variables
   * @returns Promise resolving to an initialized AI provider
   */
  static async createFromEnv(): Promise<AIProvider> {
    const providerType = (process.env.AI_PROVIDER || 'local') as AIProviderConfig['provider'];

    const config: AIProviderConfig = {
      provider: providerType,
      apiKey: process.env.AI_API_KEY,
      endpoint: process.env.AI_ENDPOINT,
      model: process.env.AI_MODEL,
      maxTokens: process.env.AI_MAX_TOKENS ? parseInt(process.env.AI_MAX_TOKENS) : undefined,
      temperature: process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : undefined,
      timeout: process.env.AI_TIMEOUT ? parseInt(process.env.AI_TIMEOUT) : undefined,
      retryAttempts: process.env.AI_RETRY_ATTEMPTS ? parseInt(process.env.AI_RETRY_ATTEMPTS) : undefined,
    };

    return this.createProvider(config);
  }
}
