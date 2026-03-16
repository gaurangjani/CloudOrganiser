// MongoDB storage implementation for rules
import { RuleModel } from '../models/rule.model';
import { AnyRule, RuleStorage, RuleFilter } from '../types/rule.types';
import logger from '../config/logger';

/**
 * MongoDB-based rule storage implementation
 */
export class MongoRuleStorage implements RuleStorage {
  /**
   * Save a rule to the database
   */
  async saveRule(rule: AnyRule): Promise<AnyRule> {
    try {
      const ruleDoc = new RuleModel({
        name: rule.name,
        description: rule.description,
        type: rule.type,
        priority: rule.priority,
        enabled: rule.enabled,
        severity: rule.severity,
        action: rule.action,
        config: rule.config,
        organizationId: rule.organizationId,
        userId: rule.userId,
        metadata: rule.metadata,
      });

      const saved = await ruleDoc.save();
      return saved.toRule();
    } catch (error) {
      logger.error('Error saving rule:', error);
      throw new Error(`Failed to save rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a rule by ID
   */
  async getRule(id: string): Promise<AnyRule | null> {
    try {
      const ruleDoc = await RuleModel.findById(id);
      if (!ruleDoc) {
        return null;
      }
      return ruleDoc.toRule();
    } catch (error) {
      logger.error('Error getting rule:', error);
      throw new Error(`Failed to get rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all rules, optionally filtered
   */
  async getRules(filter?: RuleFilter): Promise<AnyRule[]> {
    try {
      const query = this.buildQuery(filter);
      const ruleDocs = await RuleModel.find(query);
      return ruleDocs.map((doc) => doc.toRule());
    } catch (error) {
      logger.error('Error getting rules:', error);
      throw new Error(`Failed to get rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a rule
   */
  async updateRule(id: string, updates: Partial<AnyRule>): Promise<AnyRule> {
    try {
      // Remove id from updates if present
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...updateFields } = updates as any;

      const ruleDoc = await RuleModel.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
      );

      if (!ruleDoc) {
        throw new Error('Rule not found');
      }

      return ruleDoc.toRule();
    } catch (error) {
      logger.error('Error updating rule:', error);
      throw new Error(`Failed to update rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(id: string): Promise<boolean> {
    try {
      const result = await RuleModel.findByIdAndDelete(id);
      return result !== null;
    } catch (error) {
      logger.error('Error deleting rule:', error);
      throw new Error(`Failed to delete rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get rules sorted by priority (highest first)
   */
  async getRulesByPriority(filter?: RuleFilter): Promise<AnyRule[]> {
    try {
      const query = this.buildQuery(filter);
      const ruleDocs = await RuleModel.find(query).sort({ priority: -1 });
      return ruleDocs.map((doc) => doc.toRule());
    } catch (error) {
      logger.error('Error getting rules by priority:', error);
      throw new Error(`Failed to get rules by priority: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build MongoDB query from filter
   */
  private buildQuery(filter?: RuleFilter): Record<string, unknown> {
    if (!filter) {
      return {};
    }

    const query: Record<string, unknown> = {};

    if (filter.type !== undefined) {
      query.type = filter.type;
    }

    if (filter.enabled !== undefined) {
      query.enabled = filter.enabled;
    }

    if (filter.organizationId !== undefined) {
      query.organizationId = filter.organizationId;
    }

    if (filter.userId !== undefined) {
      query.userId = filter.userId;
    }

    if (filter.severity !== undefined) {
      query.severity = filter.severity;
    }

    if (filter.minPriority !== undefined || filter.maxPriority !== undefined) {
      query.priority = {};
      if (filter.minPriority !== undefined) {
        (query.priority as any).$gte = filter.minPriority;
      }
      if (filter.maxPriority !== undefined) {
        (query.priority as any).$lte = filter.maxPriority;
      }
    }

    return query;
  }
}

/**
 * In-memory rule storage for testing
 */
export class InMemoryRuleStorage implements RuleStorage {
  private rules: Map<string, AnyRule> = new Map();
  private nextId = 1;

  async saveRule(rule: AnyRule): Promise<AnyRule> {
    const id = rule.id || `rule-${this.nextId++}`;
    const now = new Date();
    const savedRule: AnyRule = {
      ...rule,
      id,
      createdAt: rule.createdAt || now,
      updatedAt: now,
    };
    this.rules.set(id, savedRule);
    return savedRule;
  }

  async getRule(id: string): Promise<AnyRule | null> {
    return this.rules.get(id) || null;
  }

  async getRules(filter?: RuleFilter): Promise<AnyRule[]> {
    let rules = Array.from(this.rules.values());

    if (filter) {
      rules = rules.filter((rule) => this.matchesFilter(rule, filter));
    }

    return rules;
  }

  async updateRule(id: string, updates: Partial<AnyRule>): Promise<AnyRule> {
    const existing = this.rules.get(id);
    if (!existing) {
      throw new Error('Rule not found');
    }

    const updated: AnyRule = {
      ...existing,
      ...updates,
      id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };

    this.rules.set(id, updated);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  async getRulesByPriority(filter?: RuleFilter): Promise<AnyRule[]> {
    const rules = await this.getRules(filter);
    return rules.sort((a, b) => b.priority - a.priority);
  }

  private matchesFilter(rule: AnyRule, filter: RuleFilter): boolean {
    if (filter.type !== undefined && rule.type !== filter.type) {
      return false;
    }

    if (filter.enabled !== undefined && rule.enabled !== filter.enabled) {
      return false;
    }

    if (filter.organizationId !== undefined && rule.organizationId !== filter.organizationId) {
      return false;
    }

    if (filter.userId !== undefined && rule.userId !== filter.userId) {
      return false;
    }

    if (filter.severity !== undefined && rule.severity !== filter.severity) {
      return false;
    }

    if (filter.minPriority !== undefined && rule.priority < filter.minPriority) {
      return false;
    }

    if (filter.maxPriority !== undefined && rule.priority > filter.maxPriority) {
      return false;
    }

    return true;
  }

  /**
   * Clear all rules (useful for testing)
   */
  clear(): void {
    this.rules.clear();
    this.nextId = 1;
  }
}
