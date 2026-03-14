// EventBus implementation for internal event publishing and subscription
import { EventEmitter } from 'events';
import { EventHandler, EventSubscription } from '../types/events.types';
import { logger } from '../config/logger';

/**
 * EventBus provides a centralized event publishing and subscription system
 * for the multi-agent file organization pipeline
 */
export class EventBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, EventSubscription>;
  private subscriptionCounter: number;

  constructor() {
    this.emitter = new EventEmitter();
    this.subscriptions = new Map();
    this.subscriptionCounter = 0;
    // Increase max listeners to support multiple agents
    this.emitter.setMaxListeners(50);
  }

  /**
   * Publish an event to all subscribers
   * @param eventType - The type of event to publish
   * @param data - The event data
   */
  public async publish<T = unknown>(eventType: string, data: T): Promise<void> {
    logger.debug(`Publishing event: ${eventType}`, { eventType, hasData: !!data });

    try {
      // Emit the event
      this.emitter.emit(eventType, data);

      // Also emit a wildcard event for listeners who want all events
      this.emitter.emit('*', { eventType, data });

      logger.debug(`Event published successfully: ${eventType}`);
    } catch (error) {
      logger.error(`Error publishing event: ${eventType}`, { error, eventType });
      throw error;
    }
  }

  /**
   * Subscribe to a specific event type
   * @param eventType - The type of event to subscribe to
   * @param handler - The handler function to call when the event is published
   * @returns EventSubscription object with unsubscribe method
   */
  public subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): EventSubscription {
    const subscriptionId = `sub-${++this.subscriptionCounter}`;

    logger.debug(`Creating subscription: ${subscriptionId} for event: ${eventType}`);

    // Wrap the handler to catch errors
    const wrappedHandler = async (data: T) => {
      try {
        await handler(data);
      } catch (error) {
        logger.error(`Error in event handler for ${eventType}`, {
          error,
          eventType,
          subscriptionId
        });
      }
    };

    // Add the listener
    this.emitter.on(eventType, wrappedHandler);

    // Create subscription object
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler,
      unsubscribe: () => {
        this.unsubscribe(subscriptionId, eventType, wrappedHandler);
      },
    };

    // Store the subscription
    this.subscriptions.set(subscriptionId, subscription);

    logger.debug(`Subscription created: ${subscriptionId}`);
    return subscription;
  }

  /**
   * Unsubscribe from an event
   * @param subscriptionId - The subscription ID
   * @param eventType - The event type
   * @param handler - The handler to remove
   */
  private unsubscribe(subscriptionId: string, eventType: string, handler: EventHandler<any>): void {
    logger.debug(`Unsubscribing: ${subscriptionId} from event: ${eventType}`);

    this.emitter.off(eventType, handler);
    this.subscriptions.delete(subscriptionId);

    logger.debug(`Unsubscribed: ${subscriptionId}`);
  }

  /**
   * Get the number of active subscriptions
   * @returns Number of active subscriptions
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get the number of listeners for a specific event type
   * @param eventType - The event type
   * @returns Number of listeners
   */
  public getListenerCount(eventType: string): number {
    return this.emitter.listenerCount(eventType);
  }

  /**
   * Remove all listeners and subscriptions
   */
  public clear(): void {
    logger.debug('Clearing all subscriptions');
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
    logger.debug('All subscriptions cleared');
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();
