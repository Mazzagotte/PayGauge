import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, beforeEach, test } from 'node:test';
import { buildDeviceReminders } from '../src/lib/notification-schedule.ts';

const device = {
  native: true, permission: 'granted', pending: [], scheduled: [], canceled: [], channels: [], fail: false, reads: 0, activeReads: 0, maxReads: 0,
};
const due = new Date();
due.setDate(due.getDate() + 10);
const date = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
const backup = {
  loans: [{id:'loan',name:'Bill',payment_type:'ongoing',status:'active',next_due_date:date,payment_amount:'50',current_balance:'0',payments_remaining:0,autopay:true}],
  notification_preferences: { payment_reminders:true,autopay_reminders:true,payment_confirmations:true,milestone_alerts:true,days_before_due:2,autopay_confirmation_delay_hours:6,quiet_hours_start:'22:00',quiet_hours_end:'07:00' },
};
globalThis.__paygaugeSchedulerMock = {
  Capacitor: {isNativePlatform:()=>device.native}, registerPlugin:()=>({}),
  LocalNotifications: {
    async getPending() {
      device.reads++;
      device.activeReads++;
      device.maxReads=Math.max(device.maxReads,device.activeReads);
      await new Promise(resolve=>setTimeout(resolve,5));
      device.activeReads--;
      return {notifications:device.pending};
    },
    async checkPermissions(){return {display:device.permission};},
    async cancel(options){device.canceled.push(options);},
    async createChannel(options){device.channels.push(options);},
    async registerActionTypes(options){device.actionTypes=options;},
    async schedule(options){if(device.fail) throw new Error('Native alarm failure');device.scheduled.push(options);},
  },
  async exportBackupJson(){return structuredClone(backup);},
};
const mockURL = 'data:text/javascript,' + encodeURIComponent(`
  export const {Capacitor,registerPlugin,LocalNotifications,exportBackupJson}=globalThis.__paygaugeSchedulerMock;
`);
const hooks=registerHooks({resolve(specifier, context, nextResolve){
  if (specifier==='@capacitor/core' || specifier==='@capacitor/local-notifications' ||
      (specifier==='./api' && context.parentURL?.endsWith('/notifications.ts'))) {
    return {url:mockURL,shortCircuit:true};
  }
  if(specifier==='./notification-schedule' && context.parentURL?.endsWith('/notifications.ts')){
    return nextResolve('./notification-schedule.ts',context);
  }
  return nextResolve(specifier,context);
}});
const { refreshDeviceReminders } = await import('../src/lib/notifications.ts');
after(()=>{hooks.deregister();delete globalThis.__paygaugeSchedulerMock;});
beforeEach(()=>{
  Object.assign(device,{native:true,permission:'granted',pending:[],scheduled:[],canceled:[],channels:[],fail:false,reads:0,activeReads:0,maxReads:0});
});

test('native scheduler replaces only managed reminders, retaining account tap metadata and unmanaged IDs',async()=>{
  const id=buildDeviceReminders(backup.loans,backup.notification_preferences)[0].id;
  device.pending=[{id:42,extra:{paygaugeAutomatic:true}},{id,extra:{type:'test'}},{id:99}];
  const before=structuredClone(backup);
  assert.match(await refreshDeviceReminders(),/3 automatic reminders scheduled/);
  assert.deepEqual(device.canceled,[{notifications:[{id:42}]}]);
  assert.equal(device.channels.length,1);
  const scheduled=device.scheduled[0].notifications;
  assert.equal(scheduled.length,3);
  assert.ok(scheduled.every(item=>item.id!==id && item.id!==99));
  assert.ok(scheduled.every(item=>item.extra.loanId==='loan' && item.extra.paygaugeAutomatic===true && item.schedule.at instanceof Date && item.schedule.allowWhileIdle));
  assert.deepEqual(device.actionTypes,{types:[{id:'TALLY_PAYMENT',actions:[{id:'mark-paid',title:'Mark paid'}]}]});
  assert.ok(scheduled.some(item=>item.actionTypeId==='TALLY_PAYMENT' && item.extra.dueDate===date && item.extra.amount===50));
  assert.ok(scheduled.filter(item=>item.extra.type==='autopay_scheduled').every(item=>item.actionTypeId===undefined));
  assert.deepEqual(backup,before);
});
test('permission denial cancels automatic reminders without scheduling new alarms or disturbing tests',async()=>{
  device.permission='denied';
  device.pending=[{id:42,extra:{paygaugeAutomatic:true}},{id:50,extra:{type:'test'}}];
  assert.match(await refreshDeviceReminders(),/Allow notifications/);
  assert.deepEqual(device.canceled,[{notifications:[{id:42}]}]);
  assert.equal(device.scheduled.length,0);
});
test('native failures propagate and subsequent refresh recovers',async()=>{
  device.fail=true;
  await assert.rejects(refreshDeviceReminders(),/Native alarm failure/);
  device.fail=false;
  assert.match(await refreshDeviceReminders(),/3 automatic reminders/);
});
test('simultaneous refresh requests serialize native changes',async()=>{
  await Promise.all([refreshDeviceReminders(),refreshDeviceReminders(),refreshDeviceReminders()]);
  assert.equal(device.reads,3);
  assert.equal(device.maxReads,1);
  assert.equal(device.scheduled.length,3);
});
test('browser refresh does not call native plugins',async()=>{
  device.native=false;
  assert.equal(await refreshDeviceReminders(),null);
  assert.equal(device.reads,0);
  assert.equal(device.scheduled.length,0);
});
