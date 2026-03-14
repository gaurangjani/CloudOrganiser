// FileTypeRuleHandler evaluates rules that match on file extension and MIME type
import { FileContext } from '../../../types/context.types';
import {
  Rule,
  RuleCondition,
  RuleConditionOperator,
  RuleEvaluationResult,
} from '../../../types/rules.types';
import { evaluateConditionValue } from './conditionUtils';

/**
 * FileTypeRuleHandler evaluates rules of type 'file_type'.
 *
 * Supported condition fields:
 *  - 'file.extension'  → context.metadata.extension  (e.g. "pdf", "docx")
 *  - 'file.mimeType'   → context.metadata.mimeType   (e.g. "application/pdf")
 *  - 'file.size'       → context.metadata.size       (bytes, numeric comparisons)
 */
export class FileTypeRuleHandler {
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
      case 'file.extension':
        return context.metadata.extension?.toLowerCase() ?? '';
      case 'file.mimeType':
        return context.metadata.mimeType?.toLowerCase() ?? '';
      case 'file.size':
        return context.metadata.size;
      default:
        return undefined;
    }
  }
}
