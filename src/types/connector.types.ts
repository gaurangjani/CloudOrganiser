// Connector types for cloud storage operations
import { FileContext, FileMetadata } from './context.types';

/**
 * OAuth token information with refresh capability
 */
export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string[];
}

/**
 * Connector configuration
 */
export interface ConnectorConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * File upload options
 */
export interface UploadOptions {
  path: string;
  filename: string;
  content: Buffer | string;
  mimeType?: string;
  conflictBehavior?: 'rename' | 'replace' | 'fail';
}

/**
 * File download options
 */
export interface DownloadOptions {
  fileId: string;
  format?: string;
}

/**
 * List files options
 */
export interface ListFilesOptions {
  path?: string;
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
  filter?: string;
  orderBy?: string;
}

/**
 * File move/rename options
 */
export interface MoveOptions {
  fileId: string;
  newParentId?: string;
  newPath?: string;
}

export interface RenameOptions {
  fileId: string;
  newName: string;
}

/**
 * Subscription/webhook configuration for change notifications
 */
export interface SubscriptionConfig {
  resourcePath: string;
  changeTypes: ('created' | 'updated' | 'deleted')[];
  notificationUrl: string;
  expirationDateTime?: Date;
  clientState?: string;
}

/**
 * Subscription response
 */
export interface Subscription {
  id: string;
  resourcePath: string;
  changeTypes: string[];
  notificationUrl: string;
  expirationDateTime: Date;
  clientState?: string;
}

/**
 * Change notification from cloud storage
 */
export interface ChangeNotification {
  subscriptionId: string;
  changeType: 'created' | 'updated' | 'deleted';
  resourceData: {
    id: string;
    name?: string;
    [key: string]: unknown;
  };
  timestamp: Date;
}

/**
 * Generic cloud storage connector interface
 */
export interface CloudStorageConnector {
  /**
   * Initialize the connector with OAuth token
   */
  initialize(token: OAuthToken): void;

  /**
   * Refresh the OAuth token
   */
  refreshToken(): Promise<OAuthToken>;

  /**
   * List files in a directory
   */
  listFiles(options: ListFilesOptions): Promise<FileContext[]>;

  /**
   * Get metadata for a specific file
   */
  getFileMetadata(fileId: string): Promise<FileMetadata>;

  /**
   * Download a file
   */
  downloadFile(options: DownloadOptions): Promise<Buffer>;

  /**
   * Upload a file
   */
  uploadFile(options: UploadOptions): Promise<FileContext>;

  /**
   * Move a file to a different location
   */
  moveFile(options: MoveOptions): Promise<FileContext>;

  /**
   * Rename a file
   */
  renameFile(options: RenameOptions): Promise<FileContext>;

  /**
   * Subscribe to change notifications
   */
  subscribeToChanges(config: SubscriptionConfig): Promise<Subscription>;

  /**
   * Unsubscribe from change notifications
   */
  unsubscribe(subscriptionId: string): Promise<void>;
}
