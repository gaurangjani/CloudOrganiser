// NamingRuleHandler evaluates rules that match on file name
import { FileContext } from '../../../types/context.types';
import {
  Rule,
  RuleCondition,
  RuleConditionOperator,
  RuleEvaluationResult,
} from '../../../types/rules.types';
import { evaluateConditionValue } from './conditionUtils';

/**
 * NamingRuleHandler evaluates rules of type 'naming'.
 *
 * Supported condition fields:
 *  - 'file.name'  → context.name (the full file name including extension)
 */
export class NamingRuleHandler {
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
      case 'file.name':
        return context.name;
      default:
        return undefined;
    }
  }
}
