// Application entry point
import app from './app';
import { config } from './config';
import { logger } from './config/logger';

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
    app.listen(config.port, () => {
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
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
