# Google Drive Connector

This module provides a comprehensive Google Drive connector implementation using the Google Drive API v3.

## Features

- **Authentication**: OAuth2 token management with automatic token refresh
- **File Listing**: List files with filtering, pagination, and custom queries
- **Metadata Retrieval**: Get detailed file metadata and properties
- **File Download**: Download file content with support for Google Docs export
- **File Upload**: Upload files with custom metadata and parent folder assignment
- **File Operations**: Move and rename files
- **Change Monitoring**: Watch for changes using webhooks

## Installation

The connector requires the `googleapis` package:

```bash
npm install googleapis
```

## Usage

### Initialize the Connector

```typescript
import { GoogleDriveConnector } from './connectors/google';
import { ConnectorConfig, TokenInfo } from './types/connector.types';

// Configure with OAuth2 credentials
const config: ConnectorConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_CALLBACK_URL,
  scopes: ['https://www.googleapis.com/auth/drive'],
};

const connector = new GoogleDriveConnector(config);

// Initialize with user tokens
const tokens: TokenInfo = {
  accessToken: 'user-access-token',
  refreshToken: 'user-refresh-token',
  expiryDate: Date.now() + 3600000,
};

connector.initialize(tokens);
```

### List Files

```typescript
// List all files with default settings
const result = await connector.listFiles();

// List files with filtering
const filteredResult = await connector.listFiles({
  pageSize: 50,
  query: 'name contains "report"',
  mimeType: 'application/pdf',
  orderBy: 'modifiedTime desc',
  includeShared: true,
});

console.log(`Found ${result.files.length} files`);
result.files.forEach(file => {
  console.log(`${file.name} (${file.id})`);
});
```

### Get File Metadata

```typescript
const fileId = 'file-id-from-drive';
const metadata = await connector.getFileMetadata(fileId);

console.log(`File: ${metadata.name}`);
console.log(`Size: ${metadata.size} bytes`);
console.log(`Modified: ${metadata.modifiedTime}`);
```

### Download File

```typescript
// Download regular file
const fileId = 'file-id-from-drive';
const content = await connector.downloadFile(fileId);
console.log(`Downloaded ${content.length} bytes`);

// Export Google Docs file as PDF
const docId = 'google-doc-id';
const pdfContent = await connector.downloadFile(docId, {
  exportFormat: 'application/pdf',
});
```

### Upload File

```typescript
// Upload a text file
const content = Buffer.from('Hello, Google Drive!');
const uploadedFile = await connector.uploadFile(content, {
  name: 'hello.txt',
  mimeType: 'text/plain',
  parentId: 'parent-folder-id',
  description: 'A test file',
});

console.log(`Uploaded file: ${uploadedFile.id}`);
```

### Move File

```typescript
// Move file to a different folder
const movedFile = await connector.moveFile('file-id', {
  addParents: ['new-parent-folder-id'],
  removeParents: ['old-parent-folder-id'],
});

console.log(`File moved: ${movedFile.name}`);
```

### Rename File

```typescript
const renamedFile = await connector.renameFile('file-id', 'new-name.txt');
console.log(`File renamed to: ${renamedFile.name}`);
```

### Watch for Changes

```typescript
// Set up webhook for change notifications
const watchResult = await connector.watchChanges({
  channelId: 'unique-channel-id',
  address: 'https://your-app.com/webhook/drive-changes',
  type: 'web_hook',
  expiration: Date.now() + 86400000, // 24 hours
  token: 'verification-token',
  pageToken: 'start-page-token',
});

console.log(`Watching changes with channel: ${watchResult.id}`);

// Stop watching when done
await connector.stopWatching(watchResult.id, watchResult.resourceId);
```

### Token Refresh

The connector includes automatic token refresh logic:

```typescript
// Manually refresh token if needed
const newTokens = await connector.refreshToken();
console.log(`New access token: ${newTokens.accessToken}`);
```

## Error Handling

All methods throw `ApiError` exceptions on failure:

```typescript
import { ApiError } from './middleware/ApiError';

try {
  const file = await connector.getFileMetadata('invalid-id');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.statusCode}: ${error.message}`);
  }
}
```

## Type Definitions

The connector uses comprehensive TypeScript interfaces:

- `Connector`: Base interface for all cloud storage connectors
- `TokenInfo`: OAuth2 token information
- `ConnectorConfig`: Connector configuration
- `DriveFile`: File metadata representation
- `FileListOptions`: Options for file listing
- `UploadOptions`: Options for file upload
- `MoveOptions`: Options for moving files
- `WatchOptions`: Options for change monitoring
- `WatchResult`: Watch channel information

All types are exported from `./types/connector.types`.

## Logging

The connector uses Winston logger for operational logging:

- Info level: Successful operations
- Error level: Failed operations with error details

## Testing

Run the test suite:

```bash
npm test
```

The connector includes comprehensive unit tests covering:
- Initialization and configuration
- All interface methods
- Error handling
- Type definitions
- Token management

## Architecture

The GoogleDriveConnector implements the `Connector` interface, ensuring compatibility with other cloud storage providers. This allows for easy swapping of providers in the application.

## Notes

- The connector requires valid OAuth2 credentials from Google Cloud Console
- Make sure to enable the Google Drive API in your Google Cloud project
- The connector automatically handles token expiration and refresh
- All file operations are logged for audit and debugging purposes
