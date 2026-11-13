import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateAfterPayments, payoffSeries } from '../src/lib/api.ts';

test('payoff series without interest ends after balance / payment payments', () => {
  const series = payoffSeries(1000, 100);
  assert.equal(series.months, 10);
  assert.equal(series.points.at(-1).balance, 0);
  assert.equal(payoffSeries(1000, 100, 0, 150).months, 4);
});

test('interest lengthens payoff, and extra payments save interest', () => {
  const base = payoffSeries(10000, 300, 12);
  const faster = payoffSeries(10000, 300, 12, 100);
  assert.ok(base.months > 34 && base.months < 45);
  assert.ok(faster.months < base.months);
  assert.ok(faster.interest < base.interest);
});

test('payments that never cover interest are flagged as infinite', () => {
  assert.equal(payoffSeries(10000, 50, 12).months, Infinity);
});

test('dateAfterPayments follows the account recurrence', () => {
  assert.equal(dateAfterPayments('2026-01-31', 'monthly', 31, 1), '2026-02-28');
  assert.equal(dateAfterPayments('2026-01-01', 'biweekly', null, 2), '2026-01-29');
  assert.equal(dateAfterPayments('2026-01-15', 'monthly', 15, 0), '2026-01-15');
});
