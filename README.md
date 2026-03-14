# CloudOrganiser

AI-based system to organize files and folders in cloud storage systems.

## Overview

This is a Node.js + TypeScript backend for a SaaS platform that intelligently organises files across multiple cloud storage providers. It features a multi-agent pipeline with AI-powered file classification, a webhook-driven event system, and connectors for Google Drive and Microsoft OneDrive.

## Features

- ✅ **Express.js** with TypeScript
- ✅ **Modular routing** architecture
- ✅ **Environment configuration** with validation using Joi
- ✅ **Logging** with Winston
- ✅ **Error handling** middleware with custom ApiError class
- ✅ **Security** with Helmet, CORS, and rate limiting
- ✅ **OAuth** for Google and Microsoft
- ✅ **Request validation** with Joi
- ✅ **Session management** with express-session
- ✅ **TypeScript** with strict mode enabled
- ✅ **ESLint** for code quality
- ✅ **Jest** for testing
- ✅ **AI-powered ClassifierAgent** with pluggable providers (OpenAI, Azure OpenAI, local)
- ✅ **WatcherAgent** for monitoring cloud storage via webhooks
- ✅ **EventBus** for inter-agent communication in the multi-agent pipeline
- ✅ **Google Drive connector** (OAuth2, file CRUD, change notifications)
- ✅ **OneDrive / SharePoint connector** (Microsoft Graph API, file CRUD, subscriptions)
- ✅ **Webhook endpoints** for Google Drive push notifications and OneDrive change notifications

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Getting Started

### 1. Installation

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set your configuration values:

```env
# Required
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Optional OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# Optional AI provider (defaults to built-in local classifier)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

### 3. Development

Start the development server with hot reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### 4. Build

Build the TypeScript project:

```bash
npm run build
```

### 5. Production

Run the production server:

```bash
npm start
```

## Project Structure

```
src/
├── agents/               # Multi-agent implementations
│   └── classifier.agent.ts      # AI-powered file classification agent
├── config/               # Configuration files
│   ├── index.ts          # Environment config with Joi validation
│   ├── logger.ts         # Winston logger configuration
│   └── passport.ts       # Passport OAuth strategies
├── connectors/           # Cloud storage connector implementations
│   └── google/
│       └── GoogleDriveConnector.ts  # Google Drive connector (Connector interface)
├── controllers/          # Request handlers
│   ├── auth.controller.ts
│   ├── health.controller.ts
│   └── webhook.controller.ts    # Webhook notification handlers
├── examples/             # Usage examples
│   └── watcher-agent-usage.ts   # WatcherAgent and EventBus examples
├── middleware/           # Express middleware
│   ├── ApiError.ts              # Custom error class
│   ├── asyncHandler.ts          # Async error wrapper
│   ├── errorHandler.ts          # Error handling middleware
│   ├── requestLogger.ts         # HTTP request logging
│   ├── validate.ts              # Request validation
│   └── index.ts                 # Middleware exports
├── providers/            # Pluggable AI provider implementations
│   ├── ai.factory.ts            # AIProviderFactory (creates providers from config)
│   ├── openai.provider.ts       # OpenAI (GPT-4, GPT-4o-mini, etc.)
│   ├── azure-openai.provider.ts # Azure OpenAI Service
│   └── local.provider.ts        # Local rule-based classifier (no API key required)
├── routes/               # API routes
│   ├── auth.routes.ts           # OAuth authentication routes
│   ├── health.routes.ts         # Health check routes
│   ├── webhook.routes.ts        # Webhook notification routes
│   └── index.ts                 # Route aggregator
├── services/             # Business logic services
│   ├── EventBus.ts              # Pub/sub event bus for inter-agent communication
│   ├── WatcherAgent.ts          # File change monitor (webhook-driven)
│   └── connectors/
│       └── onedrive.connector.ts  # OneDrive connector (CloudStorageConnector interface)
├── types/                # TypeScript type definitions
│   ├── agent.types.ts           # Agent interfaces (Watcher, Classifier, Renamer, etc.)
│   ├── ai.types.ts              # AI provider interfaces and config
│   ├── connector.types.ts       # Cloud connector interfaces
│   ├── context.types.ts         # FileContext, FileMetadata, FileLocation
│   ├── events.types.ts          # WebhookEvent, EventHandler, EventSubscription
│   ├── user.types.ts            # User and OAuth types
│   └── index.ts                 # Barrel re-export
├── utils/                # Utility functions
│   └── fileContentExtractor.ts  # Extracts readable content from files
├── app.ts                # Express app setup
└── index.ts              # Application entry point
```

## API Endpoints

### Health Check

- **GET** `/api/v1/health` - Health check endpoint

### Authentication (OAuth)

- **GET** `/api/v1/auth/google` - Initiate Google OAuth flow
- **GET** `/api/v1/auth/google/callback` - Google OAuth callback
- **GET** `/api/v1/auth/microsoft` - Initiate Microsoft OAuth flow
- **GET** `/api/v1/auth/microsoft/callback` - Microsoft OAuth callback
- **GET** `/api/v1/auth/me` - Get current authenticated user
- **POST** `/api/v1/auth/logout` - Logout user

### Webhooks

- **POST** `/api/v1/webhooks/google-drive` - Receive Google Drive push notifications
- **POST** `/api/v1/webhooks/onedrive` - Receive OneDrive change notifications (also handles validation token)
- **POST** `/api/v1/webhooks/subscriptions/google` - Create a Google Drive webhook subscription
- **POST** `/api/v1/webhooks/subscriptions/onedrive` - Create an OneDrive webhook subscription
- **DELETE** `/api/v1/webhooks/subscriptions/:subscriptionId` - Remove a webhook subscription
- **GET** `/api/v1/webhooks/subscriptions` - List all active webhook subscriptions

## Multi-Agent Pipeline

The system is designed as a multi-agent pipeline. File changes detected via webhooks flow through the pipeline using the internal EventBus:

```
Cloud Provider (Google Drive / OneDrive)
    ↓ webhook notification
WatcherAgent
    ↓ publishes to EventBus
ClassifierAgent  →  (future) RenamerAgent  →  (future) FolderAgent  →  (future) PolicyAgent
```

See `src/examples/watcher-agent-usage.ts` for working usage examples.

## AI Classification

The `ClassifierAgent` classifies files using a pluggable AI provider. See `docs/ClassifierAgent.md` for full documentation.

### Quick Start (local model — no API key needed)

```typescript
import { ClassifierAgent } from './agents/classifier.agent';

const agent = new ClassifierAgent();
await agent.initializeFromEnv(); // uses AI_PROVIDER from config (defaults to 'local')

const result = await agent.execute(fileContext);
```

### AI Provider Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | Provider: `openai`, `azure-openai`, or `local` | `local` |
| `AI_API_KEY` | API key (required for `openai` / `azure-openai`) | — |
| `AI_ENDPOINT` | Azure endpoint URL (required for `azure-openai`) | — |
| `AI_MODEL` | Model or deployment name | provider default |
| `AI_MAX_TOKENS` | Max tokens per request | `1000` |
| `AI_TEMPERATURE` | Sampling temperature (0–2) | `0.3` |
| `AI_TIMEOUT` | Request timeout in ms | `30000` |
| `AI_RETRY_ATTEMPTS` | Retry attempts on failure | `3` |

## OAuth Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/v1/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### Microsoft OAuth

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register a new application in Azure AD
3. Add a redirect URI: `http://localhost:3000/api/v1/auth/microsoft/callback`
4. Create a client secret
5. Copy Application (client) ID and client secret to `.env`

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm test` - Run tests with Jest
- `npm run test:watch` - Run tests in watch mode

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | Server port | `3000` | No |
| `API_VERSION` | API version prefix | `v1` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `CORS_ORIGIN` | CORS origin | `*` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | No |
| `SESSION_SECRET` | Session encryption key | — | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | — | No |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | — | No |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID | — | No |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth secret | — | No |
| `MICROSOFT_CALLBACK_URL` | Microsoft OAuth callback | — | No |
| `AI_PROVIDER` | AI provider type | `local` | No |
| `AI_API_KEY` | AI API key | — | No |
| `AI_ENDPOINT` | Azure OpenAI endpoint | — | No |
| `AI_MODEL` | AI model / deployment name | — | No |
| `AI_MAX_TOKENS` | Max tokens per AI request | `1000` | No |
| `AI_TEMPERATURE` | AI sampling temperature | `0.3` | No |
| `AI_TIMEOUT` | AI request timeout (ms) | `30000` | No |
| `AI_RETRY_ATTEMPTS` | AI request retry attempts | `3` | No |

## Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

See the [LICENSE](LICENSE) file for details.
