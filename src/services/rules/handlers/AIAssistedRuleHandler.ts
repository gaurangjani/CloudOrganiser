// AIAssistedRuleHandler evaluates rules using an AI provider
import { FileContext } from '../../../types/context.types';
import { AIProvider } from '../../../types/ai.types';
import {
  Rule,
  RuleEvaluationResult,
} from '../../../types/rules.types';

/**
 * AIAssistedRuleHandler evaluates rules of type 'ai_assisted'.
 *
 * Each condition in an AI-assisted rule must have:
 *  - field:    'ai.prompt'
 *  - operator: 'equals'
 *  - value:    a freeform prompt string
 *
 * The handler sends the prompt and file context to the configured AI provider.
 * The provider's classification result is used to determine whether the rule
 * matches.  When no AI provider is configured the rule is skipped (not matched).
 *
 * The rule is considered matched when the AI classifies the file with at least
 * one category or tag that the prompt requested.
 */
export class AIAssistedRuleHandler {
  private aiProvider?: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider;
  }

  async evaluate(rule: Rule, context: FileContext): Promise<RuleEvaluationResult> {
    if (!this.aiProvider || !this.aiProvider.isReady()) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        actions: [],
        metadata: { reason: 'AI provider not available' },
      };
    }

    try {
      const conditionResults = await Promise.all(
        rule.conditions.map((condition) => this.evaluateCondition(condition, context)),
      );

      const matched =
        rule.conditionLogic === 'OR'
          ? conditionResults.some(Boolean)
          : conditionResults.every(Boolean);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched,
        actions: matched ? rule.actions : [],
        metadata: { conditionResults },
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        matched: false,
        actions: [],
        metadata: {
          error: error instanceof Error ? error.message : 'AI evaluation error',
        },
      };
    }
  }

  private async evaluateCondition(
    condition: { field: string; operator: string; value: unknown },
    context: FileContext,
  ): Promise<boolean> {
    if (condition.field !== 'ai.prompt' || !this.aiProvider) {
      return false;
    }

    // Use the condition value as additional context for the prompt
    const promptHint = String(condition.value);

    const response = await this.aiProvider.classify({
      fileName: context.name,
      mimeType: context.metadata.mimeType,
      fileSize: context.metadata.size,
      content: context.content
        ? Buffer.isBuffer(context.content)
          ? context.content.toString('utf-8').substring(0, 2000)
          : String(context.content).substring(0, 2000)
        : undefined,
      metadata: {
        prompt: promptHint,
        extension: context.metadata.extension,
        path: context.location.fullPath,
      },
    });

    // A rule matches when the AI returns at least one category or tag
    return response.categories.length > 0 || response.tags.length > 0;
  }
}
