# OneDrive/SharePoint Connector

A comprehensive TypeScript connector for OneDrive and SharePoint using Microsoft Graph API with OAuth 2.0 authentication and refresh token handling.

## Features

- **Full OAuth 2.0 Support**: Secure authentication with automatic token refresh
- **File Operations**: Complete CRUD operations for files
- **Real-time Notifications**: Subscribe to file change events via webhooks
- **Type-Safe**: Written in TypeScript with comprehensive type definitions
- **Well-Tested**: 17 test cases with 80% code coverage

## Installation

The connector uses the following dependencies:

```bash
npm install @microsoft/microsoft-graph-client @microsoft/microsoft-graph-types
```

## Usage

### Initialize the Connector

```typescript
import { OneDriveConnector } from './services/connectors/onedrive.connector';
import { ConnectorConfig, OAuthToken } from './types/connector.types';

const config: ConnectorConfig = {
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'http://localhost:3000/auth/microsoft/callback',
  scopes: ['user.read', 'Files.Read', 'Files.ReadWrite', 'Files.Read.All'],
};

const connector = new OneDriveConnector(config, userId);

const token: OAuthToken = {
  accessToken: 'your-access-token',
  refreshToken: 'your-refresh-token',
  expiresAt: new Date(Date.now() + 3600 * 1000),
  tokenType: 'Bearer',
  scope: ['Files.Read', 'Files.ReadWrite'],
};

connector.initialize(token);
```

### List Files

```typescript
const files = await connector.listFiles({
  path: '/Documents',
  pageSize: 50,
  orderBy: 'name',
});

console.log(`Found ${files.length} files`);
```

### Get File Metadata

```typescript
const metadata = await connector.getFileMetadata('file-id-123');
console.log(`File size: ${metadata.size} bytes`);
console.log(`MIME type: ${metadata.mimeType}`);
```

### Download File

```typescript
const buffer = await connector.downloadFile({
  fileId: 'file-id-123',
});

// Save to disk or process the buffer
fs.writeFileSync('downloaded-file.pdf', buffer);
```

### Upload File

```typescript
const fileContent = fs.readFileSync('document.pdf');

const uploadedFile = await connector.uploadFile({
  path: '/Documents',
  filename: 'document.pdf',
  content: fileContent,
  mimeType: 'application/pdf',
  conflictBehavior: 'rename', // 'rename' | 'replace' | 'fail'
});

console.log(`Uploaded file: ${uploadedFile.name}`);
```

### Move File

```typescript
const movedFile = await connector.moveFile({
  fileId: 'file-id-123',
  newParentId: 'folder-id-456',
});

console.log(`Moved file to: ${movedFile.location.path}`);
```

### Rename File

```typescript
const renamedFile = await connector.renameFile({
  fileId: 'file-id-123',
  newName: 'new-document-name.pdf',
});

console.log(`Renamed to: ${renamedFile.name}`);
```

### Subscribe to Changes

```typescript
const subscription = await connector.subscribeToChanges({
  resourcePath: '/root',
  changeTypes: ['created', 'updated', 'deleted'],
  notificationUrl: 'https://your-app.com/webhook/notifications',
  clientState: 'secret-validation-token',
});

console.log(`Subscription ID: ${subscription.id}`);
console.log(`Expires at: ${subscription.expirationDateTime}`);
```

### Unsubscribe from Changes

```typescript
await connector.unsubscribe('subscription-id-123');
```

### Refresh Token

```typescript
const newToken = await connector.refreshToken();

// Store the new token for future use
console.log(`New access token: ${newToken.accessToken}`);
```

## API Reference

### CloudStorageConnector Interface

All methods are documented in the `CloudStorageConnector` interface in `src/types/connector.types.ts`.

#### Methods

- `initialize(token: OAuthToken): void` - Initialize connector with OAuth token
- `refreshToken(): Promise<OAuthToken>` - Refresh the OAuth access token
- `listFiles(options: ListFilesOptions): Promise<FileContext[]>` - List files in a directory
- `getFileMetadata(fileId: string): Promise<FileMetadata>` - Get metadata for a file
- `downloadFile(options: DownloadOptions): Promise<Buffer>` - Download file content
- `uploadFile(options: UploadOptions): Promise<FileContext>` - Upload a new file
- `moveFile(options: MoveOptions): Promise<FileContext>` - Move file to different folder
- `renameFile(options: RenameOptions): Promise<FileContext>` - Rename a file
- `subscribeToChanges(config: SubscriptionConfig): Promise<Subscription>` - Subscribe to change notifications
- `unsubscribe(subscriptionId: string): Promise<void>` - Cancel a subscription

## Error Handling

The connector uses the `ApiError` class for consistent error handling:

```typescript
try {
  const files = await connector.listFiles({ path: '/Documents' });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.statusCode}: ${error.message}`);
  }
}
```

Error types:
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Token expired or invalid
- `404 Not Found` - File or folder not found
- `500 Internal Server Error` - API or network error

## OAuth 2.0 Setup

### Required Scopes

The connector requires the following Microsoft Graph API scopes:

- `user.read` - Basic user profile information
- `Files.Read` - Read user files
- `Files.ReadWrite` - Read and write user files
- `Files.Read.All` - Read files in all site collections (optional)

### Microsoft App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Configure:
   - Name: Your app name
   - Supported account types: Choose appropriate option
   - Redirect URI: `http://localhost:3000/auth/microsoft/callback` (or your production URL)
5. After creation, note the "Application (client) ID"
6. Go to "Certificates & secrets" > "New client secret"
7. Copy the secret value
8. Go to "API permissions" > "Add a permission" > "Microsoft Graph" > "Delegated permissions"
9. Add: `User.Read`, `Files.Read`, `Files.ReadWrite`, `Files.Read.All`
10. Click "Grant admin consent"

### Environment Variables

Add these to your `.env` file:

```env
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_CALLBACK_URL=http://localhost:3000/auth/microsoft/callback
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- onedrive.connector.test.ts
```

The test suite includes:
- Initialization tests
- File listing (root, by folder ID, filtering)
- Metadata retrieval
- File download
- File upload (with conflict behaviors)
- File move operations
- File rename operations
- Subscription management
- Token refresh handling
- Error scenarios

## Implementation Details

### Token Management

The connector automatically checks token expiration before making API calls. If a token is expired, it throws an `ApiError` prompting you to refresh. In production, implement automatic token refresh:

```typescript
async function ensureValidToken(connector: OneDriveConnector, token: OAuthToken) {
  if (new Date() >= token.expiresAt) {
    const newToken = await connector.refreshToken();
    // Store new token in database
    await saveToken(newToken);
    return newToken;
  }
  return token;
}
```

### File Path Handling

OneDrive uses paths like `/drive/root:/folder/file.txt`. The connector automatically handles path formatting and conversion to the `FileContext` format used by the application.

### Webhook Notifications

When subscribing to changes:
1. Microsoft Graph sends a validation request to your `notificationUrl`
2. Your endpoint must respond with the validation token
3. Notifications are sent as POST requests with file change details
4. Subscriptions expire after ~3 days (4230 minutes) and must be renewed

## Architecture

The connector follows the repository's established patterns:

- **Type Safety**: Uses TypeScript interfaces from `src/types/`
- **Error Handling**: Uses `ApiError` middleware
- **Logging**: Uses Winston logger from `src/config/logger`
- **Testing**: Follows Jest testing patterns with mocks

## Type Definitions

Key types used by the connector:

- `FileContext` - Complete file information including metadata and location
- `FileMetadata` - File properties (size, MIME type, dates, checksum)
- `FileLocation` - Storage location details (provider, path, IDs)
- `OAuthToken` - OAuth token with refresh capability
- `CloudStorageConnector` - Generic connector interface

All types are exported from `src/types/index.ts`.

## Contributing

When extending the connector:

1. Add new methods to the `CloudStorageConnector` interface
2. Implement methods in `OneDriveConnector` class
3. Add comprehensive tests to `onedrive.connector.test.ts`
4. Update this README with usage examples
5. Run tests and linter: `npm test && npm run lint`

## License

Part of the CloudOrganiser project.
