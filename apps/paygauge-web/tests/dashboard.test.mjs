import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { getDashboardSummary, recordLoanPayment } from '../src/lib/api.ts';
import { groupPaymentsByDueDate } from '../src/lib/dashboard.ts';

function loan(overrides = {}) {
  return {
    id: 'debt',
    name: 'Test debt',
    category: 'loan',
    payment_type: 'payoff',
    paid_with: 'bank-account',
    description: null,
    original_amount: '1000.00',
    current_balance: '1000.00',
    payment_amount: '100.00',
    total_number_of_payments: 10,
    payments_made: 0,
    payments_remaining: 10,
    interest_rate: '0',
    start_date: '2026-10-01',
    due_day: 17,
    recurrence: 'monthly',
    next_due_date: '2026-10-17',
    estimated_payoff_date: null,
    autopay: false,
    status: 'active',
    progress_percentage: 0,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    ...overrides,
  };
}

const storage = new Map();
const originalWindow = globalThis.window;

before(() => {
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
});

after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

function setState(loans, payments = []) {
  storage.set('paygauge.localState', JSON.stringify({ loans, payments, notificationPreferences: {} }));
}

test('groups every payment on the same date without truncating at five items or mutating input', () => {
  const loans = Array.from({ length: 7 }, (_, index) => loan({ id: `bill-${index}`, payment_amount: '0.10' }));
  loans.unshift(loan({ id: 'later', next_due_date: '2026-10-25' }));
  const original = structuredClone(loans);
  const groups = groupPaymentsByDueDate(loans);
  assert.deepEqual(groups.map((group) => group.date), ['2026-10-17', '2026-10-25']);
  assert.equal(groups[0].payments.length, 7);
  assert.equal(groups[0].total, 0.70);
  assert.equal(groups[1].total, 100);
  assert.deepEqual(loans, original);
});

test('ignores inactive and undated payments, and handles empty and single-payment groups', () => {
  assert.deepEqual(groupPaymentsByDueDate([]), []);
  const groups = groupPaymentsByDueDate([
    loan(),
    loan({ id: 'undated', next_due_date: null }),
    loan({ id: 'completed', status: 'completed' }),
    loan({ id: 'archived', status: 'archived' }),
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].payments.map((payment) => payment.id), ['debt']);
  assert.equal(groups[0].total, 100);
});

test('monthly commitment uses occurrence schedules for debts and bills, not outstanding balances', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 11, 12).getTime() });
  setState([
    loan({ current_balance: '8400.00', original_amount: '24000.00', payment_amount: '350.00' }),
    loan({ id: 'monthly', payment_type: 'ongoing', current_balance: '0', payment_amount: '125.25' }),
    loan({ id: 'weekly', payment_type: 'ongoing', current_balance: '0', payment_amount: '10.00', recurrence: 'weekly', next_due_date: '2026-10-02' }),
    loan({ id: 'biweekly', payment_type: 'ongoing', current_balance: '0', payment_amount: '20.00', recurrence: 'biweekly', next_due_date: '2026-10-02' }),
    loan({ id: 'quarterly', payment_type: 'ongoing', current_balance: '0', payment_amount: '900.00', recurrence: 'quarterly', next_due_date: '2026-11-17' }),
    loan({ id: 'annual', payment_type: 'ongoing', current_balance: '0', payment_amount: '250.00', recurrence: 'annual' }),
  ], [
    { id: 'paid-bill', loan_id: 'monthly', amount: '25.25', payment_date: '2026-10-10', created_at: '2026-10-10T12:00:00Z' },
    { id: 'paid-debt', loan_id: 'debt', amount: '350.00', payment_date: '2026-10-10', created_at: '2026-10-10T12:00:00Z' },
    { id: 'prior-month', loan_id: 'monthly', amount: '125.25', payment_date: '2026-09-10', created_at: '2026-09-10T12:00:00Z' },
  ]);
  const summary = await getDashboardSummary();
  assert.equal(summary.loan_balance, '8400.00');
  assert.equal(summary.total_payments_remaining, 24);
  assert.equal(summary.current_month_due, '835.25');
  assert.equal(summary.expense_due, '485.25');
  assert.equal(summary.current_month_paid, '375.25');
  assert.equal(summary.expense_paid, '25.25');
});

test('empty dashboard returns zero totals and no due groups', async () => {
  setState([]);
  const summary = await getDashboardSummary();
  assert.equal(summary.current_month_due, '0.00');
  assert.equal(summary.current_month_paid, '0.00');
  assert.equal(summary.total_payments_remaining, 0);
  assert.deepEqual(groupPaymentsByDueDate(summary.active_loans), []);
});

test('monthly commitment excludes installments before a loan starts while including previously paid scheduled installments', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 11, 12).getTime() });
  setState([
    loan({ id: 'future', start_date: '2026-10-15', next_due_date: '2026-11-05', due_day: 5, payment_amount: '421.27' }),
    loan({ id: 'paid', start_date: '2026-09-01', next_due_date: '2026-11-17', payment_type: 'ongoing', current_balance: '0', payment_amount: '75.00' }),
  ], [
    { id: 'paid-this-month', loan_id: 'paid', amount: '75.00', payment_date: '2026-10-10', created_at: '2026-10-10T12:00:00Z' },
  ]);
  const summary = await getDashboardSummary();
  assert.equal(summary.current_month_due, '75.00');
  assert.equal(summary.current_month_paid, '75.00');
  assert.equal(summary.expense_due, '75.00');
});

test('confirming one grouped autopay preserves its source and leaves other payments unchanged', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 17, 12).getTime() });
  setState([
    loan({ id: 'autopay', payment_type: 'ongoing', current_balance: '0', payment_amount: '5.00', autopay: true }),
    loan({ id: 'manual', payment_amount: '100.00' }),
  ]);
  const payment = await recordLoanPayment('autopay', { amount: '5.00', payment_date: '2026-10-17', source: 'autopay-confirmed' });
  assert.equal(payment.source, 'autopay-confirmed');
  const summary = await getDashboardSummary();
  const groups = groupPaymentsByDueDate(summary.active_loans);
  assert.deepEqual(groups[0].payments.map((item) => item.id), ['manual']);
  assert.equal(groups[0].total, 100);
  assert.equal(summary.active_loans.find((item) => item.id === 'manual').current_balance, '1000.00');
  assert.equal(summary.current_month_due, '105.00');
  assert.equal(summary.current_month_paid, '5.00');
  assert.equal(summary.expense_paid, '5.00');
  const manual = await recordLoanPayment('manual', { amount: '100.00', payment_date: '2026-10-17', source: 'manual' });
  assert.equal(manual.source, 'manual');
  assert.equal((await getDashboardSummary()).loan_balance, '900.00');
});
