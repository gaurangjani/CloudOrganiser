// ApprovalService – manages the human-in-the-loop approval queue
import {
  PendingAction,
  CreatePendingActionInput,
  ResolvePendingActionInput,
  ApprovalFilter,
  ApprovalRepository,
} from '../types/approval.types';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from '../utils/uuid';

/**
 * InMemoryApprovalRepository is a simple in-memory implementation of
 * ApprovalRepository. Suitable for tests and development environments where
 * MongoDB may not be available.
 */
export class InMemoryApprovalRepository implements ApprovalRepository {
  private store: Map<string, PendingAction> = new Map();

  async save(input: CreatePendingActionInput): Promise<PendingAction> {
    const now = new Date();
    const action: PendingAction = {
      ...input,
      id: uuidv4(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(action.id, action);
    return action;
  }

  async findById(id: string): Promise<PendingAction | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(filter?: ApprovalFilter): Promise<PendingAction[]> {
    let results = Array.from(this.store.values());

    if (filter?.status) {
      results = results.filter((a) => a.status === filter.status);
    }
    if (filter?.source) {
      results = results.filter((a) => a.source === filter.source);
    }
    if (filter?.userId) {
      results = results.filter((a) => a.userId === filter.userId);
    }
    if (filter?.organizationId) {
      results = results.filter((a) => a.organizationId === filter.organizationId);
    }
    if (filter?.fileId) {
      results = results.filter((a) => a.fileContext.id === filter.fileId);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async resolve(id: string, input: ResolvePendingActionInput): Promise<PendingAction | null> {
    const existing = this.store.get(id);
    if (!existing) return null;

    const updated: PendingAction = {
      ...existing,
      status: input.status,
      resolvedBy: input.resolvedBy,
      resolvedAt: new Date(),
      notes: input.notes,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async count(filter?: ApprovalFilter): Promise<number> {
    const results = await this.findAll(filter);
    return results.length;
  }
}

/**
 * ApprovalService orchestrates the human-in-the-loop approval workflow.
 *
 * Responsibilities:
 *  - Queue pending actions that have low confidence
 *  - Allow dashboard users to approve or reject queued actions
 *  - Expose query methods for the dashboard
 */
export class ApprovalService {
  /** Default confidence threshold below which an action is queued for approval */
  static readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

  private repository: ApprovalRepository;

  constructor(repository: ApprovalRepository) {
    this.repository = repository;
  }

  /**
   * Determine whether an action should be queued for approval based on the
   * confidence score and the configured threshold.
   *
   * @param confidence         - Score in [0, 1] from the rule/AI
   * @param confidenceThreshold - Minimum score required to auto-apply; defaults
   *                             to `ApprovalService.DEFAULT_CONFIDENCE_THRESHOLD`
   */
  static requiresApproval(
    confidence: number,
    confidenceThreshold = ApprovalService.DEFAULT_CONFIDENCE_THRESHOLD,
  ): boolean {
    return confidence < confidenceThreshold;
  }

  /**
   * Queue a pending action for user approval.
   */
  async queueAction(input: CreatePendingActionInput): Promise<PendingAction> {
    logger.info(
      `ApprovalService: queuing action "${input.action.type}" for file "${input.fileContext.name}" ` +
        `(confidence ${input.confidence.toFixed(2)} < threshold ${input.confidenceThreshold.toFixed(2)})`,
    );
    return this.repository.save(input);
  }

  /**
   * Approve a pending action.
   */
  async approveAction(
    id: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<PendingAction | null> {
    const result = await this.repository.resolve(id, {
      status: 'approved',
      resolvedBy,
      notes,
    });

    if (result) {
      logger.info(
        `ApprovalService: action "${id}" approved by "${resolvedBy}"`,
      );
    } else {
      logger.warn(`ApprovalService: action "${id}" not found for approval`);
    }

    return result;
  }

  /**
   * Reject a pending action.
   */
  async rejectAction(
    id: string,
    resolvedBy: string,
    notes?: string,
  ): Promise<PendingAction | null> {
    const result = await this.repository.resolve(id, {
      status: 'rejected',
      resolvedBy,
      notes,
    });

    if (result) {
      logger.info(
        `ApprovalService: action "${id}" rejected by "${resolvedBy}"`,
      );
    } else {
      logger.warn(`ApprovalService: action "${id}" not found for rejection`);
    }

    return result;
  }

  /**
   * Retrieve all pending actions, optionally filtered.
   */
  async listActions(filter?: ApprovalFilter): Promise<PendingAction[]> {
    return this.repository.findAll(filter);
  }

  /**
   * Retrieve a single pending action by ID.
   */
  async getAction(id: string): Promise<PendingAction | null> {
    return this.repository.findById(id);
  }

  /**
   * Count pending actions, optionally filtered.
   */
  async countActions(filter?: ApprovalFilter): Promise<number> {
    return this.repository.count(filter);
  }
}

/**
 * Singleton instance backed by the in-memory repository.
 * Replace this with a MongoApprovalRepository in production code that
 * connects to MongoDB.
 */
export const approvalService = new ApprovalService(new InMemoryApprovalRepository());
