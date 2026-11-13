import type { DashboardLoanSummary } from './api';

export type PaymentDueGroup = {
  date: string;
  payments: DashboardLoanSummary[];
  total: number;
};

export function groupPaymentsByDueDate(loans: DashboardLoanSummary[]): PaymentDueGroup[] {
  const groups = new Map<string, PaymentDueGroup>();
  for (const loan of loans) {
    if (loan.status !== 'active' || !loan.next_due_date) continue;
    const group = groups.get(loan.next_due_date) ?? { date: loan.next_due_date, payments: [], total: 0 };
    group.payments.push(loan);
    group.total = (Math.round(group.total * 100) + Math.round(Number(loan.payment_amount) * 100)) / 100;
    groups.set(group.date, group);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}
