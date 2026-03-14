// Error handling middleware
import { Request, Response, NextFunction } from 'express';
import { ApiError } from './ApiError';
import { logger } from '../config/logger';
import { config } from '../config';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log error
  if (!isOperational || statusCode === 500) {
    logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
    logger.error(err.stack || err);
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
  }

  const response: {
    status: string;
    statusCode: number;
    message: string;
    stack?: string;
  } = {
    status: 'error',
    statusCode,
    message,
  };

  // Include stack trace in development
  if (config.env === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// Handle 404 errors
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};
