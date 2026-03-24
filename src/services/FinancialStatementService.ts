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
  StatementLineItem,
  StatementSection,
} from '../types/financial.types';

// ---------------------------------------------------------------------------
// Helper – compute the balance of a single account from a set of lines
// ---------------------------------------------------------------------------

/**
 * Returns the balance of `account` given the supplied journal lines.
 *
 * Normal balance convention (double-entry):
 *   - ASSET and EXPENSE accounts carry a **debit** normal balance
 *     → balance = Σ debits − Σ credits
 *   - LIABILITY, EQUITY and REVENUE accounts carry a **credit** normal balance
 *     → balance = Σ credits − Σ debits
 *
 * A positive result means the account has its normal balance;
 * a negative result indicates the account has been over-credited/debited.
 */
function computeAccountBalance(account: Account, lines: JournalLine[]): number {
  const accountLines = lines.filter((l) => l.accountId === account.id);
  const totalDebits = accountLines
    .filter((l) => l.direction === 'DEBIT')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalCredits = accountLines
    .filter((l) => l.direction === 'CREDIT')
    .reduce((sum, l) => sum + l.amount, 0);

  if (account.type === 'ASSET' || account.type === 'EXPENSE') {
    return totalDebits - totalCredits;
  }
  return totalCredits - totalDebits;
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

  /**
   * Add a new account to the chart of accounts.
   * Account codes must be unique within an organisation.
   */
  async createAccount(input: CreateAccountInput): Promise<Account> {
    const existing = await this.repository.findAccountByCode(
      input.code,
      input.organizationId,
    );
    if (existing) {
      throw new Error(
        `Account with code "${input.code}" already exists` +
          (input.organizationId ? ` in organization "${input.organizationId}"` : ''),
      );
    }
    logger.info(
      `FinancialStatementService: creating account "${input.code} – ${input.name}"`,
    );
    return this.repository.saveAccount(input);
  }

  /** List all accounts, optionally scoped to an organization */
  async listAccounts(organizationId?: string): Promise<Account[]> {
    return this.repository.findAllAccounts(organizationId);
  }

  // ── Journal entry management ──────────────────────────────────────────────

  /**
   * Post a journal entry to the ledger.
   *
   * Validates that:
   *  1. Total debits = Total credits (double-entry balance)
   *  2. Every referenced account exists in the chart of accounts
   *  3. Each line amount is greater than zero
   */
  async postJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
    // Validate line amounts
    for (const line of input.lines) {
      if (line.amount <= 0) {
        throw new Error(`Journal line amounts must be positive; got ${line.amount}`);
      }
    }

    // Validate double-entry balance (Σ debits = Σ credits)
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

    // Validate all referenced accounts exist
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

  /** Retrieve posted journal entries, optionally filtered */
  async listJournalEntries(options: {
    organizationId?: string;
    from?: Date;
    to?: Date;
  }): Promise<JournalEntry[]> {
    return this.repository.findJournalEntries({ ...options, isPosted: true });
  }

  // ── Financial statement generation ───────────────────────────────────────

  /**
   * Generate the Statement of Profit or Loss (IAS 1) for the specified period.
   *
   * Presentation format: function-of-expense method.
   */
  async generateProfitAndLoss(period: ReportingPeriod): Promise<ProfitAndLossStatement> {
    const entries = await this.repository.findJournalEntries({
      from: period.from,
      to: period.to,
      isPosted: true,
    });

    const allLines: JournalLine[] = entries.flatMap((e) => e.lines);
    const allAccounts = await this.repository.findAllAccounts();

    const buildSection = (subTypes: AccountSubType[], title: string): StatementSection => {
      const items: StatementLineItem[] = [];
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
    };

    const revenue = buildSection(['REVENUE'], 'Revenue');
    const costOfSales = buildSection(['COST_OF_SALES'], 'Cost of Sales');
    const grossProfit = revenue.subtotal - costOfSales.subtotal;

    const otherIncome = buildSection(['OTHER_INCOME'], 'Other Income');
    const distributionCosts = buildSection(['DISTRIBUTION_COSTS'], 'Distribution Costs');
    const administrativeExpenses = buildSection(
      ['ADMINISTRATIVE_EXPENSES'],
      'Administrative Expenses',
    );
    const otherExpenses = buildSection(['OTHER_EXPENSE'], 'Other Expenses');

    const operatingProfit =
      grossProfit +
      otherIncome.subtotal -
      distributionCosts.subtotal -
      administrativeExpenses.subtotal -
      otherExpenses.subtotal;

    const financeCosts = buildSection(['FINANCE_COSTS'], 'Finance Costs');
    const profitBeforeTax = operatingProfit - financeCosts.subtotal;

    const incomeTaxExpense = buildSection(['INCOME_TAX_EXPENSE'], 'Income Tax Expense');
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
   * Generate the Statement of Financial Position (IAS 1 Balance Sheet)
   * at the specified date.
   *
   * Assets are classified as current or non-current; likewise liabilities.
   * Logs a warning if the accounting equation (Assets = Liabilities + Equity)
   * does not hold—which would indicate missing or unbalanced ledger entries.
   */
  async generateBalanceSheet(asAt: Date, currency: string): Promise<BalanceSheetStatement> {
    const entries = await this.repository.findJournalEntries({
      to: asAt,
      isPosted: true,
    });

    const allLines: JournalLine[] = entries.flatMap((e) => e.lines);
    const allAccounts = await this.repository.findAllAccounts();

    const buildSection = (subTypes: AccountSubType[], title: string): StatementSection => {
      const items: StatementLineItem[] = [];
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
    };

    const nonCurrentAssets = buildSection(['NON_CURRENT_ASSET'], 'Non-Current Assets');
    const currentAssets = buildSection(['CURRENT_ASSET'], 'Current Assets');
    const totalAssets = nonCurrentAssets.subtotal + currentAssets.subtotal;

    const nonCurrentLiabilities = buildSection(
      ['NON_CURRENT_LIABILITY'],
      'Non-Current Liabilities',
    );
    const currentLiabilities = buildSection(['CURRENT_LIABILITY'], 'Current Liabilities');
    const totalLiabilities = nonCurrentLiabilities.subtotal + currentLiabilities.subtotal;

    const equity = buildSection(
      ['SHARE_CAPITAL', 'RETAINED_EARNINGS', 'OTHER_RESERVES'],
      'Equity',
    );
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
        `total assets: ${totalAssets.toFixed(2)} ${currency}, ` +
        `balanced: ${isBalanced}`,
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
