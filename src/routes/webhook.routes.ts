// Webhook routes for handling cloud provider notifications
import { Router } from 'express';
import {
  handleGoogleDriveWebhook,
  handleOneDriveWebhook,
  createGoogleDriveSubscription,
  createOneDriveSubscription,
  deleteWebhookSubscription,
  getActiveSubscriptions,
} from '../controllers/webhook.controller';
import { asyncHandler } from '../middleware';

const router = Router();

// Google Drive webhook endpoints
router.post('/google-drive', asyncHandler(handleGoogleDriveWebhook));
router.post('/google-drive/subscribe', asyncHandler(createGoogleDriveSubscription));

// OneDrive webhook endpoints
router.post('/onedrive', asyncHandler(handleOneDriveWebhook));
router.post('/onedrive/subscribe', asyncHandler(createOneDriveSubscription));

// General webhook management endpoints
router.get('/subscriptions', asyncHandler(getActiveSubscriptions));
router.delete('/subscriptions/:subscriptionId', asyncHandler(deleteWebhookSubscription));

export default router;
