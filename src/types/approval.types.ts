// Approval workflow type definitions for human-in-the-loop review

import { RuleAction } from './rules.types';
import { FileContext } from './context.types';

/**
 * Status of a pending action in the approval queue
 */
export type PendingActionStatus = 'pending' | 'approved' | 'rejected';

/**
 * Source that triggered the pending action
 */
export type PendingActionSource = 'rule' | 'ai_classification';

/**
 * PendingAction represents a queued action that requires user approval
 * before it is executed, due to low confidence from a rule or AI classification.
 */
export interface PendingAction {
  id: string;
  /** The file that triggered this action */
  fileContext: Pick<FileContext, 'id' | 'name' | 'userId' | 'organizationId' | 'location'>;
  /** Whether the action came from a rule match or AI classification */
  source: PendingActionSource;
  /** Rule or AI result that produced this action */
  sourceId?: string;
  sourceName?: string;
  /** The action to be taken upon approval */
  action: RuleAction;
  /** Confidence score (0–1) that caused the action to be queued */
  confidence: number;
  /** Threshold that was not met, causing the action to be queued */
  confidenceThreshold: number;
  /** Current approval status */
  status: PendingActionStatus;
  /** User or system that made the approval decision */
  resolvedBy?: string;
  /** Timestamp when the decision was made */
  resolvedAt?: Date;
  /** Optional notes added during approval/rejection */
  notes?: string;
  userId: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new pending action
 */
export type CreatePendingActionInput = Omit<
  PendingAction,
  'id' | 'status' | 'resolvedBy' | 'resolvedAt' | 'createdAt' | 'updatedAt'
>;

/**
 * Input for resolving (approving or rejecting) a pending action
 */
export interface ResolvePendingActionInput {
  status: 'approved' | 'rejected';
  resolvedBy: string;
  notes?: string;
}

/**
 * Filter options for querying pending actions
 */
export interface ApprovalFilter {
  status?: PendingActionStatus;
  source?: PendingActionSource;
  userId?: string;
  organizationId?: string;
  fileId?: string;
}

/**
 * Repository interface for persisting and retrieving pending actions
 */
export interface ApprovalRepository {
  /** Persist a new pending action and return it with auto-generated id/timestamps */
  save(input: CreatePendingActionInput): Promise<PendingAction>;
  /** Retrieve a pending action by its unique ID */
  findById(id: string): Promise<PendingAction | null>;
  /** Retrieve all pending actions, optionally filtered */
  findAll(filter?: ApprovalFilter): Promise<PendingAction[]>;
  /** Update the status (approve or reject) of a pending action */
  resolve(id: string, input: ResolvePendingActionInput): Promise<PendingAction | null>;
  /** Count pending actions, optionally filtered */
  count(filter?: ApprovalFilter): Promise<number>;
}
