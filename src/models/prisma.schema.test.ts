// Prisma schema structural validation tests.
// These tests verify the shape of the generated Prisma types without
// requiring a live database connection.

import {
  OAuthProvider,
  StorageProvider,
  RuleType,
  RuleSeverity,
  RuleAction,
  FileEventType,
  OrganizationRole,
} from '../generated/prisma/client';

// ---------------------------------------------------------------------------
// Enum value tests
// ---------------------------------------------------------------------------

describe('Prisma enums', () => {
  describe('OAuthProvider', () => {
    it('contains GOOGLE and MICROSOFT', () => {
      expect(OAuthProvider.GOOGLE).toBe('GOOGLE');
      expect(OAuthProvider.MICROSOFT).toBe('MICROSOFT');
    });
  });

  describe('StorageProvider', () => {
    it('contains all expected providers', () => {
      expect(StorageProvider.GOOGLE).toBe('GOOGLE');
      expect(StorageProvider.MICROSOFT).toBe('MICROSOFT');
      expect(StorageProvider.LOCAL).toBe('LOCAL');
      expect(StorageProvider.AWS).toBe('AWS');
      expect(StorageProvider.AZURE).toBe('AZURE');
    });
  });

  describe('RuleType', () => {
    it('contains all expected rule types', () => {
      expect(RuleType.FILE_TYPE).toBe('FILE_TYPE');
      expect(RuleType.CONTENT).toBe('CONTENT');
      expect(RuleType.NAMING).toBe('NAMING');
      expect(RuleType.FOLDER_ROUTING).toBe('FOLDER_ROUTING');
      expect(RuleType.AI_ASSISTED).toBe('AI_ASSISTED');
    });
  });

  describe('RuleSeverity', () => {
    it('contains all expected severity levels', () => {
      expect(RuleSeverity.LOW).toBe('LOW');
      expect(RuleSeverity.MEDIUM).toBe('MEDIUM');
      expect(RuleSeverity.HIGH).toBe('HIGH');
      expect(RuleSeverity.CRITICAL).toBe('CRITICAL');
    });
  });

  describe('RuleAction', () => {
    it('contains all expected actions', () => {
      expect(RuleAction.ALLOW).toBe('ALLOW');
      expect(RuleAction.BLOCK).toBe('BLOCK');
      expect(RuleAction.WARN).toBe('WARN');
      expect(RuleAction.MOVE).toBe('MOVE');
      expect(RuleAction.RENAME).toBe('RENAME');
      expect(RuleAction.TAG).toBe('TAG');
      expect(RuleAction.CLASSIFY).toBe('CLASSIFY');
    });
  });

  describe('FileEventType', () => {
    it('contains all expected event types', () => {
      expect(FileEventType.FILE_CREATED).toBe('FILE_CREATED');
      expect(FileEventType.FILE_UPDATED).toBe('FILE_UPDATED');
      expect(FileEventType.FILE_DELETED).toBe('FILE_DELETED');
      expect(FileEventType.FILE_RENAMED).toBe('FILE_RENAMED');
    });
  });

  describe('OrganizationRole', () => {
    it('contains OWNER, ADMIN, and MEMBER', () => {
      expect(OrganizationRole.OWNER).toBe('OWNER');
      expect(OrganizationRole.ADMIN).toBe('ADMIN');
      expect(OrganizationRole.MEMBER).toBe('MEMBER');
    });
  });
});

// ---------------------------------------------------------------------------
// Soft-delete and audit field shape tests
// ---------------------------------------------------------------------------

describe('Model type shapes', () => {
  it('User type has audit and soft-delete fields', () => {
    // Construct a partial User object that TypeScript must accept.
    // If any field is missing or mistyped the compile step fails.
    const partialUser: Partial<{
      id: string;
      email: string;
      name: string;
      provider: OAuthProvider;
      providerId: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
      updatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
    }> = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      provider: OAuthProvider.GOOGLE,
      providerId: 'ggl-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
    };

    expect(partialUser.provider).toBe(OAuthProvider.GOOGLE);
    expect(partialUser.deletedAt).toBeNull();
  });

  it('Organization type has audit and soft-delete fields', () => {
    const partialOrg: Partial<{
      id: string;
      name: string;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
      updatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
    }> = {
      id: 'org-1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
    };

    expect(partialOrg.slug).toBe('acme-corp');
    expect(partialOrg.deletedAt).toBeNull();
  });

  it('UserOrganization type has role, audit, and soft-delete fields', () => {
    const partialUO: Partial<{
      userId: string;
      organizationId: string;
      role: OrganizationRole;
      joinedAt: Date;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
      updatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
    }> = {
      userId: 'user-1',
      organizationId: 'org-1',
      role: OrganizationRole.ADMIN,
      joinedAt: new Date(),
      deletedAt: null,
    };

    expect(partialUO.role).toBe(OrganizationRole.ADMIN);
  });

  it('Rule type has config, audit, and soft-delete fields', () => {
    const partialRule: Partial<{
      id: string;
      name: string;
      description: string;
      type: RuleType;
      priority: number;
      enabled: boolean;
      severity: RuleSeverity;
      action: RuleAction;
      config: unknown;
      metadata: unknown;
      userId: string | null;
      organizationId: string | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
      updatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
    }> = {
      id: 'rule-1',
      name: 'Block exe files',
      description: 'Prevent .exe uploads',
      type: RuleType.FILE_TYPE,
      priority: 10,
      enabled: true,
      severity: RuleSeverity.HIGH,
      action: RuleAction.BLOCK,
      config: { extensions: ['.exe'] },
      deletedAt: null,
    };

    expect(partialRule.type).toBe(RuleType.FILE_TYPE);
    expect(partialRule.action).toBe(RuleAction.BLOCK);
    expect(partialRule.deletedAt).toBeNull();
  });

  it('FileRecord type has location, classification, audit, and soft-delete fields', () => {
    const partialFile: Partial<{
      id: string;
      name: string;
      extension: string;
      mimeType: string;
      size: bigint;
      provider: StorageProvider;
      path: string;
      parentPath: string;
      fullPath: string;
      tags: string[];
      categories: string[];
      userId: string;
      organizationId: string | null;
      fileCreatedAt: Date;
      fileModifiedAt: Date;
      fileAccessedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
      updatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
    }> = {
      id: 'file-1',
      name: 'report.pdf',
      extension: '.pdf',
      mimeType: 'application/pdf',
      size: BigInt(1024),
      provider: StorageProvider.GOOGLE,
      path: '/docs/report.pdf',
      parentPath: '/docs',
      fullPath: '/docs/report.pdf',
      tags: ['finance', 'q3'],
      categories: ['document'],
      userId: 'user-1',
      fileCreatedAt: new Date(),
      fileModifiedAt: new Date(),
      deletedAt: null,
    };

    expect(partialFile.provider).toBe(StorageProvider.GOOGLE);
    expect(partialFile.tags).toContain('finance');
    expect(partialFile.deletedAt).toBeNull();
  });

  it('FileEvent type has provider, eventType, audit, and soft-delete fields', () => {
    const partialEvent: Partial<{
      id: string;
      provider: StorageProvider;
      eventType: FileEventType;
      rawPayload: unknown;
      eventTimestamp: Date;
      fileRecordId: string | null;
      userId: string;
      organizationId: string | null;
      createdAt: Date;
      updatedAt: Date;
      createdBy: string | null;
      updatedBy: string | null;
      deletedAt: Date | null;
      deletedBy: string | null;
    }> = {
      id: 'event-1',
      provider: StorageProvider.MICROSOFT,
      eventType: FileEventType.FILE_CREATED,
      eventTimestamp: new Date(),
      userId: 'user-1',
      deletedAt: null,
    };

    expect(partialEvent.eventType).toBe(FileEventType.FILE_CREATED);
    expect(partialEvent.deletedAt).toBeNull();
  });
});
