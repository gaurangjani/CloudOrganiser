// Policy Agent implementation using the rules engine
import { PolicyAgent, PolicyCheckResult, PolicyViolation, AgentResult } from '../types/agent.types';
import { FileContext } from '../types/context.types';
import { RuleEvaluator } from '../services/RuleEvaluator';
import { RuleStorage, RuleEvaluationContext } from '../types/rule.types';
import { AIProvider } from '../types/ai.types';
import { logger } from '../config/logger';

/**
 * Policy Agent configuration
 */
export interface PolicyAgentConfig {
  storage: RuleStorage;
  aiProvider?: AIProvider;
  autoLoadRules?: boolean;
  filterOrganizationId?: string;
  filterUserId?: string;
}

/**
 * Policy Agent implementation that enforces organizational rules
 */
export class PolicyAgentImpl implements PolicyAgent {
  private evaluator: RuleEvaluator;
  private config: PolicyAgentConfig;
  private initialized = false;

  constructor(config: PolicyAgentConfig) {
    this.config = config;
    this.evaluator = new RuleEvaluator(config.storage, config.aiProvider);
  }

  /**
   * Initialize the policy agent by loading rules
   */
  async initialize(): Promise<void> {
    try {
      const filter: any = {};

      if (this.config.filterOrganizationId) {
        filter.organizationId = this.config.filterOrganizationId;
      }

      if (this.config.filterUserId) {
        filter.userId = this.config.filterUserId;
      }

      // Only load enabled rules
      filter.enabled = true;

      await this.evaluator.loadRules(filter);
      this.initialized = true;
      logger.info('PolicyAgent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PolicyAgent:', error);
      throw error;
    }
  }

  /**
   * Check if the agent is ready to execute
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Execute policy checks on a file context
   */
  async execute(context: FileContext): Promise<AgentResult<PolicyCheckResult>> {
    if (!this.initialized && this.config.autoLoadRules !== false) {
      await this.initialize();
    }

    if (!this.initialized) {
      return {
        success: false,
        error: 'PolicyAgent not initialized. Call initialize() first.',
      };
    }

    try {
      // Create evaluation context
      const evalContext: RuleEvaluationContext = {
        ...context,
        extractedContent: context.content?.toString(),
        classification: context.categories
          ? {
              categories: context.categories,
              tags: context.tags || [],
              confidence: 1.0,
              contentType: context.metadata.mimeType,
            }
          : undefined,
      };

      // Evaluate all rules
      const results = await this.evaluator.evaluate(evalContext);

      // Convert results to policy check format
      const violations: PolicyViolation[] = [];
      const warnings: string[] = [];
      const recommendations: string[] = [];
      const enforcedActions: string[] = [];

      for (const matchedRule of results.matchedRules) {
        // Determine if this is a violation or warning
        if (matchedRule.action === 'block') {
          violations.push({
            policyId: matchedRule.ruleId,
            policyName: matchedRule.ruleName,
            severity: matchedRule.severity,
            description: matchedRule.reason || 'Policy violation detected',
            remediation: this.getRemediation(matchedRule.action, matchedRule.reason),
          });
        } else if (matchedRule.action === 'warn') {
          warnings.push(`${matchedRule.ruleName}: ${matchedRule.reason}`);
        }

        // Add recommendations based on actions
        if (matchedRule.action === 'move' || matchedRule.action === 'rename') {
          recommendations.push(`${matchedRule.ruleName}: ${matchedRule.reason}`);
        }

        // Track enforced actions
        if (['block', 'move', 'rename'].includes(matchedRule.action)) {
          enforcedActions.push(`${matchedRule.action}: ${matchedRule.ruleName}`);
        }
      }

      // Add general recommendations from evaluation
      for (const action of results.recommendedActions) {
        recommendations.push(`${action.action}: ${action.reason}`);
      }

      const compliant = violations.length === 0;

      return {
        success: true,
        data: {
          compliant,
          violations,
          warnings,
          recommendations,
          enforcedActions: enforcedActions.length > 0 ? enforcedActions : undefined,
        },
        metadata: {
          evaluatedRules: results.evaluatedRules.length,
          matchedRules: results.matchedRules.length,
          highestSeverity: results.highestSeverity,
          timestamp: results.timestamp,
        },
      };
    } catch (error) {
      logger.error('Error executing PolicyAgent:', error);
      return {
        success: false,
        error: `Policy check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Reload rules from storage
   */
  async reloadRules(): Promise<void> {
    await this.initialize();
  }

  /**
   * Get the current rules
   */
  getRules() {
    return this.evaluator.getRules();
  }

  /**
   * Get remediation suggestion based on action and reason
   */
  private getRemediation(action: string, reason?: string): string {
    switch (action) {
      case 'block':
        return 'This file violates organizational policies and should not be stored. Remove or modify the file to comply with policies.';
      case 'move':
        return `Move this file to the appropriate location as specified in the policy. ${reason || ''}`;
      case 'rename':
        return `Rename this file to comply with naming conventions. ${reason || ''}`;
      case 'tag':
        return `Add appropriate tags to this file as specified in the policy. ${reason || ''}`;
      default:
        return 'Review the file and take appropriate action as specified in the policy.';
    }
  }
}
