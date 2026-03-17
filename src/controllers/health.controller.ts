// Health check controller
import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  const timestamp = new Date().toISOString();

  // Check database connectivity
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : String(err);
    logger.error('Health check: database connection failed', { error: dbError });
  }

  const healthy = dbStatus === 'ok';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'success' : 'error',
    message: healthy ? 'Server is running' : 'Service degraded',
    timestamp,
    checks: {
      database: {
        status: dbStatus,
        ...(dbError && { error: dbError }),
      },
    },
  });
};

// Liveness probe – confirms the process is alive (no dependency checks)
export const livenessCheck = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};

// Readiness probe – confirms the app can handle traffic (checks dependencies)
export const readinessCheck = async (_req: Request, res: Response): Promise<void> => {
  let dbReady = true;
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbReady = false;
    dbError = err instanceof Error ? err.message : String(err);
  }

  if (dbReady) {
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      reason: dbError,
    });
  }
};
