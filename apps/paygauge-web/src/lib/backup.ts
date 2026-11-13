import type { BackupPayload } from './api';
import { Capacitor } from '@capacitor/core';

export async function saveBackupFile(backup: BackupPayload) {
  const fileName = `tally-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const contents = JSON.stringify(backup, null, 2);

  if (typeof window === 'undefined') throw new Error('Backup export requires a device or browser.');

  let status: string;
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: 'Tally Backup',
      text: 'Tally loan and payment backup',
      url: result.uri,
      dialogTitle: 'Save or share Tally backup',
    });
    status = 'Saved to phone storage and opened share sheet.';
  } else {
    const blob = new Blob([contents], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    status = 'Backup download started. Check your Downloads folder to confirm it was saved.';
  }
  window.localStorage.setItem('paygauge.lastBackupAt', new Date().toISOString());
  return status;
}

export function validateBackupPayload(value: unknown): asserts value is BackupPayload {
  if (!isRecord(value) || value.app !== 'PayGauge' || typeof value.exported_at !== 'string' || !Number.isFinite(Date.parse(value.exported_at)) ||
    !Array.isArray(value.loans) || !Array.isArray(value.payments)) {
    throw new Error('Choose a valid Tally JSON backup with accounts and payment history.');
  }
  const accountIds = new Set<string>();
  if (value.monthly_take_home_income != null && (!isMoney(value.monthly_take_home_income) || Number(value.monthly_take_home_income) <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(value.monthly_take_home_income)))) {
    throw new Error('The backup contains invalid monthly take-home income. Nothing was imported.');
  }
  for (const account of value.loans) {
    if (!isRecord(account) || typeof account.id !== 'string' || !account.id || accountIds.has(account.id) ||
      typeof account.name !== 'string' || !account.name.trim() ||
      !['active', 'completed', 'archived'].includes(String(account.status)) ||
      !['payoff', 'ongoing'].includes(String(account.payment_type)) ||
      !['monthly', 'weekly', 'biweekly', 'quarterly', 'annual'].includes(String(account.recurrence)) ||
      !['original_amount', 'current_balance', 'payment_amount'].every(key => isMoney(account[key])) ||
      (account.interest_rate !== null && !isMoney(account.interest_rate)) ||
      !Number.isInteger(account.payments_made) || Number(account.payments_made) < 0 ||
      (account.due_day !== null && (!Number.isInteger(account.due_day) || Number(account.due_day) < 1 || Number(account.due_day) > 31)) ||
      !['start_date', 'next_due_date', 'estimated_payoff_date'].every(key => isDateOrNull(account[key]))) {
      throw new Error('The backup contains an invalid or duplicate account. Nothing was imported.');
    }
    accountIds.add(account.id);
  }
  const paymentIds = new Set<string>();
  for (const payment of value.payments) {
    if (!isRecord(payment) || typeof payment.id !== 'string' || !payment.id || paymentIds.has(payment.id) ||
      typeof payment.loan_id !== 'string' || !isMoney(payment.amount) ||
      payment.payment_date === null || !isDateOrNull(payment.payment_date) ||
      !Number.isInteger(payment.payment_number) || Number(payment.payment_number) < 0) {
      throw new Error('The backup contains invalid or duplicate payment history. Nothing was imported.');
    }
    paymentIds.add(payment.id);
    if (payment.undo !== undefined) {
      const undo = payment.undo;
      if (!isRecord(undo) || !isRecord(undo.before) || !isRecord(undo.after) ||
        undo.before.id !== payment.loan_id || undo.after.id !== payment.loan_id ||
        Number(undo.before.payments_made) + 1 !== payment.payment_number ||
        undo.after.payments_made !== payment.payment_number) {
        throw new Error('The backup contains invalid payment Undo values. Nothing was imported.');
      }
      validateBackupPayload({ app: 'PayGauge', exported_at: value.exported_at, loans: [undo.before], payments: [] });
      validateBackupPayload({ app: 'PayGauge', exported_at: value.exported_at, loans: [undo.after], payments: [] });
    }
  }
  if (value.notification_preferences !== undefined) {
    const preferences = value.notification_preferences;
    if (!isRecord(preferences) ||
      !['payment_reminders', 'autopay_reminders', 'payment_confirmations', 'milestone_alerts'].every(key => typeof preferences[key] === 'boolean') ||
      !Number.isInteger(preferences.days_before_due) || Number(preferences.days_before_due) < 0 || Number(preferences.days_before_due) > 30 ||
      !Number.isInteger(preferences.autopay_confirmation_delay_hours) || Number(preferences.autopay_confirmation_delay_hours) < 1 || Number(preferences.autopay_confirmation_delay_hours) > 24 ||
      !['quiet_hours_start', 'quiet_hours_end'].every(key => typeof preferences[key] === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(preferences[key]))) {
      throw new Error('The backup contains invalid reminder preferences. Nothing was imported.');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function isDateOrNull(value: unknown) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function readBackupFile(file: File) {
  return new Promise<BackupPayload>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload: unknown = JSON.parse(String(reader.result));
        validateBackupPayload(payload);
        resolve(payload);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function getLastBackupLabel() {
  if (typeof window === 'undefined') return 'Never';
  const lastBackupAt = window.localStorage.getItem('paygauge.lastBackupAt');
  if (!lastBackupAt) return 'Never';
  if (!Number.isFinite(Date.parse(lastBackupAt))) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(lastBackupAt));
}
