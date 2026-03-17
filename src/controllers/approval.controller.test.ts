// Integration tests for approval endpoints
import request from 'supertest';
import express, { Application } from 'express';
import approvalRoutes from '../routes/approval.routes';
import { approvalService } from '../services/ApprovalService';
import { CreatePendingActionInput } from '../types/approval.types';

// Mock the logger
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
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
        path: '/docs',
        parentPath: '/',
        fullPath: '/docs/report.pdf',
      },
    },
    source: 'rule',
    sourceId: 'rule-xyz',
    sourceName: 'Test Rule',
    action: { type: 'move', params: { destination: '/archive' } },
    confidence: 0.45,
    confidenceThreshold: 0.7,
    userId: 'user-123',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('Approval Controller', () => {
  let app: Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/approvals', approvalRoutes);
  });

  // Reset the singleton store between tests by re-creating pending actions
  afterEach(async () => {
    // Resolve all pending actions to clear them from "pending" state
    const all = await approvalService.listActions({ status: 'pending' });
    for (const action of all) {
      await approvalService.rejectAction(action.id, 'cleanup');
    }
  });

  describe('GET /api/v1/approvals', () => {
    it('returns an empty list when no actions exist', async () => {
      const response = await request(app).get('/api/v1/approvals').query({ userId: 'nobody' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('lists pending actions for a user', async () => {
      await approvalService.queueAction(makeInput({ userId: 'user-test-list' }));
      await approvalService.queueAction(makeInput({ userId: 'user-test-list' }));

      const response = await request(app)
        .get('/api/v1/approvals')
        .query({ status: 'pending', userId: 'user-test-list' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects invalid status query param', async () => {
      const response = await request(app).get('/api/v1/approvals').query({ status: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('rejects invalid source query param', async () => {
      const response = await request(app).get('/api/v1/approvals').query({ source: 'bogus' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('filters by source', async () => {
      await approvalService.queueAction(makeInput({ source: 'rule', userId: 'src-filter-user' }));
      await approvalService.queueAction(
        makeInput({ source: 'ai_classification', userId: 'src-filter-user' }),
      );

      const response = await request(app)
        .get('/api/v1/approvals')
        .query({ source: 'rule', userId: 'src-filter-user' });

      expect(response.status).toBe(200);
      const actions = response.body.data as Array<{ source: string }>;
      expect(actions.every((a) => a.source === 'rule')).toBe(true);
    });
  });

  describe('GET /api/v1/approvals/:id', () => {
    it('returns the action for a valid id', async () => {
      const queued = await approvalService.queueAction(makeInput());

      const response = await request(app).get(`/api/v1/approvals/${queued.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(queued.id);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(app).get('/api/v1/approvals/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/approvals/:id/approve', () => {
    it('approves a pending action', async () => {
      const queued = await approvalService.queueAction(makeInput());

      const response = await request(app)
        .post(`/api/v1/approvals/${queued.id}/approve`)
        .send({ resolvedBy: 'dashboard-user', notes: 'Approved via dashboard' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.resolvedBy).toBe('dashboard-user');
    });

    it('returns 400 when resolvedBy is missing', async () => {
      const queued = await approvalService.queueAction(makeInput());

      const response = await request(app)
        .post(`/api/v1/approvals/${queued.id}/approve`)
        .send({ notes: 'Forgot who I am' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(app)
        .post('/api/v1/approvals/unknown-id/approve')
        .send({ resolvedBy: 'admin' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/approvals/:id/reject', () => {
    it('rejects a pending action', async () => {
      const queued = await approvalService.queueAction(makeInput());

      const response = await request(app)
        .post(`/api/v1/approvals/${queued.id}/reject`)
        .send({ resolvedBy: 'reviewer', notes: 'Too risky' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
    });

    it('returns 400 when resolvedBy is missing', async () => {
      const queued = await approvalService.queueAction(makeInput());

      const response = await request(app)
        .post(`/api/v1/approvals/${queued.id}/reject`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(app)
        .post('/api/v1/approvals/unknown-id/reject')
        .send({ resolvedBy: 'reviewer' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
