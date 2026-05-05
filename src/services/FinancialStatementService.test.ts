import {
  FinancialStatementService,
  InMemoryLedgerRepository,
} from './FinancialStatementService';
import {
  CreateAccountInput,
  CreateJournalEntryInput,
  ReportingPeriod,
} from '../types/financial.types';

jest.mock('../config/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeAccountInput(overrides: Partial<CreateAccountInput> = {}): CreateAccountInput {
  return {
    code: '1100',
    name: 'Cash',
    type: 'ASSET',
    subType: 'CURRENT_ASSET',
    isActive: true,
    ...overrides,
  };
}

function makeJournalEntryInput(
  lines: CreateJournalEntryInput['lines'],
  overrides: Partial<Omit<CreateJournalEntryInput, 'lines'>> = {},
): CreateJournalEntryInput {
  return {
    date: new Date('2024-03-31'),
    description: 'Test entry',
    isPosted: true,
    lines,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// InMemoryLedgerRepository
// ─────────────────────────────────────────────────────────────

describe('InMemoryLedgerRepository', () => {
  let repo: InMemoryLedgerRepository;

  beforeEach(() => {
    repo = new InMemoryLedgerRepository();
  });

  it('saves and retrieves an account by id', async () => {
    const input = makeAccountInput();
    const saved = await repo.saveAccount(input);

    expect(saved.id).toBeDefined();
    expect(saved.code).toBe('1100');
    expect(saved.createdAt).toBeInstanceOf(Date);

    const found = await repo.findAccountById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
  });

  it('returns null for an unknown account id', async () => {
    expect(await repo.findAccountById('no-such-id')).toBeNull();
  });

  it('finds an account by code and organizationId', async () => {
    await repo.saveAccount(makeAccountInput({ code: '1100', organizationId: 'org-1' }));
    const found = await repo.findAccountByCode('1100', 'org-1');
    expect(found).not.toBeNull();
    expect(found!.code).toBe('1100');
  });

  it('returns null when code exists in a different organisation', async () => {
    await repo.saveAccount(makeAccountInput({ code: '1100', organizationId: 'org-1' }));
    const found = await repo.findAccountByCode('1100', 'org-2');
    expect(found).toBeNull();
  });

  it('findAllAccounts returns all accounts when no org filter', async () => {
    await repo.saveAccount(makeAccountInput({ code: '1100' }));
    await repo.saveAccount(
      makeAccountInput({ code: '2100', type: 'LIABILITY', subType: 'CURRENT_LIABILITY' }),
    );
    const all = await repo.findAllAccounts();
    expect(all).toHaveLength(2);
  });

  it('findAllAccounts filters by organizationId', async () => {
    await repo.saveAccount(makeAccountInput({ code: '1100', organizationId: 'org-A' }));
    await repo.saveAccount(makeAccountInput({ code: '1200', organizationId: 'org-B' }));
    const orgA = await repo.findAllAccounts('org-A');
    expect(orgA).toHaveLength(1);
    expect(orgA[0].organizationId).toBe('org-A');
  });

  it('saves and retrieves a journal entry', async () => {
    const cashAccount = await repo.saveAccount(makeAccountInput({ code: '1100' }));
    const revenueAccount = await repo.saveAccount(
      makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
    );

    const input = makeJournalEntryInput([
      { accountId: cashAccount.id, direction: 'DEBIT', amount: 500 },
      { accountId: revenueAccount.id, direction: 'CREDIT', amount: 500 },
    ]);

    const saved = await repo.saveJournalEntry(input);
    expect(saved.id).toBeDefined();
    expect(saved.lines).toHaveLength(2);
    expect(saved.lines[0].journalEntryId).toBe(saved.id);

    const found = await repo.findJournalEntryById(saved.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(saved.id);
  });

  it('findJournalEntries filters by date range', async () => {
    const acc = await repo.saveAccount(makeAccountInput({ code: '1100' }));
    const acc2 = await repo.saveAccount(
      makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
    );

    await repo.saveJournalEntry(
      makeJournalEntryInput(
        [
          { accountId: acc.id, direction: 'DEBIT', amount: 100 },
          { accountId: acc2.id, direction: 'CREDIT', amount: 100 },
        ],
        { date: new Date('2024-01-15') },
      ),
    );
    await repo.saveJournalEntry(
      makeJournalEntryInput(
        [
          { accountId: acc.id, direction: 'DEBIT', amount: 200 },
          { accountId: acc2.id, direction: 'CREDIT', amount: 200 },
        ],
        { date: new Date('2024-06-15') },
      ),
    );

    const q1 = await repo.findJournalEntries({
      from: new Date('2024-01-01'),
      to: new Date('2024-03-31'),
    });
    expect(q1).toHaveLength(1);
    expect(q1[0].lines[0].amount).toBe(100);
  });

  it('findJournalEntries filters by isPosted', async () => {
    const acc = await repo.saveAccount(makeAccountInput({ code: '1100' }));
    const acc2 = await repo.saveAccount(
      makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
    );

    await repo.saveJournalEntry(
      makeJournalEntryInput(
        [
          { accountId: acc.id, direction: 'DEBIT', amount: 100 },
          { accountId: acc2.id, direction: 'CREDIT', amount: 100 },
        ],
        { isPosted: true },
      ),
    );
    await repo.saveJournalEntry(
      makeJournalEntryInput(
        [
          { accountId: acc.id, direction: 'DEBIT', amount: 100 },
          { accountId: acc2.id, direction: 'CREDIT', amount: 100 },
        ],
        { isPosted: false },
      ),
    );

    const posted = await repo.findJournalEntries({ isPosted: true });
    expect(posted).toHaveLength(1);
    const drafts = await repo.findJournalEntries({ isPosted: false });
    expect(drafts).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// FinancialStatementService
// ─────────────────────────────────────────────────────────────

describe('FinancialStatementService', () => {
  let repo: InMemoryLedgerRepository;
  let service: FinancialStatementService;

  beforeEach(() => {
    repo = new InMemoryLedgerRepository();
    service = new FinancialStatementService(repo);
  });

  // ── createAccount ──────────────────────────────────────────

  describe('createAccount', () => {
    it('creates an account successfully', async () => {
      const account = await service.createAccount(makeAccountInput());
      expect(account.id).toBeDefined();
      expect(account.code).toBe('1100');
      expect(account.type).toBe('ASSET');
    });

    it('rejects duplicate account codes within the same organisation', async () => {
      await service.createAccount(makeAccountInput({ organizationId: 'org-1' }));
      await expect(
        service.createAccount(makeAccountInput({ organizationId: 'org-1' })),
      ).rejects.toThrow(/already exists/);
    });

    it('allows the same code in different organisations', async () => {
      await service.createAccount(makeAccountInput({ organizationId: 'org-1' }));
      const second = await service.createAccount(makeAccountInput({ organizationId: 'org-2' }));
      expect(second).toBeDefined();
    });
  });

  // ── postJournalEntry ───────────────────────────────────────

  describe('postJournalEntry', () => {
    it('posts a balanced journal entry', async () => {
      const cash = await service.createAccount(makeAccountInput({ code: '1100' }));
      const revenue = await service.createAccount(
        makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
      );

      const entry = await service.postJournalEntry(
        makeJournalEntryInput([
          { accountId: cash.id, direction: 'DEBIT', amount: 1000 },
          { accountId: revenue.id, direction: 'CREDIT', amount: 1000 },
        ]),
      );

      expect(entry.id).toBeDefined();
      expect(entry.isPosted).toBe(true);
      expect(entry.lines).toHaveLength(2);
    });

    it('rejects an unbalanced journal entry', async () => {
      const cash = await service.createAccount(makeAccountInput({ code: '1100' }));
      const revenue = await service.createAccount(
        makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
      );

      await expect(
        service.postJournalEntry(
          makeJournalEntryInput([
            { accountId: cash.id, direction: 'DEBIT', amount: 1000 },
            { accountId: revenue.id, direction: 'CREDIT', amount: 900 },
          ]),
        ),
      ).rejects.toThrow(/unbalanced/);
    });

    it('rejects an entry with a non-positive line amount', async () => {
      const cash = await service.createAccount(makeAccountInput({ code: '1100' }));
      const revenue = await service.createAccount(
        makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
      );

      await expect(
        service.postJournalEntry(
          makeJournalEntryInput([
            { accountId: cash.id, direction: 'DEBIT', amount: 0 },
            { accountId: revenue.id, direction: 'CREDIT', amount: 0 },
          ]),
        ),
      ).rejects.toThrow(/positive/);
    });

    it('rejects an entry referencing a non-existent account', async () => {
      const cash = await service.createAccount(makeAccountInput({ code: '1100' }));

      await expect(
        service.postJournalEntry(
          makeJournalEntryInput([
            { accountId: cash.id, direction: 'DEBIT', amount: 500 },
            { accountId: 'no-such-account', direction: 'CREDIT', amount: 500 },
          ]),
        ),
      ).rejects.toThrow(/not found/);
    });
  });

  // ── generateProfitAndLoss ─────────────────────────────────

  describe('generateProfitAndLoss', () => {
    async function setupAccounts() {
      const cash = await service.createAccount(
        makeAccountInput({ code: '1100', type: 'ASSET', subType: 'CURRENT_ASSET' }),
      );
      const revenue = await service.createAccount(
        makeAccountInput({
          code: '4000',
          name: 'Sales Revenue',
          type: 'REVENUE',
          subType: 'REVENUE',
        }),
      );
      const cogs = await service.createAccount(
        makeAccountInput({
          code: '5000',
          name: 'Cost of Sales',
          type: 'EXPENSE',
          subType: 'COST_OF_SALES',
        }),
      );
      const adminExp = await service.createAccount(
        makeAccountInput({
          code: '6000',
          name: 'Administrative Expenses',
          type: 'EXPENSE',
          subType: 'ADMINISTRATIVE_EXPENSES',
        }),
      );
      const taxExp = await service.createAccount(
        makeAccountInput({
          code: '7000',
          name: 'Income Tax Expense',
          type: 'EXPENSE',
          subType: 'INCOME_TAX_EXPENSE',
        }),
      );
      return { cash, revenue, cogs, adminExp, taxExp };
    }

    it('generates a P&L with correct gross profit and net profit', async () => {
      const { cash, revenue, cogs, adminExp, taxExp } = await setupAccounts();
      const period: ReportingPeriod = {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
        currency: 'USD',
      };

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 10000 },
            { accountId: revenue.id, direction: 'CREDIT', amount: 10000 },
          ],
          { date: new Date('2024-06-30') },
        ),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cogs.id, direction: 'DEBIT', amount: 4000 },
            { accountId: cash.id, direction: 'CREDIT', amount: 4000 },
          ],
          { date: new Date('2024-06-30') },
        ),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: adminExp.id, direction: 'DEBIT', amount: 1500 },
            { accountId: cash.id, direction: 'CREDIT', amount: 1500 },
          ],
          { date: new Date('2024-09-30') },
        ),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: taxExp.id, direction: 'DEBIT', amount: 1000 },
            { accountId: cash.id, direction: 'CREDIT', amount: 1000 },
          ],
          { date: new Date('2024-12-31') },
        ),
      );

      const pnl = await service.generateProfitAndLoss(period);

      expect(pnl.title).toBe('Statement of Profit or Loss');
      expect(pnl.standard).toBe('IAS 1');
      expect(pnl.revenue.subtotal).toBe(10000);
      expect(pnl.costOfSales.subtotal).toBe(4000);
      expect(pnl.grossProfit).toBe(6000);
      expect(pnl.administrativeExpenses.subtotal).toBe(1500);
      expect(pnl.operatingProfit).toBe(4500);
      expect(pnl.profitBeforeTax).toBe(4500);
      expect(pnl.incomeTaxExpense.subtotal).toBe(1000);
      expect(pnl.profitForPeriod).toBe(3500);
    });

    it('returns zero totals when no entries exist for the period', async () => {
      const period: ReportingPeriod = {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
        currency: 'EUR',
      };
      const pnl = await service.generateProfitAndLoss(period);
      expect(pnl.revenue.subtotal).toBe(0);
      expect(pnl.grossProfit).toBe(0);
      expect(pnl.profitForPeriod).toBe(0);
    });

    it('excludes entries outside the reporting period', async () => {
      const cash = await service.createAccount(
        makeAccountInput({ code: '1100', type: 'ASSET', subType: 'CURRENT_ASSET' }),
      );
      const revenue = await service.createAccount(
        makeAccountInput({ code: '4000', name: 'Sales', type: 'REVENUE', subType: 'REVENUE' }),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 5000 },
            { accountId: revenue.id, direction: 'CREDIT', amount: 5000 },
          ],
          { date: new Date('2023-12-31') },
        ),
      );

      const period: ReportingPeriod = {
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
        currency: 'USD',
      };
      const pnl = await service.generateProfitAndLoss(period);
      expect(pnl.revenue.subtotal).toBe(0);
    });

    it('excludes unposted entries', async () => {
      const cash = await service.createAccount(
        makeAccountInput({ code: '1100', type: 'ASSET', subType: 'CURRENT_ASSET' }),
      );
      const revenue = await service.createAccount(
        makeAccountInput({ code: '4000', name: 'Sales', type: 'REVENUE', subType: 'REVENUE' }),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 3000 },
            { accountId: revenue.id, direction: 'CREDIT', amount: 3000 },
          ],
          { isPosted: false, date: new Date('2024-06-01') },
        ),
      );

      const pnl = await service.generateProfitAndLoss({
        from: new Date('2024-01-01'),
        to: new Date('2024-12-31'),
        currency: 'USD',
      });
      expect(pnl.revenue.subtotal).toBe(0);
    });
  });

  // ── generateBalanceSheet ──────────────────────────────────

  describe('generateBalanceSheet', () => {
    async function setupBalanceSheetAccounts() {
      const cash = await service.createAccount(
        makeAccountInput({ code: '1100', name: 'Cash', type: 'ASSET', subType: 'CURRENT_ASSET' }),
      );
      const ppe = await service.createAccount(
        makeAccountInput({
          code: '1600',
          name: 'Property, Plant & Equipment',
          type: 'ASSET',
          subType: 'NON_CURRENT_ASSET',
        }),
      );
      const payables = await service.createAccount(
        makeAccountInput({
          code: '2100',
          name: 'Trade Payables',
          type: 'LIABILITY',
          subType: 'CURRENT_LIABILITY',
        }),
      );
      const ltDebt = await service.createAccount(
        makeAccountInput({
          code: '2500',
          name: 'Long-Term Debt',
          type: 'LIABILITY',
          subType: 'NON_CURRENT_LIABILITY',
        }),
      );
      const shareCapital = await service.createAccount(
        makeAccountInput({
          code: '3100',
          name: 'Share Capital',
          type: 'EQUITY',
          subType: 'SHARE_CAPITAL',
        }),
      );
      return { cash, ppe, payables, ltDebt, shareCapital };
    }

    it('generates a balanced Balance Sheet', async () => {
      const { cash, ppe, payables, ltDebt, shareCapital } = await setupBalanceSheetAccounts();

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 50000 },
            { accountId: shareCapital.id, direction: 'CREDIT', amount: 50000 },
          ],
          { date: new Date('2024-01-01') },
        ),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: ppe.id, direction: 'DEBIT', amount: 20000 },
            { accountId: ltDebt.id, direction: 'CREDIT', amount: 20000 },
          ],
          { date: new Date('2024-02-01') },
        ),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 5000 },
            { accountId: payables.id, direction: 'CREDIT', amount: 5000 },
          ],
          { date: new Date('2024-03-01') },
        ),
      );

      const bs = await service.generateBalanceSheet(new Date('2024-12-31'), 'USD');

      expect(bs.title).toBe('Statement of Financial Position');
      expect(bs.standard).toBe('IAS 1');
      expect(bs.totalAssets).toBe(75000);
      expect(bs.totalLiabilities).toBe(25000);
      expect(bs.totalEquity).toBe(50000);
      expect(bs.totalLiabilitiesAndEquity).toBe(75000);
      expect(bs.isBalanced).toBe(true);
    });

    it('returns zero totals when the ledger is empty', async () => {
      const bs = await service.generateBalanceSheet(new Date('2024-12-31'), 'GBP');
      expect(bs.totalAssets).toBe(0);
      expect(bs.totalLiabilities).toBe(0);
      expect(bs.totalEquity).toBe(0);
      expect(bs.isBalanced).toBe(true);
    });

    it('excludes entries dated after the as-at date', async () => {
      const cash = await service.createAccount(
        makeAccountInput({ code: '1100', type: 'ASSET', subType: 'CURRENT_ASSET' }),
      );
      const shareCapital = await service.createAccount(
        makeAccountInput({
          code: '3100',
          type: 'EQUITY',
          subType: 'SHARE_CAPITAL',
          name: 'Share Capital',
        }),
      );

      await service.postJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 10000 },
            { accountId: shareCapital.id, direction: 'CREDIT', amount: 10000 },
          ],
          { date: new Date('2025-01-15') },
        ),
      );

      const bs = await service.generateBalanceSheet(new Date('2024-12-31'), 'USD');
      expect(bs.totalAssets).toBe(0);
    });
  });

  // ── listJournalEntries ────────────────────────────────────

  describe('listJournalEntries', () => {
    it('returns only posted entries', async () => {
      const cash = await service.createAccount(makeAccountInput({ code: '1100' }));
      const revenue = await service.createAccount(
        makeAccountInput({ code: '4000', type: 'REVENUE', subType: 'REVENUE' }),
      );

      await service.postJournalEntry(
        makeJournalEntryInput([
          { accountId: cash.id, direction: 'DEBIT', amount: 100 },
          { accountId: revenue.id, direction: 'CREDIT', amount: 100 },
        ]),
      );

      await repo.saveJournalEntry(
        makeJournalEntryInput(
          [
            { accountId: cash.id, direction: 'DEBIT', amount: 200 },
            { accountId: revenue.id, direction: 'CREDIT', amount: 200 },
          ],
          { isPosted: false },
        ),
      );

      const listed = await service.listJournalEntries({});
      expect(listed).toHaveLength(1);
      expect(listed[0].isPosted).toBe(true);
    });
  });
});
