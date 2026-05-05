// FinancialStatementService – generates IAS 1-compliant financial statements
// from a double-entry ledger.
import { v4 as uuidv4 } from '../utils/uuid';
import { logger } from '../config/logger';
import {
  Account,
  AccountSubType,
  CreateAccountInput,
  CreateJournalEntryInput,
  JournalEntry,
  JournalLine,
  LedgerQueryOptions,
  LedgerRepository,
  ProfitAndLossStatement,
  BalanceSheetStatement,
  ReportingPeriod,
  StatementSection,
} from '../types/financial.types';

// ---------------------------------------------------------------------------
// Helper – compute the balance of a single account from a set of lines
// ---------------------------------------------------------------------------

/**
 * Normal balance convention (double-entry):
 *   ASSET / EXPENSE → debit normal → balance = Σ debits − Σ credits
 *   LIABILITY / EQUITY / REVENUE → credit normal → balance = Σ credits − Σ debits
 */
function computeAccountBalance(account: Account, lines: JournalLine[]): number {
  const accountLines = lines.filter((l) => l.accountId === account.id);
  const totalDebits = accountLines
    .filter((l) => l.direction === 'DEBIT')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalCredits = accountLines
    .filter((l) => l.direction === 'CREDIT')
    .reduce((sum, l) => sum + l.amount, 0);

  return account.type === 'ASSET' || account.type === 'EXPENSE'
    ? totalDebits - totalCredits
    : totalCredits - totalDebits;
}

// ---------------------------------------------------------------------------
// In-memory repository (suitable for development and unit tests)
// ---------------------------------------------------------------------------

export class InMemoryLedgerRepository implements LedgerRepository {
  private accounts: Map<string, Account> = new Map();
  private journalEntries: Map<string, JournalEntry> = new Map();

  async saveAccount(input: CreateAccountInput): Promise<Account> {
    const now = new Date();
    const account: Account = {
      ...input,
      id: uuidv4(),
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    return account;
  }

  async findAccountById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async findAccountByCode(code: string, organizationId?: string): Promise<Account | null> {
    for (const account of this.accounts.values()) {
      if (account.code === code && account.organizationId === organizationId) {
        return account;
      }
    }
    return null;
  }

  async findAllAccounts(organizationId?: string): Promise<Account[]> {
    let result = Array.from(this.accounts.values());
    if (organizationId !== undefined) {
      result = result.filter((a) => a.organizationId === organizationId);
    }
    return result.sort((a, b) => a.code.localeCompare(b.code));
  }

  async saveJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
    const entryId = uuidv4();
    const now = new Date();
    const lines: JournalLine[] = input.lines.map((l) => ({
      ...l,
      id: uuidv4(),
      journalEntryId: entryId,
    }));
    const entry: JournalEntry = {
      ...input,
      id: entryId,
      lines,
      isPosted: input.isPosted ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.journalEntries.set(entry.id, entry);
    return entry;
  }

  async findJournalEntryById(id: string): Promise<JournalEntry | null> {
    return this.journalEntries.get(id) ?? null;
  }

  async findJournalEntries(options: LedgerQueryOptions): Promise<JournalEntry[]> {
    let result = Array.from(this.journalEntries.values());

    if (options.organizationId !== undefined) {
      result = result.filter((e) => e.organizationId === options.organizationId);
    }
    if (options.from !== undefined) {
      result = result.filter((e) => e.date >= options.from!);
    }
    if (options.to !== undefined) {
      result = result.filter((e) => e.date <= options.to!);
    }
    if (options.isPosted !== undefined) {
      result = result.filter((e) => e.isPosted === options.isPosted);
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

// ---------------------------------------------------------------------------
// FinancialStatementService
// ---------------------------------------------------------------------------

export class FinancialStatementService {
  private repository: LedgerRepository;

  constructor(repository: LedgerRepository) {
    this.repository = repository;
  }

  // ── Account management ────────────────────────────────────────────────────

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const existing = await this.repository.findAccountByCode(input.code, input.organizationId);
    if (existing) {
      throw new Error(
        `Account with code "${input.code}" already exists` +
          (input.organizationId ? ` in organization "${input.organizationId}"` : ''),
      );
    }
    logger.info(`FinancialStatementService: creating account "${input.code} – ${input.name}"`);
    return this.repository.saveAccount(input);
  }

  async listAccounts(organizationId?: string): Promise<Account[]> {
    return this.repository.findAllAccounts(organizationId);
  }

  // ── Journal entry management ──────────────────────────────────────────────

  /**
   * Posts a journal entry after validating:
   *  1. All line amounts > 0
   *  2. Σ debits = Σ credits (double-entry balance)
   *  3. Every referenced account exists in the chart of accounts
   */
  async postJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
    for (const line of input.lines) {
      if (line.amount <= 0) {
        throw new Error(`Journal line amounts must be positive; got ${line.amount}`);
      }
    }

    const totalDebits = input.lines
      .filter((l) => l.direction === 'DEBIT')
      .reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = input.lines
      .filter((l) => l.direction === 'CREDIT')
      .reduce((sum, l) => sum + l.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(
        `Journal entry is unbalanced: total debits (${totalDebits.toFixed(2)}) ≠ ` +
          `total credits (${totalCredits.toFixed(2)})`,
      );
    }

    for (const line of input.lines) {
      const account = await this.repository.findAccountById(line.accountId);
      if (!account) {
        throw new Error(`Account "${line.accountId}" not found in chart of accounts`);
      }
    }

    logger.info(
      `FinancialStatementService: posting journal entry "${input.description}" ` +
        `dated ${input.date.toISOString().split('T')[0]}`,
    );
    return this.repository.saveJournalEntry(input);
  }

  async listJournalEntries(options: {
    organizationId?: string;
    from?: Date;
    to?: Date;
  }): Promise<JournalEntry[]> {
    return this.repository.findJournalEntries({ ...options, isPosted: true });
  }

  // ── Financial statement generation ───────────────────────────────────────

  /**
   * Build a StatementSection by summing balances of all accounts whose
   * subType is in `subTypes`, filtered to the provided journal lines.
   */
  private buildSection(
    subTypes: AccountSubType[],
    title: string,
    allAccounts: Account[],
    allLines: JournalLine[],
  ): StatementSection {
    const items = [];
    let subtotal = 0;

    for (const account of allAccounts.filter((a) => subTypes.includes(a.subType))) {
      const balance = computeAccountBalance(account, allLines);
      if (balance !== 0) {
        items.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          amount: balance,
        });
        subtotal += balance;
      }
    }

    return { title, items, subtotal };
  }

  /**
   * Generate the Statement of Profit or Loss (IAS 1) for the specified period.
   * Function-of-expense presentation method.
   */
  async generateProfitAndLoss(
    period: ReportingPeriod,
    organizationId?: string,
  ): Promise<ProfitAndLossStatement> {
    const entries = await this.repository.findJournalEntries({
      from: period.from,
      to: period.to,
      isPosted: true,
      organizationId,
    });

    const allLines: JournalLine[] = entries.flatMap((e) => e.lines);
    const allAccounts = await this.repository.findAllAccounts(organizationId);

    const build = (subTypes: AccountSubType[], title: string) =>
      this.buildSection(subTypes, title, allAccounts, allLines);

    const revenue = build(['REVENUE'], 'Revenue');
    const costOfSales = build(['COST_OF_SALES'], 'Cost of Sales');
    const grossProfit = revenue.subtotal - costOfSales.subtotal;

    const otherIncome = build(['OTHER_INCOME'], 'Other Income');
    const distributionCosts = build(['DISTRIBUTION_COSTS'], 'Distribution Costs');
    const administrativeExpenses = build(['ADMINISTRATIVE_EXPENSES'], 'Administrative Expenses');
    const otherExpenses = build(['OTHER_EXPENSE'], 'Other Expenses');

    const operatingProfit =
      grossProfit +
      otherIncome.subtotal -
      distributionCosts.subtotal -
      administrativeExpenses.subtotal -
      otherExpenses.subtotal;

    const financeCosts = build(['FINANCE_COSTS'], 'Finance Costs');
    const profitBeforeTax = operatingProfit - financeCosts.subtotal;

    const incomeTaxExpense = build(['INCOME_TAX_EXPENSE'], 'Income Tax Expense');
    const profitForPeriod = profitBeforeTax - incomeTaxExpense.subtotal;

    logger.info(
      `FinancialStatementService: P&L generated for ` +
        `${period.from.toISOString().split('T')[0]} to ${period.to.toISOString().split('T')[0]}, ` +
        `net profit: ${profitForPeriod.toFixed(2)} ${period.currency}`,
    );

    return {
      title: 'Statement of Profit or Loss',
      standard: 'IAS 1',
      period,
      generatedAt: new Date(),
      revenue,
      costOfSales,
      grossProfit,
      otherIncome,
      distributionCosts,
      administrativeExpenses,
      otherExpenses,
      operatingProfit,
      financeCosts,
      profitBeforeTax,
      incomeTaxExpense,
      profitForPeriod,
    };
  }

  /**
   * Generate the Statement of Financial Position (IAS 1 Balance Sheet) at the
   * specified date. Logs a warning if the accounting equation does not hold.
   */
  async generateBalanceSheet(
    asAt: Date,
    currency: string,
    organizationId?: string,
  ): Promise<BalanceSheetStatement> {
    const entries = await this.repository.findJournalEntries({
      to: asAt,
      isPosted: true,
      organizationId,
    });

    const allLines: JournalLine[] = entries.flatMap((e) => e.lines);
    const allAccounts = await this.repository.findAllAccounts(organizationId);

    const build = (subTypes: AccountSubType[], title: string) =>
      this.buildSection(subTypes, title, allAccounts, allLines);

    const nonCurrentAssets = build(['NON_CURRENT_ASSET'], 'Non-Current Assets');
    const currentAssets = build(['CURRENT_ASSET'], 'Current Assets');
    const totalAssets = nonCurrentAssets.subtotal + currentAssets.subtotal;

    const nonCurrentLiabilities = build(['NON_CURRENT_LIABILITY'], 'Non-Current Liabilities');
    const currentLiabilities = build(['CURRENT_LIABILITY'], 'Current Liabilities');
    const totalLiabilities = nonCurrentLiabilities.subtotal + currentLiabilities.subtotal;

    const equity = build(['SHARE_CAPITAL', 'RETAINED_EARNINGS', 'OTHER_RESERVES'], 'Equity');
    const totalEquity = equity.subtotal;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    if (!isBalanced) {
      logger.warn(
        `FinancialStatementService: Balance Sheet does not balance – ` +
          `assets=${totalAssets.toFixed(2)}, ` +
          `liabilities+equity=${totalLiabilitiesAndEquity.toFixed(2)}`,
      );
    }

    logger.info(
      `FinancialStatementService: Balance Sheet generated as at ` +
        `${asAt.toISOString().split('T')[0]}, ` +
        `total assets: ${totalAssets.toFixed(2)} ${currency}, balanced: ${isBalanced}`,
    );

    return {
      title: 'Statement of Financial Position',
      standard: 'IAS 1',
      asAt,
      generatedAt: new Date(),
      currency,
      nonCurrentAssets,
      currentAssets,
      totalAssets,
      nonCurrentLiabilities,
      currentLiabilities,
      totalLiabilities,
      equity,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  }
}

// ---------------------------------------------------------------------------
// Default singleton backed by the in-memory repository
// ---------------------------------------------------------------------------

export const financialStatementService = new FinancialStatementService(
  new InMemoryLedgerRepository(),
);
