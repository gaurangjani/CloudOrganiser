# ClassifierAgent Documentation

The ClassifierAgent is an AI-powered file classification system that analyzes files and categorizes them based on type, content, and metadata. It supports multiple file formats including PDF, DOCX, images, and text files, and uses a pluggable AI provider pattern.

## Features

- **Multi-format Support**: Handles PDF, DOCX, images (JPEG, PNG, GIF, WebP), and text files
- **Pluggable AI Providers**: Supports OpenAI, Azure OpenAI, and local models
- **Content Analysis**: Extracts and analyzes file content for accurate classification
- **PII Detection**: Identifies files that may contain Personal Identifiable Information
- **Language Detection**: Detects the language of text content
- **Smart Categorization**: Provides categories, tags, and suggested folder structure
- **Confidence Scoring**: Returns confidence level for each classification

## Architecture

### AI Provider Pattern

The system uses a pluggable provider pattern that allows you to swap AI models without changing the core classification logic:

```
ClassifierAgent
    ↓ uses
AIProvider Interface
    ↓ implemented by
├── OpenAIProvider (GPT-4, GPT-4o-mini, etc.)
├── AzureOpenAIProvider (Azure OpenAI Service)
└── LocalModelProvider (Local ML models)
```

## Installation

The ClassifierAgent is part of the CloudOrganiser system. All dependencies are already included in the project.

## Configuration

### Environment Variables

Configure the AI provider using environment variables:

```bash
# Provider type: 'openai', 'azure-openai', or 'local'
AI_PROVIDER=openai

# API credentials (required for OpenAI and Azure)
AI_API_KEY=your-api-key-here

# Azure OpenAI specific (required for Azure)
AI_ENDPOINT=https://your-resource.openai.azure.com

# Model/deployment name
AI_MODEL=gpt-4o-mini

# Optional parameters
AI_MAX_TOKENS=1000
AI_TEMPERATURE=0.3
AI_TIMEOUT=30000
AI_RETRY_ATTEMPTS=3
```

### Provider-Specific Configuration

#### OpenAI

```typescript
import { ClassifierAgent } from './agents/classifier.agent';

const agent = new ClassifierAgent();

await agent.initialize({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini', // or 'gpt-4', 'gpt-3.5-turbo'
  maxTokens: 1000,
  temperature: 0.3,
});
```

#### Azure OpenAI

```typescript
await agent.initialize({
  provider: 'azure-openai',
  apiKey: 'your-azure-key',
  endpoint: 'https://your-resource.openai.azure.com',
  model: 'your-deployment-name', // Azure deployment name
  maxTokens: 1000,
  temperature: 0.3,
});
```

#### Local Model

```typescript
await agent.initialize({
  provider: 'local',
  model: 'basic-classifier', // Local model name
});
```

## Usage

### Basic Example

```typescript
import { ClassifierAgent } from './agents/classifier.agent';
import { FileContext } from './types/context.types';

// Create and initialize the agent
const agent = new ClassifierAgent();

// Option 1: Initialize from environment variables
await agent.initializeFromEnv();

// Option 2: Initialize with explicit configuration
await agent.initialize({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
});

// Create a file context
const fileContext: FileContext = {
  id: 'file-123',
  name: 'invoice_2024.pdf',
  metadata: {
    size: 2048,
    mimeType: 'application/pdf',
    createdAt: new Date(),
    modifiedAt: new Date(),
    extension: 'pdf',
  },
  location: {
    provider: 'google',
    path: '/documents',
    parentPath: '/',
    fullPath: '/documents/invoice_2024.pdf',
  },
  userId: 'user-456',
  content: Buffer.from('...'), // Optional: file content
};

// Classify the file
const result = await agent.execute(fileContext);

if (result.success) {
  console.log('Categories:', result.data.categories);
  console.log('Tags:', result.data.tags);
  console.log('Confidence:', result.data.confidence);
  console.log('Suggested Folder:', result.data.suggestedFolder);
  console.log('Content Type:', result.data.contentType);
  console.log('Contains PII:', result.data.isPII);
  console.log('Language:', result.data.language);
} else {
  console.error('Classification failed:', result.error);
}
```

### Advanced Configuration

```typescript
// Create agent with custom options
const agent = new ClassifierAgent({
  extractContent: true, // Enable content extraction (default: true)
  maxContentLength: 5000, // Maximum content length to analyze (default: 5000)
});

// Use a custom AI provider instance
import { OpenAIProvider } from './providers/openai.provider';

const customProvider = new OpenAIProvider();
await customProvider.initialize({
  provider: 'openai',
  apiKey: 'your-key',
  model: 'gpt-4',
  temperature: 0.5, // More creative classifications
  maxTokens: 2000,
});

const agent = new ClassifierAgent({
  aiProvider: customProvider,
});
```

### Using the Factory Pattern

```typescript
import { AIProviderFactory } from './providers/ai.factory';
import { ClassifierAgent } from './agents/classifier.agent';

// Create provider from environment
const provider = await AIProviderFactory.createFromEnv();

// Or create with explicit config
const provider = await AIProviderFactory.createProvider({
  provider: 'azure-openai',
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  model: 'gpt-4',
});

// Use with classifier
const agent = new ClassifierAgent({ aiProvider: provider });
```

## Classification Result

The `FileClassification` object returned contains:

```typescript
{
  categories: string[];        // High-level categories (e.g., "financial", "legal", "personal")
  tags: string[];              // Specific tags (e.g., "invoice", "contract", "report")
  confidence: number;          // Confidence score (0-1)
  suggestedFolder?: string;    // Suggested file path
  contentType: string;         // "document", "image", "video", "audio", "code", "data", "other"
  isPII?: boolean;            // Whether file contains PII
  language?: string;          // ISO 639-1 language code (e.g., "en", "es")
}
```

### Example Result

```json
{
  "categories": ["financial", "work"],
  "tags": ["invoice", "tax", "expense"],
  "confidence": 0.92,
  "suggestedFolder": "/documents/financial/invoices",
  "contentType": "document",
  "isPII": true,
  "language": "en"
}
```

## Supported File Types

### Documents
- PDF (`.pdf`) - `application/pdf`
- Microsoft Word (`.docx`, `.doc`) - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### Images
- JPEG (`.jpg`, `.jpeg`) - `image/jpeg`
- PNG (`.png`) - `image/png`
- GIF (`.gif`) - `image/gif`
- WebP (`.webp`) - `image/webp`
- SVG (`.svg`) - `image/svg+xml`

### Text Files
- Plain text (`.txt`) - `text/plain`
- HTML (`.html`) - `text/html`
- CSS (`.css`) - `text/css`
- JavaScript (`.js`) - `text/javascript`
- JSON (`.json`) - `application/json`
- XML (`.xml`) - `application/xml`

### Code Files
Automatically detected by extension: `.js`, `.ts`, `.py`, `.java`, `.cpp`, `.c`, `.go`, `.rs`, `.rb`

## Error Handling

The agent returns a structured result with success/error information:

```typescript
const result = await agent.execute(fileContext);

if (!result.success) {
  console.error('Error:', result.error);

  // Check metadata for additional details
  if (result.metadata?.provider) {
    console.error('Failed provider:', result.metadata.provider);
  }

  if (result.metadata?.originalError) {
    console.error('Original error:', result.metadata.originalError);
  }
}
```

Common errors:
- AI provider not initialized
- Invalid file context
- API rate limiting
- Network timeouts
- Invalid API credentials

## Testing

Run the test suite:

```bash
npm test
```

Run specific tests:

```bash
npm test classifier.agent.test.ts
npm test ai.providers.test.ts
```

## Best Practices

1. **Initialize Once**: Create and initialize the agent once, then reuse it for multiple classifications
2. **Content Extraction**: Enable content extraction for better accuracy, but be mindful of file sizes
3. **Error Handling**: Always check the `success` field before using the result
4. **Rate Limiting**: Implement rate limiting when using cloud AI providers
5. **Caching**: Consider caching results for unchanged files
6. **Local Development**: Use the local provider during development to avoid API costs

## Performance Considerations

- **Content Length**: Limit content to 5000 characters for faster processing
- **Batch Processing**: Process multiple files in parallel when possible
- **Provider Choice**:
  - Local provider: Fast, no API costs, but less accurate
  - OpenAI: Most accurate, moderate cost
  - Azure OpenAI: Enterprise-grade, customizable

## Extending the System

### Adding a New AI Provider

1. Implement the `AIProvider` interface:

```typescript
import { AIProvider, AIProviderConfig, AIClassificationRequest, AIClassificationResponse } from './types/ai.types';

export class CustomProvider implements AIProvider {
  async initialize(config: AIProviderConfig): Promise<void> {
    // Initialize your provider
  }

  async classify(request: AIClassificationRequest): Promise<AIClassificationResponse> {
    // Implement classification logic
  }

  isReady(): boolean {
    return true;
  }

  getName(): string {
    return 'Custom Provider';
  }
}
```

2. Add it to the factory in `ai.factory.ts`:

```typescript
case 'custom':
  provider = new CustomProvider();
  break;
```

### Customizing Classification Logic

The local provider uses rule-based heuristics. You can extend `LocalModelProvider` to add custom rules or integrate with actual ML models like TensorFlow.js or ONNX Runtime.

## License

Part of the CloudOrganiser project.
