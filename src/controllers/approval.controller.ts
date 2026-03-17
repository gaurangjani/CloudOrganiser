// Approval controller – REST endpoints for the human-in-the-loop dashboard
import { Request, Response } from 'express';
import { approvalService } from '../services/ApprovalService';
import { ApiError } from '../middleware/ApiError';
import { logger } from '../config/logger';
import { ApprovalFilter, PendingActionSource, PendingActionStatus } from '../types/approval.types';

/**
 * List pending actions, with optional filtering by status, source, userId,
 * organizationId, or fileId via query-string parameters.
 *
 * GET /api/v1/approvals
 */
export const listPendingActions = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: ApprovalFilter = {};

    if (req.query.status) {
      const s = req.query.status as string;
      if (!['pending', 'approved', 'rejected'].includes(s)) {
        throw ApiError.badRequest(`Invalid status value: ${s}`);
      }
      filter.status = s as PendingActionStatus;
    }

    if (req.query.source) {
      const src = req.query.source as string;
      if (!['rule', 'ai_classification'].includes(src)) {
        throw ApiError.badRequest(`Invalid source value: ${src}`);
      }
      filter.source = src as PendingActionSource;
    }

    if (req.query.userId) filter.userId = req.query.userId as string;
    if (req.query.organizationId) filter.organizationId = req.query.organizationId as string;
    if (req.query.fileId) filter.fileId = req.query.fileId as string;

    const actions = await approvalService.listActions(filter);
    const total = actions.length;

    res.status(200).json({
      success: true,
      total,
      data: actions,
    });
  } catch (error) {
    logger.error('Error listing pending actions', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Get a single pending action by its ID.
 *
 * GET /api/v1/approvals/:id
 */
export const getPendingAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Missing action id');

    const action = await approvalService.getAction(id);
    if (!action) throw ApiError.notFound(`Pending action "${id}" not found`);

    res.status(200).json({ success: true, data: action });
  } catch (error) {
    logger.error('Error getting pending action', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Approve a pending action.
 *
 * POST /api/v1/approvals/:id/approve
 * Body: { resolvedBy: string, notes?: string }
 */
export const approvePendingAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Missing action id');

    const { resolvedBy, notes } = req.body as { resolvedBy?: string; notes?: string };
    if (!resolvedBy) throw ApiError.badRequest('Missing required field: resolvedBy');

    const action = await approvalService.approveAction(id, resolvedBy, notes);
    if (!action) throw ApiError.notFound(`Pending action "${id}" not found`);

    res.status(200).json({ success: true, data: action });
  } catch (error) {
    logger.error('Error approving pending action', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * Reject a pending action.
 *
 * POST /api/v1/approvals/:id/reject
 * Body: { resolvedBy: string, notes?: string }
 */
export const rejectPendingAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Missing action id');

    const { resolvedBy, notes } = req.body as { resolvedBy?: string; notes?: string };
    if (!resolvedBy) throw ApiError.badRequest('Missing required field: resolvedBy');

    const action = await approvalService.rejectAction(id, resolvedBy, notes);
    if (!action) throw ApiError.notFound(`Pending action "${id}" not found`);

    res.status(200).json({ success: true, data: action });
  } catch (error) {
    logger.error('Error rejecting pending action', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
