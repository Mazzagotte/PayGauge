import type { Loan } from './api';

export type WidgetSnapshot = {
  left: number;
  percentPaid: number;
  hasDebts: boolean;
  nextName: string | null;
  nextDate: string | null;
  nextAmount: number | null;
  updatedAt: string;
};

/** Pure summary used by the Android home-screen widget. */
export function widgetSnapshot(loans: Loan[], now = new Date()): WidgetSnapshot {
  const active = loans.filter(loan => loan.status === 'active');
  const debts = active.filter(loan => loan.payment_type === 'payoff');
  const left = debts.reduce((total, loan) => total + Number(loan.current_balance), 0);
  const original = debts.reduce((total, loan) => total + Math.max(Number(loan.original_amount), Number(loan.current_balance)), 0);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const next = active
    .filter(loan => loan.next_due_date && loan.next_due_date >= today)
    .sort((a, b) => a.next_due_date!.localeCompare(b.next_due_date!) || a.name.localeCompare(b.name))[0];
  return {
    left: Math.round(left * 100) / 100,
    percentPaid: original > 0 ? Math.round(Math.min(Math.max((original - left) / original, 0), 1) * 1000) / 10 : 0,
    hasDebts: debts.length > 0,
    nextName: next?.name ?? null,
    nextDate: next?.next_due_date ?? null,
    nextAmount: next ? Number(next.payment_type === 'payoff' ? Math.min(Number(next.current_balance), Number(next.payment_amount)) : next.payment_amount) : null,
    updatedAt: now.toISOString(),
  };
}

type TallyWidgetPlugin = { update: (options: { snapshot: string }) => Promise<void> };
let plugin: TallyWidgetPlugin | null = null;

export async function syncWidget(loans: Loan[]) {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('TallyWidget')) return;
  plugin ??= registerPlugin<TallyWidgetPlugin>('TallyWidget');
  await plugin.update({ snapshot: JSON.stringify(widgetSnapshot(loans)) });
}

/** Called on app open so date-based text (next due) stays fresh even without edits. */
export async function refreshWidget() {
  const { getLoans } = await import('./api');
  await syncWidget(await getLoans());
}
