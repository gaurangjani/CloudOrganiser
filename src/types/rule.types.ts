// Rule type definitions for the modular rules engine

import { FileContext } from './context.types';

/**
 * Rule types supported by the rules engine
 */
export type RuleType = 'file_type' | 'content' | 'naming' | 'folder_routing' | 'ai_assisted';

/**
 * Rule severity levels
 */
export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Rule action types that can be enforced
 */
export type RuleAction = 'allow' | 'block' | 'warn' | 'move' | 'rename' | 'tag' | 'classify';

/**
 * Base Rule interface that all rule types extend
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  priority: number; // Higher number = higher priority
  enabled: boolean;
  severity: RuleSeverity;
  action: RuleAction;
  organizationId?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * File Type Rule - matches files based on MIME type or extension
 */
export interface FileTypeRule extends Rule {
  type: 'file_type';
  config: {
    mimeTypes?: string[]; // e.g., ['application/pdf', 'image/*']
    extensions?: string[]; // e.g., ['.pdf', '.jpg']
    excludeMimeTypes?: string[];
    excludeExtensions?: string[];
  };
}

/**
 * Content Rule - matches files based on content analysis
 */
export interface ContentRule extends Rule {
  type: 'content';
  config: {
    patterns?: string[]; // Regex patterns to match in content
    keywords?: string[]; // Keywords to search for
    excludePatterns?: string[];
    excludeKeywords?: string[];
    caseSensitive?: boolean;
    maxContentLength?: number; // Maximum content length to analyze
  };
}

/**
 * Naming Rule - enforces file naming conventions
 */
export interface NamingRule extends Rule {
  type: 'naming';
  config: {
    pattern?: string; // Regex pattern for valid names
    prefix?: string;
    suffix?: string;
    minLength?: number;
    maxLength?: number;
    allowedCharacters?: string; // Regex for allowed characters
    forbiddenWords?: string[];
    caseFormat?: 'lowercase' | 'uppercase' | 'camelCase' | 'snake_case' | 'kebab-case';
  };
}

/**
 * Folder Routing Rule - determines where files should be placed
 */
export interface FolderRoutingRule extends Rule {
  type: 'folder_routing';
  config: {
    targetPath: string; // Destination folder path
    conditions: {
      categories?: string[]; // Match files with these categories
      tags?: string[]; // Match files with these tags
      mimeTypes?: string[];
      extensions?: string[];
      namingPattern?: string;
    };
    createIfNotExists?: boolean;
    conflictResolution?: 'overwrite' | 'rename' | 'skip' | 'version';
  };
}

/**
 * AI-Assisted Rule - uses AI to evaluate complex conditions
 */
export interface AIAssistedRule extends Rule {
  type: 'ai_assisted';
  config: {
    prompt: string; // AI prompt for evaluation
    confidenceThreshold?: number; // Minimum confidence to apply rule (0-1)
    useClassification?: boolean; // Use existing classification data
    additionalContext?: Record<string, unknown>;
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Union type for all rule types
 */
export type AnyRule = FileTypeRule | ContentRule | NamingRule | FolderRoutingRule | AIAssistedRule;

/**
 * Result of evaluating a single rule
 */
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  ruleType: RuleType;
  matched: boolean;
  action: RuleAction;
  severity: RuleSeverity;
  confidence?: number; // For AI-assisted rules
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result of evaluating all rules for a file
 */
export interface RuleEvaluationResults {
  fileId: string;
  fileName: string;
  evaluatedRules: RuleEvaluationResult[];
  matchedRules: RuleEvaluationResult[];
  highestSeverity?: RuleSeverity;
  recommendedActions: {
    action: RuleAction;
    reason: string;
    priority: number;
  }[];
  timestamp: Date;
}

/**
 * Rule evaluation context - extends FileContext with additional data
 */
export interface RuleEvaluationContext extends FileContext {
  extractedContent?: string;
  classification?: {
    categories: string[];
    tags: string[];
    confidence: number;
    contentType: string;
  };
}

/**
 * Rule storage interface for persistence
 */
export interface RuleStorage {
  /**
   * Save a rule to storage
   */
  saveRule(rule: AnyRule): Promise<AnyRule>;

  /**
   * Get a rule by ID
   */
  getRule(id: string): Promise<AnyRule | null>;

  /**
   * Get all rules, optionally filtered
   */
  getRules(filter?: RuleFilter): Promise<AnyRule[]>;

  /**
   * Update a rule
   */
  updateRule(id: string, updates: Partial<AnyRule>): Promise<AnyRule>;

  /**
   * Delete a rule
   */
  deleteRule(id: string): Promise<boolean>;

  /**
   * Get rules sorted by priority
   */
  getRulesByPriority(filter?: RuleFilter): Promise<AnyRule[]>;
}

/**
 * Filter options for querying rules
 */
export interface RuleFilter {
  type?: RuleType;
  enabled?: boolean;
  organizationId?: string;
  userId?: string;
  severity?: RuleSeverity;
  minPriority?: number;
  maxPriority?: number;
}

/**
 * Rule evaluator interface
 */
export interface IRuleEvaluator {
  /**
   * Evaluate all applicable rules for a file context
   */
  evaluate(context: RuleEvaluationContext): Promise<RuleEvaluationResults>;

  /**
   * Evaluate a specific rule against a file context
   */
  evaluateRule(rule: AnyRule, context: RuleEvaluationContext): Promise<RuleEvaluationResult>;

  /**
   * Load rules from storage
   */
  loadRules(filter?: RuleFilter): Promise<void>;

  /**
   * Get the current rules
   */
  getRules(): AnyRule[];
}
