// OneDrive/SharePoint connector using Microsoft Graph API
import { Client } from '@microsoft/microsoft-graph-client';
import { DriveItem } from '@microsoft/microsoft-graph-types';
import {
  CloudStorageConnector,
  OAuthToken,
  ConnectorConfig,
  UploadOptions,
  DownloadOptions,
  ListFilesOptions,
  MoveOptions,
  RenameOptions,
  SubscriptionConfig,
  Subscription,
} from '../../types/connector.types';
import { FileContext, FileMetadata, FileLocation } from '../../types/context.types';
import { ApiError } from '../../middleware/ApiError';
import { logger } from '../../config/logger';

/**
 * OneDrive connector implementing CloudStorageConnector interface
 * Supports OneDrive and SharePoint file operations via Microsoft Graph API
 */
export class OneDriveConnector implements CloudStorageConnector {
  private client: Client | null = null;
  private token: OAuthToken | null = null;
  private config: ConnectorConfig;
  private userId: string;

  constructor(config: ConnectorConfig, userId: string) {
    this.config = config;
    this.userId = userId;
  }

  /**
   * Initialize the connector with OAuth token
   */
  initialize(token: OAuthToken): void {
    this.token = token;
    this.client = Client.init({
      authProvider: (done) => {
        done(null, token.accessToken);
      },
    });
    logger.info('OneDrive connector initialized for user', { userId: this.userId });
  }

  /**
   * Refresh the OAuth token
   */
  async refreshToken(): Promise<OAuthToken> {
    if (!this.token || !this.token.refreshToken) {
      throw ApiError.unauthorized('No refresh token available');
    }

    try {
      // Build token refresh request
      const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.token.refreshToken,
        grant_type: 'refresh_token',
        scope: this.config.scopes.join(' '),
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw ApiError.unauthorized('Failed to refresh token');
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope?: string;
      };

      const newToken: OAuthToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.token.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        tokenType: data.token_type,
        scope: data.scope?.split(' '),
      };

      // Reinitialize with new token
      this.initialize(newToken);
      logger.info('Token refreshed successfully', { userId: this.userId });

      return newToken;
    } catch (error) {
      logger.error('Error refreshing token:', error);
      throw ApiError.unauthorized('Failed to refresh access token');
    }
  }

  /**
   * Ensure client is initialized
   */
  private ensureInitialized(): void {
    if (!this.client || !this.token) {
      throw ApiError.internal('Connector not initialized. Call initialize() first.');
    }

    // Check if token is expired and needs refresh
    if (this.token.expiresAt && new Date() >= this.token.expiresAt) {
      logger.warn('Token expired, attempting refresh', { userId: this.userId });
      // In a real implementation, this should trigger automatic refresh
      throw ApiError.unauthorized('Token expired. Please refresh token.');
    }
  }

  /**
   * Convert DriveItem to FileContext
   */
  private driveItemToFileContext(item: DriveItem, userId: string): FileContext {
    const metadata: FileMetadata = {
      size: item.size || 0,
      mimeType: item.file?.mimeType || 'application/octet-stream',
      createdAt: item.createdDateTime ? new Date(item.createdDateTime) : new Date(),
      modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : new Date(),
      extension: item.name?.split('.').pop() || '',
      checksum: item.file?.hashes?.sha1Hash || undefined,
    };

    const location: FileLocation = {
      provider: 'microsoft',
      path: item.parentReference?.path?.replace('/drive/root:', '') || '/',
      parentPath: item.parentReference?.path?.replace('/drive/root:', '') || '/',
      fullPath: `${item.parentReference?.path?.replace('/drive/root:', '') || ''}/${item.name}`,
      driveId: item.parentReference?.driveId || undefined,
      folderId: item.parentReference?.id || undefined,
    };

    return {
      id: item.id || '',
      name: item.name || '',
      metadata,
      location,
      userId,
    };
  }

  /**
   * List files in a directory
   */
  async listFiles(options: ListFilesOptions): Promise<FileContext[]> {
    this.ensureInitialized();

    try {
      const path = options.path || '/';
      const folderId = options.folderId;

      let endpoint: string;
      if (folderId) {
        endpoint = `/me/drive/items/${folderId}/children`;
      } else if (path === '/' || path === '') {
        endpoint = '/me/drive/root/children';
      } else {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        endpoint = `/me/drive/root:/${cleanPath}:/children`;
      }

      let query = this.client!.api(endpoint);

      if (options.pageSize) {
        query = query.top(options.pageSize);
      }

      if (options.filter) {
        query = query.filter(options.filter);
      }

      if (options.orderBy) {
        query = query.orderby(options.orderBy);
      }

      const response = await query.get();
      const items: DriveItem[] = response.value || [];

      logger.info('Listed files from OneDrive', {
        userId: this.userId,
        path,
        count: items.length,
      });

      return items
        .filter((item) => item.file) // Only files, not folders
        .map((item) => this.driveItemToFileContext(item, this.userId));
    } catch (error) {
      logger.error('Error listing files:', error);
      throw ApiError.internal('Failed to list files from OneDrive');
    }
  }

  /**
   * Get metadata for a specific file
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    this.ensureInitialized();

    try {
      const item: DriveItem = await this.client!.api(`/me/drive/items/${fileId}`).get();

      const metadata: FileMetadata = {
        size: item.size || 0,
        mimeType: item.file?.mimeType || 'application/octet-stream',
        createdAt: item.createdDateTime ? new Date(item.createdDateTime) : new Date(),
        modifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : new Date(),
        extension: item.name?.split('.').pop() || '',
        checksum: item.file?.hashes?.sha1Hash || undefined,
      };

      logger.info('Retrieved file metadata', { userId: this.userId, fileId });
      return metadata;
    } catch (error) {
      logger.error('Error getting file metadata:', error);
      throw ApiError.notFound('File not found');
    }
  }

  /**
   * Download a file
   */
  async downloadFile(options: DownloadOptions): Promise<Buffer> {
    this.ensureInitialized();

    try {
      const downloadUrl = await this.client!
        .api(`/me/drive/items/${options.fileId}/content`)
        .getStream();

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of downloadUrl) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      logger.info('Downloaded file', {
        userId: this.userId,
        fileId: options.fileId,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Error downloading file:', error);
      throw ApiError.internal('Failed to download file from OneDrive');
    }
  }

  /**
   * Upload a file
   */
  async uploadFile(options: UploadOptions): Promise<FileContext> {
    this.ensureInitialized();

    try {
      const content = Buffer.isBuffer(options.content)
        ? options.content
        : Buffer.from(options.content);

      const path = options.path || '/';
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const fullPath = cleanPath ? `${cleanPath}/${options.filename}` : options.filename;

      let uploadEndpoint: string;
      if (fullPath === options.filename) {
        uploadEndpoint = `/me/drive/root:/${options.filename}:/content`;
      } else {
        uploadEndpoint = `/me/drive/root:/${fullPath}:/content`;
      }

      // Handle conflict behavior
      let uploadUrl = uploadEndpoint;
      if (options.conflictBehavior === 'rename') {
        uploadUrl += '?@microsoft.graph.conflictBehavior=rename';
      } else if (options.conflictBehavior === 'replace') {
        uploadUrl += '?@microsoft.graph.conflictBehavior=replace';
      } else if (options.conflictBehavior === 'fail') {
        uploadUrl += '?@microsoft.graph.conflictBehavior=fail';
      }

      const item: DriveItem = await this.client!.api(uploadUrl).put(content);

      logger.info('Uploaded file to OneDrive', {
        userId: this.userId,
        filename: options.filename,
        size: content.length,
      });

      return this.driveItemToFileContext(item, this.userId);
    } catch (error) {
      logger.error('Error uploading file:', error);
      throw ApiError.internal('Failed to upload file to OneDrive');
    }
  }

  /**
   * Move a file to a different location
   */
  async moveFile(options: MoveOptions): Promise<FileContext> {
    this.ensureInitialized();

    if (!options.newParentId) {
      throw ApiError.badRequest('newParentId is required for move operation');
    }

    try {
      const updatePayload = {
        parentReference: {
          id: options.newParentId,
        },
      };

      const item: DriveItem = await this.client!
        .api(`/me/drive/items/${options.fileId}`)
        .patch(updatePayload);

      logger.info('Moved file', {
        userId: this.userId,
        fileId: options.fileId,
        newParentId: options.newParentId,
      });

      return this.driveItemToFileContext(item, this.userId);
    } catch (error) {
      logger.error('Error moving file:', error);
      throw ApiError.internal('Failed to move file in OneDrive');
    }
  }

  /**
   * Rename a file
   */
  async renameFile(options: RenameOptions): Promise<FileContext> {
    this.ensureInitialized();

    try {
      const updatePayload = {
        name: options.newName,
      };

      const item: DriveItem = await this.client!
        .api(`/me/drive/items/${options.fileId}`)
        .patch(updatePayload);

      logger.info('Renamed file', {
        userId: this.userId,
        fileId: options.fileId,
        newName: options.newName,
      });

      return this.driveItemToFileContext(item, this.userId);
    } catch (error) {
      logger.error('Error renaming file:', error);
      throw ApiError.internal('Failed to rename file in OneDrive');
    }
  }

  /**
   * Subscribe to change notifications
   */
  async subscribeToChanges(config: SubscriptionConfig): Promise<Subscription> {
    this.ensureInitialized();

    try {
      // Set expiration time (max 4230 minutes for drive items)
      const expirationDateTime =
        config.expirationDateTime ||
        new Date(Date.now() + 4230 * 60 * 1000); // 4230 minutes from now

      const subscriptionPayload = {
        changeType: config.changeTypes.join(','),
        notificationUrl: config.notificationUrl,
        resource: `/me/drive${config.resourcePath}`,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: config.clientState,
      };

      const response = await this.client!.api('/subscriptions').post(subscriptionPayload);

      logger.info('Created subscription', {
        userId: this.userId,
        subscriptionId: response.id,
        resourcePath: config.resourcePath,
      });

      return {
        id: response.id,
        resourcePath: config.resourcePath,
        changeTypes: config.changeTypes,
        notificationUrl: config.notificationUrl,
        expirationDateTime: new Date(response.expirationDateTime),
        clientState: config.clientState,
      };
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw ApiError.internal('Failed to subscribe to OneDrive changes');
    }
  }

  /**
   * Unsubscribe from change notifications
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.client!.api(`/subscriptions/${subscriptionId}`).delete();

      logger.info('Deleted subscription', {
        userId: this.userId,
        subscriptionId,
      });
    } catch (error) {
      logger.error('Error deleting subscription:', error);
      throw ApiError.internal('Failed to unsubscribe from OneDrive changes');
    }
  }
}
