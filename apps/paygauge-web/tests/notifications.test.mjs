import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDeviceReminders } from '../src/lib/notification-schedule.ts';

const preferences = {
  payment_reminders: true, autopay_reminders: true, payment_confirmations: true, milestone_alerts: true,
  days_before_due: 2, autopay_confirmation_delay_hours: 6, quiet_hours_start: '22:00:00', quiet_hours_end: '07:00:00',
};
const now = new Date(2026, 9, 11, 21);
function loan(overrides = {}) {
  return { id: 'bill', name: 'Phone', payment_type: 'ongoing', status: 'active', next_due_date: '2026-10-17',
    payment_amount: '266.39', current_balance: '0', payments_remaining: 0, autopay: true, ...overrides };
}

test('automatic bill reminders use correct amounts, 9 AM due time and confirmation delay', () => {
  const items = buildDeviceReminders([loan()], preferences, now);
  assert.deepEqual(items.map(item => item.type), ['payment_reminder','autopay_scheduled','autopay_confirmation']);
  assert.deepEqual(items.map(item => [item.at.getDate(), item.at.getHours()]), [[15,9],[17,9],[17,15]]);
  assert.ok(items.every(item => item.body.includes('$266.39')));
  assert.ok(items.every(item => !item.title.includes('milestone')));
});
test('quiet hours defer across midnight and same-day intervals without delivering during quiet time', () => {
  const overnight = buildDeviceReminders([loan()], { ...preferences, autopay_confirmation_delay_hours: 14 }, now);
  const confirmation = overnight.find(item => item.type === 'autopay_confirmation');
  assert.equal(confirmation.at.getDate(), 18);
  assert.equal(confirmation.at.getHours(), 7);
  const daytime = buildDeviceReminders([loan()], { ...preferences, quiet_hours_start:'08:00',quiet_hours_end:'18:00' }, now);
  assert.ok(daytime.every(item => item.at.getHours() === 18));
  const equal = buildDeviceReminders([loan()], { ...preferences,quiet_hours_start:'09:00',quiet_hours_end:'09:00' }, now);
  assert.equal(equal[0].at.getHours(),9);
});
test('skips stale dates, inactive/undated accounts, and reminders whose delivery time has passed', () => {
  assert.deepEqual(buildDeviceReminders([
    loan({next_due_date:'2026-10-01'}),loan({status:'archived'}),loan({status:'completed'}),loan({next_due_date:null}),
  ], preferences, now),[]);
  const current = buildDeviceReminders([loan({next_due_date:'2026-10-11'})], { ...preferences,autopay_confirmation_delay_hours:14 }, now);
  assert.deepEqual(current.map(item=>item.type), ['autopay_confirmation']);
  assert.equal(current[0].at.getDate(),12);
});
test('individual switches gate schedules and zero-day reminders do not duplicate manual due alerts', () => {
  assert.deepEqual(buildDeviceReminders([loan()], {...preferences,payment_reminders:false,autopay_reminders:false,payment_confirmations:false,milestone_alerts:false},now),[]);
  const manual=buildDeviceReminders([loan({autopay:false})],{...preferences,days_before_due:0},now);
  assert.equal(manual.length,1);
  assert.equal(manual[0].at.getHours(),9);
  assert.deepEqual(buildDeviceReminders([loan({autopay:false})],preferences,now).map(item=>item.type),['payment_reminder','payment_due']);
});
test('IDs are stable across refresh/order, unique per event, and debt final amounts/milestones are separate', () => {
  const loans=[loan(),loan({id:'debt',payment_type:'payoff',current_balance:'50',payment_amount:'100',payments_remaining:1})];
  const first=buildDeviceReminders(loans,preferences,now);
  assert.deepEqual(buildDeviceReminders([...loans].reverse(),preferences,now),first);
  assert.equal(new Set(first.map(item=>item.id)).size,first.length);
  const debt=first.filter(item=>item.loanId==='debt');
  assert.ok(debt.some(item=>item.type==='milestone'));
  assert.ok(debt.filter(item=>item.type!=='milestone').every(item=>item.body.includes('$50.00')));
  assert.ok(first.every(item=>item.id>0 && item.id<=1_000_000_000));
});
test('calendar arithmetic preserves local 9 AM through year boundaries and does not mutate input', () => {
  const accounts=[loan({next_due_date:'2027-01-01'})];
  const copy=structuredClone(accounts);
  const items=buildDeviceReminders(accounts,preferences,new Date(2026,11,25));
  assert.deepEqual([items[0].at.getFullYear(),items[0].at.getMonth(),items[0].at.getDate(),items[0].at.getHours()],[2026,11,30,9]);
  assert.deepEqual(accounts,copy);
  assert.throws(()=>buildDeviceReminders(accounts,{...preferences,quiet_hours_start:'bad'},now),/Quiet hours/);
});
