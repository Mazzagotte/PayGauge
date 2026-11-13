import assert from 'node:assert/strict';
import { test } from 'node:test';
import { widgetSnapshot } from '../src/lib/widget.ts';

const base = { status: 'active', payment_type: 'payoff', original_amount: '1000.00', current_balance: '600.00', payment_amount: '100.00', name: 'Car', next_due_date: '2026-11-20' };

test('widget snapshot sums active debts and picks the next upcoming payment', () => {
  const now = new Date(2026, 10, 13, 12);
  const snap = widgetSnapshot([
    base,
    { ...base, name: 'Ring', current_balance: '400.00', next_due_date: '2026-11-15' },
    { ...base, name: 'Old', status: 'completed', current_balance: '0.00' },
    { ...base, name: 'Netflix', payment_type: 'ongoing', original_amount: '0', current_balance: '0', payment_amount: '15.99', next_due_date: '2026-11-14' },
    { ...base, name: 'Stale', payment_type: 'ongoing', next_due_date: '2026-11-01' },
  ], now);
  assert.equal(snap.left, 1000);
  assert.equal(snap.percentPaid, 50);
  assert.equal(snap.hasDebts, true);
  assert.equal(snap.nextName, 'Netflix');
  assert.equal(snap.nextAmount, 15.99);
});

test('widget snapshot without debts reports no ring', () => {
  const snap = widgetSnapshot([], new Date(2026, 10, 13));
  assert.deepEqual([snap.hasDebts, snap.left, snap.percentPaid, snap.nextName], [false, 0, 0, null]);
});
