// FolderRoutingRuleHandler evaluates rules that match on file location / folder paths
import { FileContext } from '../../../types/context.types';
import {
  Rule,
  RuleCondition,
  RuleConditionOperator,
  RuleEvaluationResult,
} from '../../../types/rules.types';
import { evaluateConditionValue } from './conditionUtils';

/**
 * FolderRoutingRuleHandler evaluates rules of type 'folder_routing'.
 *
 * Supported condition fields:
 *  - 'folder.path'        → context.location.path
 *  - 'folder.parentPath'  → context.location.parentPath
 *  - 'folder.fullPath'    → context.location.fullPath
 *  - 'folder.provider'    → context.location.provider
 */
export class FolderRoutingRuleHandler {
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
      case 'folder.path':
        return context.location.path;
      case 'folder.parentPath':
        return context.location.parentPath;
      case 'folder.fullPath':
        return context.location.fullPath;
      case 'folder.provider':
        return context.location.provider;
      default:
        return undefined;
    }
  }
}
