// Application entry point
import app from './app';
import { config } from './config';
import { logger } from './config/logger';
import { prisma } from './config/prisma';

const startServer = async (): Promise<void> => {
  try {
    // Create logs directory if it doesn't exist
    const fs = await import('fs');
    const path = await import('path');
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Cloud Organiser API Server                             ║
║                                                           ║
║   Environment: ${config.env.padEnd(43)}║
║   Port: ${config.port.toString().padEnd(50)}║
║   API Version: ${config.apiVersion.padEnd(43)}║
║                                                           ║
║   Health Check: http://localhost:${config.port}/api/${config.apiVersion}/health     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);

      if (config.oauth.google.clientId) {
        logger.info('✓ Google OAuth configured');
      } else {
        logger.warn('✗ Google OAuth not configured');
      }

      if (config.oauth.microsoft.clientId) {
        logger.info('✓ Microsoft OAuth configured');
      } else {
        logger.warn('✗ Microsoft OAuth not configured');
      }
    });

    // Graceful shutdown – give in-flight requests time to complete before
    // closing the database connection.  Azure Container Apps sends SIGTERM
    // when scaling down or redeploying; the default termination grace period
    // is 30 seconds which is more than enough for most workloads.
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received: starting graceful shutdown`);

      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
        } catch (err) {
          logger.error('Error closing database connection:', err);
        }
        process.exit(0);
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Graceful shutdown timed out; forcing exit');
        process.exit(1);
      }, 25_000).unref();
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
