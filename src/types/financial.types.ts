// Financial accounting type definitions compliant with IAS 1

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

export type AssetSubType = 'CURRENT_ASSET' | 'NON_CURRENT_ASSET';
export type LiabilitySubType = 'CURRENT_LIABILITY' | 'NON_CURRENT_LIABILITY';
export type EquitySubType = 'SHARE_CAPITAL' | 'RETAINED_EARNINGS' | 'OTHER_RESERVES';
export type RevenueSubType = 'REVENUE' | 'OTHER_INCOME';
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

export interface Account {
  id: string;
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

export type CreateAccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> & {
  isActive?: boolean;
};

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export type JournalLineDirection = 'DEBIT' | 'CREDIT';

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  direction: JournalLineDirection;
  /** Always positive; direction determines the side */
  amount: number;
  description?: string;
}

export type CreateJournalLineInput = Omit<JournalLine, 'id' | 'journalEntryId'>;

export interface JournalEntry {
  id: string;
  date: Date;
  description: string;
  reference?: string;
  organizationId?: string;
  lines: JournalLine[];
  /** Only posted entries appear in financial statements */
  isPosted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateJournalEntryInput = Omit<
  JournalEntry,
  'id' | 'lines' | 'createdAt' | 'updatedAt'
> & {
  lines: CreateJournalLineInput[];
};

// ---------------------------------------------------------------------------
// Financial statement building blocks
// ---------------------------------------------------------------------------

export interface ReportingPeriod {
  from: Date;
  to: Date;
  /** ISO 4217 currency code, e.g. "USD" */
  currency: string;
}

export interface StatementLineItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
}

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
  standard: 'IAS 1';
  period: ReportingPeriod;
  generatedAt: Date;

  revenue: StatementSection;
  costOfSales: StatementSection;
  grossProfit: number;

  otherIncome: StatementSection;
  distributionCosts: StatementSection;
  administrativeExpenses: StatementSection;
  otherExpenses: StatementSection;
  operatingProfit: number;

  financeCosts: StatementSection;
  profitBeforeTax: number;
  incomeTaxExpense: StatementSection;
  profitForPeriod: number;
}

// ---------------------------------------------------------------------------
// Statement of Financial Position  (IAS 1 – Balance Sheet)
// ---------------------------------------------------------------------------

export interface BalanceSheetStatement {
  title: 'Statement of Financial Position';
  standard: 'IAS 1';
  asAt: Date;
  generatedAt: Date;
  currency: string;

  nonCurrentAssets: StatementSection;
  currentAssets: StatementSection;
  totalAssets: number;

  nonCurrentLiabilities: StatementSection;
  currentLiabilities: StatementSection;
  totalLiabilities: number;

  equity: StatementSection;
  totalEquity: number;

  totalLiabilitiesAndEquity: number;
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
