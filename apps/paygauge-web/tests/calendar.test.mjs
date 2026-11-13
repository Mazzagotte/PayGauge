import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localDateKey, monthDays, paymentsForMonth } from '../src/lib/calendar.ts';

function loan(overrides = {}) {
  return { id: 'test', name: 'Test', status: 'active', payment_type: 'ongoing', next_due_date: '2026-10-15', due_day: 15, recurrence: 'monthly', payment_amount: '421.27', current_balance: '0', interest_rate: '0', payments_remaining: 0, ...overrides };
}

test('calendar aligns weekdays and handles leap years and year transitions', () => {
  const october = monthDays(new Date(2026, 9, 1));
  assert.deepEqual(october.slice(0, 4), [null, null, null, null]);
  assert.equal(october[4], '2026-10-01');
  assert.equal(october.at(-1), '2026-10-31');
  assert.equal(monthDays(new Date(2028, 1, 1)).filter(Boolean).length, 29);
  assert.equal(monthDays(new Date(2027, 1, 1)).filter(Boolean).length, 28);
  assert.equal(localDateKey(new Date(2026, 12, 1)), '2027-01-01');
});

test('ongoing bills project beyond zero payoff count and six-month horizons', () => {
  assert.equal(paymentsForMonth([loan()], new Date(2027, 9, 1))[0].dueDate, '2027-10-15');
  assert.deepEqual(paymentsForMonth([loan()], new Date(2026, 8, 1)), []);
  assert.deepEqual(paymentsForMonth([loan({ status: 'completed' }), loan({ next_due_date: null })], new Date(2026, 9, 1)), []);
});

test('weekly and biweekly schedules include each occurrence in the displayed month', () => {
  const weekly = paymentsForMonth([loan({ recurrence: 'weekly', next_due_date: '2026-10-02' })], new Date(2026, 9, 1));
  assert.deepEqual(weekly.map(p => p.dueDate), ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30']);
  assert.equal(paymentsForMonth([loan({ recurrence: 'biweekly', next_due_date: '2026-10-02' })], new Date(2026, 9, 1)).length, 3);
});

test('monthly clamping restores anchor day and annual/quarterly dates skip other months', () => {
  const end = loan({ due_day: 31, next_due_date: '2026-01-31' });
  assert.equal(paymentsForMonth([end], new Date(2026, 1, 1))[0].dueDate, '2026-02-28');
  assert.equal(paymentsForMonth([end], new Date(2026, 2, 1))[0].dueDate, '2026-03-31');
  assert.equal(paymentsForMonth([loan({ recurrence: 'quarterly' })], new Date(2026, 10, 1)).length, 0);
  assert.equal(paymentsForMonth([loan({ recurrence: 'quarterly' })], new Date(2027, 0, 1)).length, 1);
  assert.equal(paymentsForMonth([loan({ recurrence: 'annual' })], new Date(2027, 9, 1)).length, 1);
});

test('finite debt forecasts stop after payoff and cap the interest-free final installment', () => {
  const debt = loan({ payment_type: 'payoff', current_balance: '2695.68', payments_remaining: 7 });
  const final = paymentsForMonth([debt], new Date(2027, 3, 1));
  assert.equal(final[0].dueDate, '2027-04-15');
  assert.ok(Math.abs(final[0].amount - 168.06) < 0.000001);
  assert.equal(paymentsForMonth([debt], new Date(2027, 4, 1)).length, 0);
  assert.equal(paymentsForMonth([loan({ payment_type: 'payoff', payments_remaining: 0 })], new Date(2026, 9, 1)).length, 0);
});
