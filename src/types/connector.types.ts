// Connector type definitions for cloud storage providers

/**
 * TokenInfo represents OAuth2 token information
 */
export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  tokenType?: string;
  scope?: string;
}

/**
 * ConnectorConfig contains configuration for cloud storage connectors
 */
export interface ConnectorConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  scopes?: string[];
}

/**
 * FileListOptions for filtering and pagination
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
 * FileListResult contains paginated file list results
 */
export interface FileListResult {
  files: DriveFile[];
  nextPageToken?: string;
  hasMore: boolean;
}

/**
 * DriveFile represents a file in cloud storage
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
 * FileMetadataOptions for fetching file metadata
 */
export interface FileMetadataOptions {
  fields?: string[];
  includePermissions?: boolean;
}

/**
 * UploadOptions for file upload operations
 */
export interface UploadOptions {
  name: string;
  mimeType?: string;
  parentId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DownloadOptions for file download operations
 */
export interface DownloadOptions {
  mimeType?: string;
  exportFormat?: string;
}

/**
 * MoveOptions for moving files
 */
export interface MoveOptions {
  addParents?: string[];
  removeParents?: string[];
}

/**
 * WatchOptions for setting up change notifications
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
 * WatchResult contains watch channel information
 */
export interface WatchResult {
  id: string;
  resourceId: string;
  resourceUri: string;
  expiration: number;
  token?: string;
}

/**
 * Base Connector interface that all cloud storage connectors must implement
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
