"use client";

import Link from "next/link";
import { ArrowLeft, Bell, CheckCircle2, ChevronRight, Clock3, DatabaseBackup, Download, FileUp, Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { exportBackupJson, formatMoney, getNotificationPreferences, getNotificationPreviews, importBackupJson, type BackupPayload, type NotificationItem, type NotificationPreferences, updateNotificationPreferences } from "../../../lib/api";
import { getLastBackupLabel, readBackupFile, saveBackupFile } from "../../../lib/backup";
import { requestDeviceNotificationPermission, sendLocalTestNotification } from "../../../lib/notifications";

const reminderSettings: { key: keyof NotificationPreferences; name: string; description: string }[] = [
  { key: "payment_reminders", name: "Payment Reminders", description: "Get notified before payments are due" },
  { key: "autopay_reminders", name: "Autopay Reminders", description: "Notify when autopay is scheduled" },
  { key: "payment_confirmations", name: "Payment Confirmations", description: "Remind me to confirm autopay" },
  { key: "milestone_alerts", name: "Milestone Alerts", description: "Notify for 10, 5, and final payments" },
];

export default function Page() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [previews, setPreviews] = useState<NotificationItem[]>([]);
  const [permission, setPermission] = useState("default");
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState("Never");
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    setError(null);
    try {
      const [preferenceData, previewData] = await Promise.all([getNotificationPreferences(), getNotificationPreviews()]);
      setPreferences(preferenceData);
      setPreviews(previewData.items);
      if ("Notification" in window) setPermission(Notification.permission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notification settings are unavailable");
    }
  }

  useEffect(() => {
    void loadNotifications();
    setLastBackup(getLastBackupLabel());
  }, []);

  async function updatePreference(payload: Partial<NotificationPreferences>) {
    try {
      setPreferences(await updateNotificationPreferences(payload));
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update notification settings");
    }
  }

  async function requestPermission() {
    const result = await requestDeviceNotificationPermission();
    setPermission(result);
  }

  async function sendTest() {
    const item = previews[0];
    if (!item) {
      setDeliveryStatus("Add a loan to generate a preview first.");
      return;
    }
    const result = await sendLocalTestNotification(item);
    setDeliveryStatus(result === "permission-needed" ? "Permission needed before sending." : `Test notification ${result}.`);
  }

  async function exportBackup() {
    setExporting(true);
    setBackupStatus(null);
    try {
      const backup = await exportBackupJson();
      setBackupStatus(await saveBackupFile(backup));
      setLastBackup(getLastBackupLabel());
    } finally {
      setExporting(false);
    }
  }

  async function handleBackupFile(file: File | undefined) {
    if (!file) return;
    setBackupStatus(null);
    try {
      setPendingImport(await readBackupFile(file));
    } catch {
      setBackupStatus("That file could not be read as a PayGauge backup.");
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    setBackupStatus(null);
    try {
      const result = await importBackupJson(pendingImport, true);
      setBackupStatus(`Imported ${result.imported_loans} loans and ${result.imported_payments} payments.`);
      setPendingImport(null);
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : "Backup import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <header className="pg-header">
        <Link className="pg-link" href="/dashboard"><ArrowLeft aria-hidden="true" /> Back</Link>
        <h1 className="pg-title" style={{ fontSize: 16 }}>Settings</h1>
        <span />
      </header>

      {error ? <p className="pg-error">{error}</p> : null}

      <section className="pg-card">
        <div className="pg-row" style={{ marginBottom: 14 }}>
          <div className="pg-left"><Bell aria-hidden="true" style={{ width: 18, height: 18 }} /><h2>Notifications</h2></div>
        </div>
        <div className="pg-stack">
          {reminderSettings.map((setting) => (
            <button className="pg-row pg-setting-button" type="button" key={setting.key} disabled={!preferences} onClick={() => preferences && void updatePreference({ [setting.key]: !preferences[setting.key] })}>
              <div><p className="pg-name">{setting.name}</p><p className="pg-detail">{setting.description}</p></div>
              <span className={`pg-switch ${preferences?.[setting.key] ? "" : "off"}`}><span /></span>
            </button>
          ))}

          <div className="pg-grid-2">
            <div className="pg-field">
              <label>Days Before Due</label>
              <input className="pg-input" inputMode="numeric" value={preferences?.days_before_due ?? 2} onChange={(event) => void updatePreference({ days_before_due: Number(event.target.value) })} />
            </div>
            <div className="pg-field">
              <label>Confirm After Hours</label>
              <input className="pg-input" inputMode="numeric" value={preferences?.autopay_confirmation_delay_hours ?? 6} onChange={(event) => void updatePreference({ autopay_confirmation_delay_hours: Number(event.target.value) })} />
            </div>
          </div>

          <div className="pg-grid-2">
            <div className="pg-field">
              <label>Quiet Starts</label>
              <input className="pg-input" type="time" value={(preferences?.quiet_hours_start ?? "22:00").slice(0, 5)} onChange={(event) => void updatePreference({ quiet_hours_start: `${event.target.value}:00` })} />
            </div>
            <div className="pg-field">
              <label>Quiet Ends</label>
              <input className="pg-input" type="time" value={(preferences?.quiet_hours_end ?? "07:00").slice(0, 5)} onChange={(event) => void updatePreference({ quiet_hours_end: `${event.target.value}:00` })} />
            </div>
          </div>

          <button className="pg-button secondary" type="button" onClick={() => void requestPermission()}>
            <Bell aria-hidden="true" /> Notification Permission: {permission}
          </button>
          <button className="pg-button" type="button" onClick={() => void sendTest()}>
            <Bell aria-hidden="true" /> Send Test Reminder
          </button>
          {deliveryStatus ? <p className="pg-muted">{deliveryStatus}</p> : null}
        </div>
      </section>

      <section className="pg-card" style={{ marginTop: 14 }}>
        <div className="pg-row" style={{ marginBottom: 14 }}>
          <div className="pg-left"><Settings aria-hidden="true" style={{ width: 18, height: 18 }} /><h2>Backup</h2></div>
        </div>
        <div className="pg-detail-list">
          <div className="pg-detail-line"><span><DatabaseBackup aria-hidden="true" /> Last Backup</span><strong>{lastBackup}</strong></div>
          <button className="pg-detail-line pg-setting-button" type="button" onClick={() => void exportBackup()} disabled={exporting}>
            <span><Download aria-hidden="true" /> Export Backup</span><strong>{exporting ? "Exporting" : "Save"} <ChevronRight aria-hidden="true" /></strong>
          </button>
          <label className="pg-detail-line pg-setting-button">
            <span><FileUp aria-hidden="true" /> Import Backup</span><strong>Choose File <ChevronRight aria-hidden="true" /></strong>
            <input type="file" accept="application/json,.json" onChange={(event) => void handleBackupFile(event.target.files?.[0])} style={{ display: "none" }} />
          </label>
        </div>
        {backupStatus ? <p className="pg-muted" style={{ marginTop: 12 }}>{backupStatus}</p> : null}
      </section>

      <section className="pg-section-head"><h2>Notification Preview</h2></section>
      <div className="pg-stack">
        {previews.map((item) => (
          <article className="pg-notification" key={item.id}>
            <div className="pg-row"><strong>PayGauge</strong><span>{item.type.replaceAll("_", " ")}</span></div>
            <div className="pg-left">
              <Bell aria-hidden="true" />
              <div><strong>{item.title}</strong><p style={{ margin: "4px 0 0" }}>{item.body}</p></div>
            </div>
            {item.action_required ? (
              <div className="pg-grid-2">
                <button className="pg-button" style={{ minHeight: 38 }}><CheckCircle2 aria-hidden="true" /> Mark Paid</button>
                <button className="pg-button dark" style={{ minHeight: 38 }}><Clock3 aria-hidden="true" /> Snooze</button>
              </div>
            ) : null}
          </article>
        ))}

        {!previews.length ? <article className="pg-empty-card"><strong>No previews yet</strong><span>Add a loan with a due date to generate notification examples from real data.</span></article> : null}
      </div>

      {pendingImport ? (
        <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Import backup">
          <section className="pg-modal">
            <h2 style={{ margin: 0 }}>Import Backup</h2>
            <p className="pg-muted">This will replace local PayGauge data with {pendingImport.loans.length} loans and {pendingImport.payments.length} payments from the selected backup.</p>
            <div className="pg-action-row">
              <button className="pg-button dark" type="button" onClick={() => setPendingImport(null)}>Cancel</button>
              <button className="pg-button" type="button" disabled={importing} onClick={() => void confirmImport()}>{importing ? "Importing" : "Import"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
