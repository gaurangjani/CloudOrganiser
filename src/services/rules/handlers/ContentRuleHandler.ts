// ContentRuleHandler evaluates rules that match on file content
import { FileContext } from '../../../types/context.types';
import {
  Rule,
  RuleCondition,
  RuleConditionOperator,
  RuleEvaluationResult,
} from '../../../types/rules.types';
import { evaluateConditionValue } from './conditionUtils';

/**
 * ContentRuleHandler evaluates rules of type 'content'.
 *
 * Supported condition fields:
 *  - 'content.text'  → the raw text of context.content (Buffer or string)
 *
 * If the FileContext does not have content attached (context.content is undefined),
 * all content conditions evaluate to false.
 */
export class ContentRuleHandler {
  evaluate(rule: Rule, context: FileContext): RuleEvaluationResult {
    const conditionResults = rule.conditions.map((condition) =>
      this.evaluateCondition(condition, context),
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
  }

  private evaluateCondition(condition: RuleCondition, context: FileContext): boolean {
    const actualValue = this.resolveField(condition.field, context);
    if (actualValue === undefined) return false;
    return evaluateConditionValue(
      actualValue,
      condition.operator as RuleConditionOperator,
      condition.value,
    );
  }

  private resolveField(field: string, context: FileContext): unknown {
    switch (field) {
      case 'content.text':
        if (context.content === undefined) return undefined;
        return Buffer.isBuffer(context.content)
          ? context.content.toString('utf-8')
          : String(context.content);
      default:
        return undefined;
    }
  }
}
