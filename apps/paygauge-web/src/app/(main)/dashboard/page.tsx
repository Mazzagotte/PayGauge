"use client";

import Link from "next/link";
import { PageHeader } from "../../../components/navigation/PageHeader";
import { ProgressRing } from "../../../components/ProgressRing";
import { BellRing, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import {
  type DashboardSummary,
  type NotificationItem,
  currentLocalDate,
  formatDate,
  formatMoney,
  formatNumber,
  getDashboardSummary,
  getNotificationQueue,
  getSnoozedNotificationIds,
  recordLoanPayment,
  relativeDueText,
  snoozeNotification,
} from "../../../lib/api";
import { groupPaymentsByDueDate } from "../../../lib/dashboard";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function Page() {
  const [greeting, setGreeting] = useState("Good morning");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingNotification, setRecordingNotification] = useState(false);
  const [recordingNextPayment, setRecordingNextPayment] = useState(false);
  const [confirmingNotification, setConfirmingNotification] = useState<NotificationItem | null>(null);
  const [confirmingNextPayment, setConfirmingNextPayment] = useState<DashboardSummary["next_payment"]>(null);
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

  useEffect(() => {
    const updateGreeting = () => setGreeting(getGreeting());
    const intervalId = window.setInterval(updateGreeting, 60_000);

    updateGreeting();
    return () => window.clearInterval(intervalId);
  }, []);

  async function confirmAutopayPayment(item: NotificationItem) {
    setRecordingNotification(true);
    setError(null);
    try {
      await recordLoanPayment(item.loan_id, {
        amount: item.amount,
        payment_date: currentLocalDate(),
        notes: "Confirmed from Tally notification queue",
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

  async function confirmNextPayment() {
    if (!confirmingNextPayment) return;
    setRecordingNextPayment(true);
    setError(null);
    try {
      await recordLoanPayment(confirmingNextPayment.id, {
        amount: confirmingNextPayment.payment_amount,
        payment_date: currentLocalDate(),
        notes: "Recorded from Tally dashboard",
        source: confirmingNextPayment.autopay ? "autopay-confirmed" : "manual",
      });
      setConfirmingNextPayment(null);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setRecordingNextPayment(false);
    }
  }

  function snooze(item: NotificationItem, minutes = 60) {
    snoozeNotification(item.id, minutes);
    setNotificationItems((items) => [...items]);
  }

  const snoozedNotificationIds = getSnoozedNotificationIds();
  const needsConfirmation = notificationItems.filter((item) => item.action_required && !snoozedNotificationIds.has(item.id));
  const activeLoans = summary?.active_loans ?? [];
  const debts = activeLoans.filter((loan) => loan.payment_type === "payoff");
  // Accounts waiting on an autopay confirmation are handled above; keep them out of "Next due".
  const confirmingIds = new Set(needsConfirmation.map((item) => item.loan_id));
  const [nextDueGroup, ...upcomingGroups] = groupPaymentsByDueDate(activeLoans.filter((loan) => !confirmingIds.has(loan.id)));
  const upcomingRows = upcomingGroups.flatMap((group) => group.payments.map((loan) => ({ loan, date: group.date }))).slice(0, 5);
  const monthlyDue = Number(summary?.current_month_due ?? 0);
  const monthlyPaid = Number(summary?.current_month_paid ?? 0);
  const monthlyRemaining = Math.max(monthlyDue - monthlyPaid, 0);
  const monthlyProgress = monthlyDue > 0 ? Math.min(Math.max(monthlyPaid / monthlyDue * 100, 0), 100) : 0;
  const debtLeft = Number(summary?.loan_balance ?? 0);
  const debtOriginal = Number(summary?.total_original_debt ?? 0);
  const debtProgress = debtOriginal > 0 ? Math.min(Math.max((debtOriginal - debtLeft) / debtOriginal * 100, 0), 100) : 0;
  const hasDebts = debts.length > 0;
  const isEmpty = !loading && activeLoans.length === 0;
  const ringValue = hasDebts ? debtProgress : monthlyProgress;
  const monthName = new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date());

  return (
    <>
      <PageHeader title="Home" subtitle={<>{greeting}, <b className="pg-grad">James</b></>} />

      {error ? <p className="pg-error">{error}</p> : null}

      <section className="pg-hero" aria-label="What's left">
        <div className="pg-hero-main">
          <ProgressRing value={loading ? 0 : ringValue} size={124} stroke={12}
            label={hasDebts ? `${Math.round(debtProgress)}% of debt paid off` : `${Math.round(monthlyProgress)}% of this month paid`}>
            <strong>{loading ? "–" : `${Math.round(ringValue)}%`}</strong>
            <span>{hasDebts ? "paid off" : "this month"}</span>
          </ProgressRing>
          <div className="pg-hero-copy">
            <span className="pg-hero-label">{hasDebts ? "Left to pay" : isEmpty ? "Nothing tracked yet" : `Left in ${monthName}`}</span>
            <strong className="pg-hero-value">{loading ? "..." : formatMoney(hasDebts ? debtLeft : monthlyRemaining, hasDebts ? 0 : 2)}</strong>
            <span className="pg-hero-sub">
              {loading ? "Checking your payments" : hasDebts
                ? `of ${formatMoney(debtOriginal)} · ${formatNumber(summary?.total_payments_remaining ?? 0)} payments across ${formatNumber(debts.length)} ${debts.length === 1 ? "debt" : "debts"}`
                : isEmpty ? "Add a loan or bill to see what's left." : `${formatMoney(monthlyPaid, 2)} paid of ${formatMoney(monthlyDue, 2)}`}
            </span>
          </div>
        </div>
        {isEmpty ? (
          <Link className="pg-button" href="/loans/new">Add your first payment</Link>
        ) : hasDebts ? (
          <div className="pg-hero-month">
            <div className="pg-row"><span>{monthName}</span><span><b>{formatMoney(monthlyPaid, 2)}</b> paid of {formatMoney(monthlyDue, 2)}</span></div>
            <div className="pg-monthly-progress" role="progressbar" aria-label="This month's payments recorded" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(monthlyProgress)}>
              <span style={{ width: `${loading ? 0 : monthlyProgress}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      {needsConfirmation.length ? (
        <>
          <section className="pg-section-head"><h2>Needs confirmation</h2></section>
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
                <div className="pg-action-row pg-gap-top">
                  <button className="pg-button" type="button" onClick={() => setConfirmingNotification(item)}><CheckCircle2 aria-hidden="true" /> Paid</button>
                  <button className="pg-button secondary" type="button" onClick={() => snooze(item)}><BellRing aria-hidden="true" /> Snooze</button>
                </div>
                <button className="pg-link pg-text-button" type="button" onClick={() => snooze(item, 1440)}>Not processed today</button>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {loading ? (
        <article className="pg-empty-card pg-dashboard-loading"><strong>Loading upcoming payments</strong><span>Checking your payment schedule...</span></article>
      ) : nextDueGroup ? (
        <>
          <section className="pg-section-head">
            <h2>Next due · {relativeDueText(nextDueGroup.date).replace(/^Due /, "")}</h2>
            <Link className="pg-link" href="/calendar">Calendar</Link>
          </section>
          <article className="pg-list-card pg-next-due">
            {nextDueGroup.payments.map((loan) => (
              <div className="pg-due-payment" key={loan.id}>
                <div className="pg-row">
                  <Link className="pg-left" href={`/loans/detail?id=${loan.id}`}>
                    <span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span>
                    <div>
                      <p className="pg-name">{loan.name}</p>
                      <p className="pg-detail">{formatDate(nextDueGroup.date)} · {loan.autopay ? "Autopay" : "Manual"}</p>
                    </div>
                  </Link>
                  <strong className="pg-due-amount">{formatMoney(loan.payment_amount, 2)}</strong>
                </div>
                <button className="pg-button" type="button" aria-label={`${loan.autopay ? "Confirm paid" : "Mark as paid"}: ${loan.name}`} onClick={() => setConfirmingNextPayment(loan)}>
                  <CheckCircle2 aria-hidden="true" /> {loan.autopay ? "Confirm paid" : "Mark as paid"}
                </button>
              </div>
            ))}
          </article>
        </>
      ) : null}

      {upcomingRows.length ? (
        <>
          <section className="pg-section-head"><h2>Coming up</h2><Link className="pg-link" href="/loans">All payments</Link></section>
          <article className="pg-list-card pg-upcoming-list">
            {upcomingRows.map(({ loan, date }) => (
              <Link className="pg-upcoming-row" href={`/loans/detail?id=${loan.id}`} key={`${loan.id}-${date}`}>
                <span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span>
                <span className="pg-upcoming-copy"><b>{loan.name}</b><span>{formatDate(date)}</span></span>
                <strong>{formatMoney(loan.payment_amount, 2)}</strong>
              </Link>
            ))}
          </article>
        </>
      ) : null}

      {confirmingNotification ? (
        <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm autopay">
          <section className="pg-modal">
            <h2>Confirm autopay</h2>
            <p className="pg-muted">Only continue if {confirmingNotification.loan_name}'s {formatMoney(confirmingNotification.amount, 2)} autopay actually processed.</p>
            <div className="pg-detail-list">
              <div className="pg-detail-line"><span>Payments Left After</span><strong>{formatNumber(confirmingNotification.payments_remaining_after)}</strong></div>
              <div className="pg-detail-line"><span>Source</span><strong>Autopay Confirmed</strong></div>
            </div>
            <div className="pg-action-row">
              <button className="pg-button secondary" type="button" onClick={() => setConfirmingNotification(null)}>Cancel</button>
              <button className="pg-button" type="button" disabled={recordingNotification} onClick={() => void confirmAutopayPayment(confirmingNotification)}>Confirm Paid</button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmingNextPayment ? (
        <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm next payment">
          <section className="pg-modal">
            <h2>{confirmingNextPayment.autopay ? "Confirm autopay" : "Confirm payment"}</h2>
            <p className="pg-muted">Record {formatMoney(confirmingNextPayment.payment_amount, 2)} for {confirmingNextPayment.name}?</p>
            {confirmingNextPayment.autopay ? <p className="pg-muted">Only confirm if this autopay actually processed. A scheduled payment is not yet paid.</p> : null}
            <div className="pg-detail-list">
              <div className="pg-detail-line"><span>Payment Date</span><strong>{formatDate(currentLocalDate())}</strong></div>
              {confirmingNextPayment.payment_type === "payoff" ? <div className="pg-detail-line"><span>Payments Left After</span><strong>{formatNumber(Math.max(confirmingNextPayment.payments_remaining - 1, 0))}</strong></div> : null}
              <div className="pg-detail-line"><span>Source</span><strong>{confirmingNextPayment.autopay ? "Autopay Confirmed" : "Manual"}</strong></div>
            </div>
            <div className="pg-action-row">
              <button className="pg-button secondary" type="button" disabled={recordingNextPayment} onClick={() => setConfirmingNextPayment(null)}>Cancel</button>
              <button className="pg-button" type="button" disabled={recordingNextPayment} onClick={() => void confirmNextPayment()}>{recordingNextPayment ? "Saving" : "Confirm Paid"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
