// WatcherAgent implementation for monitoring cloud storage file changes
import { WatcherAgent as IWatcherAgent, AgentResult } from '../types/agent.types';
import { FileContext } from '../types/context.types';
import { WebhookEvent, WebhookProvider } from '../types/events.types';
import { eventBus } from './EventBus';
import { logger } from '../config/logger';

/**
 * WebhookSubscription represents an active webhook subscription with a cloud provider
 */
export interface WebhookSubscription {
  id: string;
  provider: WebhookProvider;
  userId: string;
  resourceId: string;
  expiresAt: Date;
  callbackUrl: string;
  active: boolean;
}

/**
 * WatcherAgent monitors cloud storage for file changes and publishes events
 * to the internal event bus for other agents to consume
 */
export class WatcherAgent implements IWatcherAgent {
  private subscriptions: Map<string, WebhookSubscription>;

  constructor() {
    this.subscriptions = new Map();
    logger.info('WatcherAgent initialized');
  }

  /**
   * Execute the watcher agent - processes incoming file change context
   * and publishes it to the event bus
   * @param context - The file context representing the file change
   * @returns Promise resolving to detected file changes
   */
  public async execute(context: FileContext): Promise<AgentResult<FileContext[]>> {
    try {
      logger.debug('WatcherAgent executing for file', {
        fileId: context?.id,
        fileName: context?.name,
        provider: context?.location?.provider
      });

      // Validate the context
      if (!this.isValidContext(context)) {
        return {
          success: false,
          error: 'Invalid file context provided',
          metadata: { context },
        };
      }

      // Publish the file change event to the event bus
      await this.publishFileChangeEvent(context);

      // Return the file context as an array (single file detected)
      return {
        success: true,
        data: [context],
        metadata: {
          timestamp: new Date().toISOString(),
          provider: context.location.provider,
        },
      };
    } catch (error) {
      logger.error('Error in WatcherAgent execution', { error, context });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: { context },
      };
    }
  }

  /**
   * Process a webhook notification from a cloud provider
   * @param provider - The cloud provider
   * @param payload - The raw webhook payload
   * @returns Promise resolving to processed file contexts
   */
  public async processWebhookNotification(
    provider: WebhookProvider,
    payload: unknown
  ): Promise<FileContext[]> {
    try {
      logger.info('Processing webhook notification', { provider });

      // Parse the webhook payload based on provider
      const fileContexts = await this.parseWebhookPayload(provider, payload);

      // Process each file context
      const results: FileContext[] = [];
      for (const context of fileContexts) {
        const result = await this.execute(context);
        if (result.success && result.data) {
          results.push(...result.data);
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing webhook notification', { error, provider });
      throw error;
    }
  }

  /**
   * Subscribe to file change notifications from a cloud provider
   * @param provider - The cloud provider
   * @param userId - The user ID
   * @param resourceId - The resource ID (drive ID, folder ID, etc.)
   * @param callbackUrl - The webhook callback URL
   * @param expirationTime - Optional expiration time in milliseconds (default: 24 hours)
   * @returns Promise resolving to the subscription
   */
  public async subscribeToWebhook(
    provider: WebhookProvider,
    userId: string,
    resourceId: string,
    callbackUrl: string,
    expirationTime: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<WebhookSubscription> {
    try {
      logger.info('Creating webhook subscription', { provider, userId, resourceId });

      const subscriptionId = this.generateSubscriptionId(provider, userId, resourceId);
      const expiresAt = new Date(Date.now() + expirationTime);

      const subscription: WebhookSubscription = {
        id: subscriptionId,
        provider,
        userId,
        resourceId,
        expiresAt,
        callbackUrl,
        active: true,
      };

      // Store the subscription
      this.subscriptions.set(subscriptionId, subscription);

      logger.info('Webhook subscription created', { subscriptionId, expiresAt });

      return subscription;
    } catch (error) {
      logger.error('Error creating webhook subscription', { error, provider, userId });
      throw error;
    }
  }

  /**
   * Unsubscribe from file change notifications
   * @param subscriptionId - The subscription ID
   * @returns Promise resolving to true if unsubscribed successfully
   */
  public async unsubscribeFromWebhook(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);

      if (!subscription) {
        logger.warn('Subscription not found', { subscriptionId });
        return false;
      }

      // Mark as inactive and remove
      subscription.active = false;
      this.subscriptions.delete(subscriptionId);

      logger.info('Webhook subscription removed', { subscriptionId });
      return true;
    } catch (error) {
      logger.error('Error removing webhook subscription', { error, subscriptionId });
      throw error;
    }
  }

  /**
   * Get all active subscriptions
   * @returns Array of active subscriptions
   */
  public getActiveSubscriptions(): WebhookSubscription[] {
    const now = new Date();
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.active && sub.expiresAt > now
    );
  }

  /**
   * Renew an expiring subscription
   * @param subscriptionId - The subscription ID
   * @param expirationTime - New expiration time in milliseconds
   * @returns Promise resolving to updated subscription
   */
  public async renewSubscription(
    subscriptionId: string,
    expirationTime: number = 24 * 60 * 60 * 1000
  ): Promise<WebhookSubscription | null> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      logger.warn('Cannot renew - subscription not found', { subscriptionId });
      return null;
    }

    subscription.expiresAt = new Date(Date.now() + expirationTime);
    logger.info('Subscription renewed', { subscriptionId, expiresAt: subscription.expiresAt });

    return subscription;
  }

  /**
   * Validate if a file context is valid
   * @param context - The file context to validate
   * @returns True if valid
   */
  private isValidContext(context: FileContext): boolean {
    return !!(
      context &&
      context.id &&
      context.name &&
      context.metadata &&
      context.location &&
      context.location.provider &&
      context.userId
    );
  }

  /**
   * Publish a file change event to the event bus
   * @param context - The file context
   */
  private async publishFileChangeEvent(context: FileContext): Promise<void> {
    const event: WebhookEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: context.location.provider === 'google' || context.location.provider === 'microsoft'
        ? context.location.provider
        : 'google', // Default to google for now
      eventType: 'file.created', // Default to created, should be determined from webhook payload
      fileContext: context,
      timestamp: new Date(),
    };

    // Publish the generic webhook event
    await eventBus.publish('webhook.file.change', event);

    // Publish provider-specific event
    await eventBus.publish(`webhook.${event.provider}.file.change`, event);

    // Publish event type-specific event
    await eventBus.publish(`webhook.file.${event.eventType}`, event);

    logger.debug('File change event published', {
      eventId: event.id,
      provider: event.provider,
      eventType: event.eventType,
    });
  }

  /**
   * Parse webhook payload based on provider
   * @param provider - The cloud provider
   * @param _payload - The raw webhook payload
   * @returns Promise resolving to file contexts
   */
  private async parseWebhookPayload(
    provider: WebhookProvider,
    _payload: unknown
  ): Promise<FileContext[]> {
    // This is a placeholder implementation
    // In a real implementation, this would parse provider-specific webhook payloads
    // and convert them to FileContext objects

    logger.debug('Parsing webhook payload', { provider });

    // For now, return an empty array
    // This will be implemented when integrating with actual cloud provider APIs
    return [];
  }

  /**
   * Generate a unique subscription ID
   * @param provider - The cloud provider
   * @param userId - The user ID
   * @param resourceId - The resource ID
   * @returns Subscription ID
   */
  private generateSubscriptionId(
    provider: WebhookProvider,
    userId: string,
    resourceId: string
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${provider}-${userId}-${resourceId}-${timestamp}-${random}`;
  }
}

// Export a singleton instance
export const watcherAgent = new WatcherAgent();
