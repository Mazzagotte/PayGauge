import type { Loan, NotificationPreferences } from './api';

export type ScheduledReminder = {
  id: number;
  title: string;
  body: string;
  at: Date;
  loanId: string;
  type: string;
  /** Due date this reminder is about; "Mark paid" only records if the account is still on it. */
  dueDate: string;
  amount: number;
  /** Shows a "Mark paid" button on the notification. */
  markPaid: boolean;
};

export const MARK_PAID_ACTION_TYPE = 'TALLY_PAYMENT';
export const MARK_PAID_ACTION = 'mark-paid';
const MARK_PAID_TYPES = new Set(['payment_reminder', 'payment_due', 'autopay_confirmation']);

export function buildDeviceReminders(loans: Loan[], preferences: NotificationPreferences, now = new Date()): ScheduledReminder[] {
  const start = timeMinutes(preferences.quiet_hours_start);
  const end = timeMinutes(preferences.quiet_hours_end);
  const reminders: ScheduledReminder[] = [];
  const ids = new Set<number>();
  function add(loan: Loan, type: string, title: string, body: string, date: Date) {
    const at = new Date(date);
    const minutes = at.getHours() * 60 + at.getMinutes();
    const quiet = start !== end && (start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end);
    if (quiet) {
      if (start > end && minutes >= start) at.setDate(at.getDate() + 1);
      at.setHours(Math.floor(end / 60), end % 60, 0, 0);
    }
    if (at <= now) return;
    const key = `${loan.id}:${type}:${loan.next_due_date}`;
    let hash = 0;
    for (const character of key) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
    let id = 1 + hash % 1_000_000_000;
    while (ids.has(id)) id = id % 1_000_000_000 + 1;
    ids.add(id);
    reminders.push({ id, title, body, at, loanId: loan.id, type, dueDate: loan.next_due_date!, amount: currentAmount, markPaid: MARK_PAID_TYPES.has(type) });
  }
  let currentAmount = 0;
  for (const loan of [...loans].sort((a, b) => a.id.localeCompare(b.id))) {
    if (loan.status !== 'active' || !loan.next_due_date) continue;
    const due = new Date(`${loan.next_due_date}T09:00:00`);
    if (!Number.isFinite(due.getTime())) throw new Error(`Invalid due date for ${loan.name}.`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (due < today) continue;
    const amount = loan.payment_type === 'ongoing' ? Number(loan.payment_amount) : Math.min(Number(loan.current_balance), Number(loan.payment_amount));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    currentAmount = Math.round(amount * 100) / 100;
    const money = amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    if (preferences.payment_reminders) {
      const before = new Date(due);
      before.setDate(before.getDate() - preferences.days_before_due);
      add(loan, 'payment_reminder', `${loan.name} payment coming up`, `${money} due ${loan.next_due_date}. Open Tally to review.`, before);
      if (preferences.days_before_due > 0 && (!loan.autopay || !preferences.autopay_reminders)) {
        add(loan, 'payment_due', `${loan.name} payment due`, `${money} is due today. Record it only after paying.`, due);
      }
    }
    if (loan.autopay && preferences.autopay_reminders) {
      add(loan, 'autopay_scheduled', `${loan.name} autopay scheduled`, `${money} is scheduled today. This is not confirmation of payment.`, due);
    }
    if (loan.autopay && preferences.payment_confirmations) {
      add(loan, 'autopay_confirmation', `Confirm ${loan.name} payment`, `Check whether the ${money} autopay processed, then confirm in Tally.`, new Date(due.getTime() + preferences.autopay_confirmation_delay_hours * 3600000));
    }
    if (loan.payment_type === 'payoff' && preferences.milestone_alerts && [1, 5, 10].includes(loan.payments_remaining)) {
      add(loan, 'milestone', `${loan.name} payoff milestone`, `${loan.payments_remaining} estimated payments remain. This is an estimate, not lender confirmation.`, due);
    }
  }
  return reminders.sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
}

function timeMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) throw new Error('Quiet hours must use valid local times.');
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
