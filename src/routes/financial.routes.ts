// Financial routes – accounts, journal entries, and IAS 1 financial statements
import { Router } from 'express';
import {
  createAccount,
  listAccounts,
  postJournalEntry,
  listJournalEntries,
  getProfitAndLoss,
  getBalanceSheet,
} from '../controllers/financial.controller';
import { asyncHandler } from '../middleware';

const router = Router();

// ── Accounts (chart of accounts) ─────────────────────────────────────────
router.post('/accounts', asyncHandler(createAccount));
router.get('/accounts', asyncHandler(listAccounts));

// ── Journal entries ───────────────────────────────────────────────────────
router.post('/journal-entries', asyncHandler(postJournalEntry));
router.get('/journal-entries', asyncHandler(listJournalEntries));

// ── Financial statements ──────────────────────────────────────────────────
// GET /api/v1/financial/profit-loss?from=YYYY-MM-DD&to=YYYY-MM-DD&currency=USD
router.get('/profit-loss', asyncHandler(getProfitAndLoss));

// GET /api/v1/financial/balance-sheet?asAt=YYYY-MM-DD&currency=USD
router.get('/balance-sheet', asyncHandler(getBalanceSheet));

export default router;
