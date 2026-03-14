// Integration tests for webhook endpoints
import request from 'supertest';
import express, { Application } from 'express';
import webhookRoutes from '../routes/webhook.routes';
import { watcherAgent } from '../services/WatcherAgent';

// Mock the config to avoid validation errors
jest.mock('../config', () => ({
  config: {
    env: 'test',
    port: 3000,
    apiVersion: 'v1',
    logging: { level: 'info' },
    cors: { origin: '*' },
    rateLimit: { windowMs: 900000, maxRequests: 100 },
    session: { secret: 'test-secret' },
    oauth: {
      google: { clientId: '', clientSecret: '', callbackUrl: '' },
      microsoft: { clientId: '', clientSecret: '', callbackUrl: '' },
    },
  },
}));

// Mock the watcherAgent
jest.mock('../services/WatcherAgent', () => ({
  watcherAgent: {
    processWebhookNotification: jest.fn(),
    subscribeToWebhook: jest.fn(),
    unsubscribeFromWebhook: jest.fn(),
    getActiveSubscriptions: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Webhook Controller', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/webhooks', webhookRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/webhooks/google-drive', () => {
    it('should handle Google Drive sync message', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/google-drive')
        .set('x-goog-channel-id', 'channel-123')
        .set('x-goog-resource-id', 'resource-456')
        .set('x-goog-resource-state', 'sync')
        .send({});

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    it('should process Google Drive webhook notification', async () => {
      (watcherAgent.processWebhookNotification as jest.Mock).mockResolvedValue([
        { id: 'file-1', name: 'test.pdf' },
      ]);

      const response = await request(app)
        .post('/api/v1/webhooks/google-drive')
        .set('x-goog-channel-id', 'channel-123')
        .set('x-goog-resource-id', 'resource-456')
        .set('x-goog-resource-state', 'update')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        processed: 1,
      });
      expect(watcherAgent.processWebhookNotification).toHaveBeenCalledWith(
        'google',
        expect.objectContaining({
          channelId: 'channel-123',
          resourceId: 'resource-456',
          resourceState: 'update',
        })
      );
    });

    it('should return 400 for missing headers', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/google-drive')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/webhooks/onedrive', () => {
    it('should handle OneDrive validation request', async () => {
      const validationToken = 'test-validation-token';

      const response = await request(app)
        .post('/api/v1/webhooks/onedrive')
        .query({ validationToken })
        .send({});

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/plain');
      expect(response.text).toBe(validationToken);
    });

    it('should process OneDrive webhook notification', async () => {
      (watcherAgent.processWebhookNotification as jest.Mock).mockResolvedValue([
        { id: 'file-1', name: 'document.docx' },
      ]);

      const response = await request(app)
        .post('/api/v1/webhooks/onedrive')
        .send({
          clientState: 'client-state-123',
          value: [
            {
              subscriptionId: 'sub-123',
              resource: 'me/drive/root',
              changeType: 'updated',
            },
          ],
        });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        success: true,
        processed: 1,
      });
      expect(watcherAgent.processWebhookNotification).toHaveBeenCalled();
    });

    it('should return 400 for missing clientState', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/onedrive')
        .send({
          value: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/webhooks/google-drive/subscribe', () => {
    it('should create Google Drive subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        provider: 'google' as const,
        userId: 'user-456',
        resourceId: 'resource-789',
        callbackUrl: 'https://example.com/webhook',
        expiresAt: new Date(),
        active: true,
      };

      (watcherAgent.subscribeToWebhook as jest.Mock).mockResolvedValue(mockSubscription);

      const response = await request(app)
        .post('/api/v1/webhooks/google-drive/subscribe')
        .send({
          userId: 'user-456',
          resourceId: 'resource-789',
          callbackUrl: 'https://example.com/webhook',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription).toBeDefined();
      expect(watcherAgent.subscribeToWebhook).toHaveBeenCalledWith(
        'google',
        'user-456',
        'resource-789',
        'https://example.com/webhook'
      );
    });

    it('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/google-drive/subscribe')
        .send({
          userId: 'user-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/webhooks/onedrive/subscribe', () => {
    it('should create OneDrive subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        provider: 'microsoft' as const,
        userId: 'user-456',
        resourceId: 'resource-789',
        callbackUrl: 'https://example.com/webhook',
        expiresAt: new Date(),
        active: true,
      };

      (watcherAgent.subscribeToWebhook as jest.Mock).mockResolvedValue(mockSubscription);

      const response = await request(app)
        .post('/api/v1/webhooks/onedrive/subscribe')
        .send({
          userId: 'user-456',
          resourceId: 'resource-789',
          callbackUrl: 'https://example.com/webhook',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription).toBeDefined();
      expect(watcherAgent.subscribeToWebhook).toHaveBeenCalledWith(
        'microsoft',
        'user-456',
        'resource-789',
        'https://example.com/webhook'
      );
    });
  });

  describe('GET /api/v1/webhooks/subscriptions', () => {
    it('should return active subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          provider: 'google' as const,
          userId: 'user-1',
          resourceId: 'resource-1',
          callbackUrl: 'https://example.com/webhook1',
          expiresAt: new Date(),
          active: true,
        },
        {
          id: 'sub-2',
          provider: 'microsoft' as const,
          userId: 'user-2',
          resourceId: 'resource-2',
          callbackUrl: 'https://example.com/webhook2',
          expiresAt: new Date(),
          active: true,
        },
      ];

      (watcherAgent.getActiveSubscriptions as jest.Mock).mockReturnValue(mockSubscriptions);

      const response = await request(app).get('/api/v1/webhooks/subscriptions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscriptions).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });
  });

  describe('DELETE /api/v1/webhooks/subscriptions/:subscriptionId', () => {
    it('should delete a subscription', async () => {
      (watcherAgent.unsubscribeFromWebhook as jest.Mock).mockResolvedValue(true);

      const response = await request(app).delete('/api/v1/webhooks/subscriptions/sub-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Subscription deleted successfully');
      expect(watcherAgent.unsubscribeFromWebhook).toHaveBeenCalledWith('sub-123');
    });

    it('should return 404 for non-existent subscription', async () => {
      (watcherAgent.unsubscribeFromWebhook as jest.Mock).mockResolvedValue(false);

      const response = await request(app).delete(
        '/api/v1/webhooks/subscriptions/non-existent'
      );

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
