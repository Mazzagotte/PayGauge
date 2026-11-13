"use client";

import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { markPaidFromReminder, refreshDeviceReminders } from "../../lib/notifications";
import { MARK_PAID_ACTION } from "../../lib/notification-schedule";

export function NotificationScheduler() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const refresh = () => {
      void refreshDeviceReminders().then(status => {
        if (!active) return;
        setError(null);
        window.dispatchEvent(new CustomEvent("paygauge:reminder-status", { detail: status }));
      }).catch(err => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Unable to schedule reminders.";
        setError(message);
        window.dispatchEvent(new CustomEvent("paygauge:reminder-status", { detail: `Scheduling failed: ${message}` }));
      });
    };
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    const listener = import("@capacitor/local-notifications").then(({ LocalNotifications }) =>
      LocalNotifications.addListener("localNotificationActionPerformed", action => {
        const extra = action.notification.extra as Record<string, unknown> | undefined;
        const id: unknown = extra?.loanId;
        if (action.actionId === MARK_PAID_ACTION) {
          void markPaidFromReminder(extra).then(result => {
            if (!active) return;
            setNotice(result.status === "recorded" ? `Recorded payment for ${result.loanName}.` : result.status === "already-recorded" ? `${result.loanName} was already recorded.` : null);
            if (typeof id === "string" && id && result.status !== "missing") router.push(`/loans/detail/?id=${encodeURIComponent(id)}`);
          }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to record that payment."); });
          return;
        }
        if (typeof id === "string" && id) router.push(`/loans/detail/?id=${encodeURIComponent(id)}`);
      }));
    void listener.catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to open notification actions."); });
    refresh();
    window.addEventListener("paygauge:state-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      window.removeEventListener("paygauge:state-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
      void listener.then(handle => handle.remove()).catch(err => console.error("Notification listener cleanup failed", err));
    };
  }, [router]);
  if (error) return <p className="pg-error" role="alert">Automatic reminders could not be updated: {error}</p>;
  return notice ? <div className="pg-toast" role="status">{notice}</div> : null;
}
