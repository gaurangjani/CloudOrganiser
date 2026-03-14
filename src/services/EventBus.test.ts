// Tests for EventBus
import { EventBus } from '../services/EventBus';
import { WebhookEvent } from '../types/events.types';

// Mock the logger to avoid config issues
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('publish', () => {
    it('should publish events to subscribers', async () => {
      const mockHandler = jest.fn();
      eventBus.subscribe('test.event', mockHandler);

      const testData = { message: 'test data' };
      await eventBus.publish('test.event', testData);

      expect(mockHandler).toHaveBeenCalledWith(testData);
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should publish to multiple subscribers', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe('test.event', handler1);
      eventBus.subscribe('test.event', handler2);
      eventBus.subscribe('test.event', handler3);

      const testData = { message: 'broadcast test' };
      await eventBus.publish('test.event', testData);

      expect(handler1).toHaveBeenCalledWith(testData);
      expect(handler2).toHaveBeenCalledWith(testData);
      expect(handler3).toHaveBeenCalledWith(testData);
    });

    it('should publish wildcard events', async () => {
      const wildcardHandler = jest.fn();
      eventBus.subscribe('*', wildcardHandler);

      const testData = { message: 'wildcard test' };
      await eventBus.publish('any.event', testData);

      expect(wildcardHandler).toHaveBeenCalledWith({
        eventType: 'any.event',
        data: testData,
      });
    });

    it('should handle errors in event handlers gracefully', async () => {
      const errorHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();

      eventBus.subscribe('test.event', errorHandler);
      eventBus.subscribe('test.event', successHandler);

      const testData = { message: 'error test' };
      await eventBus.publish('test.event', testData);

      // Both handlers should be called despite the error
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should return a subscription object', () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribe('test.event', handler);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.eventType).toBe('test.event');
      expect(subscription.unsubscribe).toBeInstanceOf(Function);
    });

    it('should increment subscription count', () => {
      expect(eventBus.getSubscriptionCount()).toBe(0);

      eventBus.subscribe('test1', jest.fn());
      expect(eventBus.getSubscriptionCount()).toBe(1);

      eventBus.subscribe('test2', jest.fn());
      expect(eventBus.getSubscriptionCount()).toBe(2);
    });

    it('should allow async handlers', async () => {
      const asyncHandler = jest.fn().mockImplementation(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return data;
      });

      eventBus.subscribe('async.event', asyncHandler);

      const testData = { message: 'async test' };
      await eventBus.publish('async.event', testData);

      expect(asyncHandler).toHaveBeenCalledWith(testData);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from events', async () => {
      const handler = jest.fn();
      const subscription = eventBus.subscribe('test.event', handler);

      // Verify subscription works
      await eventBus.publish('test.event', { test: 1 });
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      subscription.unsubscribe();

      // Verify handler is no longer called
      await eventBus.publish('test.event', { test: 2 });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should decrement subscription count on unsubscribe', () => {
      const sub1 = eventBus.subscribe('test1', jest.fn());
      const sub2 = eventBus.subscribe('test2', jest.fn());

      expect(eventBus.getSubscriptionCount()).toBe(2);

      sub1.unsubscribe();
      expect(eventBus.getSubscriptionCount()).toBe(1);

      sub2.unsubscribe();
      expect(eventBus.getSubscriptionCount()).toBe(0);
    });
  });

  describe('getListenerCount', () => {
    it('should return the number of listeners for an event type', () => {
      expect(eventBus.getListenerCount('test.event')).toBe(0);

      eventBus.subscribe('test.event', jest.fn());
      expect(eventBus.getListenerCount('test.event')).toBe(1);

      eventBus.subscribe('test.event', jest.fn());
      expect(eventBus.getListenerCount('test.event')).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all subscriptions', () => {
      eventBus.subscribe('test1', jest.fn());
      eventBus.subscribe('test2', jest.fn());
      eventBus.subscribe('test3', jest.fn());

      expect(eventBus.getSubscriptionCount()).toBe(3);

      eventBus.clear();

      expect(eventBus.getSubscriptionCount()).toBe(0);
    });

    it('should not call handlers after clear', async () => {
      const handler = jest.fn();
      eventBus.subscribe('test.event', handler);

      eventBus.clear();

      await eventBus.publish('test.event', { test: 'data' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('WebhookEvent integration', () => {
    it('should handle webhook events', async () => {
      const handler = jest.fn();
      eventBus.subscribe('webhook.file.change', handler);

      const webhookEvent: WebhookEvent = {
        id: 'event-123',
        provider: 'google',
        eventType: 'file.created',
        fileContext: {
          id: 'file-123',
          name: 'test.pdf',
          metadata: {
            size: 1024,
            mimeType: 'application/pdf',
            createdAt: new Date(),
            modifiedAt: new Date(),
            extension: 'pdf',
          },
          location: {
            provider: 'google',
            path: '/test',
            parentPath: '/',
            fullPath: '/test/test.pdf',
          },
          userId: 'user-123',
        },
        timestamp: new Date(),
      };

      await eventBus.publish('webhook.file.change', webhookEvent);

      expect(handler).toHaveBeenCalledWith(webhookEvent);
    });
  });
});
