// Tests for ApprovalService and InMemoryApprovalRepository
import { ApprovalService, InMemoryApprovalRepository } from './ApprovalService';
import { CreatePendingActionInput, ApprovalFilter } from '../types/approval.types';

// Mock logger to avoid config dependency
jest.mock('../config/logger', () => ({
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

function makeInput(overrides: Partial<CreatePendingActionInput> = {}): CreatePendingActionInput {
  return {
    fileContext: {
      id: 'file-001',
      name: 'report.pdf',
      userId: 'user-123',
      location: {
        provider: 'google',
        path: '/documents',
        parentPath: '/',
        fullPath: '/documents/report.pdf',
      },
    },
    source: 'rule',
    sourceId: 'rule-abc',
    sourceName: 'Low-confidence rule',
    action: { type: 'move', params: { destination: '/archive' } },
    confidence: 0.5,
    confidenceThreshold: 0.7,
    userId: 'user-123',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// InMemoryApprovalRepository
// ─────────────────────────────────────────────────────────────

describe('InMemoryApprovalRepository', () => {
  let repo: InMemoryApprovalRepository;

  beforeEach(() => {
    repo = new InMemoryApprovalRepository();
  });

  it('saves and retrieves a pending action by id', async () => {
    const input = makeInput();
    const saved = await repo.save(input);

    expect(saved.id).toBeDefined();
    expect(saved.status).toBe('pending');
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);

    const found = await repo.findById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
  });

  it('returns null for unknown id', async () => {
    const result = await repo.findById('non-existent');
    expect(result).toBeNull();
  });

  it('findAll returns all saved actions', async () => {
    await repo.save(makeInput({ source: 'rule' }));
    await repo.save(makeInput({ source: 'ai_classification' }));

    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('findAll filters by status', async () => {
    const saved = await repo.save(makeInput());
    await repo.resolve(saved.id, { status: 'approved', resolvedBy: 'admin' });
    await repo.save(makeInput()); // leaves this one as pending

    const pending = await repo.findAll({ status: 'pending' });
    expect(pending).toHaveLength(1);

    const approved = await repo.findAll({ status: 'approved' });
    expect(approved).toHaveLength(1);
  });

  it('findAll filters by source', async () => {
    await repo.save(makeInput({ source: 'rule' }));
    await repo.save(makeInput({ source: 'ai_classification' }));

    const ruleSrc = await repo.findAll({ source: 'rule' });
    expect(ruleSrc).toHaveLength(1);
    expect(ruleSrc[0].source).toBe('rule');
  });

  it('findAll filters by userId', async () => {
    await repo.save(makeInput({ userId: 'alice' }));
    await repo.save(makeInput({ userId: 'bob' }));

    const alice = await repo.findAll({ userId: 'alice' });
    expect(alice).toHaveLength(1);
    expect(alice[0].userId).toBe('alice');
  });

  it('findAll filters by fileId', async () => {
    await repo.save(makeInput({ fileContext: { ...makeInput().fileContext, id: 'file-A' } }));
    await repo.save(makeInput({ fileContext: { ...makeInput().fileContext, id: 'file-B' } }));

    const results = await repo.findAll({ fileId: 'file-A' });
    expect(results).toHaveLength(1);
    expect(results[0].fileContext.id).toBe('file-A');
  });

  it('resolve approves an action', async () => {
    const saved = await repo.save(makeInput());
    const resolved = await repo.resolve(saved.id, {
      status: 'approved',
      resolvedBy: 'admin-user',
      notes: 'Looks good',
    });

    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe('approved');
    expect(resolved!.resolvedBy).toBe('admin-user');
    expect(resolved!.notes).toBe('Looks good');
    expect(resolved!.resolvedAt).toBeInstanceOf(Date);
  });

  it('resolve rejects an action', async () => {
    const saved = await repo.save(makeInput());
    const resolved = await repo.resolve(saved.id, {
      status: 'rejected',
      resolvedBy: 'admin-user',
    });

    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe('rejected');
  });

  it('resolve returns null for unknown id', async () => {
    const result = await repo.resolve('no-such-id', { status: 'approved', resolvedBy: 'admin' });
    expect(result).toBeNull();
  });

  it('count returns correct total', async () => {
    await repo.save(makeInput());
    await repo.save(makeInput());

    expect(await repo.count()).toBe(2);
  });

  it('count filters by status', async () => {
    const saved = await repo.save(makeInput());
    await repo.resolve(saved.id, { status: 'approved', resolvedBy: 'admin' });
    await repo.save(makeInput()); // pending

    expect(await repo.count({ status: 'pending' })).toBe(1);
    expect(await repo.count({ status: 'approved' })).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// ApprovalService
// ─────────────────────────────────────────────────────────────

describe('ApprovalService', () => {
  let repo: InMemoryApprovalRepository;
  let service: ApprovalService;

  beforeEach(() => {
    repo = new InMemoryApprovalRepository();
    service = new ApprovalService(repo);
  });

  describe('requiresApproval (static)', () => {
    it('returns true when confidence is below the default threshold', () => {
      expect(ApprovalService.requiresApproval(0.5)).toBe(true);
    });

    it('returns false when confidence meets the default threshold', () => {
      expect(ApprovalService.requiresApproval(0.7)).toBe(false);
    });

    it('returns false when confidence exceeds the default threshold', () => {
      expect(ApprovalService.requiresApproval(0.95)).toBe(false);
    });

    it('respects a custom threshold', () => {
      expect(ApprovalService.requiresApproval(0.8, 0.9)).toBe(true);
      expect(ApprovalService.requiresApproval(0.9, 0.9)).toBe(false);
    });
  });

  describe('queueAction', () => {
    it('creates a pending action with status "pending"', async () => {
      const action = await service.queueAction(makeInput());

      expect(action.id).toBeDefined();
      expect(action.status).toBe('pending');
      expect(action.source).toBe('rule');
    });
  });

  describe('approveAction', () => {
    it('approves an existing pending action', async () => {
      const queued = await service.queueAction(makeInput());
      const approved = await service.approveAction(queued.id, 'admin', 'LGTM');

      expect(approved).not.toBeNull();
      expect(approved!.status).toBe('approved');
      expect(approved!.resolvedBy).toBe('admin');
      expect(approved!.notes).toBe('LGTM');
    });

    it('returns null for an unknown id', async () => {
      const result = await service.approveAction('no-such-id', 'admin');
      expect(result).toBeNull();
    });
  });

  describe('rejectAction', () => {
    it('rejects an existing pending action', async () => {
      const queued = await service.queueAction(makeInput());
      const rejected = await service.rejectAction(queued.id, 'reviewer', 'Not safe');

      expect(rejected).not.toBeNull();
      expect(rejected!.status).toBe('rejected');
      expect(rejected!.resolvedBy).toBe('reviewer');
      expect(rejected!.notes).toBe('Not safe');
    });

    it('returns null for an unknown id', async () => {
      const result = await service.rejectAction('no-such-id', 'reviewer');
      expect(result).toBeNull();
    });
  });

  describe('listActions', () => {
    it('returns all queued actions', async () => {
      await service.queueAction(makeInput({ source: 'rule' }));
      await service.queueAction(makeInput({ source: 'ai_classification' }));

      const all = await service.listActions();
      expect(all).toHaveLength(2);
    });

    it('filters by status', async () => {
      const a = await service.queueAction(makeInput());
      await service.approveAction(a.id, 'admin');
      await service.queueAction(makeInput()); // remains pending

      const pending = await service.listActions({ status: 'pending' });
      expect(pending).toHaveLength(1);

      const approved = await service.listActions({ status: 'approved' });
      expect(approved).toHaveLength(1);
    });

    it('filters by source', async () => {
      await service.queueAction(makeInput({ source: 'rule' }));
      await service.queueAction(makeInput({ source: 'ai_classification' }));

      const ruleActions = await service.listActions({ source: 'rule' });
      expect(ruleActions).toHaveLength(1);
    });

    it('accepts an empty filter', async () => {
      await service.queueAction(makeInput());
      const results = await service.listActions({} as ApprovalFilter);
      expect(results).toHaveLength(1);
    });
  });

  describe('getAction', () => {
    it('retrieves an action by id', async () => {
      const queued = await service.queueAction(makeInput());
      const found = await service.getAction(queued.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(queued.id);
    });

    it('returns null for an unknown id', async () => {
      const result = await service.getAction('unknown');
      expect(result).toBeNull();
    });
  });

  describe('countActions', () => {
    it('counts all actions', async () => {
      await service.queueAction(makeInput());
      await service.queueAction(makeInput());

      expect(await service.countActions()).toBe(2);
    });

    it('counts filtered actions', async () => {
      const a = await service.queueAction(makeInput());
      await service.approveAction(a.id, 'admin');
      await service.queueAction(makeInput());

      expect(await service.countActions({ status: 'pending' })).toBe(1);
      expect(await service.countActions({ status: 'approved' })).toBe(1);
    });
  });
});
