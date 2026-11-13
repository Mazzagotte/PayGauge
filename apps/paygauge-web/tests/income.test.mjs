import assert from 'node:assert/strict';
import { beforeEach, after, test } from 'node:test';
import { currentLocalDate, recordLoanPayment, exportBackupJson, getDashboardSummary, getIncomeBreakdown, importBackupJson, updateMonthlyIncome } from '../src/lib/api.ts';

const originalWindow = globalThis.window;
let storage;
function loan(overrides = {}) {
  return {
    id: 'debt', name: 'Debt', category: 'financing', payment_type: 'payoff', paid_with: 'bank-account',
    original_amount: '1000.00', current_balance: '1000.00', payment_amount: '350.00',
    payments_made: 0, payments_remaining: 3, interest_rate: '0', start_date: '2026-10-01',
    due_day: 25, recurrence: 'monthly', next_due_date: '2026-10-25', autopay: true, status: 'active',
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}
beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
});
after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});
function seed(loans = [], payments = [], income = null) {
  storage.set('paygauge.localState', JSON.stringify({ loans, payments, monthlyTakeHomeIncome: income }));
}
test('real-sized commitments split rent, bills and debts and match dashboard totals', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 11, 12).getTime() });
  seed([
    loan(), loan({ id: 'concordia', payment_amount: '421.27', current_balance: '2695.68' }),
    loan({ id: 'rent', category: 'rent-mortgage', payment_type: 'ongoing', current_balance: '0', payment_amount: '1400.00', due_day: 1, next_due_date: '2026-10-01' }),
    ...['100.00','5.00','266.39'].map((amount,i)=>loan({ id: `bill${i}`, category: 'bill', payment_type: 'ongoing', current_balance: '0', payment_amount: amount })),
  ], [], '3653.06');
  const data = await getIncomeBreakdown();
  assert.deepEqual(data.groups.map(g=>g.scheduled), ['771.27','371.39','1400.00']);
  assert.deepEqual(data.groups.map(g=>g.paid), ['0.00','0.00','0.00']);
  assert.equal(data.monthlyIncome, '3653.06');
  assert.equal((2542.66/Number(data.monthlyIncome)*100).toFixed(1), '69.6');
  assert.equal((Number(data.monthlyIncome)-2542.66).toFixed(2), '1110.40');
  assert.equal((await getDashboardSummary()).current_month_due, '2542.66');
});
test('paid includes actual current-month transactions for inactive accounts, not future or prior-month payments', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 11, 12).getTime() });
  seed([loan({ status: 'archived' })], [
    { id:'a',loan_id:'debt',amount:'100.00',payment_date:'2026-10-01',created_at:'a' },
    { id:'b',loan_id:'debt',amount:'200.00',payment_date:'2026-09-30',created_at:'b' },
    { id:'c',loan_id:'debt',amount:'300.00',payment_date:'2026-10-12',created_at:'c' },
    { id:'d',loan_id:'missing',amount:'400.00',payment_date:'2026-10-02',created_at:'d' },
  ]);
  const data = await getIncomeBreakdown();
  assert.equal(data.groups[0].paid,'100.00');
  assert.equal(data.groups[0].scheduled,'0.00');
});
test('income edits persist and reject invalid inputs without altering accounts or payments', async () => {
  seed([loan()]);
  const before = await exportBackupJson();
  await updateMonthlyIncome('3653.06');
  const after = await exportBackupJson();
  assert.equal(after.monthly_take_home_income, '3653.06');
  assert.deepEqual(before.loans, after.loans);
  assert.deepEqual(before.payments, after.payments);
  for(const invalid of ['', '0', '-1', 'NaN', 'Infinity', '3.333', '1e3']) await assert.rejects(updateMonthlyIncome(invalid), /greater than zero/);
  assert.equal((await getIncomeBreakdown()).monthlyIncome,'3653.06');
});
test('backups round trip income and older backups reset it on replacement', async () => {
  seed([loan()], [], '3653.06');
  const backup = await exportBackupJson();
  await updateMonthlyIncome('4000');
  await importBackupJson(backup,true);
  assert.equal((await getIncomeBreakdown()).monthlyIncome,'3653.06');
  const {monthly_take_home_income, ...older} = backup;
  await importBackupJson(older,true);
  assert.equal((await getIncomeBreakdown()).monthlyIncome,null);
  await assert.rejects(importBackupJson({...backup,monthly_take_home_income:'-4'},true),/positive amount/);
});
test('empty and over-income summaries retain exact totals without hiding deficits', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 11, 12).getTime() });
  seed();
  assert.equal((await getIncomeBreakdown()).groups.reduce((s,g)=>s+Number(g.scheduled),0),0);
  seed([loan()], [], '100.00');
  const data=await getIncomeBreakdown();
  assert.equal(data.groups[0].scheduled,'350.00');
  assert.equal(Number(data.groups[0].scheduled)/Number(data.monthlyIncome)*100,350);
});

test('evening payments use the local date and count immediately toward income', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 11, 21, 23).getTime() });
  seed([loan()], [], '3653.06');
  assert.equal(currentLocalDate(), '2026-10-11');
  const payment = await recordLoanPayment('debt', {});
  assert.equal(payment.payment_date, '2026-10-11');
  assert.equal((await getIncomeBreakdown()).groups[0].paid, '350.00');
});
