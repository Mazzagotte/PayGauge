import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import {
  deletePayment, exportBackupJson, getLoan, getLoanPayments, getNotificationQueue,
  getLoans, importBackupJson, paymentUndoUnavailableReason, recordLoanPayment, updateLoan,
} from '../src/lib/api.ts';
import { validateBackupPayload } from '../src/lib/backup.ts';

const originalWindow = globalThis.window;
let storage;
function loan(overrides = {}) {
  return {
    id: 'test', name: 'Test account', category: 'loan', payment_type: 'payoff', paid_with: 'bank-account',
    description: null, original_amount: '1000.00', current_balance: '1000.00', payment_amount: '100.00',
    total_number_of_payments: 10, payments_made: 0, payments_remaining: 10, interest_rate: '0',
    start_date: '2026-01-01', due_day: 31, recurrence: 'monthly', next_due_date: '2026-10-31',
    estimated_payoff_date: null, autopay: true, status: 'active', progress_percentage: 0,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
});
after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});
function seed(loans, payments = []) {
  storage.set('paygauge.localState', JSON.stringify({ loans, payments }));
}

test('recurring bill reminders use full amounts and never advertise payoff milestones', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 17, 12).getTime() });
  seed([loan({ payment_type: 'ongoing', category: 'bill', current_balance: '0.00', payment_amount: '266.39', next_due_date: '2026-10-17', due_day: 17 })]);
  const items = (await getNotificationQueue()).items;
  assert.ok(items.some(item => item.type === 'autopay_confirmation'));
  assert.ok(items.some(item => item.type === 'payment_due'));
  assert.ok(items.every(item => item.amount === '266.39' && item.type !== 'milestone'));
  assert.ok(items.every(item => !item.body.includes('payments will remain') && !item.title.includes('Paid off')));
  const confirmation = items.find(item => item.type === 'autopay_confirmation');
  const payment = await recordLoanPayment('test', { amount: confirmation.amount, source: 'autopay-confirmed' });
  assert.equal(payment.amount, '266.39');
  assert.equal(payment.milestone, undefined);
  assert.equal(payment.notification_title, undefined);
  assert.equal((await getLoan('test')).current_balance, '0.00');
});

test('reconciles stale monthly schedules from a payment already recorded this month', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 12, 12).getTime() });
  seed([loan({
    name: 'Engagement Ring', category: 'jewelry', current_balance: '3077.73',
    original_amount: '4876.00', payment_amount: '349.14', payments_made: 7,
    interest_rate: '23.88', next_due_date: '2026-03-25', due_day: 25,
  })]);
  const payment = await recordLoanPayment('test', { payment_date: '2026-10-11', amount: '349.14' });

  assert.equal((await getLoans())[0].next_due_date, '2026-11-25');
  assert.ok(!(await getNotificationQueue()).items.some(item => item.type === 'autopay_confirmation'));
  assert.equal(JSON.parse(storage.get('paygauge.localState')).loans[0].next_due_date, '2026-11-25');
  const paymentHistory = await getLoanPayments('test');
  assert.equal(paymentUndoUnavailableReason(paymentHistory[0], await getLoan('test'), paymentHistory), null);
  await deletePayment(payment.id);
  assert.equal((await getLoan('test')).next_due_date, '2026-10-25');
});

test('does not keep asking for autopay confirmation on a past-month due date', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 12, 12).getTime() });
  seed([loan({ next_due_date: '2026-03-25', due_day: 25 })]);
  assert.ok(!(await getNotificationQueue()).items.some(item => item.type === 'autopay_confirmation'));
});

test('repairs the payment Undo snapshot if the due date was already migrated', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 12, 12).getTime() });
  seed([loan({ current_balance: '3077.73', payments_made: 7, next_due_date: '2026-03-25', due_day: 25 })]);
  const payment = await recordLoanPayment('test', { payment_date: '2026-10-11' });
  const state = JSON.parse(storage.get('paygauge.localState'));
  state.loans[0].next_due_date = '2026-11-25';
  storage.set('paygauge.localState', JSON.stringify(state));

  const history = await getLoanPayments('test');
  assert.equal(paymentUndoUnavailableReason(history[0], await getLoan('test'), history), null);
  assert.equal(history[0].undo.before.next_due_date, '2026-10-25');
  assert.equal(history[0].undo.after.next_due_date, '2026-11-25');
  assert.equal(JSON.parse(storage.get('paygauge.localState')).payments[0].undo.after.next_due_date, '2026-11-25');
  await deletePayment(payment.id);
  assert.equal((await getLoan('test')).next_due_date, '2026-10-25');
});

test('Undo restores exact bill values for every recurrence including clamped month ends', async () => {
  for (const recurrence of ['monthly', 'weekly', 'biweekly', 'quarterly', 'annual']) {
    seed([loan({ recurrence, payment_type: 'ongoing', current_balance: '0.00', next_due_date: '2026-01-31' })]);
    const before = await getLoan('test');
    const payment = await recordLoanPayment('test', { payment_date: '2026-01-31' });
    assert.notEqual((await getLoan('test')).next_due_date, before.next_due_date);
    assert.equal(paymentUndoUnavailableReason(payment, await getLoan('test'), await getLoanPayments('test')), null);
    await deletePayment(payment.id);
    assert.deepEqual(await getLoan('test'), before);
    assert.deepEqual(await getLoanPayments('test'), []);
  }
});

test('Undo restores actual debt balance after overpayment and restores completed status', async () => {
  seed([loan({ current_balance: '75.00' })]);
  const before = await getLoan('test');
  const payment = await recordLoanPayment('test', { amount: '100.00' });
  assert.equal((await getLoan('test')).status, 'completed');
  await deletePayment(payment.id);
  assert.deepEqual(await getLoan('test'), before);
});

test('older and imported payment history cannot change a statement-reconciled balance', async () => {
  for (const source of ['manual', 'import', 'autopay-confirmed']) {
    const payment = { id: 'old', loan_id: 'test', payment_number: 1, amount: '349.14', payment_date: '2026-09-21', source, created_at: '2026-09-21T00:00:00Z' };
    seed([loan({ payments_made: 7, current_balance: '3077.73' })], [payment]);
    const before = storage.get('paygauge.localState');
    assert.match(paymentUndoUnavailableReason(payment, await getLoan('test'), [payment]), /Older or imported history/);
    await assert.rejects(deletePayment('old'), /Older or imported history/);
    assert.equal(storage.get('paygauge.localState'), before);
  }
});

test('only the latest recorded payment is reversible, even when its date is earlier', async () => {
  seed([loan()]);
  const original = await getLoan('test');
  const first = await recordLoanPayment('test', { payment_date: '2026-10-20' });
  const second = await recordLoanPayment('test', { payment_date: '2026-10-10' });
  await assert.rejects(deletePayment(first.id), /latest recorded payment/);
  await deletePayment(second.id);
  await deletePayment(first.id);
  assert.deepEqual(await getLoan('test'), original);
});

test('Undo rejects edits after payment, protecting changed account fields', async () => {
  seed([loan()]);
  const payment = await recordLoanPayment('test', {});
  await updateLoan('test', { payment_amount: '200.00' });
  const before = storage.get('paygauge.localState');
  await assert.rejects(deletePayment(payment.id), /account changed/);
  assert.equal(storage.get('paygauge.localState'), before);
});

test('backups retain reversal values and reject malformed snapshots', async t => {
  // Pin "today" so the October due date in the fixture stays current regardless of when tests run.
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 17, 12).getTime() });
  seed([loan()]);
  const original = await getLoan('test');
  const payment = await recordLoanPayment('test', {});
  const backup = await exportBackupJson();
  validateBackupPayload(backup);
  await importBackupJson(backup, true);
  await deletePayment(payment.id);
  assert.deepEqual(await getLoan('test'), original);
  const invalid = structuredClone(backup);
  invalid.payments[0].undo.before.id = 'other-account';
  assert.throws(() => validateBackupPayload(invalid), /invalid payment Undo values/);
  invalid.payments[0].undo.before.id = 'test';
  invalid.payments[0].undo.before.current_balance = 'bad';
  assert.throws(() => validateBackupPayload(invalid), /invalid or duplicate account/);
});
