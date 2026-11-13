import type { NotificationItem } from './api';
import { Capacitor, registerPlugin } from '@capacitor/core';

type AppSettingsPlugin = {
  openNotificationSettings: () => Promise<void>;
};

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

export async function getDeviceNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return (await LocalNotifications.checkPermissions()).display;
  }
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestDeviceNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';

  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    window.dispatchEvent(new Event('paygauge:state-changed'));
    return result.display;
  }

  if ('Notification' in window) return Notification.requestPermission();
  return 'unsupported';
}

export async function sendLocalTestNotification(item: NotificationItem) {
  if (typeof window === 'undefined') return 'unsupported';
  const permission = await getDeviceNotificationPermission();
  if (permission === 'unsupported') return 'unsupported';
  if (permission !== 'granted') return 'permission-needed';

  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2_147_483_647),
          title: item.title,
          body: item.body,
          schedule: { at: new Date(Date.now() + 1000) },
          extra: { loanId: item.loan_id, type: item.type },
        },
      ],
    });
    return 'scheduled';
  }

  new Notification(item.title, { body: item.body });
  return 'sent';
}

export async function openNotificationSettings() {
  if (typeof window === 'undefined') return 'unsupported';

  if (!Capacitor.isNativePlatform()) return 'unsupported';
  await AppSettings.openNotificationSettings();
  return 'opened';
}

let scheduleQueue: Promise<unknown> = Promise.resolve();

export function refreshDeviceReminders() {
  const run = scheduleQueue.catch(() => undefined).then(async () => {
    if (!Capacitor.isNativePlatform()) return null;
    const [{ LocalNotifications }, { exportBackupJson }, { buildDeviceReminders, MARK_PAID_ACTION, MARK_PAID_ACTION_TYPE }] = await Promise.all([
      import('@capacitor/local-notifications'), import('./api'), import('./notification-schedule'),
    ]);
    const pending = await LocalNotifications.getPending();
    const managed = pending.notifications.filter(item => item.extra?.paygaugeAutomatic === true);
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') {
      if (managed.length) await LocalNotifications.cancel({ notifications: managed.map(item => ({ id: item.id })) });
      return 'Allow notifications to enable automatic reminders.';
    }
    const backup = await exportBackupJson();
    if (!backup.notification_preferences) throw new Error('Reminder preferences are unavailable.');
    const reminders = buildDeviceReminders(backup.loans, backup.notification_preferences);
    const occupiedIds = new Set(pending.notifications.filter(item => item.extra?.paygaugeAutomatic !== true).map(item => item.id));
    for (const reminder of reminders) {
      while (occupiedIds.has(reminder.id)) reminder.id = reminder.id % 1_000_000_000 + 1;
      occupiedIds.add(reminder.id);
    }
    if (typeof LocalNotifications.registerActionTypes === 'function') {
      await LocalNotifications.registerActionTypes({ types: [{ id: MARK_PAID_ACTION_TYPE, actions: [{ id: MARK_PAID_ACTION, title: 'Mark paid' }] }] });
    }
    await LocalNotifications.createChannel({ id: 'paygauge-reminders', name: 'Payment reminders', importance: 3, description: 'Payment dates and autopay confirmations' });
    if (managed.length) await LocalNotifications.cancel({ notifications: managed.map(item => ({ id: item.id })) });
    if (reminders.length) await LocalNotifications.schedule({
      notifications: reminders.map(item => ({
        id: item.id, title: item.title, body: item.body,
        channelId: 'paygauge-reminders',
        schedule: { at: item.at, allowWhileIdle: true },
        ...(item.markPaid ? { actionTypeId: MARK_PAID_ACTION_TYPE } : {}),
        extra: { loanId: item.loanId, type: item.type, dueDate: item.dueDate, amount: item.amount, paygaugeAutomatic: true },
      })),
    });
    return `${reminders.length} automatic reminders scheduled for next tracked due dates.`;
  });
  scheduleQueue = run;
  return run;
}

export type MarkPaidResult = { status: 'recorded' | 'already-recorded' | 'missing'; loanName?: string };

/**
 * Handles the "Mark paid" notification button. Only records when the account is still on the
 * due date the reminder was about, so tapping twice (or after paying in-app) never double-counts.
 */
export async function markPaidFromReminder(extra: Record<string, unknown> | undefined): Promise<MarkPaidResult> {
  const loanId = typeof extra?.loanId === 'string' ? extra.loanId : null;
  const dueDate = typeof extra?.dueDate === 'string' ? extra.dueDate : null;
  if (!loanId) return { status: 'missing' };
  const { getLoan, recordLoanPayment, currentLocalDate } = await import('./api');
  let loan;
  try {
    loan = await getLoan(loanId);
  } catch {
    return { status: 'missing' };
  }
  if (loan.status !== 'active' || (dueDate && loan.next_due_date !== dueDate)) return { status: 'already-recorded', loanName: loan.name };
  const amount = loan.payment_type === 'ongoing' ? Number(loan.payment_amount) : Math.min(Number(loan.current_balance), Number(loan.payment_amount));
  await recordLoanPayment(loan.id, {
    amount: amount.toFixed(2),
    payment_date: currentLocalDate(),
    notes: 'Marked paid from reminder',
    source: loan.autopay ? 'autopay-confirmed' : 'manual',
  });
  return { status: 'recorded', loanName: loan.name };
}
