// Connector type definitions for cloud storage providers
import { FileContext, FileMetadata } from './context.types';

/**
 * OAuth token information with refresh capability (used by CloudStorageConnector)
 */
export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string[];
}

/**
 * TokenInfo represents OAuth2 token information (used by Connector)
 */
export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  tokenType?: string;
  scope?: string;
}

/**
 * Connector configuration
 */
export interface ConnectorConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scopes?: string[];
}

/**
 * FileListOptions for filtering and pagination (used by Connector)
 */
export interface FileListOptions {
  pageSize?: number;
  pageToken?: string;
  query?: string;
  parentId?: string;
  mimeType?: string;
  orderBy?: string;
  includeShared?: boolean;
}

/**
 * FileListResult contains paginated file list results (used by Connector)
 */
export interface FileListResult {
  files: DriveFile[];
  nextPageToken?: string;
  hasMore: boolean;
}

/**
 * DriveFile represents a file in cloud storage (used by Connector)
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: Date;
  modifiedTime: Date;
  parentIds?: string[];
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  shared?: boolean;
  owners?: string[];
  permissions?: string[];
  description?: string;
}

/**
 * FileMetadataOptions for fetching file metadata (used by Connector)
 */
export interface FileMetadataOptions {
  fields?: string[];
  includePermissions?: boolean;
}

/**
 * File upload options (used by CloudStorageConnector)
 */
export interface UploadOptions {
  path?: string;
  filename?: string;
  name?: string;
  content?: Buffer | string;
  mimeType?: string;
  parentId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  conflictBehavior?: 'rename' | 'replace' | 'fail';
}

/**
 * File download options (used by both)
 */
export interface DownloadOptions {
  fileId?: string;
  format?: string;
  mimeType?: string;
  exportFormat?: string;
}

/**
 * List files options (used by CloudStorageConnector)
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
 * File move options (used by both)
 */
export interface MoveOptions {
  fileId?: string;
  newParentId?: string;
  newPath?: string;
  addParents?: string[];
  removeParents?: string[];
}

/**
 * File rename options (used by CloudStorageConnector)
 */
export interface RenameOptions {
  fileId: string;
  newName: string;
}

/**
 * WatchOptions for setting up change notifications (used by Connector)
 */
export interface WatchOptions {
  channelId: string;
  address: string;
  type?: 'web_hook' | 'webhook';
  expiration?: number;
  token?: string;
  pageToken?: string;
}

/**
 * WatchResult contains watch channel information (used by Connector)
 */
export interface WatchResult {
  id: string;
  resourceId: string;
  resourceUri: string;
  expiration: number;
  token?: string;
}

/**
 * Subscription/webhook configuration for change notifications (used by CloudStorageConnector)
 */
export interface SubscriptionConfig {
  resourcePath: string;
  changeTypes: ('created' | 'updated' | 'deleted')[];
  notificationUrl: string;
  expirationDateTime?: Date;
  clientState?: string;
}

/**
 * Subscription response (used by CloudStorageConnector)
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
 * Change notification from cloud storage (used by CloudStorageConnector)
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
 * Generic cloud storage connector interface (OneDrive connector implementation)
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

/**
 * Base Connector interface that all cloud storage connectors must implement (Google Drive connector implementation)
 */
export interface Connector {
  /**
   * Initialize the connector with authentication
   * @param tokens - OAuth2 token information
   */
  initialize(tokens: TokenInfo): void;

  /**
   * Refresh access token using refresh token
   * @returns Promise resolving to updated token information
   */
  refreshToken(): Promise<TokenInfo>;

  /**
   * List files from cloud storage
   * @param options - Options for filtering and pagination
   * @returns Promise resolving to file list results
   */
  listFiles(options?: FileListOptions): Promise<FileListResult>;

  /**
   * Get file metadata
   * @param fileId - ID of the file
   * @param options - Options for metadata retrieval
   * @returns Promise resolving to file metadata
   */
  getFileMetadata(
    fileId: string,
    options?: FileMetadataOptions,
  ): Promise<DriveFile>;

  /**
   * Download file content
   * @param fileId - ID of the file
   * @param options - Download options
   * @returns Promise resolving to file content as Buffer
   */
  downloadFile(fileId: string, options?: DownloadOptions): Promise<Buffer>;

  /**
   * Upload file to cloud storage
   * @param content - File content as Buffer or string
   * @param options - Upload options
   * @returns Promise resolving to uploaded file metadata
   */
  uploadFile(
    content: Buffer | string,
    options: UploadOptions,
  ): Promise<DriveFile>;

  /**
   * Move file to a different location
   * @param fileId - ID of the file
   * @param options - Move options
   * @returns Promise resolving to updated file metadata
   */
  moveFile(fileId: string, options: MoveOptions): Promise<DriveFile>;

  /**
   * Rename a file
   * @param fileId - ID of the file
   * @param newName - New name for the file
   * @returns Promise resolving to updated file metadata
   */
  renameFile(fileId: string, newName: string): Promise<DriveFile>;

  /**
   * Watch for changes in cloud storage
   * @param options - Watch configuration options
   * @returns Promise resolving to watch channel information
   */
  watchChanges(options: WatchOptions): Promise<WatchResult>;

  /**
   * Stop watching a channel
   * @param channelId - ID of the channel to stop
   * @param resourceId - Resource ID of the channel
   */
  stopWatching(channelId: string, resourceId: string): Promise<void>;
}
