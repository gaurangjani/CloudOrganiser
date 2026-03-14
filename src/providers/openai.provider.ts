// OpenAI provider implementation
import {
  AIProvider,
  AIProviderConfig,
  AIClassificationRequest,
  AIClassificationResponse,
  AIProviderError,
} from '../types/ai.types';

/**
 * OpenAIProvider implements the AIProvider interface for OpenAI's API
 */
export class OpenAIProvider implements AIProvider {
  private config?: AIProviderConfig;
  private ready = false;

  async initialize(config: AIProviderConfig): Promise<void> {
    if (config.provider !== 'openai') {
      throw new AIProviderError('Invalid provider type for OpenAIProvider', 'openai');
    }

    if (!config.apiKey) {
      throw new AIProviderError('API key is required for OpenAI provider', 'openai');
    }

    this.config = {
      ...config,
      endpoint: config.endpoint || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.3,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
    };

    this.ready = true;
  }

  async classify(request: AIClassificationRequest): Promise<AIClassificationResponse> {
    if (!this.ready || !this.config) {
      throw new AIProviderError('OpenAI provider not initialized', 'openai');
    }

    const prompt = this.buildClassificationPrompt(request);

    try {
      const response = await this.callOpenAI(prompt);
      return this.parseClassificationResponse(response);
    } catch (error) {
      throw new AIProviderError(
        `OpenAI classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai',
        error instanceof Error ? error : undefined
      );
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getName(): string {
    return 'OpenAI';
  }

  /**
   * Build the classification prompt for OpenAI
   */
  private buildClassificationPrompt(request: AIClassificationRequest): string {
    const { fileName, mimeType, fileSize, content, metadata } = request;

    return `You are a file classification expert. Analyze the following file and provide a detailed classification.

File Information:
- Name: ${fileName}
- MIME Type: ${mimeType}
- Size: ${fileSize} bytes
${metadata ? `- Additional Metadata: ${JSON.stringify(metadata)}` : ''}

${content ? `Content Preview:\n${content.substring(0, 3000)}` : 'No content available for analysis.'}

Please provide a classification in the following JSON format:
{
  "categories": ["category1", "category2"],
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "suggestedFolder": "/path/to/suggested/folder",
  "contentType": "document|image|video|audio|code|data|other",
  "isPII": false,
  "language": "en",
  "reasoning": "Brief explanation of classification"
}

Categories should be high-level (e.g., "work", "personal", "financial", "legal", "medical", "education").
Tags should be specific and descriptive (e.g., "invoice", "contract", "report", "presentation").
Confidence should be between 0 and 1.
Set isPII to true if the file likely contains Personal Identifiable Information.
Language should be ISO 639-1 code (e.g., "en", "es", "fr") or null if not applicable.

Respond ONLY with the JSON object, no additional text.`;
  }

  /**
   * Call the OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.config) {
      throw new AIProviderError('Configuration not set', 'openai');
    }

    const url = `${this.config.endpoint}/chat/completions`;

    const requestBody = {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a file classification expert that responds only with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      response_format: { type: 'json_object' },
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= (this.config.retryAttempts || 1); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await response.json()) as any;

        if (!data.choices || !data.choices[0]?.message?.content) {
          throw new Error('Invalid response format from OpenAI API');
        }

        return data.choices[0].message.content;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < (this.config.retryAttempts || 1)) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Failed to call OpenAI API');
  }

  /**
   * Parse the classification response from OpenAI
   */
  private parseClassificationResponse(response: string): AIClassificationResponse {
    try {
      const parsed = JSON.parse(response);

      // Validate required fields
      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error('Missing or invalid categories');
      }

      if (!parsed.tags || !Array.isArray(parsed.tags)) {
        throw new Error('Missing or invalid tags');
      }

      if (typeof parsed.confidence !== 'number') {
        throw new Error('Missing or invalid confidence');
      }

      if (!parsed.contentType) {
        throw new Error('Missing contentType');
      }

      return {
        categories: parsed.categories,
        tags: parsed.tags,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        suggestedFolder: parsed.suggestedFolder || undefined,
        contentType: parsed.contentType,
        isPII: parsed.isPII || false,
        language: parsed.language || undefined,
        reasoning: parsed.reasoning || undefined,
      };
    } catch (error) {
      throw new AIProviderError(
        `Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'openai',
        error instanceof Error ? error : undefined
      );
    }
  }
}
