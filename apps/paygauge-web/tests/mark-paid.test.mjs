import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { beforeEach, test } from 'node:test';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (/^\.\/(api|notification-schedule|widget)$/.test(specifier) && context.parentURL?.includes('/src/lib/')) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });

const storage = new Map();
globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
const { markPaidFromReminder } = await import('../src/lib/notifications.ts');
const { getLoan, getLoanPayments } = await import('../src/lib/api.ts');

const loan = {
  id: 'car', name: 'Car', category: 'loan', payment_type: 'payoff', paid_with: 'bank-account', description: null,
  original_amount: '1000.00', current_balance: '1000.00', payment_amount: '100.00', total_number_of_payments: 10,
  payments_made: 0, payments_remaining: 10, interest_rate: '0', start_date: '2026-01-01', due_day: 20, recurrence: 'monthly',
  next_due_date: '2026-11-20', estimated_payoff_date: null, autopay: false, status: 'active', progress_percentage: 0,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};
beforeEach(() => { storage.clear(); storage.set('paygauge.localState', JSON.stringify({ loans: [loan], payments: [] })); });

test('Mark paid records once, then ignores repeat taps for the same due date', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 18, 9).getTime() });
  assert.deepEqual(await markPaidFromReminder({ loanId: 'car', dueDate: '2026-11-20' }), { status: 'recorded', loanName: 'Car' });
  assert.equal((await getLoan('car')).current_balance, '900.00');
  assert.equal((await getLoan('car')).next_due_date, '2026-12-20');
  assert.deepEqual(await markPaidFromReminder({ loanId: 'car', dueDate: '2026-11-20' }), { status: 'already-recorded', loanName: 'Car' });
  assert.equal((await getLoanPayments('car')).length, 1);
});

test('Mark paid for a deleted account does nothing', async () => {
  assert.deepEqual(await markPaidFromReminder({ loanId: 'gone', dueDate: '2026-11-20' }), { status: 'missing' });
  assert.deepEqual(await markPaidFromReminder(undefined), { status: 'missing' });
});
