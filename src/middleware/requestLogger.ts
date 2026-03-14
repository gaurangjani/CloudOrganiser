// Logging middleware for HTTP requests
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  // Log request
  logger.http(`Incoming ${req.method} ${req.path}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(
      `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
};
