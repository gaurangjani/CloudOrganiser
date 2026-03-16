// Shared condition evaluation utilities used by all rule handlers
import { RuleConditionOperator } from '../../../types/rules.types';

/**
 * Evaluates a single condition by comparing `actualValue` against `expectedValue`
 * using the given `operator`.
 */
export function evaluateConditionValue(
  actualValue: unknown,
  operator: RuleConditionOperator,
  expectedValue: unknown,
): boolean {
  const actual = String(actualValue).toLowerCase();
  const expected = String(expectedValue).toLowerCase();

  switch (operator) {
    case 'equals':
      return actual === expected;

    case 'not_equals':
      return actual !== expected;

    case 'contains':
      return actual.includes(expected);

    case 'not_contains':
      return !actual.includes(expected);

    case 'starts_with':
      return actual.startsWith(expected);

    case 'ends_with':
      return actual.endsWith(expected);

    case 'matches_regex': {
      try {
        const regex = new RegExp(String(expectedValue), 'i');
        return regex.test(String(actualValue));
      } catch {
        return false;
      }
    }

    case 'greater_than':
      return Number(actualValue) > Number(expectedValue);

    case 'less_than':
      return Number(actualValue) < Number(expectedValue);

    case 'in': {
      const list = Array.isArray(expectedValue)
        ? (expectedValue as unknown[]).map((v) => String(v).toLowerCase())
        : [expected];
      return list.includes(actual);
    }

    case 'not_in': {
      const list = Array.isArray(expectedValue)
        ? (expectedValue as unknown[]).map((v) => String(v).toLowerCase())
        : [expected];
      return !list.includes(actual);
    }

    default:
      return false;
  }
}
