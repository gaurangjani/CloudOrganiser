// Environment configuration management
import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

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

  // OAuth - Google
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().allow('').optional(),

  // OAuth - Microsoft
  MICROSOFT_CLIENT_ID: Joi.string().allow('').optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().allow('').optional(),
  MICROSOFT_CALLBACK_URL: Joi.string().allow('').optional(),
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
};
