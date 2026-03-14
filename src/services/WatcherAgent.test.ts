// Tests for WatcherAgent
import { WatcherAgent } from '../services/WatcherAgent';
import { FileContext } from '../types/context.types';
import { eventBus } from '../services/EventBus';

// Mock the eventBus
jest.mock('../services/EventBus', () => ({
  eventBus: {
    publish: jest.fn(),
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

describe('WatcherAgent', () => {
  let watcherAgent: WatcherAgent;
  let mockFileContext: FileContext;

  beforeEach(() => {
    watcherAgent = new WatcherAgent();
    mockFileContext = {
      id: 'file-123',
      name: 'test-document.pdf',
      metadata: {
        size: 2048,
        mimeType: 'application/pdf',
        createdAt: new Date(),
        modifiedAt: new Date(),
        extension: 'pdf',
      },
      location: {
        provider: 'google',
        path: '/documents',
        parentPath: '/',
        fullPath: '/documents/test-document.pdf',
      },
      userId: 'user-456',
      tags: ['work', 'important'],
    };

    // Clear mock calls
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute successfully with valid file context', async () => {
      const result = await watcherAgent.execute(mockFileContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockFileContext]);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.provider).toBe('google');
    });

    it('should publish file change events to event bus', async () => {
      await watcherAgent.execute(mockFileContext);

      expect(eventBus.publish).toHaveBeenCalledTimes(3);
      expect(eventBus.publish).toHaveBeenCalledWith(
        'webhook.file.change',
        expect.objectContaining({
          provider: 'google',
          fileContext: mockFileContext,
        })
      );
    });

    it('should return error for invalid file context', async () => {
      const invalidContext = {
        id: '',
        name: '',
      } as FileContext;

      const result = await watcherAgent.execute(invalidContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid file context provided');
    });

    it('should handle execution errors gracefully', async () => {
      // Mock publish to throw an error
      (eventBus.publish as jest.Mock).mockRejectedValueOnce(new Error('Publish failed'));

      const result = await watcherAgent.execute(mockFileContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Publish failed');
    });
  });

  describe('subscribeToWebhook', () => {
    it('should create a new webhook subscription', async () => {
      const subscription = await watcherAgent.subscribeToWebhook(
        'google',
        'user-123',
        'resource-456',
        'https://example.com/webhook'
      );

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.provider).toBe('google');
      expect(subscription.userId).toBe('user-123');
      expect(subscription.resourceId).toBe('resource-456');
      expect(subscription.callbackUrl).toBe('https://example.com/webhook');
      expect(subscription.active).toBe(true);
      expect(subscription.expiresAt).toBeInstanceOf(Date);
    });

    it('should set default expiration time to 24 hours', async () => {
      const now = Date.now();
      const subscription = await watcherAgent.subscribeToWebhook(
        'google',
        'user-123',
        'resource-456',
        'https://example.com/webhook'
      );

      const expectedExpiration = now + 24 * 60 * 60 * 1000;
      const actualExpiration = subscription.expiresAt.getTime();

      // Allow 1 second tolerance
      expect(Math.abs(actualExpiration - expectedExpiration)).toBeLessThan(1000);
    });

    it('should accept custom expiration time', async () => {
      const customExpiration = 2 * 60 * 60 * 1000; // 2 hours
      const now = Date.now();

      const subscription = await watcherAgent.subscribeToWebhook(
        'microsoft',
        'user-123',
        'resource-456',
        'https://example.com/webhook',
        customExpiration
      );

      const expectedExpiration = now + customExpiration;
      const actualExpiration = subscription.expiresAt.getTime();

      expect(Math.abs(actualExpiration - expectedExpiration)).toBeLessThan(1000);
    });
  });

  describe('unsubscribeFromWebhook', () => {
    it('should unsubscribe successfully', async () => {
      const subscription = await watcherAgent.subscribeToWebhook(
        'google',
        'user-123',
        'resource-456',
        'https://example.com/webhook'
      );

      const success = await watcherAgent.unsubscribeFromWebhook(subscription.id);

      expect(success).toBe(true);
      expect(watcherAgent.getActiveSubscriptions()).toHaveLength(0);
    });

    it('should return false for non-existent subscription', async () => {
      const success = await watcherAgent.unsubscribeFromWebhook('non-existent-id');

      expect(success).toBe(false);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should return all active subscriptions', async () => {
      await watcherAgent.subscribeToWebhook(
        'google',
        'user-1',
        'resource-1',
        'https://example.com/webhook1'
      );
      await watcherAgent.subscribeToWebhook(
        'microsoft',
        'user-2',
        'resource-2',
        'https://example.com/webhook2'
      );

      const subscriptions = watcherAgent.getActiveSubscriptions();

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].active).toBe(true);
      expect(subscriptions[1].active).toBe(true);
    });

    it('should filter out expired subscriptions', async () => {
      // Create subscription with 0 expiration (already expired)
      await watcherAgent.subscribeToWebhook(
        'google',
        'user-1',
        'resource-1',
        'https://example.com/webhook1',
        0
      );

      // Create valid subscription
      await watcherAgent.subscribeToWebhook(
        'google',
        'user-2',
        'resource-2',
        'https://example.com/webhook2'
      );

      const subscriptions = watcherAgent.getActiveSubscriptions();

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].userId).toBe('user-2');
    });

    it('should not include unsubscribed subscriptions', async () => {
      const sub1 = await watcherAgent.subscribeToWebhook(
        'google',
        'user-1',
        'resource-1',
        'https://example.com/webhook1'
      );
      await watcherAgent.subscribeToWebhook(
        'google',
        'user-2',
        'resource-2',
        'https://example.com/webhook2'
      );

      await watcherAgent.unsubscribeFromWebhook(sub1.id);

      const subscriptions = watcherAgent.getActiveSubscriptions();

      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].userId).toBe('user-2');
    });
  });

  describe('renewSubscription', () => {
    it('should renew an existing subscription', async () => {
      const subscription = await watcherAgent.subscribeToWebhook(
        'google',
        'user-123',
        'resource-456',
        'https://example.com/webhook',
        1000 // 1 second expiration
      );

      const originalExpiration = subscription.expiresAt.getTime();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Renew with 2 hours
      const renewed = await watcherAgent.renewSubscription(
        subscription.id,
        2 * 60 * 60 * 1000
      );

      expect(renewed).toBeDefined();
      expect(renewed?.expiresAt.getTime()).toBeGreaterThan(originalExpiration);
    });

    it('should return null for non-existent subscription', async () => {
      const renewed = await watcherAgent.renewSubscription('non-existent-id');

      expect(renewed).toBeNull();
    });
  });

  describe('processWebhookNotification', () => {
    it('should process webhook notifications', async () => {
      const payload = {
        resourceId: 'resource-123',
        changes: ['file-created'],
      };

      const result = await watcherAgent.processWebhookNotification('google', payload);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Google Drive notifications', async () => {
      const payload = {
        channelId: 'channel-123',
        resourceId: 'resource-456',
        resourceState: 'update',
      };

      const result = await watcherAgent.processWebhookNotification('google', payload);

      expect(result).toBeDefined();
    });

    it('should handle Microsoft OneDrive notifications', async () => {
      const payload = {
        clientState: 'state-123',
        notification: {
          subscriptionId: 'sub-456',
          resource: 'file-path',
        },
      };

      const result = await watcherAgent.processWebhookNotification('microsoft', payload);

      expect(result).toBeDefined();
    });
  });
});
