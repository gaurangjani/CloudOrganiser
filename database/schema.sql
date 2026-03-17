-- ============================================================
-- CloudOrganiser SaaS Platform – PostgreSQL Schema
-- ============================================================
-- Tables: Users, CloudConnections, Files, FileEvents, Rules,
--         AgentLogs, PendingActions, AuditLogs
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

-- 'microsoft' = Microsoft 365 / OneDrive; 'azure' = Azure Blob Storage
CREATE TYPE cloud_provider AS ENUM ('google', 'microsoft', 'aws', 'azure', 'local');

CREATE TYPE file_event_type AS ENUM ('created', 'updated', 'deleted', 'renamed', 'moved');

CREATE TYPE rule_type AS ENUM ('file_type', 'content', 'naming', 'folder_routing', 'ai_assisted');

CREATE TYPE rule_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE rule_action AS ENUM ('allow', 'block', 'warn', 'move', 'rename', 'tag', 'classify');

CREATE TYPE rule_condition_logic AS ENUM ('AND', 'OR');

CREATE TYPE agent_name AS ENUM ('watcher', 'classifier', 'renamer', 'folder', 'policy', 'learning');

CREATE TYPE agent_log_status AS ENUM ('started', 'success', 'failure', 'skipped');

CREATE TYPE pending_action_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TYPE pending_action_type AS ENUM ('move', 'rename', 'tag', 'classify', 'archive', 'notify', 'ai_classify');

CREATE TYPE audit_action AS ENUM (
  'user.created', 'user.updated', 'user.deleted',
  'connection.created', 'connection.updated', 'connection.deleted',
  'file.created', 'file.updated', 'file.deleted', 'file.moved', 'file.renamed',
  'rule.created', 'rule.updated', 'rule.deleted',
  'action.executed', 'action.failed'
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) NOT NULL UNIQUE,
  name           VARCHAR(255) NOT NULL,
  provider       cloud_provider NOT NULL,
  provider_id    VARCHAR(255) NOT NULL,
  avatar_url     TEXT,
  organization_id UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_users_provider UNIQUE (provider, provider_id)
);

CREATE INDEX idx_users_email          ON users (email);
CREATE INDEX idx_users_organization   ON users (organization_id);

-- ============================================================
-- CLOUD CONNECTIONS
-- ============================================================
-- Stores OAuth credentials and metadata for each cloud account
-- linked by a user.

CREATE TABLE cloud_connections (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider            cloud_provider NOT NULL,
  -- Encrypted tokens – store cipher-text only; plain-text secrets must never
  -- be persisted here. Enforce encryption at the application layer (e.g. via
  -- AES-256-GCM + a KMS-managed key) before writing these columns.
  access_token        TEXT         NOT NULL,
  refresh_token       TEXT,
  token_expires_at    TIMESTAMPTZ,
  token_type          VARCHAR(50)  NOT NULL DEFAULT 'Bearer',
  scopes              TEXT[],
  -- Provider-specific account metadata
  provider_account_id VARCHAR(255),
  display_name        VARCHAR(255),
  -- Webhook / subscription tracking
  subscription_id     VARCHAR(255),
  subscription_expires_at TIMESTAMPTZ,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cloud_connections_user     ON cloud_connections (user_id);
CREATE INDEX idx_cloud_connections_provider ON cloud_connections (provider);
-- Deduplicate only identified accounts; NULL provider_account_id rows are
-- exempt so that a connection record can exist before the account ID is fetched.
CREATE UNIQUE INDEX uq_cloud_connections_identified
  ON cloud_connections (user_id, provider, provider_account_id)
  WHERE provider_account_id IS NOT NULL;

-- ============================================================
-- FILES
-- ============================================================
-- Represents a tracked file in any connected cloud storage.

CREATE TABLE files (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  connection_id       UUID         NOT NULL REFERENCES cloud_connections (id) ON DELETE CASCADE,
  -- Provider-assigned file identifier
  provider_file_id    VARCHAR(512) NOT NULL,
  name                VARCHAR(512) NOT NULL,
  mime_type           VARCHAR(255),
  extension           VARCHAR(50),
  size_bytes          BIGINT,
  -- Location within the cloud provider
  path                TEXT,
  parent_path         TEXT,
  full_path           TEXT,
  drive_id            VARCHAR(255),
  folder_id           VARCHAR(255),
  -- Classification / tagging (denormalised for query performance)
  tags                TEXT[],
  categories          TEXT[],
  checksum            VARCHAR(128),
  -- Provider timestamps
  provider_created_at  TIMESTAMPTZ,
  provider_modified_at TIMESTAMPTZ,
  -- Local tracking timestamps
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_files_connection_provider_id
    UNIQUE (connection_id, provider_file_id)
);

CREATE INDEX idx_files_user            ON files (user_id);
CREATE INDEX idx_files_connection      ON files (connection_id);
CREATE INDEX idx_files_provider_file   ON files (provider_file_id);
CREATE INDEX idx_files_name            ON files (name);
CREATE INDEX idx_files_mime_type       ON files (mime_type);
CREATE INDEX idx_files_tags            ON files USING GIN (tags);
CREATE INDEX idx_files_categories      ON files USING GIN (categories);

-- ============================================================
-- FILE EVENTS
-- ============================================================
-- Immutable log of every change detected for a tracked file.

CREATE TABLE file_events (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         UUID           NOT NULL REFERENCES files (id) ON DELETE CASCADE,
  user_id         UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  connection_id   UUID           NOT NULL REFERENCES cloud_connections (id) ON DELETE CASCADE,
  event_type      file_event_type NOT NULL,
  -- Snapshot of relevant file fields at the time of the event
  previous_name   VARCHAR(512),
  new_name        VARCHAR(512),
  previous_path   TEXT,
  new_path        TEXT,
  -- Raw webhook payload for debugging / replay
  raw_payload     JSONB,
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_events_file        ON file_events (file_id);
CREATE INDEX idx_file_events_user        ON file_events (user_id);
CREATE INDEX idx_file_events_connection  ON file_events (connection_id);
CREATE INDEX idx_file_events_type        ON file_events (event_type);
CREATE INDEX idx_file_events_occurred_at ON file_events (occurred_at DESC);

-- ============================================================
-- RULES
-- ============================================================
-- Organisational rules evaluated by the rules engine.

CREATE TABLE rules (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Rules may be personal (user_id set) or organisational (organization_id set).
  -- ON DELETE CASCADE: personal rules are removed when their owner is deleted.
  user_id          UUID             REFERENCES users (id) ON DELETE CASCADE,
  organization_id  UUID,
  name             VARCHAR(200)     NOT NULL,
  description      VARCHAR(1000),
  type             rule_type        NOT NULL,
  -- Lower number = higher priority (0 is evaluated first, 1000 is last).
  priority         INTEGER          NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 1000),
  enabled          BOOLEAN          NOT NULL DEFAULT TRUE,
  severity         rule_severity    NOT NULL DEFAULT 'medium',
  action           rule_action      NOT NULL,
  -- Conditions and actions stored as structured JSON
  conditions       JSONB            NOT NULL DEFAULT '[]',
  condition_logic  rule_condition_logic NOT NULL DEFAULT 'AND',
  actions          JSONB            NOT NULL DEFAULT '[]',
  metadata         JSONB,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  -- Every rule must be owned by either a user or an organisation
  CONSTRAINT chk_rules_owner CHECK (
    user_id IS NOT NULL OR organization_id IS NOT NULL
  )
);

CREATE INDEX idx_rules_user           ON rules (user_id);
CREATE INDEX idx_rules_organization   ON rules (organization_id);
CREATE INDEX idx_rules_type_enabled   ON rules (type, enabled);
CREATE INDEX idx_rules_priority       ON rules (priority DESC);
CREATE INDEX idx_rules_enabled        ON rules (enabled, priority DESC);

-- ============================================================
-- AGENT LOGS
-- ============================================================
-- Execution records for each agent in the multi-agent pipeline.

CREATE TABLE agent_logs (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         UUID            REFERENCES files (id) ON DELETE SET NULL,
  file_event_id   UUID            REFERENCES file_events (id) ON DELETE SET NULL,
  user_id         UUID            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  agent           agent_name      NOT NULL,
  status          agent_log_status NOT NULL,
  -- Duration in milliseconds
  duration_ms     INTEGER,
  -- Structured input/output snapshots for debugging
  input_context   JSONB,
  output_result   JSONB,
  error_message   TEXT,
  error_stack     TEXT,
  started_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_file        ON agent_logs (file_id);
CREATE INDEX idx_agent_logs_file_event  ON agent_logs (file_event_id);
CREATE INDEX idx_agent_logs_user        ON agent_logs (user_id);
CREATE INDEX idx_agent_logs_agent       ON agent_logs (agent);
CREATE INDEX idx_agent_logs_status      ON agent_logs (status);
CREATE INDEX idx_agent_logs_started_at  ON agent_logs (started_at DESC);

-- ============================================================
-- PENDING ACTIONS
-- ============================================================
-- Deferred / queued actions that the platform needs to execute
-- (e.g. moves, renames, notifications triggered by rules).

CREATE TABLE pending_actions (
  id              UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID                  NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  file_id         UUID                  REFERENCES files (id) ON DELETE SET NULL,
  rule_id         UUID                  REFERENCES rules (id) ON DELETE SET NULL,
  agent_log_id    UUID                  REFERENCES agent_logs (id) ON DELETE SET NULL,
  action_type     pending_action_type   NOT NULL,
  status          pending_action_status NOT NULL DEFAULT 'pending',
  -- Action parameters (target path, new name, tags, etc.)
  params          JSONB                 NOT NULL DEFAULT '{}',
  -- Scheduling
  scheduled_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Retry tracking
  attempts        INTEGER               NOT NULL DEFAULT 0,
  max_attempts    INTEGER               NOT NULL DEFAULT 3,
  last_error      TEXT,
  created_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_actions_user         ON pending_actions (user_id);
CREATE INDEX idx_pending_actions_file         ON pending_actions (file_id);
CREATE INDEX idx_pending_actions_rule         ON pending_actions (rule_id);
CREATE INDEX idx_pending_actions_status       ON pending_actions (status);
CREATE INDEX idx_pending_actions_scheduled_at ON pending_actions (scheduled_at ASC)
  WHERE status = 'pending';

-- ============================================================
-- AUDIT LOGS
-- ============================================================
-- Immutable record of every significant action taken in the
-- platform for compliance and security review.

CREATE TABLE audit_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         REFERENCES users (id) ON DELETE SET NULL,
  organization_id UUID,
  action          audit_action NOT NULL,
  -- The type and ID of the resource that was acted upon
  resource_type   VARCHAR(100),
  resource_id     UUID,
  -- Contextual metadata (IP address, user-agent, changed fields, etc.)
  metadata        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user           ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_organization   ON audit_logs (organization_id);
CREATE INDEX idx_audit_logs_action         ON audit_logs (action);
CREATE INDEX idx_audit_logs_resource       ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_occurred_at    ON audit_logs (occurred_at DESC);
