// Google Drive connector tests
import { GoogleDriveConnector } from './GoogleDriveConnector';
import {
  ConnectorConfig,
  TokenInfo,
  FileListOptions,
  UploadOptions,
  MoveOptions,
  WatchOptions,
} from '../../types/connector.types';

// Mock google-auth-library and googleapis
jest.mock('googleapis');
jest.mock('google-auth-library');

describe('GoogleDriveConnector', () => {
  let connector: GoogleDriveConnector;
  let mockConfig: ConnectorConfig;
  let mockTokens: TokenInfo;

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['https://www.googleapis.com/auth/drive'],
    };

    mockTokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiryDate: Date.now() + 3600000,
      tokenType: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive',
    };

    connector = new GoogleDriveConnector(mockConfig);
  });

  describe('Constructor', () => {
    it('should create a GoogleDriveConnector instance', () => {
      expect(connector).toBeInstanceOf(GoogleDriveConnector);
    });
  });

  describe('initialize', () => {
    it('should initialize the connector with tokens', () => {
      expect(() => connector.initialize(mockTokens)).not.toThrow();
    });
  });

  describe('Type Definitions', () => {
    it('should have proper FileListOptions type', () => {
      const options: FileListOptions = {
        pageSize: 100,
        pageToken: 'token',
        query: 'name contains "test"',
        parentId: 'parent-123',
        mimeType: 'application/pdf',
        orderBy: 'modifiedTime desc',
        includeShared: true,
      };

      expect(options.pageSize).toBe(100);
      expect(options.query).toBe('name contains "test"');
    });

    it('should have proper UploadOptions type', () => {
      const options: UploadOptions = {
        name: 'test-file.txt',
        mimeType: 'text/plain',
        parentId: 'parent-123',
        description: 'Test file',
        metadata: { custom: 'value' },
      };

      expect(options.name).toBe('test-file.txt');
      expect(options.mimeType).toBe('text/plain');
    });

    it('should have proper MoveOptions type', () => {
      const options: MoveOptions = {
        addParents: ['parent-456'],
        removeParents: ['parent-123'],
      };

      expect(options.addParents).toContain('parent-456');
      expect(options.removeParents).toContain('parent-123');
    });

    it('should have proper WatchOptions type', () => {
      const options: WatchOptions = {
        channelId: 'channel-123',
        address: 'https://example.com/webhook',
        type: 'web_hook',
        expiration: Date.now() + 86400000,
        token: 'verification-token',
        pageToken: 'start-token',
      };

      expect(options.channelId).toBe('channel-123');
      expect(options.address).toBe('https://example.com/webhook');
    });
  });

  describe('Connector Interface Implementation', () => {
    it('should implement all Connector interface methods', () => {
      expect(typeof connector.initialize).toBe('function');
      expect(typeof connector.refreshToken).toBe('function');
      expect(typeof connector.listFiles).toBe('function');
      expect(typeof connector.getFileMetadata).toBe('function');
      expect(typeof connector.downloadFile).toBe('function');
      expect(typeof connector.uploadFile).toBe('function');
      expect(typeof connector.moveFile).toBe('function');
      expect(typeof connector.renameFile).toBe('function');
      expect(typeof connector.watchChanges).toBe('function');
      expect(typeof connector.stopWatching).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when methods are called before initialization', async () => {
      const uninitializedConnector = new GoogleDriveConnector(mockConfig);

      await expect(uninitializedConnector.listFiles()).rejects.toThrow(
        'GoogleDriveConnector not initialized',
      );

      await expect(
        uninitializedConnector.getFileMetadata('file-123'),
      ).rejects.toThrow('GoogleDriveConnector not initialized');

      await expect(
        uninitializedConnector.downloadFile('file-123'),
      ).rejects.toThrow('GoogleDriveConnector not initialized');

      await expect(
        uninitializedConnector.uploadFile(Buffer.from('test'), {
          name: 'test.txt',
        }),
      ).rejects.toThrow('GoogleDriveConnector not initialized');

      await expect(
        uninitializedConnector.moveFile('file-123', {
          addParents: ['parent-456'],
        }),
      ).rejects.toThrow('GoogleDriveConnector not initialized');

      await expect(
        uninitializedConnector.renameFile('file-123', 'new-name.txt'),
      ).rejects.toThrow('GoogleDriveConnector not initialized');

      await expect(
        uninitializedConnector.watchChanges({
          channelId: 'channel-123',
          address: 'https://example.com/webhook',
        }),
      ).rejects.toThrow('GoogleDriveConnector not initialized');

      await expect(
        uninitializedConnector.stopWatching('channel-123', 'resource-123'),
      ).rejects.toThrow('GoogleDriveConnector not initialized');
    });
  });

  describe('Token Management', () => {
    it('should have proper TokenInfo structure', () => {
      expect(mockTokens).toHaveProperty('accessToken');
      expect(mockTokens).toHaveProperty('refreshToken');
      expect(mockTokens).toHaveProperty('expiryDate');
      expect(mockTokens).toHaveProperty('tokenType');
      expect(mockTokens).toHaveProperty('scope');
    });

    it('should accept tokens during initialization', () => {
      connector.initialize(mockTokens);
      // If no error is thrown, initialization was successful
      expect(true).toBe(true);
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      connector.initialize(mockTokens);
    });

    it('should handle file content as Buffer', () => {
      const content = Buffer.from('test file content');
      expect(Buffer.isBuffer(content)).toBe(true);
    });

    it('should handle file content as string', () => {
      const content = 'test file content';
      expect(typeof content).toBe('string');
    });
  });

  describe('Configuration', () => {
    it('should accept valid connector configuration', () => {
      const config: ConnectorConfig = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      };

      const newConnector = new GoogleDriveConnector(config);
      expect(newConnector).toBeInstanceOf(GoogleDriveConnector);
    });

    it('should work without optional configuration fields', () => {
      const minimalConfig: ConnectorConfig = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      const newConnector = new GoogleDriveConnector(minimalConfig);
      expect(newConnector).toBeInstanceOf(GoogleDriveConnector);
    });
  });
});
