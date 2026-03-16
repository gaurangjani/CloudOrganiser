// Rules engine type definitions for the modular rules system

/**
 * RuleType defines the category of a rule
 */
export type RuleType = 'file_type' | 'content' | 'naming' | 'folder_routing' | 'ai_assisted';

/**
 * RuleConditionOperator defines the comparison operation to perform
 */
export type RuleConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in';

/**
 * RuleCondition defines a single condition to evaluate against a FileContext.
 *
 * Supported field paths:
 *  - file_type rules:   'file.extension', 'file.mimeType', 'file.size'
 *  - content rules:     'content.text'
 *  - naming rules:      'file.name'
 *  - folder_routing:    'folder.path', 'folder.parentPath', 'folder.fullPath'
 *  - ai_assisted rules: 'ai.prompt' (value is the prompt text for the AI)
 */
export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: unknown;
}

/**
 * RuleActionType defines the type of action to take when a rule matches
 */
export type RuleActionType =
  | 'move'
  | 'rename'
  | 'tag'
  | 'categorize'
  | 'archive'
  | 'notify'
  | 'ai_classify';

/**
 * RuleAction defines what happens when a rule matches
 */
export interface RuleAction {
  type: RuleActionType;
  params: Record<string, unknown>;
}

/**
 * Rule is the core definition of a single organisational rule
 */
export interface Rule {
  id: string;
  name: string;
  description?: string;
  type: RuleType;
  /** Lower number = higher priority (evaluated first) */
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  /** How multiple conditions are combined */
  conditionLogic: 'AND' | 'OR';
  actions: RuleAction[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * CreateRuleInput is the payload used to create a new rule (omits auto-generated fields)
 */
export type CreateRuleInput = Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * RuleEvaluationResult represents the outcome of evaluating a single rule
 */
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  ruleType: RuleType;
  matched: boolean;
  actions: RuleAction[];
  /** Confidence score produced by the rule handler (e.g. AI-assisted rules) */
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * RulesEngineResult represents the overall result of running the rules engine
 * against a single FileContext
 */
export interface RulesEngineResult {
  fileContextId: string;
  matchedRules: RuleEvaluationResult[];
  totalRulesEvaluated: number;
  /** Actions that were applied immediately (met the confidence threshold) */
  appliedActions: RuleAction[];
  /** Actions that were queued for human approval (low confidence) */
  pendingActionIds: string[];
  timestamp: Date;
}

/**
 * RuleFilter provides optional filtering when querying rules from the repository
 */
export interface RuleFilter {
  type?: RuleType;
  enabled?: boolean;
  userId?: string;
  organizationId?: string;
}

/**
 * RulesRepository is the interface for persisting and retrieving rules.
 * Concrete implementations can use any backing store (in-memory, SQL, NoSQL, etc.).
 */
export interface RulesRepository {
  /** Persist a new rule and return it with auto-generated id/timestamps */
  save(input: CreateRuleInput): Promise<Rule>;
  /** Retrieve a rule by its unique ID */
  findById(id: string): Promise<Rule | null>;
  /** Retrieve all rules, optionally filtered */
  findAll(filter?: RuleFilter): Promise<Rule[]>;
  /** Partially update a rule by ID; returns the updated rule or null if not found */
  update(id: string, updates: Partial<Omit<Rule, 'id' | 'createdAt'>>): Promise<Rule | null>;
  /** Delete a rule by ID; returns true when successfully deleted */
  delete(id: string): Promise<boolean>;
  /** Count rules, optionally filtered */
  count(filter?: RuleFilter): Promise<number>;
}
