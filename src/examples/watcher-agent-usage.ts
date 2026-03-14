// Example: Using WatcherAgent and EventBus
/* eslint-disable no-console */
import { watcherAgent } from '../services/WatcherAgent';
import { eventBus } from '../services/EventBus';
import { FileContext } from '../types/context.types';
import { WebhookEvent } from '../types/events.types';

/**
 * Example 1: Subscribe to file change events
 *
 * This demonstrates how other agents can subscribe to file changes
 * detected by the WatcherAgent
 */
export function subscribeToFileChanges() {
  // Subscribe to all file change events
  const subscription = eventBus.subscribe<WebhookEvent>(
    'webhook.file.change',
    async (event: WebhookEvent) => {
      console.log('File change detected:', {
        provider: event.provider,
        eventType: event.eventType,
        fileName: event.fileContext.name,
        fileId: event.fileContext.id,
      });

      // Process the file change (e.g., trigger classification)
      // await classifierAgent.execute(event.fileContext);
    }
  );

  console.log('Subscribed to file changes with ID:', subscription.id);

  // To unsubscribe later:
  // subscription.unsubscribe();
}

/**
 * Example 2: Subscribe to provider-specific events
 *
 * This demonstrates how to listen to events from a specific cloud provider
 */
export function subscribeToGoogleDriveEvents() {
  const subscription = eventBus.subscribe<WebhookEvent>(
    'webhook.google.file.change',
    async (event: WebhookEvent) => {
      console.log('Google Drive file change:', event.fileContext.name);

      // Handle Google Drive specific logic
      if (event.fileContext.location.driveId) {
        console.log('Drive ID:', event.fileContext.location.driveId);
      }
    }
  );

  return subscription;
}

/**
 * Example 3: Subscribe to specific event types
 *
 * This demonstrates how to listen to specific file operations
 */
export function subscribeToFileCreations() {
  const subscription = eventBus.subscribe<WebhookEvent>(
    'webhook.file.file.created',
    async (event: WebhookEvent) => {
      console.log('New file created:', event.fileContext.name);

      // Process new files differently than updates
      // e.g., send welcome email, apply default policies, etc.
    }
  );

  return subscription;
}

/**
 * Example 4: Process a file change manually
 *
 * This demonstrates how to manually trigger the WatcherAgent
 * with a file context
 */
export async function processFileChange() {
  const fileContext: FileContext = {
    id: 'file-123',
    name: 'quarterly-report.pdf',
    metadata: {
      size: 2048000,
      mimeType: 'application/pdf',
      createdAt: new Date(),
      modifiedAt: new Date(),
      extension: 'pdf',
    },
    location: {
      provider: 'google',
      path: '/Reports/Q4',
      parentPath: '/Reports',
      fullPath: '/Reports/Q4/quarterly-report.pdf',
      driveId: 'my-drive',
      folderId: 'folder-456',
    },
    userId: 'user-789',
    tags: ['financial', 'quarterly'],
  };

  // Execute the watcher agent
  const result = await watcherAgent.execute(fileContext);

  if (result.success) {
    console.log('File processed successfully:', result.data);
  } else {
    console.error('Error processing file:', result.error);
  }
}

/**
 * Example 5: Create a webhook subscription
 *
 * This demonstrates how to set up webhook subscriptions
 * with cloud providers
 */
export async function createWebhookSubscriptions() {
  // Create Google Drive subscription
  const googleSubscription = await watcherAgent.subscribeToWebhook(
    'google',
    'user-123',
    'drive-resource-id',
    'https://api.example.com/api/v1/webhooks/google-drive',
    24 * 60 * 60 * 1000 // 24 hours
  );

  console.log('Google Drive subscription created:', {
    id: googleSubscription.id,
    expiresAt: googleSubscription.expiresAt,
  });

  // Create OneDrive subscription
  const oneDriveSubscription = await watcherAgent.subscribeToWebhook(
    'microsoft',
    'user-123',
    'onedrive-resource-id',
    'https://api.example.com/api/v1/webhooks/onedrive',
    24 * 60 * 60 * 1000 // 24 hours
  );

  console.log('OneDrive subscription created:', {
    id: oneDriveSubscription.id,
    expiresAt: oneDriveSubscription.expiresAt,
  });

  return { googleSubscription, oneDriveSubscription };
}

/**
 * Example 6: Monitor and manage subscriptions
 *
 * This demonstrates how to check active subscriptions and renew them
 */
export async function manageSubscriptions() {
  // Get all active subscriptions
  const activeSubscriptions = watcherAgent.getActiveSubscriptions();

  console.log(`Active subscriptions: ${activeSubscriptions.length}`);

  // Check for expiring subscriptions (expiring within 1 hour)
  const expiringThreshold = new Date(Date.now() + 60 * 60 * 1000);

  for (const subscription of activeSubscriptions) {
    if (subscription.expiresAt < expiringThreshold) {
      console.log(`Subscription ${subscription.id} is expiring soon, renewing...`);

      // Renew the subscription for another 24 hours
      const renewed = await watcherAgent.renewSubscription(
        subscription.id,
        24 * 60 * 60 * 1000
      );

      if (renewed) {
        console.log(`Subscription renewed until: ${renewed.expiresAt}`);
      }
    }
  }
}

/**
 * Example 7: Multi-agent pipeline
 *
 * This demonstrates how multiple agents can work together
 * through the event bus
 */
export function setupAgentPipeline() {
  // Step 1: Watch for file changes
  eventBus.subscribe<WebhookEvent>(
    'webhook.file.change',
    async (event: WebhookEvent) => {
      console.log('[Pipeline] Step 1: File detected');

      // Step 2: Publish to classification
      await eventBus.publish('pipeline.classify', event.fileContext);
    }
  );

  // Step 2: Classify the file
  eventBus.subscribe<FileContext>(
    'pipeline.classify',
    async (fileContext: FileContext) => {
      console.log('[Pipeline] Step 2: Classifying file');

      // Simulate classification
      // const classification = await classifierAgent.execute(fileContext);

      // Step 3: Publish to renamer
      await eventBus.publish('pipeline.rename', fileContext);
    }
  );

  // Step 3: Rename the file
  eventBus.subscribe<FileContext>(
    'pipeline.rename',
    async (fileContext: FileContext) => {
      console.log('[Pipeline] Step 3: Suggesting rename');

      // Simulate renaming
      // const renamed = await renamerAgent.execute(fileContext);

      // Step 4: Publish to folder organizer
      await eventBus.publish('pipeline.organize', fileContext);
    }
  );

  // Step 4: Organize into folders
  eventBus.subscribe<FileContext>(
    'pipeline.organize',
    async (_fileContext: FileContext) => {
      console.log('[Pipeline] Step 4: Organizing file');

      // Simulate organizing
      // const organized = await folderAgent.execute(fileContext);

      console.log('[Pipeline] File processing complete!');
    }
  );

  console.log('Multi-agent pipeline configured');
}

/**
 * Example 8: Error handling in event subscribers
 *
 * This demonstrates proper error handling when subscribing to events
 */
export function subscribeWithErrorHandling() {
  eventBus.subscribe<WebhookEvent>(
    'webhook.file.change',
    async (event: WebhookEvent) => {
      try {
        // Attempt to process the file
        console.log('Processing file:', event.fileContext.name);

        // Simulate some processing that might fail
        if (!event.fileContext.metadata) {
          throw new Error('Missing file metadata');
        }

        // Process successfully
        console.log('File processed successfully');
      } catch (error) {
        // Log the error
        console.error('Error processing file:', error);

        // Optionally publish an error event
        await eventBus.publish('webhook.file.error', {
          error,
          fileContext: event.fileContext,
        });
      }
    }
  );
}

// Export all examples
export const examples = {
  subscribeToFileChanges,
  subscribeToGoogleDriveEvents,
  subscribeToFileCreations,
  processFileChange,
  createWebhookSubscriptions,
  manageSubscriptions,
  setupAgentPipeline,
  subscribeWithErrorHandling,
};
