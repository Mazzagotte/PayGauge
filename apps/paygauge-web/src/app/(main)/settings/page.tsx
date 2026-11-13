"use client";

import Link from "next/link";
import { PageHeader } from "../../../components/navigation/PageHeader";
import { Bell, ChartPie, ChevronRight, Download, FileUp, Info, ShieldCheck, SunMoon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { exportBackupJson, getNotificationPreferences, getNotificationPreviews, importBackupJson, type BackupPayload, type NotificationItem, type NotificationPreferences, updateNotificationPreferences } from "../../../lib/api";
import { getLastBackupLabel, readBackupFile, saveBackupFile } from "../../../lib/backup";
import { getThemePref, setThemePref, type ThemePref } from "../../../lib/theme";
import { getDeviceNotificationPermission, openNotificationSettings, requestDeviceNotificationPermission, sendLocalTestNotification, refreshDeviceReminders } from "../../../lib/notifications";

const reminderSettings = [
  { key: "payment_reminders", name: "Payments coming due", description: "A heads-up before each due date" },
  { key: "autopay_reminders", name: "Autopay days", description: "When an autopay is scheduled" },
  { key: "payment_confirmations", name: "Confirm autopay", description: "Check that autopay went through" },
  { key: "milestone_alerts", name: "Payoff milestones", description: "10, 5 and 1 payments left" },
] as const;

const permissionLabels: Record<string, string> = {
  loading: "Checking permission",
  default: "Permission not requested",
  prompt: "Permission not requested",
  "prompt-with-rationale": "Permission needed",
  granted: "Permission granted",
  denied: "Notifications blocked",
  unsupported: "Notifications unavailable",
  error: "Permission check failed",
};

export default function Page() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [previews, setPreviews] = useState<NotificationItem[]>([]);
  const [permission, setPermission] = useState("loading");
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState("Checking");
  const [pendingImport, setPendingImport] = useState<{ payload: BackupPayload; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const [timing, setTiming] = useState({ days: "2", hours: "6", start: "22:00", end: "07:00" });
  const [theme, setTheme] = useState<ThemePref>("system");
  const [showHelp, setShowHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const importDialog = useRef<HTMLDialogElement>(null);

  async function loadNotifications() {
    const [preferenceData, previewData] = await Promise.all([getNotificationPreferences(), getNotificationPreviews()]);
    setPreferences(preferenceData);
    setPreviews(previewData.items);
    setTiming({
      days: String(preferenceData.days_before_due),
      hours: String(preferenceData.autopay_confirmation_delay_hours),
      start: preferenceData.quiet_hours_start.slice(0, 5),
      end: preferenceData.quiet_hours_end.slice(0, 5),
    });
  }

  async function refreshPermission() {
    try {
      setPermission(await getDeviceNotificationPermission());
    } catch (err) {
      setPermission("error");
      setDeliveryStatus(err instanceof Error ? err.message : "Unable to check notification permission.");
    }
  }

  useEffect(() => {
    const onScheduleStatus = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string") setScheduleStatus(event.detail);
    };
    window.addEventListener("paygauge:reminder-status", onScheduleStatus);
    setTheme(getThemePref());
    void refreshDeviceReminders().then(setScheduleStatus).catch(err => setScheduleStatus(`Scheduling failed: ${err instanceof Error ? err.message : "Unknown error"}`));
    void loadNotifications().catch(err => setError(err instanceof Error ? err.message : "Unable to load reminder preferences."));
    void refreshPermission();
    try {
      setLastBackup(getLastBackupLabel());
    } catch (err) {
      setLastBackup("Unavailable");
      setBackupError(err instanceof Error ? err.message : "Unable to read the last export date.");
    }
    window.addEventListener("focus", refreshPermission);
    return () => {
      window.removeEventListener("focus", refreshPermission);
      window.removeEventListener("paygauge:reminder-status", onScheduleStatus);
    };
  }, []);

  useEffect(() => {
    if (pendingImport) importDialog.current?.showModal();
    else importDialog.current?.close();
  }, [pendingImport]);

  async function updatePreference(payload: Partial<NotificationPreferences>) {
    setSaving(true);
    setError(null);
    setPreferenceStatus(null);
    try {
      setPreferences(await updateNotificationPreferences(payload));
      setPreviews((await getNotificationPreviews()).items);
      setPreferenceStatus("Reminder preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save reminder preferences.");
    } finally {
      setSaving(false);
    }
  }

  function saveTiming(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d+$/.test(timing.days) || Number(timing.days) > 30 ||
      !/^\d+$/.test(timing.hours) || Number(timing.hours) < 1 || Number(timing.hours) > 24 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(timing.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timing.end)) {
      setError("Use 0-30 days, 1-24 hours, and valid quiet-hour times.");
      return;
    }
    void updatePreference({
      days_before_due: Number(timing.days),
      autopay_confirmation_delay_hours: Number(timing.hours),
      quiet_hours_start: `${timing.start}:00`,
      quiet_hours_end: `${timing.end}:00`,
    });
  }

  async function notificationAction(action: "permission" | "settings" | "test") {
    setDelivering(true);
    setDeliveryStatus(null);
    try {
      if (action === "permission") {
        const result = await requestDeviceNotificationPermission();
        setPermission(result);
        setDeliveryStatus(result === "granted" ? "Notification permission granted." : permissionLabels[result] ?? "Permission was not granted.");
      } else if (action === "settings") {
        if (await openNotificationSettings() === "unsupported") {
          setDeliveryStatus("In this browser, open site permissions next to the address bar and allow notifications.");
        }
      } else {
        const item = previews[0];
        if (!item) {
          setDeliveryStatus("No reminder preview is available. Enable a reminder type for an active payment first.");
          return;
        }
        const result = await sendLocalTestNotification(item);
        setDeliveryStatus(result === "sent" ? "Test notification sent." : result === "scheduled" ? "Test notification scheduled for delivery in one second." :
          result === "unsupported" ? "Notifications are unavailable on this device." : "Allow notification permission before sending a test.");
        await refreshPermission();
      }
    } catch (err) {
      setDeliveryStatus(err instanceof Error ? err.message : "Notification action failed.");
    } finally {
      setDelivering(false);
    }
  }

  async function exportBackup() {
    setExporting(true);
    setBackupStatus(null);
    setBackupError(null);
    try {
      setBackupStatus(await saveBackupFile(await exportBackupJson()));
      setLastBackup(getLastBackupLabel());
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Backup export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleBackupFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setPendingImport(null);
    setBackupStatus(null);
    setBackupError(null);
    try {
      setPendingImport({ payload: await readBackupFile(file), name: file.name });
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "That file could not be read as a Tally backup.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    setBackupStatus(null);
    setBackupError(null);
    try {
      const result = await importBackupJson(pendingImport.payload, true);
      setBackupStatus(`Restored ${result.imported_loans} accounts and ${result.imported_payments} recorded payments.${result.skipped_payments ? ` Skipped ${result.skipped_payments} payments without matching accounts.` : ""}`);
      setPendingImport(null);
      try {
        await loadNotifications();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Backup restored, but reminder settings could not be refreshed.");
      }
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Backup import failed.");
    } finally {
      setImporting(false);
    }
  }

  const backupBusy = exporting || importing || reading;
  return (
    <>
      <PageHeader title="More" subtitle="Settings, backups and reminders." />

      <section className="pg-group" aria-label="General">
        <Link className="pg-group-row" href="/income/">
          <span className="pg-group-icon"><ChartPie aria-hidden="true" /></span>
          <span className="pg-group-copy"><b>Income breakdown</b><span>How much of your pay goes to payments</span></span>
          <ChevronRight className="pg-chev" aria-hidden="true" />
        </Link>
        <div className="pg-group-row">
          <span className="pg-group-icon"><SunMoon aria-hidden="true" /></span>
          <span className="pg-group-copy"><b>Appearance</b></span>
          <div className="pg-segmented pg-theme-seg" role="radiogroup" aria-label="Appearance">
            {([["system", "Auto"], ["light", "Light"], ["dark", "Dark"]] as const).map(([value, label]) => (
              <button type="button" role="radio" aria-checked={theme === value} className={theme === value ? "active" : ""} key={value}
                onClick={() => { setTheme(value); setThemePref(value); }}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <h2 className="pg-group-title" id="backup-heading">Backup</h2>
      <section className="pg-group" aria-labelledby="backup-heading">
        <button className="pg-group-row" type="button" onClick={() => void exportBackup()} disabled={backupBusy}>
          <span className="pg-group-icon"><Download aria-hidden="true" /></span>
          <span className="pg-group-copy"><b>{exporting ? "Exporting…" : "Export backup"}</b><span>Last export: {lastBackup}</span></span>
          <ChevronRight className="pg-chev" aria-hidden="true" />
        </button>
        <button className="pg-group-row" type="button" onClick={() => fileInput.current?.click()} disabled={backupBusy}>
          <span className="pg-group-icon"><FileUp aria-hidden="true" /></span>
          <span className="pg-group-copy"><b>{reading ? "Reading…" : "Restore from backup"}</b><span>Replaces everything on this phone</span></span>
          <ChevronRight className="pg-chev" aria-hidden="true" />
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Choose Tally backup" onChange={(event) => void handleBackupFile(event.target.files?.[0])} hidden />
      </section>
      {backupStatus ? <p className="pg-status" role="status">{backupStatus}</p> : null}
      {backupError && !pendingImport ? <p className="pg-error" role="alert">{backupError}</p> : null}

      <h2 className="pg-group-title" id="notifications-heading">Reminders</h2>
      <section className="pg-group" aria-labelledby="notifications-heading">
        <div className="pg-group-row">
          <span className={`pg-group-icon ${permission === "granted" ? "good" : ""}`}><Bell aria-hidden="true" /></span>
          <span className="pg-group-copy"><b>{permissionLabels[permission] ?? "Permission needed"}</b><span>{permission === "granted" ? "Reminders arrive at 9 AM on due dates" : "Turn on to get due-date reminders"}</span></span>
          {permission !== "granted" && permission !== "unsupported" && permission !== "denied" ? (
            <button className="pg-button small" type="button" disabled={delivering || permission === "loading"} onClick={() => void notificationAction("permission")}>Allow</button>
          ) : permission === "denied" ? (
            <button className="pg-button small secondary" type="button" disabled={delivering} onClick={() => void notificationAction("settings")}>Settings</button>
          ) : null}
        </div>
        {reminderSettings.map(setting => (
          <button className="pg-group-row" type="button" role="switch" key={setting.key} aria-checked={Boolean(preferences?.[setting.key])} disabled={!preferences || saving || importing} onClick={() => preferences && void updatePreference({ [setting.key]: !preferences[setting.key] })}>
            <span className="pg-group-copy"><b>{setting.name}</b><span>{setting.description}</span></span>
            <span aria-hidden="true" className={`pg-switch ${preferences?.[setting.key] ? "" : "off"}`}><span /></span>
          </button>
        ))}
        <button className="pg-group-row" type="button" disabled={delivering || permission !== "granted" || !previews.length} onClick={() => void notificationAction("test")}>
          <span className="pg-group-copy"><b>Send a test reminder</b></span>
          <ChevronRight className="pg-chev" aria-hidden="true" />
        </button>
        <button className="pg-group-row" type="button" onClick={() => setShowHelp(true)}>
          <span className="pg-group-copy"><b>How reminders work</b></span>
          <Info className="pg-chev" aria-hidden="true" />
        </button>
      </section>
      {deliveryStatus ? <p className="pg-status" role="status">{deliveryStatus}</p> : null}
      {error ? <p className="pg-error" role="alert">{error}</p> : null}
      {preferenceStatus ? <p className="pg-status" role="status">{preferenceStatus}</p> : null}

      <details className="pg-group pg-settings-advanced">
        <summary className="pg-group-row"><span className="pg-group-copy"><b>Reminder timing</b><span>{timing.days} days before · quiet {timing.start}–{timing.end}</span></span><ChevronRight className="pg-chev" aria-hidden="true" /></summary>
        <form onSubmit={saveTiming}>
          <div className="pg-grid-2 pg-settings-grid">
            <div className="pg-field">
              <label htmlFor="reminder-days">Days before due</label>
              <input id="reminder-days" className="pg-input" type="number" inputMode="numeric" min="0" max="30" step="1" required disabled={!preferences || saving || importing} value={timing.days} onChange={event => setTiming({ ...timing, days: event.target.value })} />
            </div>
            <div className="pg-field">
              <label htmlFor="reminder-hours">Confirm autopay after</label>
              <input id="reminder-hours" className="pg-input" type="number" inputMode="numeric" min="1" max="24" step="1" required disabled={!preferences || saving || importing} value={timing.hours} onChange={event => setTiming({ ...timing, hours: event.target.value })} />
            </div>
          </div>
          <div className="pg-grid-2 pg-settings-grid">
            <div className="pg-field"><label htmlFor="quiet-start">Quiet from</label><input id="quiet-start" className="pg-input" type="time" required disabled={!preferences || saving || importing} value={timing.start} onChange={event => setTiming({ ...timing, start: event.target.value })} /></div>
            <div className="pg-field"><label htmlFor="quiet-end">Quiet until</label><input id="quiet-end" className="pg-input" type="time" required disabled={!preferences || saving || importing} value={timing.end} onChange={event => setTiming({ ...timing, end: event.target.value })} /></div>
          </div>
          <button className="pg-button secondary" type="submit" disabled={!preferences || saving || importing}>{saving ? "Saving…" : "Save timing"}</button>
        </form>
      </details>

      <p className="pg-footnote"><ShieldCheck aria-hidden="true" /> Your data stays on this phone and isn&apos;t synced. Export a backup before switching phones.</p>

      {showHelp ? (
        <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-heading" onClick={(event) => { if (event.target === event.currentTarget) setShowHelp(false); }}>
          <section className="pg-modal">
            <h2 id="help-heading">How reminders work</h2>
            <ul className="pg-help-list">
              <li>Reminders are scheduled for each account&apos;s next due date at 9 AM, even when Tally is closed.</li>
              <li>Tap <b>Mark paid</b> on a reminder to record the payment without opening the app.</li>
              <li>Autopay reminders are not proof of payment. Confirm once it actually goes through.</li>
              <li>Quiet hours push reminders to the end of the quiet window. Old overdue dates are skipped.</li>
              <li>Dates refresh when you open the app or change data. Android may delay delivery to save battery.</li>
            </ul>
            {scheduleStatus ? <p className="pg-status" role="status">{scheduleStatus}</p> : null}
            <button className="pg-button secondary" type="button" onClick={() => setShowHelp(false)}>Got it</button>
          </section>
        </div>
      ) : null}

      <dialog ref={importDialog} className="pg-modal pg-import-dialog" aria-labelledby="import-heading" onCancel={event => { if (importing) event.preventDefault(); else setPendingImport(null); }} onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!importing) setPendingImport(null);
        }
      }}>
        {pendingImport ? (
          <>
            <h2 id="import-heading">Replace local data?</h2>
            <p className="pg-muted pg-import-filename">{pendingImport.name}</p>
            <p className="pg-muted">Restore {pendingImport.payload.loans.length} accounts and {pendingImport.payload.payments.length} recorded payments. This replaces your current accounts, history, income, and reminder preferences. Older backups without income clear that setting. It cannot be undone without another backup.</p>
            {backupError ? <p className="pg-error" role="alert">{backupError}</p> : null}
            <div className="pg-action-row">
              <button className="pg-button secondary" type="button" disabled={importing} onClick={() => setPendingImport(null)}>Cancel</button>
              <button className="pg-button" type="button" disabled={importing || saving} onClick={() => void confirmImport()}>{importing ? "Restoring..." : "Replace data"}</button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
