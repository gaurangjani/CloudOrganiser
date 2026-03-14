// Webhook controller for handling cloud provider notifications
import { Request, Response } from 'express';
import { watcherAgent } from '../services/WatcherAgent';
import { logger } from '../config/logger';
import { ApiError } from '../middleware/ApiError';

/**
 * Handle Google Drive webhook notifications
 */
export const handleGoogleDriveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received Google Drive webhook notification', {
      headers: req.headers,
      body: req.body,
    });

    // Verify the webhook notification
    // Google Drive uses X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Resource-State headers
    const channelId = req.headers['x-goog-channel-id'];
    const resourceId = req.headers['x-goog-resource-id'];
    const resourceState = req.headers['x-goog-resource-state'];

    if (!channelId || !resourceId) {
      throw ApiError.badRequest('Missing required webhook headers');
    }

    logger.debug('Google Drive webhook headers', { channelId, resourceId, resourceState });

    // Handle sync message (initial verification)
    if (resourceState === 'sync') {
      logger.info('Google Drive webhook sync message received');
      res.status(200).send('OK');
      return;
    }

    // Process the webhook notification
    const fileContexts = await watcherAgent.processWebhookNotification('google', {
      channelId,
      resourceId,
      resourceState,
      headers: req.headers,
      body: req.body,
    });

    logger.info('Google Drive webhook processed', {
      fileCount: fileContexts.length,
      channelId,
    });

    res.status(200).json({
      success: true,
      processed: fileContexts.length,
    });
  } catch (error) {
    logger.error('Error handling Google Drive webhook', { error });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};

/**
 * Handle Microsoft OneDrive webhook notifications
 */
export const handleOneDriveWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received OneDrive webhook notification', {
      headers: req.headers,
      body: req.body,
    });

    // Handle validation request
    // OneDrive sends a validation token on subscription creation
    if (req.query.validationToken) {
      const validationToken = req.query.validationToken as string;
      logger.info('OneDrive webhook validation request', { validationToken });

      // Respond with the validation token in plain text
      res.status(200).type('text/plain').send(validationToken);
      return;
    }

    // Verify the webhook notification
    const clientState = req.body?.clientState;
    if (!clientState) {
      throw ApiError.badRequest('Missing clientState in webhook payload');
    }

    logger.debug('OneDrive webhook payload', { clientState });

    // Process the webhook notification
    const notifications = req.body?.value || [];
    let totalProcessed = 0;

    for (const notification of notifications) {
      const fileContexts = await watcherAgent.processWebhookNotification('microsoft', {
        notification,
        clientState,
        headers: req.headers,
      });

      totalProcessed += fileContexts.length;
    }

    logger.info('OneDrive webhook processed', {
      notificationCount: notifications.length,
      fileCount: totalProcessed,
    });

    res.status(202).json({
      success: true,
      processed: totalProcessed,
    });
  } catch (error) {
    logger.error('Error handling OneDrive webhook', { error });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};

/**
 * Create a webhook subscription for Google Drive
 */
export const createGoogleDriveSubscription = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, resourceId, callbackUrl } = req.body;

    if (!userId || !resourceId || !callbackUrl) {
      throw ApiError.badRequest('Missing required parameters: userId, resourceId, callbackUrl');
    }

    logger.info('Creating Google Drive webhook subscription', { userId, resourceId });

    const subscription = await watcherAgent.subscribeToWebhook(
      'google',
      userId,
      resourceId,
      callbackUrl
    );

    res.status(201).json({
      success: true,
      subscription,
    });
  } catch (error) {
    logger.error('Error creating Google Drive subscription', { error });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};

/**
 * Create a webhook subscription for OneDrive
 */
export const createOneDriveSubscription = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, resourceId, callbackUrl } = req.body;

    if (!userId || !resourceId || !callbackUrl) {
      throw ApiError.badRequest('Missing required parameters: userId, resourceId, callbackUrl');
    }

    logger.info('Creating OneDrive webhook subscription', { userId, resourceId });

    const subscription = await watcherAgent.subscribeToWebhook(
      'microsoft',
      userId,
      resourceId,
      callbackUrl
    );

    res.status(201).json({
      success: true,
      subscription,
    });
  } catch (error) {
    logger.error('Error creating OneDrive subscription', { error });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};

/**
 * Delete a webhook subscription
 */
export const deleteWebhookSubscription = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      throw ApiError.badRequest('Missing subscriptionId parameter');
    }

    logger.info('Deleting webhook subscription', { subscriptionId });

    const success = await watcherAgent.unsubscribeFromWebhook(subscriptionId);

    if (!success) {
      throw ApiError.notFound('Subscription not found');
    }

    res.status(200).json({
      success: true,
      message: 'Subscription deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting webhook subscription', { error });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
};

/**
 * Get all active webhook subscriptions
 */
export const getActiveSubscriptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Fetching active webhook subscriptions');

    const subscriptions = watcherAgent.getActiveSubscriptions();

    res.status(200).json({
      success: true,
      subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    logger.error('Error fetching active subscriptions', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
