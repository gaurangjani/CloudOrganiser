// Financial controller – REST endpoints for ledger accounts, journal entries,
// and IAS 1-compliant financial statement generation.
import { Request, Response } from 'express';
import { financialStatementService } from '../services/FinancialStatementService';
import { ApiError } from '../middleware/ApiError';
import { logger } from '../config/logger';
import {
  AccountType,
  AccountSubType,
  CreateAccountInput,
  CreateJournalEntryInput,
  CreateJournalLineInput,
  ReportingPeriod,
} from '../types/financial.types';

// ---------------------------------------------------------------------------
// Helper – parse and validate a date string from query / body
// ---------------------------------------------------------------------------

function parseDate(value: unknown, label: string): Date {
  if (!value || typeof value !== 'string') {
    throw ApiError.badRequest(`Missing or invalid parameter: ${label} (expected ISO date string)`);
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw ApiError.badRequest(`Invalid date for ${label}: "${value}"`);
  }
  return date;
}

// ---------------------------------------------------------------------------
// Account endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/financial/accounts
 *
 * Body:
 *   { code, name, type, subType, description?, organizationId?, isActive? }
 */
export const createAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, type, subType, description, organizationId } =
      req.body as Record<string, unknown>;

    if (!code || typeof code !== 'string') {
      throw ApiError.badRequest('Missing required field: code');
    }
    if (!name || typeof name !== 'string') {
      throw ApiError.badRequest('Missing required field: name');
    }

    const validTypes: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
    if (!type || !validTypes.includes(type as AccountType)) {
      throw ApiError.badRequest(
        `Missing or invalid field: type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    const validSubTypes: AccountSubType[] = [
      'CURRENT_ASSET',
      'NON_CURRENT_ASSET',
      'CURRENT_LIABILITY',
      'NON_CURRENT_LIABILITY',
      'SHARE_CAPITAL',
      'RETAINED_EARNINGS',
      'OTHER_RESERVES',
      'REVENUE',
      'OTHER_INCOME',
      'COST_OF_SALES',
      'DISTRIBUTION_COSTS',
      'ADMINISTRATIVE_EXPENSES',
      'FINANCE_COSTS',
      'INCOME_TAX_EXPENSE',
      'OTHER_EXPENSE',
    ];
    if (!subType || !validSubTypes.includes(subType as AccountSubType)) {
      throw ApiError.badRequest(
        `Missing or invalid field: subType. Must be one of: ${validSubTypes.join(', ')}`,
      );
    }

    const input: CreateAccountInput = {
      code: code.trim(),
      name: (name as string).trim(),
      type: type as AccountType,
      subType: subType as AccountSubType,
      description: typeof description === 'string' ? description.trim() : undefined,
      organizationId: typeof organizationId === 'string' ? organizationId.trim() : undefined,
    };

    const account = await financialStatementService.createAccount(input);
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    logger.error('Error creating account', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else if (error instanceof Error) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * GET /api/v1/financial/accounts
 *
 * Query params:
 *   organizationId? – filter by organisation
 */
export const listAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;

    const accounts = await financialStatementService.listAccounts(organizationId);
    res.status(200).json({ success: true, total: accounts.length, data: accounts });
  } catch (error) {
    logger.error('Error listing accounts', { error });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ---------------------------------------------------------------------------
// Journal entry endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/financial/journal-entries
 *
 * Body:
 *   {
 *     date: string (ISO),
 *     description: string,
 *     reference?: string,
 *     organizationId?: string,
 *     isPosted?: boolean,
 *     lines: Array<{ accountId, direction: 'DEBIT'|'CREDIT', amount, description? }>
 *   }
 */
export const postJournalEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, description, reference, organizationId, isPosted, lines } =
      req.body as Record<string, unknown>;

    const entryDate = parseDate(date, 'date');

    if (!description || typeof description !== 'string') {
      throw ApiError.badRequest('Missing required field: description');
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      throw ApiError.badRequest('A journal entry must have at least two lines');
    }

    const parsedLines: CreateJournalLineInput[] = lines.map(
      (l: Record<string, unknown>, idx: number) => {
        if (!l.accountId || typeof l.accountId !== 'string') {
          throw ApiError.badRequest(`Line ${idx + 1}: missing accountId`);
        }
        if (!['DEBIT', 'CREDIT'].includes(l.direction as string)) {
          throw ApiError.badRequest(
            `Line ${idx + 1}: direction must be "DEBIT" or "CREDIT"`,
          );
        }
        const amount = Number(l.amount);
        if (isNaN(amount) || amount <= 0) {
          throw ApiError.badRequest(`Line ${idx + 1}: amount must be a positive number`);
        }
        return {
          accountId: l.accountId as string,
          direction: l.direction as 'DEBIT' | 'CREDIT',
          amount,
          description: typeof l.description === 'string' ? l.description : undefined,
        };
      },
    );

    const input: CreateJournalEntryInput = {
      date: entryDate,
      description: (description as string).trim(),
      reference: typeof reference === 'string' ? reference.trim() : undefined,
      organizationId: typeof organizationId === 'string' ? organizationId.trim() : undefined,
      isPosted: isPosted !== false,
      lines: parsedLines,
    };

    const entry = await financialStatementService.postJournalEntry(input);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    logger.error('Error posting journal entry', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else if (error instanceof Error) {
      res.status(400).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * GET /api/v1/financial/journal-entries
 *
 * Query params:
 *   organizationId?, from? (ISO date), to? (ISO date)
 */
export const listJournalEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId =
      typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined;
    const from =
      typeof req.query.from === 'string' ? parseDate(req.query.from, 'from') : undefined;
    const to = typeof req.query.to === 'string' ? parseDate(req.query.to, 'to') : undefined;

    const entries = await financialStatementService.listJournalEntries({
      organizationId,
      from,
      to,
    });

    res.status(200).json({ success: true, total: entries.length, data: entries });
  } catch (error) {
    logger.error('Error listing journal entries', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

// ---------------------------------------------------------------------------
// Financial statement endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/financial/profit-loss
 *
 * Query params:
 *   from     – period start (ISO date, required)
 *   to       – period end   (ISO date, required)
 *   currency – ISO 4217 code, e.g. "USD" (default: "USD")
 */
export const getProfitAndLoss = async (req: Request, res: Response): Promise<void> => {
  try {
    const from = parseDate(req.query.from, 'from');
    const to = parseDate(req.query.to, 'to');

    if (from > to) {
      throw ApiError.badRequest('"from" date must not be after "to" date');
    }

    const currency =
      typeof req.query.currency === 'string' && req.query.currency.trim()
        ? req.query.currency.trim().toUpperCase()
        : 'USD';

    const period: ReportingPeriod = { from, to, currency };
    const statement = await financialStatementService.generateProfitAndLoss(period);

    res.status(200).json({ success: true, data: statement });
  } catch (error) {
    logger.error('Error generating Profit & Loss statement', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};

/**
 * GET /api/v1/financial/balance-sheet
 *
 * Query params:
 *   asAt     – balance sheet date (ISO date, required)
 *   currency – ISO 4217 code, e.g. "USD" (default: "USD")
 */
export const getBalanceSheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const asAt = parseDate(req.query.asAt, 'asAt');
    const currency =
      typeof req.query.currency === 'string' && req.query.currency.trim()
        ? req.query.currency.trim().toUpperCase()
        : 'USD';

    const statement = await financialStatementService.generateBalanceSheet(asAt, currency);

    res.status(200).json({ success: true, data: statement });
  } catch (error) {
    logger.error('Error generating Balance Sheet', { error });
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};
