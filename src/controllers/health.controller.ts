// Health check controller
import { Request, Response } from 'express';

export const healthCheck = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
};
