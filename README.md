# CloudOrganiser

AI-based system to organize files and folders in cloud storage systems.

## Overview

This is a Node.js + TypeScript backend skeleton for a SaaS platform with Express API setup, environment configuration, logging middleware, error handling middleware, and modular routing. The project is prepared for OAuth integrations with Microsoft and Google.

## Features

- ✅ **Express.js** with TypeScript
- ✅ **Modular routing** architecture
- ✅ **Environment configuration** with validation using Joi
- ✅ **Logging** with Winston
- ✅ **Error handling** middleware with custom ApiError class
- ✅ **Security** with Helmet, CORS, and rate limiting
- ✅ **OAuth preparation** for Google and Microsoft
- ✅ **Request validation** with Joi
- ✅ **Session management** with express-session
- ✅ **TypeScript** with strict mode enabled
- ✅ **ESLint** for code quality
- ✅ **Jest** for testing

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
├── config/           # Configuration files
│   ├── index.ts      # Environment config with Joi validation
│   ├── logger.ts     # Winston logger configuration
│   └── passport.ts   # Passport OAuth strategies
├── controllers/      # Request handlers
│   ├── auth.controller.ts
│   └── health.controller.ts
├── middleware/       # Express middleware
│   ├── ApiError.ts          # Custom error class
│   ├── asyncHandler.ts      # Async error wrapper
│   ├── errorHandler.ts      # Error handling middleware
│   ├── requestLogger.ts     # HTTP request logging
│   ├── validate.ts          # Request validation
│   └── index.ts             # Middleware exports
├── routes/           # API routes
│   ├── auth.routes.ts       # OAuth authentication routes
│   ├── health.routes.ts     # Health check routes
│   └── index.ts             # Route aggregator
├── services/         # Business logic (empty, ready for implementation)
├── types/            # TypeScript type definitions
│   └── user.types.ts        # User and OAuth types
├── utils/            # Utility functions (empty, ready for implementation)
├── app.ts            # Express app setup
└── index.ts          # Application entry point
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

## OAuth Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
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

## Middleware

### Request Logger

Logs all HTTP requests with method, path, status code, and response time using Winston.

### Error Handler

Catches and formats all errors consistently:
- Operational errors (expected) with appropriate status codes
- Programming errors logged with full stack trace
- Development mode includes stack traces in responses

### Async Handler

Wraps async route handlers to automatically catch errors and pass them to error handling middleware.

### Validation

Validates request body against Joi schemas before reaching controllers.

## Adding New Routes

1. Create a controller in `src/controllers/`:

```typescript
// src/controllers/example.controller.ts
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware';

export const exampleHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.json({ message: 'Example response' });
  }
);
```

2. Create routes in `src/routes/`:

```typescript
// src/routes/example.routes.ts
import { Router } from 'express';
import { exampleHandler } from '../controllers/example.controller';

const router = Router();
router.get('/', exampleHandler);

export default router;
```

3. Register in `src/routes/index.ts`:

```typescript
import exampleRoutes from './example.routes';
router.use(`${apiPrefix}/example`, exampleRoutes);
```

## Security Features

- **Helmet**: Sets secure HTTP headers
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: Request validation with Joi
- **Session Security**: Secure session configuration with httpOnly cookies

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| NODE_ENV | Environment mode | development | No |
| PORT | Server port | 3000 | No |
| API_VERSION | API version prefix | v1 | No |
| LOG_LEVEL | Logging level | info | No |
| CORS_ORIGIN | CORS origin | * | No |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 900000 | No |
| RATE_LIMIT_MAX_REQUESTS | Max requests per window | 100 | No |
| SESSION_SECRET | Session encryption key | - | Yes |
| GOOGLE_CLIENT_ID | Google OAuth client ID | - | No |
| GOOGLE_CLIENT_SECRET | Google OAuth secret | - | No |
| GOOGLE_CALLBACK_URL | Google OAuth callback | - | No |
| MICROSOFT_CLIENT_ID | Microsoft OAuth client ID | - | No |
| MICROSOFT_CLIENT_SECRET | Microsoft OAuth secret | - | No |
| MICROSOFT_CALLBACK_URL | Microsoft OAuth callback | - | No |

## Testing

Run tests:

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
