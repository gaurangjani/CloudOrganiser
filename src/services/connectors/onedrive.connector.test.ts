// Tests for OneDrive connector
import { OneDriveConnector } from './onedrive.connector';
import {
  ConnectorConfig,
  OAuthToken,
  ListFilesOptions,
  UploadOptions,
  MoveOptions,
  RenameOptions,
  SubscriptionConfig,
} from '../../types/connector.types';
import { Client } from '@microsoft/microsoft-graph-client';

// Mock the Microsoft Graph Client
jest.mock('@microsoft/microsoft-graph-client');
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('OneDriveConnector', () => {
  let connector: OneDriveConnector;
  let mockConfig: ConnectorConfig;
  let mockToken: OAuthToken;
  const userId = 'test-user-123';

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['Files.Read', 'Files.ReadWrite', 'Files.Read.All'],
    };

    mockToken = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      tokenType: 'Bearer',
      scope: ['Files.Read', 'Files.ReadWrite'],
    };

    connector = new OneDriveConnector(mockConfig, userId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the connector with OAuth token', () => {
      const mockClient = {
        api: jest.fn(),
      };
      (Client.init as jest.Mock).mockReturnValue(mockClient);

      connector.initialize(mockToken);

      expect(Client.init).toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('should list files from root directory', async () => {
      const mockDriveItems = [
        {
          id: 'file-1',
          name: 'document.pdf',
          size: 2048,
          file: { mimeType: 'application/pdf' },
          createdDateTime: '2024-01-01T00:00:00Z',
          lastModifiedDateTime: '2024-01-02T00:00:00Z',
          parentReference: {
            path: '/drive/root:',
            driveId: 'drive-123',
            id: 'root',
          },
        },
        {
          id: 'file-2',
          name: 'image.jpg',
          size: 1024,
          file: { mimeType: 'image/jpeg' },
          createdDateTime: '2024-01-03T00:00:00Z',
          lastModifiedDateTime: '2024-01-04T00:00:00Z',
          parentReference: {
            path: '/drive/root:',
            driveId: 'drive-123',
            id: 'root',
          },
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({ value: mockDriveItems });
      const mockApi = jest.fn().mockReturnValue({ get: mockGet });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const options: ListFilesOptions = { path: '/' };
      const result = await connector.listFiles(options);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('document.pdf');
      expect(result[0].metadata.mimeType).toBe('application/pdf');
      expect(result[0].location.provider).toBe('microsoft');
      expect(result[1].name).toBe('image.jpg');
    });

    it('should list files from specific folder by ID', async () => {
      const mockDriveItems = [
        {
          id: 'file-3',
          name: 'report.docx',
          size: 4096,
          file: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
          createdDateTime: '2024-01-05T00:00:00Z',
          lastModifiedDateTime: '2024-01-06T00:00:00Z',
          parentReference: {
            path: '/drive/root:/Documents',
            driveId: 'drive-123',
            id: 'folder-456',
          },
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({ value: mockDriveItems });
      const mockApi = jest.fn().mockReturnValue({ get: mockGet });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const options: ListFilesOptions = { folderId: 'folder-456' };
      const result = await connector.listFiles(options);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('report.docx');
      expect(mockApi).toHaveBeenCalledWith('/me/drive/items/folder-456/children');
    });

    it('should filter out folders and only return files', async () => {
      const mockDriveItems = [
        {
          id: 'file-1',
          name: 'document.pdf',
          size: 2048,
          file: { mimeType: 'application/pdf' },
          createdDateTime: '2024-01-01T00:00:00Z',
          lastModifiedDateTime: '2024-01-02T00:00:00Z',
          parentReference: { path: '/drive/root:', driveId: 'drive-123', id: 'root' },
        },
        {
          id: 'folder-1',
          name: 'Documents',
          folder: { childCount: 5 },
          createdDateTime: '2024-01-01T00:00:00Z',
          lastModifiedDateTime: '2024-01-02T00:00:00Z',
          parentReference: { path: '/drive/root:', driveId: 'drive-123', id: 'root' },
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({ value: mockDriveItems });
      const mockApi = jest.fn().mockReturnValue({ get: mockGet });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const result = await connector.listFiles({ path: '/' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('document.pdf');
    });

    it('should throw error if connector not initialized', async () => {
      await expect(connector.listFiles({ path: '/' })).rejects.toThrow(
        'Connector not initialized'
      );
    });
  });

  describe('getFileMetadata', () => {
    it('should get metadata for a specific file', async () => {
      const mockDriveItem = {
        id: 'file-1',
        name: 'document.pdf',
        size: 2048,
        file: {
          mimeType: 'application/pdf',
          hashes: { sha1Hash: 'abc123' },
        },
        createdDateTime: '2024-01-01T00:00:00Z',
        lastModifiedDateTime: '2024-01-02T00:00:00Z',
      };

      const mockGet = jest.fn().mockResolvedValue(mockDriveItem);
      const mockApi = jest.fn().mockReturnValue({ get: mockGet });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const metadata = await connector.getFileMetadata('file-1');

      expect(metadata.size).toBe(2048);
      expect(metadata.mimeType).toBe('application/pdf');
      expect(metadata.extension).toBe('pdf');
      expect(metadata.checksum).toBe('abc123');
      expect(mockApi).toHaveBeenCalledWith('/me/drive/items/file-1');
    });
  });

  describe('downloadFile', () => {
    it('should download a file as buffer', async () => {
      const mockContent = Buffer.from('test file content');

      // Create an async generator to simulate stream
      async function* mockStream() {
        yield mockContent;
      }

      const mockGetStream = jest.fn().mockResolvedValue(mockStream());
      const mockApi = jest.fn().mockReturnValue({ getStream: mockGetStream });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const buffer = await connector.downloadFile({ fileId: 'file-1' });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe('test file content');
      expect(mockApi).toHaveBeenCalledWith('/me/drive/items/file-1/content');
    });
  });

  describe('uploadFile', () => {
    it('should upload a file to OneDrive', async () => {
      const mockDriveItem = {
        id: 'new-file-1',
        name: 'upload.txt',
        size: 100,
        file: { mimeType: 'text/plain' },
        createdDateTime: '2024-01-01T00:00:00Z',
        lastModifiedDateTime: '2024-01-01T00:00:00Z',
        parentReference: {
          path: '/drive/root:',
          driveId: 'drive-123',
          id: 'root',
        },
      };

      const mockPut = jest.fn().mockResolvedValue(mockDriveItem);
      const mockApi = jest.fn().mockReturnValue({ put: mockPut });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const options: UploadOptions = {
        path: '/',
        filename: 'upload.txt',
        content: Buffer.from('test content'),
        mimeType: 'text/plain',
        conflictBehavior: 'rename',
      };

      const result = await connector.uploadFile(options);

      expect(result.name).toBe('upload.txt');
      expect(result.metadata.size).toBe(100);
      expect(mockApi).toHaveBeenCalledWith(
        expect.stringContaining('/me/drive/root:/upload.txt:/content')
      );
    });

    it('should handle different conflict behaviors', async () => {
      const mockDriveItem = {
        id: 'new-file-1',
        name: 'upload.txt',
        size: 100,
        file: { mimeType: 'text/plain' },
        createdDateTime: '2024-01-01T00:00:00Z',
        lastModifiedDateTime: '2024-01-01T00:00:00Z',
        parentReference: { path: '/drive/root:', driveId: 'drive-123', id: 'root' },
      };

      const mockPut = jest.fn().mockResolvedValue(mockDriveItem);
      const mockApi = jest.fn().mockReturnValue({ put: mockPut });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const options: UploadOptions = {
        path: '/',
        filename: 'upload.txt',
        content: 'test content',
        conflictBehavior: 'replace',
      };

      await connector.uploadFile(options);

      expect(mockApi).toHaveBeenCalledWith(
        expect.stringContaining('conflictBehavior=replace')
      );
    });
  });

  describe('moveFile', () => {
    it('should move a file to a different folder', async () => {
      const mockDriveItem = {
        id: 'file-1',
        name: 'document.pdf',
        size: 2048,
        file: { mimeType: 'application/pdf' },
        createdDateTime: '2024-01-01T00:00:00Z',
        lastModifiedDateTime: '2024-01-02T00:00:00Z',
        parentReference: {
          path: '/drive/root:/NewFolder',
          driveId: 'drive-123',
          id: 'folder-456',
        },
      };

      const mockPatch = jest.fn().mockResolvedValue(mockDriveItem);
      const mockApi = jest.fn().mockReturnValue({ patch: mockPatch });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const options: MoveOptions = {
        fileId: 'file-1',
        newParentId: 'folder-456',
      };

      const result = await connector.moveFile(options);

      expect(result.name).toBe('document.pdf');
      expect(result.location.folderId).toBe('folder-456');
      expect(mockPatch).toHaveBeenCalledWith({
        parentReference: { id: 'folder-456' },
      });
    });

    it('should throw error if newParentId is missing', async () => {
      const mockClient = { api: jest.fn() };
      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      await expect(
        connector.moveFile({ fileId: 'file-1' } as MoveOptions)
      ).rejects.toThrow('newParentId is required for move operation');
    });
  });

  describe('renameFile', () => {
    it('should rename a file', async () => {
      const mockDriveItem = {
        id: 'file-1',
        name: 'renamed-document.pdf',
        size: 2048,
        file: { mimeType: 'application/pdf' },
        createdDateTime: '2024-01-01T00:00:00Z',
        lastModifiedDateTime: '2024-01-02T00:00:00Z',
        parentReference: {
          path: '/drive/root:',
          driveId: 'drive-123',
          id: 'root',
        },
      };

      const mockPatch = jest.fn().mockResolvedValue(mockDriveItem);
      const mockApi = jest.fn().mockReturnValue({ patch: mockPatch });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const options: RenameOptions = {
        fileId: 'file-1',
        newName: 'renamed-document.pdf',
      };

      const result = await connector.renameFile(options);

      expect(result.name).toBe('renamed-document.pdf');
      expect(mockPatch).toHaveBeenCalledWith({ name: 'renamed-document.pdf' });
    });
  });

  describe('subscribeToChanges', () => {
    it('should create a subscription for change notifications', async () => {
      const mockSubscription = {
        id: 'sub-123',
        changeType: 'created,updated,deleted',
        notificationUrl: 'https://example.com/webhook',
        resource: '/me/drive/root',
        expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(),
        clientState: 'secret-state',
      };

      const mockPost = jest.fn().mockResolvedValue(mockSubscription);
      const mockApi = jest.fn().mockReturnValue({ post: mockPost });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const config: SubscriptionConfig = {
        resourcePath: '/root',
        changeTypes: ['created', 'updated', 'deleted'],
        notificationUrl: 'https://example.com/webhook',
        clientState: 'secret-state',
      };

      const result = await connector.subscribeToChanges(config);

      expect(result.id).toBe('sub-123');
      expect(result.resourcePath).toBe('/root');
      expect(result.changeTypes).toEqual(['created', 'updated', 'deleted']);
      expect(mockPost).toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should delete a subscription', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockApi = jest.fn().mockReturnValue({ delete: mockDelete });
      const mockClient = { api: mockApi };

      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      await connector.unsubscribe('sub-123');

      expect(mockApi).toHaveBeenCalledWith('/subscriptions/sub-123');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh the OAuth token', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'Files.Read Files.ReadWrite',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const mockClient = { api: jest.fn() };
      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      const newToken = await connector.refreshToken();

      expect(newToken.accessToken).toBe('new-access-token');
      expect(newToken.refreshToken).toBe('new-refresh-token');
      expect(fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.any(Object)
      );
    });

    it('should throw error if no refresh token available', async () => {
      const tokenWithoutRefresh: OAuthToken = {
        ...mockToken,
        refreshToken: undefined,
      };

      connector.initialize(tokenWithoutRefresh);

      await expect(connector.refreshToken()).rejects.toThrow('No refresh token available');
    });

    it('should throw error if token refresh fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const mockClient = { api: jest.fn() };
      (Client.init as jest.Mock).mockReturnValue(mockClient);
      connector.initialize(mockToken);

      await expect(connector.refreshToken()).rejects.toThrow('Failed to refresh access token');
    });
  });
});
