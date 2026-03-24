// Financial accounting type definitions
// Compliant with IAS 1 – Presentation of Financial Statements

// ---------------------------------------------------------------------------
// Account classification
// ---------------------------------------------------------------------------

/**
 * The five fundamental account types used in double-entry bookkeeping.
 *
 * Normal balances:
 *   - ASSET    → debit
 *   - EXPENSE  → debit
 *   - LIABILITY → credit
 *   - EQUITY   → credit
 *   - REVENUE  → credit
 */
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

/** Sub-classifications for ASSET accounts (IAS 1: current / non-current split) */
export type AssetSubType = 'CURRENT_ASSET' | 'NON_CURRENT_ASSET';

/** Sub-classifications for LIABILITY accounts */
export type LiabilitySubType = 'CURRENT_LIABILITY' | 'NON_CURRENT_LIABILITY';

/** Sub-classifications for EQUITY accounts */
export type EquitySubType = 'SHARE_CAPITAL' | 'RETAINED_EARNINGS' | 'OTHER_RESERVES';

/** Sub-classifications for REVENUE accounts */
export type RevenueSubType = 'REVENUE' | 'OTHER_INCOME';

/** Sub-classifications for EXPENSE accounts */
export type ExpenseSubType =
  | 'COST_OF_SALES'
  | 'DISTRIBUTION_COSTS'
  | 'ADMINISTRATIVE_EXPENSES'
  | 'FINANCE_COSTS'
  | 'INCOME_TAX_EXPENSE'
  | 'OTHER_EXPENSE';

export type AccountSubType =
  | AssetSubType
  | LiabilitySubType
  | EquitySubType
  | RevenueSubType
  | ExpenseSubType;

// ---------------------------------------------------------------------------
// Chart of accounts
// ---------------------------------------------------------------------------

/** A single account in the chart of accounts */
export interface Account {
  id: string;
  /** Numeric or alphanumeric account code, e.g. "1100" */
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  description?: string;
  organizationId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Input required to create an account (isActive defaults to true if omitted) */
export type CreateAccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> & {
  isActive?: boolean;
};

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export type JournalLineDirection = 'DEBIT' | 'CREDIT';

/** A single debit or credit line within a journal entry */
export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  direction: JournalLineDirection;
  /** Monetary amount – always positive; direction determines the side */
  amount: number;
  description?: string;
}

/** Input for a single line when creating a journal entry */
export type CreateJournalLineInput = Omit<JournalLine, 'id' | 'journalEntryId'>;

/**
 * A journal entry groups one or more debit/credit lines that together satisfy
 * the double-entry requirement (Σ debits = Σ credits).
 */
export interface JournalEntry {
  id: string;
  date: Date;
  description: string;
  /** External reference such as an invoice or purchase-order number */
  reference?: string;
  organizationId?: string;
  lines: JournalLine[];
  /** Only posted entries are included in financial statements */
  isPosted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Input required to create a journal entry */
export type CreateJournalEntryInput = Omit<
  JournalEntry,
  'id' | 'lines' | 'createdAt' | 'updatedAt'
> & {
  lines: CreateJournalLineInput[];
};

// ---------------------------------------------------------------------------
// Financial statement building blocks
// ---------------------------------------------------------------------------

/** The reporting period (or as-at date) for a financial statement */
export interface ReportingPeriod {
  from: Date;
  to: Date;
  /** ISO 4217 currency code, e.g. "USD" */
  currency: string;
}

/** A single account line item within a statement section */
export interface StatementLineItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
}

/** A labelled group of line items with a running subtotal */
export interface StatementSection {
  title: string;
  items: StatementLineItem[];
  subtotal: number;
}

// ---------------------------------------------------------------------------
// Statement of Profit or Loss  (IAS 1 – function-of-expense presentation)
// ---------------------------------------------------------------------------

export interface ProfitAndLossStatement {
  title: 'Statement of Profit or Loss';
  /** International accounting standard applied */
  standard: 'IAS 1';
  period: ReportingPeriod;
  generatedAt: Date;

  // ── Revenue ───────────────────────────────────────────────
  revenue: StatementSection;
  costOfSales: StatementSection;
  /** Revenue − Cost of sales */
  grossProfit: number;

  // ── Other income and operating expenses ───────────────────
  otherIncome: StatementSection;
  distributionCosts: StatementSection;
  administrativeExpenses: StatementSection;
  otherExpenses: StatementSection;
  /**
   * Gross profit + Other income
   *   − Distribution costs − Administrative expenses − Other expenses
   */
  operatingProfit: number;

  // ── Finance items and tax ─────────────────────────────────
  financeCosts: StatementSection;
  /** Operating profit − Finance costs */
  profitBeforeTax: number;
  incomeTaxExpense: StatementSection;
  /** Profit before tax − Income tax expense */
  profitForPeriod: number;
}

// ---------------------------------------------------------------------------
// Statement of Financial Position  (IAS 1 – Balance Sheet)
// ---------------------------------------------------------------------------

export interface BalanceSheetStatement {
  title: 'Statement of Financial Position';
  standard: 'IAS 1';
  /** Point in time to which the balance sheet relates */
  asAt: Date;
  generatedAt: Date;
  currency: string;

  // ── Assets ────────────────────────────────────────────────
  nonCurrentAssets: StatementSection;
  currentAssets: StatementSection;
  totalAssets: number;

  // ── Liabilities ───────────────────────────────────────────
  nonCurrentLiabilities: StatementSection;
  currentLiabilities: StatementSection;
  totalLiabilities: number;

  // ── Equity ────────────────────────────────────────────────
  equity: StatementSection;
  totalEquity: number;

  // ── Verification ──────────────────────────────────────────
  /** Total liabilities + Total equity (should equal totalAssets) */
  totalLiabilitiesAndEquity: number;
  /** True when Assets = Liabilities + Equity (accounting equation holds) */
  isBalanced: boolean;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface LedgerQueryOptions {
  organizationId?: string;
  from?: Date;
  to?: Date;
  isPosted?: boolean;
}

export interface LedgerRepository {
  saveAccount(input: CreateAccountInput): Promise<Account>;
  findAccountById(id: string): Promise<Account | null>;
  findAccountByCode(code: string, organizationId?: string): Promise<Account | null>;
  findAllAccounts(organizationId?: string): Promise<Account[]>;

  saveJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry>;
  findJournalEntryById(id: string): Promise<JournalEntry | null>;
  findJournalEntries(options: LedgerQueryOptions): Promise<JournalEntry[]>;
}
