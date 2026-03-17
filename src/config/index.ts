// Environment configuration management
import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';
import { AI_PROVIDER_TYPES, AIProviderType } from '../types/ai.types';
import { OCR_PROVIDER_TYPES, OCRProviderType } from '../types/ocr.types';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Define configuration schema
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_VERSION: Joi.string().default('v1'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),

  // CORS
  CORS_ORIGIN: Joi.string().default('*'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Session
  SESSION_SECRET: Joi.string().required(),

  // Token encryption (AES-256-GCM key for storing OAuth tokens at rest)
  TOKEN_ENCRYPTION_KEY: Joi.string().min(16).required(),

  // OAuth - Google
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().allow('').optional(),

  // OAuth - Microsoft
  MICROSOFT_CLIENT_ID: Joi.string().allow('').optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().allow('').optional(),
  MICROSOFT_CALLBACK_URL: Joi.string().allow('').optional(),

  // AI Provider
  AI_PROVIDER: Joi.string().valid(...AI_PROVIDER_TYPES).default('local'),
  AI_API_KEY: Joi.string().allow('').optional(),
  AI_ENDPOINT: Joi.string().allow('').optional(),
  AI_MODEL: Joi.string().allow('').optional(),
  AI_MAX_TOKENS: Joi.number().optional(),
  AI_TEMPERATURE: Joi.number().min(0).max(2).optional(),
  AI_TIMEOUT: Joi.number().optional(),
  AI_RETRY_ATTEMPTS: Joi.number().optional(),

  // OCR Provider
  OCR_PROVIDER: Joi.string().valid(...OCR_PROVIDER_TYPES).default('tesseract'),
  OCR_API_KEY: Joi.string().allow('').optional(),
  OCR_ENDPOINT: Joi.string().allow('').optional(),
  OCR_LANGUAGE: Joi.string().allow('').optional(),
  OCR_TIMEOUT: Joi.number().optional(),
})
  .unknown()
  .required();

// Validate environment variables
const { error, value: envVars } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV as string,
  port: envVars.PORT as number,
  apiVersion: envVars.API_VERSION as string,

  logging: {
    level: envVars.LOG_LEVEL as string,
  },

  cors: {
    origin: envVars.CORS_ORIGIN as string,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  },

  session: {
    secret: envVars.SESSION_SECRET as string,
  },

  tokenEncryptionKey: envVars.TOKEN_ENCRYPTION_KEY as string,

  oauth: {
    google: {
      clientId: envVars.GOOGLE_CLIENT_ID as string,
      clientSecret: envVars.GOOGLE_CLIENT_SECRET as string,
      callbackUrl: envVars.GOOGLE_CALLBACK_URL as string,
    },
    microsoft: {
      clientId: envVars.MICROSOFT_CLIENT_ID as string,
      clientSecret: envVars.MICROSOFT_CLIENT_SECRET as string,
      callbackUrl: envVars.MICROSOFT_CALLBACK_URL as string,
    },
  },

  ai: {
    provider: envVars.AI_PROVIDER as AIProviderType,
    apiKey: envVars.AI_API_KEY as string | undefined,
    endpoint: envVars.AI_ENDPOINT as string | undefined,
    model: envVars.AI_MODEL as string | undefined,
    maxTokens: envVars.AI_MAX_TOKENS as number | undefined,
    temperature: envVars.AI_TEMPERATURE as number | undefined,
    timeout: envVars.AI_TIMEOUT as number | undefined,
    retryAttempts: envVars.AI_RETRY_ATTEMPTS as number | undefined,
  },

  ocr: {
    provider: envVars.OCR_PROVIDER as OCRProviderType,
    apiKey: envVars.OCR_API_KEY as string | undefined,
    endpoint: envVars.OCR_ENDPOINT as string | undefined,
    language: envVars.OCR_LANGUAGE as string | undefined,
    timeout: envVars.OCR_TIMEOUT as number | undefined,
  },
};

/**
 * OAuth 2.0 scopes requested from Microsoft.
 * Shared between the Passport strategy and the token-refresh call so they
 * stay in sync if the required permissions change.
 */
export const MICROSOFT_OAUTH_SCOPES = [
  'offline_access',
  'user.read',
  'Files.Read',
  'Files.ReadWrite',
  'Files.Read.All',
] as const;
