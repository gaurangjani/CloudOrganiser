// Context types for file and folder operations

/**
 * FileMetadata contains detailed information about a file
 */
export interface FileMetadata {
  size: number;
  mimeType: string;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt?: Date;
  extension: string;
  encoding?: string;
  checksum?: string;
}

/**
 * FileLocation represents where a file is stored
 */
export interface FileLocation {
  provider: 'google' | 'microsoft' | 'local' | 'aws' | 'azure';
  path: string;
  parentPath: string;
  fullPath: string;
  driveId?: string;
  folderId?: string;
}

/**
 * FileContext contains all necessary information about a file
 * that agents need to process and organize
 */
export interface FileContext {
  id: string;
  name: string;
  metadata: FileMetadata;
  location: FileLocation;
  content?: Buffer | string;
  tags?: string[];
  categories?: string[];
  userId: string;
  organizationId?: string;
  customProperties?: Record<string, unknown>;
}

/**
 * DirectoryContext represents information about a folder/directory
 */
export interface DirectoryContext {
  id: string;
  name: string;
  path: string;
  parentPath?: string;
  createdAt: Date;
  modifiedAt: Date;
  fileCount: number;
  totalSize: number;
  userId: string;
  organizationId?: string;
}
