-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'LOCAL', 'AWS', 'AZURE');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('FILE_TYPE', 'CONTENT', 'NAMING', 'FOLDER_ROUTING', 'AI_ASSISTED');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('ALLOW', 'BLOCK', 'WARN', 'MOVE', 'RENAME', 'TAG', 'CLASSIFY');

-- CreateEnum
CREATE TYPE "FileEventType" AS ENUM ('FILE_CREATED', 'FILE_UPDATED', 'FILE_DELETED', 'FILE_RENAMED');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "UserOrganization_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" "RuleSeverity" NOT NULL DEFAULT 'MEDIUM',
    "action" "RuleAction" NOT NULL,
    "config" JSONB NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "encoding" TEXT,
    "checksum" TEXT,
    "provider" "StorageProvider" NOT NULL,
    "path" TEXT NOT NULL,
    "parentPath" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "driveId" TEXT,
    "folderId" TEXT,
    "tags" TEXT[],
    "categories" TEXT[],
    "customProperties" JSONB,
    "fileCreatedAt" TIMESTAMP(3) NOT NULL,
    "fileModifiedAt" TIMESTAMP(3) NOT NULL,
    "fileAccessedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileEvent" (
    "id" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL,
    "eventType" "FileEventType" NOT NULL,
    "rawPayload" JSONB,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "fileRecordId" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "FileEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_provider_providerId_key" ON "User"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_deletedAt_idx" ON "Organization"("deletedAt");

-- CreateIndex
CREATE INDEX "UserOrganization_userId_idx" ON "UserOrganization"("userId");

-- CreateIndex
CREATE INDEX "UserOrganization_organizationId_idx" ON "UserOrganization"("organizationId");

-- CreateIndex
CREATE INDEX "UserOrganization_role_idx" ON "UserOrganization"("role");

-- CreateIndex
CREATE INDEX "UserOrganization_deletedAt_idx" ON "UserOrganization"("deletedAt");

-- CreateIndex
CREATE INDEX "Rule_type_enabled_idx" ON "Rule"("type", "enabled");

-- CreateIndex
CREATE INDEX "Rule_priority_idx" ON "Rule"("priority" DESC);

-- CreateIndex
CREATE INDEX "Rule_organizationId_userId_idx" ON "Rule"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Rule_enabled_priority_idx" ON "Rule"("enabled", "priority" DESC);

-- CreateIndex
CREATE INDEX "Rule_userId_idx" ON "Rule"("userId");

-- CreateIndex
CREATE INDEX "Rule_organizationId_idx" ON "Rule"("organizationId");

-- CreateIndex
CREATE INDEX "Rule_deletedAt_idx" ON "Rule"("deletedAt");

-- CreateIndex
CREATE INDEX "FileRecord_userId_idx" ON "FileRecord"("userId");

-- CreateIndex
CREATE INDEX "FileRecord_organizationId_idx" ON "FileRecord"("organizationId");

-- CreateIndex
CREATE INDEX "FileRecord_provider_idx" ON "FileRecord"("provider");

-- CreateIndex
CREATE INDEX "FileRecord_mimeType_idx" ON "FileRecord"("mimeType");

-- CreateIndex
CREATE INDEX "FileRecord_extension_idx" ON "FileRecord"("extension");

-- CreateIndex
CREATE INDEX "FileRecord_fullPath_idx" ON "FileRecord"("fullPath");

-- CreateIndex
CREATE INDEX "FileRecord_userId_provider_idx" ON "FileRecord"("userId", "provider");

-- CreateIndex
CREATE INDEX "FileRecord_organizationId_provider_idx" ON "FileRecord"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "FileRecord_deletedAt_idx" ON "FileRecord"("deletedAt");

-- CreateIndex
CREATE INDEX "FileEvent_userId_idx" ON "FileEvent"("userId");

-- CreateIndex
CREATE INDEX "FileEvent_organizationId_idx" ON "FileEvent"("organizationId");

-- CreateIndex
CREATE INDEX "FileEvent_provider_eventType_idx" ON "FileEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "FileEvent_fileRecordId_idx" ON "FileEvent"("fileRecordId");

-- CreateIndex
CREATE INDEX "FileEvent_eventTimestamp_idx" ON "FileEvent"("eventTimestamp");

-- CreateIndex
CREATE INDEX "FileEvent_deletedAt_idx" ON "FileEvent"("deletedAt");

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrganization" ADD CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileEvent" ADD CONSTRAINT "FileEvent_fileRecordId_fkey" FOREIGN KEY ("fileRecordId") REFERENCES "FileRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileEvent" ADD CONSTRAINT "FileEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileEvent" ADD CONSTRAINT "FileEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
