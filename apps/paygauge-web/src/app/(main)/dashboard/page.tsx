"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, Sparkles, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import {
  type DashboardSummary,
  type NotificationItem,
  formatDate,
  formatMoney,
  getDashboardSummary,
  getNotificationQueue,
  getSnoozedNotificationIds,
  milestoneLabel,
  recordLoanPayment,
  relativeDueText,
  seedDemoData,
  snoozeNotification,
} from "../../../lib/api";

export default function Page() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [recordingNotification, setRecordingNotification] = useState(false);
  const [confirmingNotification, setConfirmingNotification] = useState<NotificationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      const [summaryData, notificationData] = await Promise.all([getDashboardSummary(), getNotificationQueue()]);
      setSummary(summaryData);
      setNotificationItems(notificationData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard is unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleSeedDemo() {
    setSeeding(true);
    setError(null);
    try {
      await seedDemoData(true);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo data");
    } finally {
      setSeeding(false);
      setLoading(false);
    }
  }

  async function confirmAutopayPayment(item: NotificationItem) {
    setRecordingNotification(true);
    setError(null);
    try {
      await recordLoanPayment(item.loan_id, {
        amount: item.amount,
        payment_date: new Date().toISOString().slice(0, 10),
        notes: "Confirmed from PayGauge notification queue",
        source: "autopay-confirmed",
      });
      setConfirmingNotification(null);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm autopay");
    } finally {
      setRecordingNotification(false);
    }
  }

  function snooze(item: NotificationItem, minutes = 60) {
    snoozeNotification(item.id, minutes);
    setNotificationItems((items) => [...items]);
  }

  const snoozedNotificationIds = getSnoozedNotificationIds();
  const needsConfirmation = notificationItems.filter((item) => item.action_required && !snoozedNotificationIds.has(item.id));
  const closestLoan = summary?.next_payment;
  const upcomingAfterNext = summary?.upcoming_payments.filter((loan) => loan.id !== closestLoan?.id) ?? [];

  return (
    <>
      <header className="pg-header">
        <div className="pg-brand">
          <img className="pg-brand-mark" src="/brand/PayGauge_Logo_Mark.png" alt="PayGauge" />
          <div className="pg-brand-copy">
            <strong>PayGauge</strong>
            <span>See what's left.</span>
          </div>
        </div>
        <Link className="pg-icon-button" href="/settings" aria-label="Settings">
          <UserCircle aria-hidden="true" />
        </Link>
      </header>

      <h1 className="pg-greeting">Good morning, James!</h1>
      <p className="pg-muted">You're making progress.</p>

      {closestLoan ? (
        <article className="pg-insight-card" style={{ marginTop: 14 }}>
          <Sparkles aria-hidden="true" />
          <div>
            <strong>{closestLoan.payments_remaining} payments left on {closestLoan.name}</strong>
            <span>{relativeDueText(closestLoan.next_due_date)}. {milestoneLabel(closestLoan.payments_remaining, closestLoan.progress_percentage) ?? "Keep the payoff count moving."}</span>
          </div>
        </article>
      ) : null}

      {error ? <p className="pg-error">{error}</p> : null}

      <section className="pg-grid-2" style={{ marginTop: 16 }}>
        <div className="pg-stat"><span>Total Remaining</span><strong>{loading ? "..." : formatMoney(summary?.total_remaining_balance ?? 0)}</strong></div>
        <div className="pg-stat"><span>Monthly Payments</span><strong>{loading ? "..." : formatMoney(summary?.total_monthly_payments ?? 0)}</strong></div>
        <div className="pg-stat"><span>Total Payments Left</span><strong>{loading ? "..." : summary?.total_payments_remaining ?? 0}</strong></div>
        <div className="pg-stat"><span>Loans Completed</span><strong>{loading ? "..." : summary?.loans_completed ?? 0}</strong></div>
      </section>

      <section className="pg-section-head">
        <h2>Next Payment</h2>
        <Link className="pg-link" href="/calendar">See All</Link>
      </section>

      {summary?.next_payment ? (
        <article className="pg-list-card">
          <div className="pg-row">
            <div className="pg-left">
              <span className={`pg-token ${categoryTone(summary.next_payment.category)}`}><LoanCategoryIcon category={summary.next_payment.category} /></span>
              <div>
                <p className="pg-name">{summary.next_payment.name}</p>
                <p className="pg-detail">{formatMoney(summary.next_payment.payment_amount, 2)}</p>
                <p className="pg-detail">{formatDate(summary.next_payment.next_due_date)}</p>
              </div>
            </div>
            <span className="pg-pill">Next</span>
          </div>
        </article>
      ) : (
        <article className="pg-empty-card">
          <strong>No payments due yet</strong>
          <span>Add a loan to see the next due payment.</span>
          <button className="pg-button" disabled={seeding} onClick={() => void handleSeedDemo()}>{seeding ? "Loading..." : "Load Demo Data"}</button>
        </article>
      )}

      {needsConfirmation.length ? (
        <>
          <section className="pg-section-head"><h2>Needs Confirmation</h2></section>
          <div className="pg-stack">
            {needsConfirmation.map((item) => (
              <article className="pg-list-card" key={item.id}>
                <div className="pg-row">
                  <div className="pg-left">
                    <span className={`pg-token ${categoryTone(item.category)}`}><BellRing aria-hidden="true" /></span>
                    <div>
                      <p className="pg-name">{item.title}</p>
                      <p className="pg-detail">{item.body}</p>
                    </div>
                  </div>
                </div>
                <div className="pg-action-row" style={{ marginTop: 10 }}>
                  <button className="pg-button" type="button" onClick={() => setConfirmingNotification(item)}><CheckCircle2 aria-hidden="true" /> Paid</button>
                  <button className="pg-button dark" type="button" onClick={() => snooze(item)}><BellRing aria-hidden="true" /> Snooze</button>
                </div>
                <button className="pg-link" type="button" onClick={() => snooze(item, 1440)} style={{ background: "transparent", border: 0, padding: "9px 0 0" }}>
                  Not processed today
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {upcomingAfterNext.length ? (
        <>
          <section className="pg-section-head"><h2>Upcoming</h2><Link className="pg-link" href="/calendar">Calendar</Link></section>
          <div className="pg-stack">
            {upcomingAfterNext.slice(0, 3).map((loan) => (
              <Link className="pg-list-card" href={`/loans/detail?id=${loan.id}`} key={loan.id}>
                <div className="pg-row">
                  <div className="pg-left">
                    <span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span>
                    <div><p className="pg-name">{loan.name}</p><p className="pg-detail">{formatDate(loan.next_due_date)}</p></div>
                  </div>
                  <strong>{formatMoney(loan.payment_amount, 2)}</strong>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <section className="pg-section-head"><h2>Active Loans</h2><Link className="pg-link" href="/loans">Manage</Link></section>

      <div className="pg-stack">
        {summary?.active_loans.map((loan) => (
          <Link className="pg-loan-card" href={`/loans/detail?id=${loan.id}`} key={loan.id}>
            <div className="pg-row">
              <div className="pg-left">
                <span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span>
                <div><p className="pg-name">{loan.name}</p><p className="pg-detail">{formatMoney(loan.payment_amount, 2)}/month</p></div>
              </div>
              <div className="pg-amount"><strong>{formatMoney(loan.current_balance)}</strong><span>remaining</span></div>
            </div>
            <div className="pg-progress"><span style={{ width: `${Math.max(3, loan.progress_percentage)}%` }} /></div>
            <div className="pg-progress-meta">
              <span>{milestoneLabel(loan.payments_remaining, loan.progress_percentage) ?? `${loan.payments_remaining} payments left`}</span>
              <span>{relativeDueText(loan.next_due_date)}</span>
            </div>
          </Link>
        ))}

        {!loading && summary?.active_loans.length === 0 ? (
          <article className="pg-empty-card">
            <strong>No active loans</strong>
            <span>Add your first loan to start tracking what is left.</span>
            <button className="pg-button secondary" disabled={seeding} onClick={() => void handleSeedDemo()}>{seeding ? "Loading..." : "Load Demo Data"}</button>
            <Link className="pg-button" href="/loans/new">Add Loan</Link>
          </article>
        ) : null}
      </div>

      {confirmingNotification ? (
        <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm autopay">
          <section className="pg-modal">
            <h2 style={{ margin: 0 }}>Confirm Autopay</h2>
            <p className="pg-muted">Only continue if {confirmingNotification.loan_name}'s {formatMoney(confirmingNotification.amount, 2)} autopay actually processed.</p>
            <div className="pg-detail-list">
              <div className="pg-detail-line"><span>Payments Left After</span><strong>{confirmingNotification.payments_remaining_after}</strong></div>
              <div className="pg-detail-line"><span>Source</span><strong>Autopay Confirmed</strong></div>
            </div>
            <div className="pg-action-row">
              <button className="pg-button dark" type="button" onClick={() => setConfirmingNotification(null)}>Cancel</button>
              <button className="pg-button" type="button" disabled={recordingNotification} onClick={() => void confirmAutopayPayment(confirmingNotification)}>Confirm Paid</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
