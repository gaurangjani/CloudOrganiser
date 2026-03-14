// Google Drive connector implementation
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import {
  Connector,
  TokenInfo,
  ConnectorConfig,
  FileListOptions,
  FileListResult,
  DriveFile,
  FileMetadataOptions,
  UploadOptions,
  DownloadOptions,
  MoveOptions,
  WatchOptions,
  WatchResult,
} from '../../types/connector.types';
import { ApiError } from '../../middleware/ApiError';
import { logger } from '../../config/logger';

/**
 * GoogleDriveConnector implements the Connector interface for Google Drive
 * Provides methods for file operations and change monitoring
 */
export class GoogleDriveConnector implements Connector {
  private oauth2Client: OAuth2Client;
  private drive: drive_v3.Drive | null = null;

  /**
   * Create a new GoogleDriveConnector instance
   * @param config - Configuration with OAuth2 credentials
   */
  constructor(config: ConnectorConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
  }

  /**
   * Initialize the connector with OAuth2 tokens
   * @param tokens - OAuth2 token information
   */
  initialize(tokens: TokenInfo): void {
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
      token_type: tokens.tokenType,
      scope: tokens.scope,
    });

    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth2Client,
    });

    logger.info('GoogleDriveConnector initialized');
  }

  /**
   * Refresh access token using refresh token
   * @returns Promise resolving to updated token information
   */
  async refreshToken(): Promise<TokenInfo> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      logger.info('Google Drive access token refreshed');

      return {
        accessToken: credentials.access_token || '',
        refreshToken: credentials.refresh_token || undefined,
        expiryDate: credentials.expiry_date || undefined,
        tokenType: credentials.token_type || undefined,
        scope: credentials.scope || undefined,
      };
    } catch (error) {
      logger.error('Failed to refresh Google Drive token', { error });
      throw ApiError.unauthorized('Failed to refresh access token');
    }
  }

  /**
   * Ensure the connector is initialized
   * @throws ApiError if not initialized
   */
  private ensureInitialized(): void {
    if (!this.drive) {
      throw ApiError.internal('GoogleDriveConnector not initialized');
    }
  }

  /**
   * Convert Google Drive file to DriveFile interface
   * @param file - Google Drive file resource
   * @returns DriveFile object
   */
  private toDriveFile(file: drive_v3.Schema$File): DriveFile {
    return {
      id: file.id || '',
      name: file.name || '',
      mimeType: file.mimeType || '',
      size: file.size ? parseInt(file.size, 10) : undefined,
      createdTime: file.createdTime ? new Date(file.createdTime) : new Date(),
      modifiedTime: file.modifiedTime
        ? new Date(file.modifiedTime)
        : new Date(),
      parentIds: file.parents || undefined,
      webViewLink: file.webViewLink || undefined,
      webContentLink: file.webContentLink || undefined,
      thumbnailLink: file.thumbnailLink || undefined,
      shared: file.shared || undefined,
      owners: file.owners?.map((owner) => owner.emailAddress || ''),
      permissions: file.permissions?.map((perm) => perm.role || ''),
      description: file.description || undefined,
    };
  }

  /**
   * List files from Google Drive
   * @param options - Options for filtering and pagination
   * @returns Promise resolving to file list results
   */
  async listFiles(options?: FileListOptions): Promise<FileListResult> {
    this.ensureInitialized();

    try {
      const params: drive_v3.Params$Resource$Files$List = {
        pageSize: options?.pageSize || 100,
        pageToken: options?.pageToken,
        fields:
          'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, thumbnailLink, shared, owners, permissions, description)',
        orderBy: options?.orderBy || 'modifiedTime desc',
        q: this.buildQuery(options),
      };

      const response = await this.drive!.files.list(params);

      logger.info('Listed Google Drive files', {
        count: response.data.files?.length || 0,
      });

      return {
        files: (response.data.files || []).map((file) =>
          this.toDriveFile(file),
        ),
        nextPageToken: response.data.nextPageToken || undefined,
        hasMore: !!response.data.nextPageToken,
      };
    } catch (error) {
      logger.error('Failed to list Google Drive files', { error });
      throw ApiError.internal('Failed to list files from Google Drive');
    }
  }

  /**
   * Build query string for file listing
   * @param options - File list options
   * @returns Query string
   */
  private buildQuery(options?: FileListOptions): string {
    const conditions: string[] = [];

    if (options?.parentId) {
      conditions.push(`'${options.parentId}' in parents`);
    }

    if (options?.mimeType) {
      conditions.push(`mimeType='${options.mimeType}'`);
    }

    if (options?.query) {
      conditions.push(options.query);
    }

    if (!options?.includeShared) {
      conditions.push('trashed=false');
    } else {
      conditions.push('(trashed=false or sharedWithMe=true)');
    }

    return conditions.join(' and ');
  }

  /**
   * Get file metadata from Google Drive
   * @param fileId - ID of the file
   * @param options - Options for metadata retrieval
   * @returns Promise resolving to file metadata
   */
  async getFileMetadata(
    fileId: string,
    options?: FileMetadataOptions,
  ): Promise<DriveFile> {
    this.ensureInitialized();

    try {
      const fields =
        options?.fields?.join(',') ||
        'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, thumbnailLink, shared, owners, permissions, description';

      const response = await this.drive!.files.get({
        fileId,
        fields,
      });

      logger.info('Retrieved Google Drive file metadata', { fileId });

      return this.toDriveFile(response.data);
    } catch (error) {
      logger.error('Failed to get Google Drive file metadata', {
        fileId,
        error,
      });
      throw ApiError.notFound('File not found in Google Drive');
    }
  }

  /**
   * Download file content from Google Drive
   * @param fileId - ID of the file
   * @param options - Download options
   * @returns Promise resolving to file content as Buffer
   */
  async downloadFile(
    fileId: string,
    options?: DownloadOptions,
  ): Promise<Buffer> {
    this.ensureInitialized();

    try {
      const params: drive_v3.Params$Resource$Files$Get = {
        fileId,
        alt: 'media',
      };

      // For Google Docs files, export to specified format
      if (options?.exportFormat) {
        const exportResponse = await this.drive!.files.export(
          {
            fileId,
            mimeType: options.exportFormat,
          },
          { responseType: 'stream' },
        );

        return await this.streamToBuffer(exportResponse.data as Readable);
      }

      const response = await this.drive!.files.get(params, {
        responseType: 'stream',
      });

      logger.info('Downloaded Google Drive file', { fileId });

      return await this.streamToBuffer(response.data as Readable);
    } catch (error) {
      logger.error('Failed to download Google Drive file', { fileId, error });
      throw ApiError.internal('Failed to download file from Google Drive');
    }
  }

  /**
   * Convert stream to buffer
   * @param stream - Readable stream
   * @returns Promise resolving to Buffer
   */
  private streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Upload file to Google Drive
   * @param content - File content as Buffer or string
   * @param options - Upload options
   * @returns Promise resolving to uploaded file metadata
   */
  async uploadFile(
    content: Buffer | string,
    options: UploadOptions,
  ): Promise<DriveFile> {
    this.ensureInitialized();

    try {
      const requestBody: drive_v3.Schema$File = {
        name: options.name,
        mimeType: options.mimeType,
        description: options.description,
        parents: options.parentId ? [options.parentId] : undefined,
      };

      const media = {
        mimeType: options.mimeType || 'application/octet-stream',
        body: Readable.from(content),
      };

      const response = await this.drive!.files.create({
        requestBody,
        media,
        fields:
          'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink',
      });

      logger.info('Uploaded file to Google Drive', {
        fileId: response.data.id,
        name: options.name,
      });

      return this.toDriveFile(response.data);
    } catch (error) {
      logger.error('Failed to upload file to Google Drive', { error });
      throw ApiError.internal('Failed to upload file to Google Drive');
    }
  }

  /**
   * Move file to a different location in Google Drive
   * @param fileId - ID of the file
   * @param options - Move options
   * @returns Promise resolving to updated file metadata
   */
  async moveFile(fileId: string, options: MoveOptions): Promise<DriveFile> {
    this.ensureInitialized();

    try {
      const response = await this.drive!.files.update({
        fileId,
        addParents: options.addParents?.join(','),
        removeParents: options.removeParents?.join(','),
        fields:
          'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink',
      });

      logger.info('Moved Google Drive file', { fileId });

      return this.toDriveFile(response.data);
    } catch (error) {
      logger.error('Failed to move Google Drive file', { fileId, error });
      throw ApiError.internal('Failed to move file in Google Drive');
    }
  }

  /**
   * Rename a file in Google Drive
   * @param fileId - ID of the file
   * @param newName - New name for the file
   * @returns Promise resolving to updated file metadata
   */
  async renameFile(fileId: string, newName: string): Promise<DriveFile> {
    this.ensureInitialized();

    try {
      const response = await this.drive!.files.update({
        fileId,
        requestBody: {
          name: newName,
        },
        fields:
          'id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink',
      });

      logger.info('Renamed Google Drive file', { fileId, newName });

      return this.toDriveFile(response.data);
    } catch (error) {
      logger.error('Failed to rename Google Drive file', { fileId, error });
      throw ApiError.internal('Failed to rename file in Google Drive');
    }
  }

  /**
   * Watch for changes in Google Drive
   * @param options - Watch configuration options
   * @returns Promise resolving to watch channel information
   */
  async watchChanges(options: WatchOptions): Promise<WatchResult> {
    this.ensureInitialized();

    try {
      const requestBody: drive_v3.Schema$Channel = {
        id: options.channelId,
        type: options.type || 'web_hook',
        address: options.address,
        token: options.token,
        expiration: options.expiration?.toString(),
      };

      const params: drive_v3.Params$Resource$Changes$Watch = {
        requestBody,
        pageToken: options.pageToken || '1',
      };

      const response = await this.drive!.changes.watch(params);

      logger.info('Started watching Google Drive changes', {
        channelId: options.channelId,
      });

      return {
        id: response.data.id || '',
        resourceId: response.data.resourceId || '',
        resourceUri: response.data.resourceUri || '',
        expiration: parseInt(response.data.expiration || '0', 10),
        token: response.data.token || undefined,
      };
    } catch (error) {
      logger.error('Failed to watch Google Drive changes', { error });
      throw ApiError.internal('Failed to set up Google Drive change watch');
    }
  }

  /**
   * Stop watching a Google Drive channel
   * @param channelId - ID of the channel to stop
   * @param resourceId - Resource ID of the channel
   */
  async stopWatching(channelId: string, resourceId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.drive!.channels.stop({
        requestBody: {
          id: channelId,
          resourceId,
        },
      });

      logger.info('Stopped watching Google Drive channel', { channelId });
    } catch (error) {
      logger.error('Failed to stop watching Google Drive channel', {
        channelId,
        error,
      });
      throw ApiError.internal('Failed to stop Google Drive watch channel');
    }
  }
}
