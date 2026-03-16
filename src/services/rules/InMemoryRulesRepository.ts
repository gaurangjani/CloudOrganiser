// In-memory implementation of RulesRepository
import { v4 as uuidv4 } from '../../utils/uuid';
import {
  Rule,
  CreateRuleInput,
  RuleFilter,
  RulesRepository,
} from '../../types/rules.types';

/**
 * InMemoryRulesRepository stores rules in memory.
 * Suitable for development, testing, and scenarios where persistence is not required.
 * Replace with a SQL/NoSQL-backed implementation for production use.
 */
export class InMemoryRulesRepository implements RulesRepository {
  private rules: Map<string, Rule> = new Map();

  /** Persist a new rule and return it with generated id and timestamps */
  async save(input: CreateRuleInput): Promise<Rule> {
    const now = new Date();
    const rule: Rule = {
      ...input,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  /** Retrieve a rule by ID */
  async findById(id: string): Promise<Rule | null> {
    return this.rules.get(id) ?? null;
  }

  /** Retrieve all rules, optionally filtered */
  async findAll(filter?: RuleFilter): Promise<Rule[]> {
    let results = Array.from(this.rules.values());

    if (filter) {
      if (filter.type !== undefined) {
        results = results.filter((r) => r.type === filter.type);
      }
      if (filter.enabled !== undefined) {
        results = results.filter((r) => r.enabled === filter.enabled);
      }
      if (filter.userId !== undefined) {
        results = results.filter((r) => r.userId === filter.userId);
      }
      if (filter.organizationId !== undefined) {
        results = results.filter((r) => r.organizationId === filter.organizationId);
      }
    }

    return results;
  }

  /** Update an existing rule by ID */
  async update(
    id: string,
    updates: Partial<Omit<Rule, 'id' | 'createdAt'>>,
  ): Promise<Rule | null> {
    const existing = this.rules.get(id);
    if (!existing) return null;

    const updated: Rule = { ...existing, ...updates, id, createdAt: existing.createdAt, updatedAt: new Date() };
    this.rules.set(id, updated);
    return updated;
  }

  /** Delete a rule by ID */
  async delete(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  /** Count rules, optionally filtered */
  async count(filter?: RuleFilter): Promise<number> {
    const results = await this.findAll(filter);
    return results.length;
  }
}
