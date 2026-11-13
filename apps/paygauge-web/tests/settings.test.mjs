import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { getLastBackupLabel, readBackupFile, saveBackupFile, validateBackupPayload } from '../src/lib/backup.ts';
import { getDeviceNotificationPermission, openNotificationSettings, requestDeviceNotificationPermission, sendLocalTestNotification } from '../src/lib/notifications.ts';
import { exportBackupJson, getNotificationPreferences, importBackupJson, updateNotificationPreferences } from '../src/lib/api.ts';

function backup() {
  return {
    app: 'PayGauge',
    exported_at: '2026-10-12T02:00:00Z',
    loans: [{
      id: 'debt', name: 'Debt', category: 'loan', payment_type: 'payoff', paid_with: 'bank-account',
      description: null, original_amount: '1000.00', current_balance: '900.00', payment_amount: '100.00',
      total_number_of_payments: 10, payments_made: 1, payments_remaining: 9, interest_rate: '0',
      start_date: '2026-10-01', due_day: 15, recurrence: 'monthly', next_due_date: '2026-10-15',
      estimated_payoff_date: null, autopay: true, status: 'active', progress_percentage: 10,
      created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    }],
    payments: [{
      id: 'payment', loan_id: 'debt', amount: '100.00', payment_date: '2026-10-01',
      payment_number: 1, notes: null, source: 'manual', created_at: '2026-10-01T00:00:00Z',
    }],
  };
}

const keys = ['window', 'document', 'Notification', 'FileReader'];
const originalGlobals = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let storage;

beforeEach(() => {
  storage = new Map();
  globalThis.window = { localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
});

afterEach(() => {
  for (const key of keys) {
    if (originalGlobals[key]) Object.defineProperty(globalThis, key, originalGlobals[key]);
    else delete globalThis[key];
  }
});

test('validates backups without modifying their financial records', () => {
  const data = backup();
  const before = structuredClone(data);
  validateBackupPayload(data);
  validateBackupPayload({ ...data, loans: [], payments: [] });
  assert.deepEqual(data, before);
});

test('rejects wrong formats, invalid amounts/dates, duplicates and malformed preferences', () => {
  for (const data of [null, {}, { ...backup(), app: 'Other' }, { ...backup(), loans: {} }]) {
    assert.throws(() => validateBackupPayload(data), /valid Tally/);
  }
  for (const change of [
    { current_balance: 'NaN' }, { payment_amount: '-1' }, { next_due_date: '2026-02-30' },
    { recurrence: 'daily' }, { payments_made: -1 }, { due_day: 32 },
  ]) {
    const data = backup();
    Object.assign(data.loans[0], change);
    assert.throws(() => validateBackupPayload(data), /invalid or duplicate account/);
  }
  const duplicate = backup();
  duplicate.loans.push({ ...duplicate.loans[0] });
  assert.throws(() => validateBackupPayload(duplicate), /duplicate account/);
  const badPayment = backup();
  badPayment.payments[0].amount = 'bad';
  assert.throws(() => validateBackupPayload(badPayment), /payment history/);
  assert.throws(() => validateBackupPayload({ ...backup(), notification_preferences: {} }), /reminder preferences/);
  for (const income of ['0', '-1', 'bad', '12.345', 3653.06]) {
    assert.throws(() => validateBackupPayload({ ...backup(), monthly_take_home_income: income }), /monthly take-home income/);
  }
  validateBackupPayload({ ...backup(), monthly_take_home_income: '3653.06' });
  validateBackupPayload({ ...backup(), monthly_take_home_income: null });
});

test('file reader validates parsed JSON before exposing import counts', async () => {
  globalThis.FileReader = class {
    readAsText(file) {
      this.result = file.contents;
      this.onload();
    }
  };
  assert.deepEqual(await readBackupFile({ contents: JSON.stringify(backup()) }), backup());
  await assert.rejects(readBackupFile({ contents: '[]' }), /valid Tally/);
  await assert.rejects(readBackupFile({ contents: '{bad' }), SyntaxError);
});

test('export reports download initiation and marks an export only after successful dispatch', async () => {
  let clicked = false;
  let removed = false;
  const link = { click: () => { clicked = true; }, remove: () => { removed = true; } };
  globalThis.document = { createElement: () => link, body: { appendChild: () => {} } };
  assert.match(await saveBackupFile(backup()), /download started/);
  assert.equal(clicked, true);
  assert.equal(removed, true);
  assert.ok(storage.has('paygauge.lastBackupAt'));
  const previous = storage.get('paygauge.lastBackupAt');
  link.click = () => { throw new Error('Download failed'); };
  await assert.rejects(saveBackupFile(backup()), /Download failed/);
  assert.equal(storage.get('paygauge.lastBackupAt'), previous);
});

test('last export handles missing or malformed timestamps', () => {
  assert.equal(getLastBackupLabel(), 'Never');
  storage.set('paygauge.lastBackupAt', 'invalid');
  assert.equal(getLastBackupLabel(), 'Unknown date');
});

test('reminder edits and backup restore preserve all account and payment amounts', async () => {
  await importBackupJson(backup(), true);
  const initial = await exportBackupJson();
  const preferences = await getNotificationPreferences();
  await updateNotificationPreferences({ payment_reminders: false, days_before_due: 3, autopay_confirmation_delay_hours: 12 });
  const edited = await exportBackupJson();
  assert.equal(edited.notification_preferences.payment_reminders, false);
  assert.equal(edited.notification_preferences.days_before_due, 3);
  assert.equal(edited.notification_preferences.autopay_confirmation_delay_hours, 12);
  assert.deepEqual(edited.loans, initial.loans);
  assert.deepEqual(edited.payments, initial.payments);
  validateBackupPayload({ ...backup(), notification_preferences: preferences });
  await importBackupJson({ ...backup(), notification_preferences: preferences }, true);
  assert.deepEqual(await getNotificationPreferences(), preferences);
});

test('browser notification status, permission gating, and explicit delivery failures', async () => {
  assert.equal(await getDeviceNotificationPermission(), 'unsupported');
  assert.equal(await sendLocalTestNotification({}), 'unsupported');
  assert.equal(await openNotificationSettings(), 'unsupported');
  let sent = 0;
  globalThis.Notification = class {
    static permission = 'denied';
    static async requestPermission() { return 'granted'; }
    constructor() { sent += 1; }
  };
  window.Notification = globalThis.Notification;
  assert.equal(await getDeviceNotificationPermission(), 'denied');
  assert.equal(await sendLocalTestNotification({}), 'permission-needed');
  assert.equal(sent, 0);
  assert.equal(await requestDeviceNotificationPermission(), 'granted');
  Notification.permission = 'granted';
  assert.equal(await sendLocalTestNotification({ title: 'Test', body: 'Reminder' }), 'sent');
  assert.equal(sent, 1);
  globalThis.Notification = class {
    static permission = 'granted';
    constructor() { throw new Error('Delivery failed'); }
  };
  window.Notification = globalThis.Notification;
  await assert.rejects(sendLocalTestNotification({}), /Delivery failed/);
});
