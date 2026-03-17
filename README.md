# ☁️ CloudOrganiser

> **An open-source, multi-cloud AI file organiser SaaS platform**

CloudOrganiser is a Node.js + TypeScript backend that intelligently organises files across multiple cloud storage providers using a multi-agent AI pipeline. It monitors file changes via webhooks, classifies files with pluggable AI models, evaluates custom organisation rules, and routes files to the right folders automatically — all with zero manual effort.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  - [1. Installation](#1-installation)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. OAuth Setup](#3-oauth-setup)
  - [4. Development Server](#4-development-server)
  - [5. Build & Production](#5-build--production)
- [API Endpoints](#api-endpoints)
- [Environment Variables Reference](#environment-variables-reference)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🤖 Multi-Agent AI Pipeline

- **WatcherAgent** — monitors Google Drive and OneDrive for file changes via real-time webhooks
- **ClassifierAgent** — classifies files by type, content, language, PII status, and suggested folder using a pluggable AI provider
- **PolicyAgent** — enforces organisational rules using a modular, priority-ordered rules engine
- **EventBus** — lightweight pub/sub system for decoupled, asynchronous agent-to-agent communication

### 🧠 Pluggable AI Providers

- **OpenAI** (GPT-4, GPT-4o-mini, etc.) — cloud-based, highest accuracy
- **Azure OpenAI** — enterprise-grade, privately hosted models
- **Local rule-based classifier** — zero API cost, works offline, ideal for development

### 🗂️ Modular Rules Engine

- Five rule handler types: `file_type`, `content`, `naming`, `folder_routing`, `ai_assisted`
- Priority-ordered evaluation with early-exit support
- In-memory rules repository (pluggable via `RulesRepository` interface)
- MongoDB-backed persistence via `rule.model.ts`

### ☁️ Multi-Cloud Connectors

- **Google Drive** — OAuth2 authentication, full file CRUD, change notification subscriptions
- **Microsoft OneDrive / SharePoint** — Microsoft Graph API, full file CRUD, webhook subscriptions

### 🔗 Webhook Integration

- Google Drive push notifications
- OneDrive change notifications with validation token handshake
- Subscription management (create, list, delete)

### 🔐 Security & Infrastructure

- **Helmet** — HTTP security headers
- **CORS** with configurable origin allowlist
- **Rate limiting** via `express-rate-limit`
- **Session management** with `express-session`
- **OAuth 2.0** for Google and Microsoft (via Passport.js strategies)
- **Joi** schema validation for all environment config and request bodies
- **Winston** structured logging with configurable log level

### 🛠️ Developer Experience

- TypeScript with strict mode and full type coverage
- ESLint with `@typescript-eslint` rules
- Jest test suite with coverage reporting
- `nodemon` hot-reload development server

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloud Providers                          │
│          Google Drive                  Microsoft OneDrive       │
└──────────────┬──────────────────────────────┬───────────────────┘
               │  webhook notification        │  webhook notification
               ▼                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Express.js API Server                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │ Auth Routes │  │Health Routes │  │   Webhook Routes     │     │
│  └─────────────┘  └──────────────┘  └──────────┬───────────┘     │
└────────────────────────────────────────────────┼─────────────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  WatcherAgent    │
                                        │ (change monitor) │
                                        └────────┬─────────┘
                                                 │ publish(FILE_CHANGED)
                                                 ▼
                                        ┌──────────────────┐
                                        │    EventBus      │
                                        │  (pub/sub core)  │
                                        └────────┬─────────┘
                                                 │ subscribe
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  ▼
                   ┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐
                   │ ClassifierAgent │ │  PolicyAgent     │ │  (future agents) │
                   │  AI categories  │ │  Rules engine    │ │  Renamer, Folder │
                   │  tags, PII, lang│ │  5 handler types │ │  Deduper, etc.   │
                   └────────┬────────┘ └──────────────────┘ └──────────────────┘
                            │
               ┌────────────┴─────────────┐
               ▼                          ▼
   ┌───────────────────────┐  ┌─────────────────────────┐
   │   AI Providers        │  │   Cloud Connectors      │
   │  ┌─────────────────┐  │  │  ┌──────────────────┐   │
   │  │ OpenAIProvider  │  │  │  │GoogleDriveConn.  │   │
   │  │ AzureOpenAIProv.│  │  │  │OneDriveConnector │   │
   │  │ LocalProvider   │  │  │  └──────────────────┘   │
   │  └─────────────────┘  │  └─────────────────────────┘
   └───────────────────────┘
```

### Key Design Decisions

| Concern | Approach |
|---------|----------|
| Agent communication | `EventBus` pub/sub (loose coupling, async) |
| AI extensibility | `AIProvider` interface + factory pattern |
| Rules extensibility | `RulesRepository` interface + typed handlers |
| Cloud extensibility | `Connector` / `CloudStorageConnector` interfaces |
| Config safety | Joi schema validation at startup |
| Error propagation | `ApiError` class + global `errorHandler` middleware |

---

## Project Structure

```
CloudOrganiser-/
├── docs/
│   └── ClassifierAgent.md        # ClassifierAgent full documentation
├── src/
│   ├── agents/
│   │   ├── classifier.agent.ts   # AI-powered file classification agent
│   │   └── policy.agent.ts       # Policy enforcement agent (rules engine)
│   ├── config/
│   │   ├── index.ts              # Joi-validated environment config
│   │   ├── logger.ts             # Winston logger setup
│   │   └── passport.ts           # OAuth strategies (Google + Microsoft)
│   ├── connectors/
│   │   └── google/
│   │       └── GoogleDriveConnector.ts  # Google Drive (Connector interface)
│   ├── controllers/
│   │   ├── auth.controller.ts    # OAuth flow handlers
│   │   ├── health.controller.ts  # Health check handler
│   │   └── webhook.controller.ts # Webhook notification handlers
│   ├── examples/
│   │   └── watcher-agent-usage.ts  # End-to-end pipeline usage examples
│   ├── middleware/
│   │   ├── ApiError.ts           # Custom HTTP error class
│   │   ├── asyncHandler.ts       # Async route wrapper
│   │   ├── errorHandler.ts       # Global error handling middleware
│   │   ├── requestLogger.ts      # HTTP request logging middleware
│   │   ├── validate.ts           # Joi request validation middleware
│   │   └── index.ts              # Middleware barrel export
│   ├── models/
│   │   └── rule.model.ts         # Mongoose Rule model for persistence
│   ├── providers/
│   │   ├── ai.factory.ts         # AIProviderFactory (config → provider)
│   │   ├── openai.provider.ts    # OpenAI provider
│   │   ├── azure-openai.provider.ts  # Azure OpenAI provider
│   │   └── local.provider.ts     # Local rule-based provider (no API key)
│   ├── routes/
│   │   ├── auth.routes.ts        # /api/v1/auth/* routes
│   │   ├── health.routes.ts      # /api/v1/health routes
│   │   ├── webhook.routes.ts     # /api/v1/webhooks/* routes
│   │   └── index.ts              # Route aggregator
│   ├── services/
│   │   ├── EventBus.ts           # Pub/sub event bus
│   │   ├── WatcherAgent.ts       # Webhook-driven file change monitor
│   │   ├── RuleEvaluator.ts      # Central rule orchestrator
│   │   ├── connectors/
│   │   │   └── onedrive.connector.ts  # OneDrive (CloudStorageConnector interface)
│   │   └── rules/
│   │       ├── RuleEvaluator.ts        # Modular rules engine
│   │       ├── InMemoryRulesRepository.ts  # Default in-memory storage
│   │       ├── index.ts                # Rules barrel export
│   │       └── handlers/
│   │           ├── FileTypeRuleHandler.ts
│   │           ├── ContentRuleHandler.ts
│   │           ├── NamingRuleHandler.ts
│   │           ├── FolderRoutingRuleHandler.ts
│   │           ├── AIAssistedRuleHandler.ts
│   │           └── conditionUtils.ts
│   ├── storage/
│   │   └── rule.storage.ts       # RuleStorage interface implementation
│   ├── types/
│   │   ├── agent.types.ts        # Agent interfaces (Watcher, Classifier, etc.)
│   │   ├── ai.types.ts           # AI provider interfaces and config
│   │   ├── connector.types.ts    # Cloud connector interfaces
│   │   ├── context.types.ts      # FileContext, FileMetadata, FileLocation
│   │   ├── events.types.ts       # WebhookEvent, EventHandler, EventSubscription
│   │   ├── rules.types.ts        # Rule and RulesEngine types
│   │   ├── user.types.ts         # User and OAuth token types
│   │   └── index.ts              # Barrel re-export
│   ├── utils/
│   │   ├── fileContentExtractor.ts  # Extracts readable text from files
│   │   └── uuid.ts               # UUID utility
│   ├── app.ts                    # Express app setup and middleware registration
│   └── index.ts                  # Application entry point
├── .env.example                  # Environment variable template
├── .eslintrc.json                # ESLint configuration
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Jest global setup (mock credentials)
├── package.json
└── tsconfig.json
```

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| [Node.js](https://nodejs.org/) | >= 18.0.0 |
| npm | >= 9.0.0 (bundled with Node.js 18) |
| [MongoDB](https://www.mongodb.com/) | >= 6.0 (optional, for rule persistence) |

> **No cloud accounts are required to run the platform locally.** The local AI provider and in-memory rules repository work completely offline.

---

## Setup Instructions

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/gaurangjani/CloudOrganiser.git
cd CloudOrganiser
npm install
```

### 2. Environment Configuration

Copy the example environment file and populate your values:

```bash
cp .env.example .env
```

Minimum required configuration to start the server:

```env
# Required — change in production!
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Optional: connect to MongoDB for rule persistence
# MONGODB_URI=mongodb://localhost:27017/cloudorganiser

# Optional: configure an AI provider (defaults to free local classifier)
AI_PROVIDER=local
```

See the full [Environment Variables Reference](#environment-variables-reference) table below for all available options.

### 3. OAuth Setup

OAuth credentials are **optional**. Skip this step if you only need the local AI classifier and rules engine.

#### Google OAuth (Google Drive)

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, then navigate to **APIs & Services → Credentials**.
3. Enable the **Google Drive API**.
4. Create an **OAuth 2.0 Client ID** (Application type: Web application).
5. Add an authorised redirect URI: `http://localhost:3000/api/v1/auth/google/callback`.
6. Copy the Client ID and Client Secret into `.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
```

#### Microsoft OAuth (OneDrive / SharePoint)

1. Open the [Azure Portal](https://portal.azure.com/).
2. Go to **Azure Active Directory → App registrations → New registration**.
3. Set the redirect URI to `http://localhost:3000/api/v1/auth/microsoft/callback`.
4. Under **Certificates & secrets**, generate a new client secret.
5. Copy the Application (client) ID and secret into `.env`:

```env
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:3000/api/v1/auth/microsoft/callback
```

### 4. Development Server

Start the development server with hot reload:

```bash
npm run dev
```

The API is available at `http://localhost:3000`.  
Health check: `GET http://localhost:3000/api/v1/health`

### 5. Build & Production

Compile TypeScript to JavaScript:

```bash
npm run build
```

Run the compiled production server:

```bash
npm start
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Initiate Google OAuth flow |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/auth/microsoft` | Initiate Microsoft OAuth flow |
| GET | `/auth/microsoft/callback` | Microsoft OAuth callback |
| GET | `/auth/me` | Get authenticated user info |
| POST | `/auth/logout` | Sign out and destroy session |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/google-drive` | Receive Google Drive push notifications |
| POST | `/webhooks/onedrive` | Receive OneDrive change notifications (also handles validation token) |
| POST | `/webhooks/subscriptions/google` | Create a Google Drive webhook subscription |
| POST | `/webhooks/subscriptions/onedrive` | Create an OneDrive webhook subscription |
| DELETE | `/webhooks/subscriptions/:subscriptionId` | Remove a webhook subscription |
| GET | `/webhooks/subscriptions` | List all active subscriptions |

---

## Multi-Agent Pipeline

File changes detected via webhooks flow through the agents using the internal `EventBus`:

```
Cloud Provider (Google Drive / OneDrive)
    │
    │  webhook notification
    ▼
WatcherAgent  ──publish(FILE_CHANGED)──▶  EventBus
                                              │
                     ┌────────────────────────┤
                     ▼                        ▼
              ClassifierAgent          PolicyAgent
              (AI categories,         (rules evaluation:
               tags, PII, lang,        file_type, content,
               suggestedFolder)        naming, folder_routing,
                                       ai_assisted)
                     │
                     ▼  (planned)
              RenamerAgent  ──▶  FolderAgent  ──▶  DeduplicatorAgent
```

See [`src/examples/watcher-agent-usage.ts`](src/examples/watcher-agent-usage.ts) for a full working example.

## AI Classification

The `ClassifierAgent` classifies files using pluggable AI providers. Full documentation is in [`docs/ClassifierAgent.md`](docs/ClassifierAgent.md).

### Quick Start (no API key required)

```typescript
import { ClassifierAgent } from './agents/classifier.agent';

const agent = new ClassifierAgent();
await agent.initializeFromEnv(); // defaults to 'local' provider

const result = await agent.execute(fileContext);
if (result.success) {
  console.log(result.data.categories);    // ['financial', 'work']
  console.log(result.data.suggestedFolder); // '/documents/financial/invoices'
  console.log(result.data.isPII);          // true
}
```

### AI Provider Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | `openai` \| `azure-openai` \| `local` | `local` |
| `AI_API_KEY` | API key (required for `openai` / `azure-openai`) | — |
| `AI_ENDPOINT` | Azure OpenAI endpoint (required for `azure-openai`) | — |
| `AI_MODEL` | Model or deployment name | provider default |
| `AI_MAX_TOKENS` | Max tokens per request | `1000` |
| `AI_TEMPERATURE` | Sampling temperature (0–2) | `0.3` |
| `AI_TIMEOUT` | Request timeout in ms | `30000` |
| `AI_RETRY_ATTEMPTS` | Retry attempts on transient failures | `3` |

---

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Runtime environment | `development` | No |
| `PORT` | HTTP server port | `3000` | No |
| `API_VERSION` | API version prefix | `v1` | No |
| `LOG_LEVEL` | Winston log level | `info` | No |
| `CORS_ORIGIN` | Allowed CORS origin | `*` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` | No |
| `SESSION_SECRET` | Session encryption secret | — | **Yes** |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | — | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | — | No |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect URI | — | No |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID | — | No |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret | — | No |
| `MICROSOFT_CALLBACK_URL` | Microsoft OAuth redirect URI | — | No |
| `AI_PROVIDER` | AI provider (`openai`, `azure-openai`, `local`) | `local` | No |
| `AI_API_KEY` | AI provider API key | — | No |
| `AI_ENDPOINT` | Azure OpenAI endpoint URL | — | No |
| `AI_MODEL` | Model / deployment name | — | No |
| `AI_MAX_TOKENS` | Max tokens per AI request | `1000` | No |
| `AI_TEMPERATURE` | AI sampling temperature | `0.3` | No |
| `AI_TIMEOUT` | AI request timeout (ms) | `30000` | No |
| `AI_RETRY_ATTEMPTS` | AI retry attempts | `3` | No |

---

## Testing

Run the full test suite with coverage:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

Run a specific test file:

```bash
npx jest src/agents/classifier.agent.test.ts
npx jest src/providers/ai.providers.test.ts
npx jest src/services/rules/RuleEvaluator.test.ts
```

### Lint

```bash
npm run lint          # check
npm run lint:fix      # auto-fix
```

---

## Contributing

Contributions are warmly welcomed! Please follow these steps:

### Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/CloudOrganiser.git
   cd CloudOrganiser
   npm install
   ```
3. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

### Development Guidelines

- **TypeScript** — all new code must be written in TypeScript with full type annotations; avoid `any` unless unavoidable.
- **ESLint** — run `npm run lint` before committing; the CI pipeline enforces zero lint errors.
- **Tests** — add or update Jest tests for every new feature or bug fix. Run `npm test` before opening a PR.
- **Commit messages** — use the [Conventional Commits](https://www.conventionalcommits.org/) format (e.g., `feat:`, `fix:`, `docs:`, `refactor:`).
- **One concern per PR** — keep pull requests focused on a single feature or fix.

### Extending the System

| Extension point | What to do |
|-----------------|------------|
| Add a new AI provider | Implement the `AIProvider` interface in `src/providers/`, register it in `ai.factory.ts` |
| Add a new rule handler | Implement a handler in `src/services/rules/handlers/`, register it in `RuleEvaluator` |
| Add a new cloud connector | Implement `Connector` or `CloudStorageConnector` in `src/connectors/` or `src/services/connectors/` |
| Add a new agent | Implement the `Agent<T>` interface in `src/agents/`, publish/subscribe via `EventBus` |
| Add a new API route | Add controller in `src/controllers/`, route in `src/routes/`, mount in `src/routes/index.ts` |

### Submitting a Pull Request

1. Push your branch to GitHub: `git push origin feat/your-feature-name`
2. Open a pull request against the `main` branch.
3. Fill in the PR template describing your changes, related issues, and how to test.
4. Wait for the CI checks to pass and address any review comments.

### Reporting Issues

Please open a [GitHub Issue](https://github.com/gaurangjani/CloudOrganiser/issues) with:
- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs actual behaviour
- Relevant logs or screenshots

---

## License

This project is licensed under the **ISC License** — see the [LICENSE](LICENSE) file for details.
