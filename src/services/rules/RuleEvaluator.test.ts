// Tests for the modular rules engine
import { RuleEvaluator } from './RuleEvaluator';
import { InMemoryRulesRepository } from './InMemoryRulesRepository';
import { FileTypeRuleHandler } from './handlers/FileTypeRuleHandler';
import { ContentRuleHandler } from './handlers/ContentRuleHandler';
import { NamingRuleHandler } from './handlers/NamingRuleHandler';
import { FolderRoutingRuleHandler } from './handlers/FolderRoutingRuleHandler';
import { AIAssistedRuleHandler } from './handlers/AIAssistedRuleHandler';
import { FileContext } from '../../types/context.types';
import {
  CreateRuleInput,
  Rule,
  RuleCondition,
} from '../../types/rules.types';
import {
  AIProvider,
  AIClassificationRequest,
  AIClassificationResponse,
} from '../../types/ai.types';

// Mock logger to prevent config dependency during tests
jest.mock('../../config/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeFileContext(overrides: Partial<FileContext> = {}): FileContext {
  return {
    id: 'file-001',
    name: 'report.pdf',
    metadata: {
      size: 2048,
      mimeType: 'application/pdf',
      createdAt: new Date('2024-01-01'),
      modifiedAt: new Date('2024-01-02'),
      extension: 'pdf',
    },
    location: {
      provider: 'google',
      path: '/documents',
      parentPath: '/',
      fullPath: '/documents/report.pdf',
    },
    userId: 'user-123',
    ...overrides,
  };
}

function makeRuleInput(overrides: Partial<CreateRuleInput> = {}): CreateRuleInput {
  return {
    name: 'Test Rule',
    type: 'file_type',
    priority: 10,
    enabled: true,
    conditionLogic: 'AND',
    conditions: [],
    actions: [{ type: 'tag', params: { tag: 'matched' } }],
    ...overrides,
  };
}

// Mock AI provider that always returns a non-empty classification
class MockAIProvider implements AIProvider {
  private ready: boolean;
  constructor(ready = true) {
    this.ready = ready;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async initialize(_config: any): Promise<void> {
    this.ready = true;
  }
  async classify(_request: AIClassificationRequest): Promise<AIClassificationResponse> {
    return {
      categories: ['documents'],
      tags: ['pdf'],
      confidence: 0.9,
      contentType: 'document',
      isPII: false,
      language: 'en',
    };
  }
  isReady(): boolean {
    return this.ready;
  }
  getName(): string {
    return 'MockAI';
  }
}

// ─────────────────────────────────────────────────────────────
// InMemoryRulesRepository
// ─────────────────────────────────────────────────────────────

describe('InMemoryRulesRepository', () => {
  let repo: InMemoryRulesRepository;

  beforeEach(() => {
    repo = new InMemoryRulesRepository();
  });

  it('saves and retrieves a rule by id', async () => {
    const input = makeRuleInput();
    const saved = await repo.save(input);

    expect(saved.id).toBeDefined();
    expect(saved.name).toBe(input.name);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);

    const found = await repo.findById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
  });

  it('returns null for a missing id', async () => {
    const result = await repo.findById('non-existent');
    expect(result).toBeNull();
  });

  it('findAll returns all saved rules', async () => {
    await repo.save(makeRuleInput({ name: 'Rule A', type: 'file_type' }));
    await repo.save(makeRuleInput({ name: 'Rule B', type: 'naming' }));
    await repo.save(makeRuleInput({ name: 'Rule C', type: 'content' }));

    const all = await repo.findAll();
    expect(all).toHaveLength(3);
  });

  it('findAll filters by type', async () => {
    await repo.save(makeRuleInput({ name: 'A', type: 'file_type' }));
    await repo.save(makeRuleInput({ name: 'B', type: 'naming' }));
    await repo.save(makeRuleInput({ name: 'C', type: 'file_type' }));

    const fileTypeRules = await repo.findAll({ type: 'file_type' });
    expect(fileTypeRules).toHaveLength(2);
    fileTypeRules.forEach((r) => expect(r.type).toBe('file_type'));
  });

  it('findAll filters by enabled flag', async () => {
    await repo.save(makeRuleInput({ enabled: true }));
    await repo.save(makeRuleInput({ enabled: false }));

    const enabled = await repo.findAll({ enabled: true });
    expect(enabled).toHaveLength(1);
    expect(enabled[0].enabled).toBe(true);
  });

  it('findAll filters by userId', async () => {
    await repo.save(makeRuleInput({ userId: 'alice' }));
    await repo.save(makeRuleInput({ userId: 'bob' }));

    const aliceRules = await repo.findAll({ userId: 'alice' });
    expect(aliceRules).toHaveLength(1);
    expect(aliceRules[0].userId).toBe('alice');
  });

  it('updates a rule', async () => {
    const saved = await repo.save(makeRuleInput({ priority: 5 }));
    const updated = await repo.update(saved.id, { priority: 99 });

    expect(updated).not.toBeNull();
    expect(updated!.priority).toBe(99);
    // updatedAt should change
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(saved.updatedAt.getTime());
  });

  it('returns null when updating a missing rule', async () => {
    const result = await repo.update('missing', { priority: 1 });
    expect(result).toBeNull();
  });

  it('deletes a rule', async () => {
    const saved = await repo.save(makeRuleInput());
    const deleted = await repo.delete(saved.id);

    expect(deleted).toBe(true);
    const found = await repo.findById(saved.id);
    expect(found).toBeNull();
  });

  it('returns false when deleting a missing rule', async () => {
    const result = await repo.delete('does-not-exist');
    expect(result).toBe(false);
  });

  it('counts rules', async () => {
    await repo.save(makeRuleInput({ type: 'file_type' }));
    await repo.save(makeRuleInput({ type: 'naming' }));

    expect(await repo.count()).toBe(2);
    expect(await repo.count({ type: 'file_type' })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// FileTypeRuleHandler
// ─────────────────────────────────────────────────────────────

describe('FileTypeRuleHandler', () => {
  const handler = new FileTypeRuleHandler();

  function makeRule(conditions: RuleCondition[], logic: 'AND' | 'OR' = 'AND'): Rule {
    return {
      id: 'r1',
      name: 'File type rule',
      type: 'file_type',
      priority: 1,
      enabled: true,
      conditionLogic: logic,
      conditions,
      actions: [{ type: 'tag', params: { tag: 'pdf-doc' } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('matches on file extension (equals)', () => {
    const rule = makeRule([{ field: 'file.extension', operator: 'equals', value: 'pdf' }]);
    const ctx = makeFileContext();
    const result = handler.evaluate(rule, ctx);
    expect(result.matched).toBe(true);
    expect(result.actions).toHaveLength(1);
  });

  it('does not match when extension differs', () => {
    const rule = makeRule([{ field: 'file.extension', operator: 'equals', value: 'docx' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it('matches on mimeType (contains)', () => {
    const rule = makeRule([{ field: 'file.mimeType', operator: 'contains', value: 'pdf' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('matches on file size (greater_than)', () => {
    const rule = makeRule([{ field: 'file.size', operator: 'greater_than', value: 1000 }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('does not match on file size (less_than fails)', () => {
    const rule = makeRule([{ field: 'file.size', operator: 'less_than', value: 100 }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
  });

  it('supports OR logic', () => {
    const rule = makeRule(
      [
        { field: 'file.extension', operator: 'equals', value: 'docx' }, // false
        { field: 'file.mimeType', operator: 'contains', value: 'pdf' }, // true
      ],
      'OR',
    );
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('supports AND logic with all matching', () => {
    const rule = makeRule(
      [
        { field: 'file.extension', operator: 'equals', value: 'pdf' },
        { field: 'file.size', operator: 'greater_than', value: 1000 },
      ],
      'AND',
    );
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('fails AND logic when one condition does not match', () => {
    const rule = makeRule(
      [
        { field: 'file.extension', operator: 'equals', value: 'pdf' },
        { field: 'file.size', operator: 'less_than', value: 100 }, // fails
      ],
      'AND',
    );
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
  });

  it('supports "in" operator with extension list', () => {
    const rule = makeRule([
      { field: 'file.extension', operator: 'in', value: ['pdf', 'docx', 'xlsx'] },
    ]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('returns correct ruleId and ruleName in result', () => {
    const rule = makeRule([{ field: 'file.extension', operator: 'equals', value: 'pdf' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.ruleId).toBe('r1');
    expect(result.ruleName).toBe('File type rule');
    expect(result.ruleType).toBe('file_type');
  });
});

// ─────────────────────────────────────────────────────────────
// ContentRuleHandler
// ─────────────────────────────────────────────────────────────

describe('ContentRuleHandler', () => {
  const handler = new ContentRuleHandler();

  function makeRule(conditions: RuleCondition[]): Rule {
    return {
      id: 'c1',
      name: 'Content rule',
      type: 'content',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions,
      actions: [{ type: 'categorize', params: { category: 'financial' } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('matches when content contains keyword', () => {
    const rule = makeRule([{ field: 'content.text', operator: 'contains', value: 'invoice' }]);
    const ctx = makeFileContext({ content: 'This is an invoice for services rendered.' });
    const result = handler.evaluate(rule, ctx);
    expect(result.matched).toBe(true);
  });

  it('does not match when content is missing', () => {
    const rule = makeRule([{ field: 'content.text', operator: 'contains', value: 'invoice' }]);
    const ctx = makeFileContext({ content: undefined });
    const result = handler.evaluate(rule, ctx);
    expect(result.matched).toBe(false);
  });

  it('handles Buffer content', () => {
    const rule = makeRule([{ field: 'content.text', operator: 'contains', value: 'confidential' }]);
    const ctx = makeFileContext({ content: Buffer.from('This document is confidential.') });
    const result = handler.evaluate(rule, ctx);
    expect(result.matched).toBe(true);
  });

  it('matches regex on content', () => {
    const rule = makeRule([
      { field: 'content.text', operator: 'matches_regex', value: '\\d{4}-\\d{2}-\\d{2}' },
    ]);
    const ctx = makeFileContext({ content: 'Date: 2024-03-14, Report ID: X100' });
    const result = handler.evaluate(rule, ctx);
    expect(result.matched).toBe(true);
  });

  it('returns false for unknown field', () => {
    const rule = makeRule([{ field: 'unknown.field', operator: 'contains', value: 'test' }]);
    const result = handler.evaluate(rule, makeFileContext({ content: 'test content' }));
    expect(result.matched).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// NamingRuleHandler
// ─────────────────────────────────────────────────────────────

describe('NamingRuleHandler', () => {
  const handler = new NamingRuleHandler();

  function makeRule(conditions: RuleCondition[]): Rule {
    return {
      id: 'n1',
      name: 'Naming rule',
      type: 'naming',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions,
      actions: [{ type: 'rename', params: { pattern: '{date}_{name}' } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('matches file name starting with pattern', () => {
    const rule = makeRule([{ field: 'file.name', operator: 'starts_with', value: 'report' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('matches file name ending with extension', () => {
    const rule = makeRule([{ field: 'file.name', operator: 'ends_with', value: '.pdf' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('matches file name with regex', () => {
    const rule = makeRule([
      { field: 'file.name', operator: 'matches_regex', value: '^report.*\\.pdf$' },
    ]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('does not match when file name is different', () => {
    const rule = makeRule([{ field: 'file.name', operator: 'equals', value: 'other.txt' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
  });

  it('not_contains operator works correctly', () => {
    const rule = makeRule([{ field: 'file.name', operator: 'not_contains', value: 'archive' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// FolderRoutingRuleHandler
// ─────────────────────────────────────────────────────────────

describe('FolderRoutingRuleHandler', () => {
  const handler = new FolderRoutingRuleHandler();

  function makeRule(conditions: RuleCondition[]): Rule {
    return {
      id: 'f1',
      name: 'Folder routing rule',
      type: 'folder_routing',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions,
      actions: [{ type: 'move', params: { destination: '/archive/documents' } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('matches on folder path (contains)', () => {
    const rule = makeRule([{ field: 'folder.path', operator: 'contains', value: 'documents' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('matches on folder.fullPath (starts_with)', () => {
    const rule = makeRule([
      { field: 'folder.fullPath', operator: 'starts_with', value: '/documents' },
    ]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('matches on folder.provider', () => {
    const rule = makeRule([{ field: 'folder.provider', operator: 'equals', value: 'google' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
  });

  it('does not match for unrelated path', () => {
    const rule = makeRule([{ field: 'folder.path', operator: 'equals', value: '/images' }]);
    const result = handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AIAssistedRuleHandler
// ─────────────────────────────────────────────────────────────

describe('AIAssistedRuleHandler', () => {
  it('skips evaluation when no AI provider is configured', async () => {
    const handler = new AIAssistedRuleHandler();
    const rule: Rule = {
      id: 'ai1',
      name: 'AI rule',
      type: 'ai_assisted',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'ai.prompt', operator: 'equals', value: 'is this a financial doc?' }],
      actions: [{ type: 'categorize', params: { category: 'finance' } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
    expect(result.metadata?.reason).toBe('AI provider not available');
  });

  it('matches when AI provider returns non-empty classification', async () => {
    const handler = new AIAssistedRuleHandler(new MockAIProvider());
    const rule: Rule = {
      id: 'ai1',
      name: 'AI rule',
      type: 'ai_assisted',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'ai.prompt', operator: 'equals', value: 'classify this document' }],
      actions: [{ type: 'tag', params: { tag: 'ai-classified' } }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(true);
    expect(result.actions).toHaveLength(1);
  });

  it('skips evaluation when AI provider is not ready', async () => {
    const handler = new AIAssistedRuleHandler(new MockAIProvider(false));
    const rule: Rule = {
      id: 'ai1',
      name: 'AI rule (not ready)',
      type: 'ai_assisted',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'ai.prompt', operator: 'equals', value: 'classify' }],
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
  });

  it('handles AI provider errors gracefully', async () => {
    class FailingAIProvider extends MockAIProvider {
      async classify(_req: AIClassificationRequest): Promise<AIClassificationResponse> {
        throw new Error('AI service unavailable');
      }
    }
    const handler = new AIAssistedRuleHandler(new FailingAIProvider());
    const rule: Rule = {
      id: 'ai2',
      name: 'Failing AI rule',
      type: 'ai_assisted',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND',
      conditions: [{ field: 'ai.prompt', operator: 'equals', value: 'classify' }],
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await handler.evaluate(rule, makeFileContext());
    expect(result.matched).toBe(false);
    expect(result.metadata?.error).toContain('AI service unavailable');
  });
});

// ─────────────────────────────────────────────────────────────
// RuleEvaluator (integration)
// ─────────────────────────────────────────────────────────────

describe('RuleEvaluator', () => {
  let repo: InMemoryRulesRepository;
  let evaluator: RuleEvaluator;

  beforeEach(() => {
    repo = new InMemoryRulesRepository();
    evaluator = new RuleEvaluator(repo);
  });

  it('returns empty results when no rules exist', async () => {
    const result = await evaluator.evaluate(makeFileContext());
    expect(result.totalRulesEvaluated).toBe(0);
    expect(result.matchedRules).toHaveLength(0);
    expect(result.appliedActions).toHaveLength(0);
  });

  it('evaluates rules in priority order (lower number first)', async () => {
    const evaluated: string[] = [];

    // Save rules with different priorities
    const r10 = await repo.save(makeRuleInput({ name: 'Priority 10', priority: 10 }));
    const r1 = await repo.save(makeRuleInput({ name: 'Priority 1', priority: 1 }));
    const r5 = await repo.save(makeRuleInput({ name: 'Priority 5', priority: 5 }));

    // Spy on evaluateRule to capture order
    const originalEvaluateRule = evaluator.evaluateRule.bind(evaluator);
    jest.spyOn(evaluator, 'evaluateRule').mockImplementation(async (rule, ctx) => {
      evaluated.push(rule.name);
      return originalEvaluateRule(rule, ctx);
    });

    await evaluator.evaluate(makeFileContext());

    expect(evaluated).toEqual([r1.name, r5.name, r10.name]);
  });

  it('skips disabled rules', async () => {
    await repo.save(makeRuleInput({ enabled: false, name: 'Disabled rule' }));
    const result = await evaluator.evaluate(makeFileContext());
    expect(result.totalRulesEvaluated).toBe(0);
  });

  it('collects actions from all matched rules', async () => {
    await repo.save(
      makeRuleInput({
        name: 'File type rule',
        type: 'file_type',
        priority: 1,
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'pdf' }],
        actions: [{ type: 'tag', params: { tag: 'pdf' } }],
      }),
    );
    await repo.save(
      makeRuleInput({
        name: 'Naming rule',
        type: 'naming',
        priority: 2,
        conditions: [{ field: 'file.name', operator: 'starts_with', value: 'report' }],
        actions: [{ type: 'categorize', params: { category: 'reports' } }],
      }),
    );

    const result = await evaluator.evaluate(makeFileContext());
    expect(result.matchedRules).toHaveLength(2);
    expect(result.appliedActions).toHaveLength(2);
  });

  it('includes fileContextId in result', async () => {
    const ctx = makeFileContext({ id: 'my-file-id' });
    const result = await evaluator.evaluate(ctx);
    expect(result.fileContextId).toBe('my-file-id');
  });

  it('includes timestamp in result', async () => {
    const before = new Date();
    const result = await evaluator.evaluate(makeFileContext());
    const after = new Date();
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('filters rules by userId via filter param', async () => {
    await repo.save(makeRuleInput({ userId: 'alice', name: 'Alice rule', priority: 1 }));
    await repo.save(makeRuleInput({ userId: 'bob', name: 'Bob rule', priority: 2 }));

    const result = await evaluator.evaluate(makeFileContext(), { userId: 'alice' });
    expect(result.totalRulesEvaluated).toBe(1);
    expect(result.matchedRules[0]?.ruleName).toBe('Alice rule');
  });

  it('handles multiple rule types in one pass', async () => {
    await repo.save(
      makeRuleInput({
        type: 'file_type',
        priority: 1,
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'pdf' }],
        actions: [{ type: 'tag', params: { tag: 'type-match' } }],
      }),
    );
    await repo.save(
      makeRuleInput({
        type: 'content',
        priority: 2,
        conditions: [{ field: 'content.text', operator: 'contains', value: 'invoice' }],
        actions: [{ type: 'categorize', params: { category: 'invoices' } }],
      }),
    );
    await repo.save(
      makeRuleInput({
        type: 'folder_routing',
        priority: 3,
        conditions: [{ field: 'folder.path', operator: 'contains', value: 'documents' }],
        actions: [{ type: 'move', params: { destination: '/archive' } }],
      }),
    );

    const ctx = makeFileContext({ content: 'This is an invoice.' });
    const result = await evaluator.evaluate(ctx);

    expect(result.totalRulesEvaluated).toBe(3);
    expect(result.matchedRules).toHaveLength(3);
    expect(result.appliedActions.map((a) => a.type)).toEqual(['tag', 'categorize', 'move']);
  });

  it('uses AI-assisted rules when provider is configured', async () => {
    const aiEvaluator = new RuleEvaluator(repo, { aiProvider: new MockAIProvider() });
    await repo.save(
      makeRuleInput({
        type: 'ai_assisted',
        priority: 1,
        conditions: [{ field: 'ai.prompt', operator: 'equals', value: 'classify this file' }],
        actions: [{ type: 'tag', params: { tag: 'ai-processed' } }],
      }),
    );

    const result = await aiEvaluator.evaluate(makeFileContext());
    expect(result.matchedRules).toHaveLength(1);
    expect(result.matchedRules[0].ruleType).toBe('ai_assisted');
  });

  it('evaluateRule returns unmatched result for unknown rule type', async () => {
    // Create a rule with an invalid type to test the exhaustive check
    const invalidRule = {
      id: 'bad-rule',
      name: 'Bad rule',
      type: 'unknown_type' as 'file_type',
      priority: 1,
      enabled: true,
      conditionLogic: 'AND' as const,
      conditions: [],
      actions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await evaluator.evaluateRule(invalidRule, makeFileContext());
    expect(result.matched).toBe(false);
  });
});
