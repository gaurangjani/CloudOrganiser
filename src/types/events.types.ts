// Event types for the internal event bus system
import { FileContext } from './context.types';

/**
 * WebhookProvider represents the cloud storage provider
 */
export type WebhookProvider = 'google' | 'microsoft';

/**
 * WebhookEventType represents the type of file change event
 */
export type WebhookEventType = 'file.created' | 'file.updated' | 'file.deleted' | 'file.renamed';

/**
 * WebhookEvent represents a file change notification from a cloud provider
 */
export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  eventType: WebhookEventType;
  fileContext: FileContext;
  timestamp: Date;
  rawPayload?: unknown;
}

/**
 * EventHandler is a callback function that processes events
 */
export type EventHandler<T = WebhookEvent> = (event: T) => void | Promise<void>;

/**
 * EventSubscription represents a subscription to an event
 */
export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler<any>;
  unsubscribe: () => void;
}
