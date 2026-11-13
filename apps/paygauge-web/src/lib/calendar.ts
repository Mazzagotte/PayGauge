import type { Loan } from './api';

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthDays(month: Date): (string | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length }, (_, index) => localDateKey(new Date(first.getFullYear(), first.getMonth(), index + 1))),
  ];
}

export function paymentsForMonth(loans: Loan[], month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return loans.flatMap((loan) => {
    if (loan.status !== 'active' || !loan.next_due_date) return [];
    const anchor = new Date(`${loan.next_due_date}T00:00:00`);
    const dayStep = loan.recurrence === 'weekly' ? 7 : loan.recurrence === 'biweekly' ? 14 : 0;
    const monthStep = loan.recurrence === 'quarterly' ? 3 : loan.recurrence === 'annual' ? 12 : 1;
    const occurrence = (index: number) => {
      if (dayStep) {
        const date = new Date(anchor);
        date.setDate(date.getDate() + index * dayStep);
        return date;
      }
      if (index === 0) return anchor;
      const target = new Date(anchor.getFullYear(), anchor.getMonth() + index * monthStep, 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(loan.due_day ?? anchor.getDate(), lastDay));
      return target;
    };
    let index = dayStep
      ? Math.max(0, Math.floor((Date.UTC(start.getFullYear(), start.getMonth(), 1) - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) / (86400000 * dayStep)))
      : Math.max(0, Math.floor(((start.getFullYear() - anchor.getFullYear()) * 12 + start.getMonth() - anchor.getMonth()) / monthStep));
    const limit = loan.payment_type === 'ongoing' ? Infinity : loan.payments_remaining;
    const payments: { id: string; loan: Loan; dueDate: string; amount: number }[] = [];
    for (; index < limit; index += 1) {
      const date = occurrence(index);
      if (date > end) break;
      if (date < start) continue;
      const regular = Number(loan.payment_amount);
      const amount = loan.payment_type === 'payoff' && Number(loan.interest_rate ?? 0) === 0
        ? Math.min(regular, Math.max(Number(loan.current_balance) - index * regular, 0))
        : regular;
      payments.push({ id: `${loan.id}:${localDateKey(date)}`, loan, dueDate: localDateKey(date), amount });
    }
    return payments;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.loan.name.localeCompare(b.loan.name));
}
