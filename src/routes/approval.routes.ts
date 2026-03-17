// Approval routes for human-in-the-loop dashboard
import { Router } from 'express';
import {
  listPendingActions,
  getPendingAction,
  approvePendingAction,
  rejectPendingAction,
} from '../controllers/approval.controller';
import { asyncHandler } from '../middleware';

const router = Router();

// List all pending actions (with optional query-string filters)
router.get('/', asyncHandler(listPendingActions));

// Get a single pending action
router.get('/:id', asyncHandler(getPendingAction));

// Approve a pending action
router.post('/:id/approve', asyncHandler(approvePendingAction));

// Reject a pending action
router.post('/:id/reject', asyncHandler(rejectPendingAction));

export default router;
