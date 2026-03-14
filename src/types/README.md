# Multi-Agent System Type Definitions

This directory contains TypeScript interface definitions for the CloudOrganiser multi-agent system. The agents work together to automatically organize and manage files across cloud storage platforms.

## Overview

The system consists of six specialized agents, each with a specific responsibility in the file organization pipeline:

1. **WatcherAgent** - Monitors for file changes
2. **ClassifierAgent** - Categorizes and tags files
3. **RenamerAgent** - Suggests intelligent file names
4. **FolderAgent** - Manages folder structure
5. **PolicyAgent** - Enforces organizational policies
6. **LearningAgent** - Adapts based on user behavior

## Core Interfaces

### FileContext

The `FileContext` interface represents all information about a file that agents need to process:

```typescript
interface FileContext {
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
```

### Base Agent Interface

All agents implement the base `Agent<T>` interface with a standard `execute()` method:

```typescript
interface Agent<T = unknown> {
  execute(context: FileContext): Promise<AgentResult<T>>;
}
```

## Agent Specifications

### 1. WatcherAgent

**Purpose**: Monitors cloud storage for new or modified files and triggers the organization pipeline.

**Return Type**: `FileContext[]` - Array of detected file changes

**Use Case**: Continuously watches cloud storage and emits events when files are added or modified.

```typescript
interface WatcherAgent extends Agent<FileContext[]> {
  execute(context: FileContext): Promise<AgentResult<FileContext[]>>;
}
```

### 2. ClassifierAgent

**Purpose**: Analyzes file content and metadata to determine categories, tags, and appropriate organization.

**Return Type**: `FileClassification` - Categorization results with confidence scores

**Use Case**: Examines files to understand their type, purpose, and assigns appropriate categories.

```typescript
interface ClassifierAgent extends Agent<FileClassification> {
  execute(context: FileContext): Promise<AgentResult<FileClassification>>;
}

interface FileClassification {
  categories: string[];
  tags: string[];
  confidence: number;
  suggestedFolder?: string;
  contentType: string;
  isPII?: boolean;
  language?: string;
}
```

### 3. RenamerAgent

**Purpose**: Generates meaningful file names based on content, context, and naming conventions.

**Return Type**: `FileRenameResult` - Suggested name with reasoning

**Use Case**: Standardizes file names to improve searchability and organization.

```typescript
interface RenamerAgent extends Agent<FileRenameResult> {
  execute(context: FileContext): Promise<AgentResult<FileRenameResult>>;
}

interface FileRenameResult {
  originalName: string;
  suggestedName: string;
  reason: string;
  confidence: number;
  applied: boolean;
}
```

### 4. FolderAgent

**Purpose**: Manages folder structure and determines optimal file placement.

**Return Type**: `FolderOperation` - Details of folder management actions

**Use Case**: Organizes files into appropriate directories based on classification and policies.

```typescript
interface FolderAgent extends Agent<FolderOperation> {
  execute(context: FileContext): Promise<AgentResult<FolderOperation>>;
}

interface FolderOperation {
  action: 'move' | 'copy' | 'create_folder' | 'archive';
  sourcePath: string;
  targetPath: string;
  folderCreated?: boolean;
  timestamp: Date;
}
```

### 5. PolicyAgent

**Purpose**: Enforces organizational policies, compliance rules, and retention policies.

**Return Type**: `PolicyCheckResult` - Compliance status and violations

**Use Case**: Ensures files comply with naming conventions, security policies, and retention rules.

```typescript
interface PolicyAgent extends Agent<PolicyCheckResult> {
  execute(context: FileContext): Promise<AgentResult<PolicyCheckResult>>;
}

interface PolicyCheckResult {
  compliant: boolean;
  violations: PolicyViolation[];
  warnings: string[];
  recommendations: string[];
  enforcedActions?: string[];
}
```

### 6. LearningAgent

**Purpose**: Learns from user behavior and continuously improves organization strategies.

**Return Type**: `LearningInsight` - Detected patterns and adaptations

**Use Case**: Observes user corrections and preferences to adapt organization rules over time.

```typescript
interface LearningAgent extends Agent<LearningInsight> {
  execute(context: FileContext): Promise<AgentResult<LearningInsight>>;
}

interface LearningInsight {
  patterns: UserPattern[];
  adaptations: Adaptation[];
  confidence: number;
  sampleSize: number;
}
```

## Usage Example

Here's how to implement a simple agent:

```typescript
import { ClassifierAgent, FileContext, AgentResult, FileClassification } from '../types';

class MyClassifierAgent implements ClassifierAgent {
  async execute(context: FileContext): Promise<AgentResult<FileClassification>> {
    try {
      // Analyze the file
      const classification: FileClassification = {
        categories: ['documents'],
        tags: [context.metadata.extension],
        confidence: 0.85,
        contentType: context.metadata.mimeType,
      };

      return {
        success: true,
        data: classification,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

## Agent Pipeline Flow

```
1. WatcherAgent → Detects new/modified files
2. ClassifierAgent → Analyzes and categorizes files
3. RenamerAgent → Suggests appropriate file names
4. PolicyAgent → Checks compliance and enforces rules
5. FolderAgent → Organizes files into folders
6. LearningAgent → Records patterns and adapts rules
```

## Testing

All interfaces include comprehensive tests in `agent.types.test.ts`. Run tests with:

```bash
npm test
```

## Type Safety

All interfaces are strictly typed with TypeScript's strict mode enabled. This ensures:

- Type safety at compile time
- IntelliSense support in IDEs
- Clear documentation through types
- Prevention of common errors

## Extensibility

The base `Agent<T>` interface allows for creating custom agents:

```typescript
interface CustomAgent extends Agent<CustomResult> {
  execute(context: FileContext): Promise<AgentResult<CustomResult>>;
}
```

## Next Steps

1. Implement concrete classes for each agent interface
2. Create agent service layer in `src/services/`
3. Add API endpoints for agent operations
4. Integrate with cloud storage providers
5. Build agent orchestration system
