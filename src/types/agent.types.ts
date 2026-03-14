// Agent type definitions for the multi-agent file organization system
import { FileContext } from './context.types';

/**
 * AgentResult represents the outcome of an agent's execution
 */
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base Agent interface that all agents must implement
 * All agents must have a standard execute() method that accepts FileContext
 */
export interface Agent<T = unknown> {
  /**
   * Execute the agent's primary operation on a file
   * @param context - The file context containing all file information
   * @returns Promise resolving to the agent's result
   */
  execute(context: FileContext): Promise<AgentResult<T>>;
}

/**
 * WatcherAgent monitors cloud storage for new or modified files
 * Detects file changes and triggers the organization pipeline
 */
export interface WatcherAgent extends Agent<FileContext[]> {
  /**
   * Execute file watching operations
   * @param context - The file context to watch
   * @returns Promise resolving to detected file changes
   */
  execute(context: FileContext): Promise<AgentResult<FileContext[]>>;
}

/**
 * ClassifierAgent analyzes files and categorizes them
 * Uses AI/ML to determine file type, purpose, and appropriate categories
 */
export interface ClassifierAgent extends Agent<FileClassification> {
  /**
   * Execute file classification
   * @param context - The file context to classify
   * @returns Promise resolving to classification results
   */
  execute(context: FileContext): Promise<AgentResult<FileClassification>>;
}

/**
 * FileClassification represents the result of file classification
 */
export interface FileClassification {
  categories: string[];
  tags: string[];
  confidence: number;
  suggestedFolder?: string;
  contentType: string;
  isPII?: boolean;
  language?: string;
}

/**
 * RenamerAgent suggests and applies intelligent file renaming
 * Generates meaningful names based on file content and context
 */
export interface RenamerAgent extends Agent<FileRenameResult> {
  /**
   * Execute file renaming logic
   * @param context - The file context to rename
   * @returns Promise resolving to rename suggestions
   */
  execute(context: FileContext): Promise<AgentResult<FileRenameResult>>;
}

/**
 * FileRenameResult represents renaming suggestions
 */
export interface FileRenameResult {
  originalName: string;
  suggestedName: string;
  reason: string;
  confidence: number;
  applied: boolean;
}

/**
 * FolderAgent manages folder structure and file placement
 * Organizes files into appropriate directories
 */
export interface FolderAgent extends Agent<FolderOperation> {
  /**
   * Execute folder organization operations
   * @param context - The file context to organize
   * @returns Promise resolving to folder operation results
   */
  execute(context: FileContext): Promise<AgentResult<FolderOperation>>;
}

/**
 * FolderOperation represents folder management actions
 */
export interface FolderOperation {
  action: 'move' | 'copy' | 'create_folder' | 'archive';
  sourcePath: string;
  targetPath: string;
  folderCreated?: boolean;
  timestamp: Date;
}

/**
 * PolicyAgent enforces organizational policies and rules
 * Ensures compliance with naming conventions, retention policies, etc.
 */
export interface PolicyAgent extends Agent<PolicyCheckResult> {
  /**
   * Execute policy checks and enforcement
   * @param context - The file context to check
   * @returns Promise resolving to policy check results
   */
  execute(context: FileContext): Promise<AgentResult<PolicyCheckResult>>;
}

/**
 * PolicyCheckResult represents policy compliance results
 */
export interface PolicyCheckResult {
  compliant: boolean;
  violations: PolicyViolation[];
  warnings: string[];
  recommendations: string[];
  enforcedActions?: string[];
}

/**
 * PolicyViolation represents a specific policy violation
 */
export interface PolicyViolation {
  policyId: string;
  policyName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation?: string;
}

/**
 * LearningAgent learns from user behavior and improves organization
 * Adapts rules and suggestions based on user feedback and patterns
 */
export interface LearningAgent extends Agent<LearningInsight> {
  /**
   * Execute learning and adaptation operations
   * @param context - The file context to learn from
   * @returns Promise resolving to learning insights
   */
  execute(context: FileContext): Promise<AgentResult<LearningInsight>>;
}

/**
 * LearningInsight represents patterns and insights learned
 */
export interface LearningInsight {
  patterns: UserPattern[];
  adaptations: Adaptation[];
  confidence: number;
  sampleSize: number;
}

/**
 * UserPattern represents detected user behavior patterns
 */
export interface UserPattern {
  type: 'naming' | 'organization' | 'categorization' | 'timing';
  description: string;
  frequency: number;
  lastObserved: Date;
}

/**
 * Adaptation represents changes made based on learning
 */
export interface Adaptation {
  ruleId: string;
  previousBehavior: string;
  newBehavior: string;
  reason: string;
  appliedAt: Date;
}
