// Rule evaluator implementation
import {
  AnyRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleEvaluationResults,
  FileTypeRule,
  ContentRule,
  NamingRule,
  FolderRoutingRule,
  AIAssistedRule,
  RuleFilter,
  IRuleEvaluator,
  RuleStorage,
  RuleAction,
} from '../types/rule.types';
import { AIProvider } from '../types/ai.types';
import logger from '../config/logger';

/**
 * Rule evaluator that processes rules in priority order
 */
export class RuleEvaluator implements IRuleEvaluator {
  private rules: AnyRule[] = [];
  private storage: RuleStorage;
  private aiProvider?: AIProvider;

  constructor(storage: RuleStorage, aiProvider?: AIProvider) {
    this.storage = storage;
    this.aiProvider = aiProvider;
  }

  /**
   * Load rules from storage
   */
  async loadRules(filter?: RuleFilter): Promise<void> {
    try {
      // Load rules sorted by priority
      this.rules = await this.storage.getRulesByPriority(filter);
      logger.info(`Loaded ${this.rules.length} rules from storage`);
    } catch (error) {
      logger.error('Error loading rules:', error);
      throw error;
    }
  }

  /**
   * Get currently loaded rules
   */
  getRules(): AnyRule[] {
    return [...this.rules];
  }

  /**
   * Evaluate all applicable rules for a file context
   */
  async evaluate(context: RuleEvaluationContext): Promise<RuleEvaluationResults> {
    const evaluatedRules: RuleEvaluationResult[] = [];
    const matchedRules: RuleEvaluationResult[] = [];

    // Evaluate each rule in priority order
    for (const rule of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const result = await this.evaluateRule(rule, context);
        evaluatedRules.push(result);

        if (result.matched) {
          matchedRules.push(result);
        }
      } catch (error) {
        logger.error(`Error evaluating rule ${rule.id}:`, error);
        evaluatedRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.type,
          matched: false,
          action: rule.action,
          severity: rule.severity,
          reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Determine highest severity
    const highestSeverity = this.getHighestSeverity(matchedRules);

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(matchedRules);

    return {
      fileId: context.id,
      fileName: context.name,
      evaluatedRules,
      matchedRules,
      highestSeverity,
      recommendedActions,
      timestamp: new Date(),
    };
  }

  /**
   * Evaluate a specific rule against a file context
   */
  async evaluateRule(rule: AnyRule, context: RuleEvaluationContext): Promise<RuleEvaluationResult> {
    switch (rule.type) {
      case 'file_type':
        return this.evaluateFileTypeRule(rule as FileTypeRule, context);
      case 'content':
        return this.evaluateContentRule(rule as ContentRule, context);
      case 'naming':
        return this.evaluateNamingRule(rule as NamingRule, context);
      case 'folder_routing':
        return this.evaluateFolderRoutingRule(rule as FolderRoutingRule, context);
      case 'ai_assisted':
        return this.evaluateAIAssistedRule(rule as AIAssistedRule, context);
      default:
        throw new Error(`Unknown rule type: ${(rule as any).type}`);
    }
  }

  /**
   * Evaluate a file type rule
   */
  private evaluateFileTypeRule(rule: FileTypeRule, context: RuleEvaluationContext): RuleEvaluationResult {
    const { mimeTypes, extensions, excludeMimeTypes, excludeExtensions } = rule.config;
    let matched = false;
    let reason = '';

    // Check exclude patterns first
    if (excludeMimeTypes && this.matchesMimeType(context.metadata.mimeType, excludeMimeTypes)) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        action: rule.action,
        severity: rule.severity,
        reason: `File MIME type ${context.metadata.mimeType} is excluded`,
      };
    }

    if (excludeExtensions && excludeExtensions.includes(context.metadata.extension)) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        action: rule.action,
        severity: rule.severity,
        reason: `File extension ${context.metadata.extension} is excluded`,
      };
    }

    // Check include patterns
    if (mimeTypes && this.matchesMimeType(context.metadata.mimeType, mimeTypes)) {
      matched = true;
      reason = `File MIME type ${context.metadata.mimeType} matches rule`;
    } else if (extensions && extensions.includes(context.metadata.extension)) {
      matched = true;
      reason = `File extension ${context.metadata.extension} matches rule`;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      matched,
      action: rule.action,
      severity: rule.severity,
      reason: reason || 'File type does not match rule criteria',
    };
  }

  /**
   * Evaluate a content rule
   */
  private evaluateContentRule(rule: ContentRule, context: RuleEvaluationContext): RuleEvaluationResult {
    const { patterns, keywords, excludePatterns, excludeKeywords, caseSensitive, maxContentLength } = rule.config;
    const content = context.extractedContent || context.content?.toString() || '';

    // Truncate content if needed
    const contentToCheck = maxContentLength ? content.slice(0, maxContentLength) : content;

    if (!contentToCheck) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        action: rule.action,
        severity: rule.severity,
        reason: 'No content available for analysis',
      };
    }

    // Check exclude patterns first
    if (excludePatterns) {
      for (const pattern of excludePatterns) {
        const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
        if (regex.test(contentToCheck)) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            matched: false,
            action: rule.action,
            severity: rule.severity,
            reason: `Content matches excluded pattern: ${pattern}`,
          };
        }
      }
    }

    if (excludeKeywords) {
      const lowerContent = caseSensitive ? contentToCheck : contentToCheck.toLowerCase();
      for (const keyword of excludeKeywords) {
        const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
        if (lowerContent.includes(searchKeyword)) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            matched: false,
            action: rule.action,
            severity: rule.severity,
            reason: `Content contains excluded keyword: ${keyword}`,
          };
        }
      }
    }

    // Check include patterns
    if (patterns) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
        if (regex.test(contentToCheck)) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            matched: true,
            action: rule.action,
            severity: rule.severity,
            reason: `Content matches pattern: ${pattern}`,
          };
        }
      }
    }

    if (keywords) {
      const lowerContent = caseSensitive ? contentToCheck : contentToCheck.toLowerCase();
      for (const keyword of keywords) {
        const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
        if (lowerContent.includes(searchKeyword)) {
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleType: rule.type,
            matched: true,
            action: rule.action,
            severity: rule.severity,
            reason: `Content contains keyword: ${keyword}`,
          };
        }
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      matched: false,
      action: rule.action,
      severity: rule.severity,
      reason: 'Content does not match rule criteria',
    };
  }

  /**
   * Evaluate a naming rule
   */
  private evaluateNamingRule(rule: NamingRule, context: RuleEvaluationContext): RuleEvaluationResult {
    const { pattern, prefix, suffix, minLength, maxLength, allowedCharacters, forbiddenWords, caseFormat } =
      rule.config;
    const fileName = context.name;
    let matched = true;
    const reasons: string[] = [];

    // Check pattern
    if (pattern) {
      const regex = new RegExp(pattern);
      if (!regex.test(fileName)) {
        matched = false;
        reasons.push(`File name does not match pattern: ${pattern}`);
      }
    }

    // Check prefix
    if (prefix && !fileName.startsWith(prefix)) {
      matched = false;
      reasons.push(`File name does not start with required prefix: ${prefix}`);
    }

    // Check suffix
    if (suffix && !fileName.endsWith(suffix)) {
      matched = false;
      reasons.push(`File name does not end with required suffix: ${suffix}`);
    }

    // Check length
    if (minLength !== undefined && fileName.length < minLength) {
      matched = false;
      reasons.push(`File name is shorter than minimum length: ${minLength}`);
    }

    if (maxLength !== undefined && fileName.length > maxLength) {
      matched = false;
      reasons.push(`File name exceeds maximum length: ${maxLength}`);
    }

    // Check allowed characters
    if (allowedCharacters) {
      const regex = new RegExp(`^[${allowedCharacters}]+$`);
      if (!regex.test(fileName)) {
        matched = false;
        reasons.push(`File name contains characters not in allowed set: ${allowedCharacters}`);
      }
    }

    // Check forbidden words
    if (forbiddenWords) {
      const lowerFileName = fileName.toLowerCase();
      for (const word of forbiddenWords) {
        if (lowerFileName.includes(word.toLowerCase())) {
          matched = false;
          reasons.push(`File name contains forbidden word: ${word}`);
        }
      }
    }

    // Check case format
    if (caseFormat) {
      if (!this.matchesCaseFormat(fileName, caseFormat)) {
        matched = false;
        reasons.push(`File name does not match case format: ${caseFormat}`);
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      matched,
      action: rule.action,
      severity: rule.severity,
      reason: matched ? 'File name meets all naming requirements' : reasons.join('; '),
    };
  }

  /**
   * Evaluate a folder routing rule
   */
  private evaluateFolderRoutingRule(
    rule: FolderRoutingRule,
    context: RuleEvaluationContext
  ): RuleEvaluationResult {
    const { conditions } = rule.config;
    let matched = true;
    const reasons: string[] = [];

    // Check categories
    if (conditions.categories && context.classification?.categories) {
      const hasCategory = conditions.categories.some((cat) => context.classification?.categories.includes(cat));
      if (!hasCategory) {
        matched = false;
        reasons.push(`File does not have required categories: ${conditions.categories.join(', ')}`);
      }
    }

    // Check tags
    if (conditions.tags && context.tags) {
      const hasTag = conditions.tags.some((tag) => context.tags?.includes(tag));
      if (!hasTag) {
        matched = false;
        reasons.push(`File does not have required tags: ${conditions.tags.join(', ')}`);
      }
    }

    // Check MIME types
    if (conditions.mimeTypes) {
      if (!this.matchesMimeType(context.metadata.mimeType, conditions.mimeTypes)) {
        matched = false;
        reasons.push(`File MIME type does not match: ${conditions.mimeTypes.join(', ')}`);
      }
    }

    // Check extensions
    if (conditions.extensions) {
      if (!conditions.extensions.includes(context.metadata.extension)) {
        matched = false;
        reasons.push(`File extension does not match: ${conditions.extensions.join(', ')}`);
      }
    }

    // Check naming pattern
    if (conditions.namingPattern) {
      const regex = new RegExp(conditions.namingPattern);
      if (!regex.test(context.name)) {
        matched = false;
        reasons.push(`File name does not match pattern: ${conditions.namingPattern}`);
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      matched,
      action: rule.action,
      severity: rule.severity,
      reason: matched
        ? `File should be routed to: ${rule.config.targetPath}`
        : reasons.join('; ') || 'File does not match routing conditions',
      metadata: matched ? { targetPath: rule.config.targetPath } : undefined,
    };
  }

  /**
   * Evaluate an AI-assisted rule
   */
  private async evaluateAIAssistedRule(
    rule: AIAssistedRule,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    if (!this.aiProvider || !this.aiProvider.isReady()) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        action: rule.action,
        severity: rule.severity,
        reason: 'AI provider not available',
      };
    }

    try {
      const { prompt, confidenceThreshold = 0.7, useClassification } = rule.config;

      // Build context for AI
      let aiContext = `File: ${context.name}\nMIME Type: ${context.metadata.mimeType}\n`;

      if (useClassification && context.classification) {
        aiContext += `Categories: ${context.classification.categories.join(', ')}\n`;
        aiContext += `Tags: ${context.classification.tags.join(', ')}\n`;
        aiContext += `Content Type: ${context.classification.contentType}\n`;
      }

      if (context.extractedContent) {
        aiContext += `\nContent Preview: ${context.extractedContent.slice(0, 500)}...\n`;
      }

      const fullPrompt = `${prompt}\n\nContext:\n${aiContext}\n\nRespond with a JSON object: {"matched": boolean, "confidence": number, "reason": string}`;

      // Note: This is a simplified implementation
      // In practice, you'd need to adapt this to work with your specific AI provider
      // For now, we'll return a placeholder result
      logger.warn('AI-assisted rule evaluation not fully implemented yet');

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        action: rule.action,
        severity: rule.severity,
        confidence: 0,
        reason: 'AI-assisted evaluation not fully implemented',
      };
    } catch (error) {
      logger.error('Error in AI-assisted rule evaluation:', error);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        action: rule.action,
        severity: rule.severity,
        reason: `AI evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Helper to match MIME type against patterns (supports wildcards)
   */
  private matchesMimeType(mimeType: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        return mimeType.startsWith(prefix);
      }
      return mimeType === pattern;
    });
  }

  /**
   * Helper to check if a filename matches a case format
   */
  private matchesCaseFormat(fileName: string, format: string): boolean {
    switch (format) {
      case 'lowercase':
        return fileName === fileName.toLowerCase();
      case 'uppercase':
        return fileName === fileName.toUpperCase();
      case 'camelCase':
        return /^[a-z][a-zA-Z0-9]*$/.test(fileName);
      case 'snake_case':
        return /^[a-z][a-z0-9_]*$/.test(fileName);
      case 'kebab-case':
        return /^[a-z][a-z0-9-]*$/.test(fileName);
      default:
        return true;
    }
  }

  /**
   * Get the highest severity from matched rules
   */
  private getHighestSeverity(results: RuleEvaluationResult[]): 'low' | 'medium' | 'high' | 'critical' | undefined {
    if (results.length === 0) {
      return undefined;
    }

    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    let highest: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const result of results) {
      if (severityOrder[result.severity] > severityOrder[highest]) {
        highest = result.severity;
      }
    }

    return highest;
  }

  /**
   * Generate recommended actions based on matched rules
   */
  private generateRecommendedActions(
    results: RuleEvaluationResult[]
  ): { action: RuleAction; reason: string; priority: number }[] {
    const actionMap = new Map<RuleAction, { reason: string; priority: number }>();

    for (const result of results) {
      const existing = actionMap.get(result.action);
      const priority = this.getActionPriority(result);

      if (!existing || priority > existing.priority) {
        actionMap.set(result.action, {
          reason: result.reason || '',
          priority,
        });
      }
    }

    return Array.from(actionMap.entries())
      .map(([action, { reason, priority }]) => ({ action, reason, priority }))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get priority for an action based on severity
   */
  private getActionPriority(result: RuleEvaluationResult): number {
    const severityPriority = { low: 1, medium: 2, high: 3, critical: 4 };
    return severityPriority[result.severity];
  }
}
