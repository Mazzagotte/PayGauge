"use client";

import Link from "next/link";
import { PageHeader } from "../../../../components/navigation/PageHeader";
import { currentLocalDate } from "../../../../lib/api";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, CreditCard, Edit3, Percent, Sparkles, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";

import { LoanCategoryIcon, categoryTone, loanCategories } from "../../../../components/loans/LoanCategoryIcon";

const loanCategoryLabel = (category: string) => loanCategories.find((item) => item.value === category)?.label ?? "Payment";
import { ChipGroup } from "../../../../components/ChipGroup";
import { MiniCalendar } from "../../../../components/MiniCalendar";
import { PayoffChart } from "../../../../components/PayoffChart";
import { ProgressRing } from "../../../../components/ProgressRing";
import { dateAfterPayments, payoffSeries, deleteLoan, isPayoffTargetCategory, type Loan, type Payment, formatDate, formatMoney, formatNumber, getLoan, getLoanPayments, lastPaymentText, milestoneLabel, payoffInsight, recurrenceLabel, recordLoanPayment, relativeDueText, updateLoan } from "../../../../lib/api";

export default function Page() {
  const [loanId, setLoanId] = useState<string | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentDate: currentLocalDate() });
  const [extraPayment, setExtraPayment] = useState("50");
  const [dateChoice, setDateChoice] = useState<"today" | "yesterday" | "other">("today");
  const router = useRouter();

  useEffect(() => {
    setLoanId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  async function loadLoan(id: string) {
    setLoading(true);
    setError(null);
    try {
      const [loanData, paymentData] = await Promise.all([getLoan(id), getLoanPayments(id)]);
      setLoan(loanData);
      setPayments(paymentData);
      setPaymentForm((prev) => ({ ...prev, amount: Number(loanData.payment_amount).toFixed(2) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loan details are unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loanId) void loadLoan(loanId);
    else setLoading(false);
  }, [loanId]);

  async function handlePayment() {
    if (!loan) return;
    setSaving(true);
    setError(null);
    try {
      await recordLoanPayment(loan.id, { amount: Number(paymentForm.amount || loan.payment_amount).toFixed(2), payment_date: paymentForm.paymentDate, notes: null, source: "manual" });
      await loadLoan(loan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: "active" | "completed" | "archived") {
    if (!loan) return;
    setStatusSaving(true);
    setError(null);
    try {
      setLoan(await updateLoan(loan.id, { status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update loan");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleDelete() {
    if (!loan) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteLoan(loan.id);
      router.push("/loans");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete loan");
    } finally {
      setDeleting(false);
    }
  }

  const paymentAmount = Number(paymentForm.amount || loan?.payment_amount || 0);
  const balanceAfterPayment = Math.max(Number(loan?.current_balance ?? 0) - paymentAmount, 0);
  const paymentsLeftAfterPayment = Math.max((loan?.payments_remaining ?? 0) - 1, 0);
  const rate = Number(loan?.interest_rate ?? 0);
  const baseSeries = loan ? payoffSeries(Number(loan.current_balance), Number(loan.payment_amount), rate) : null;
  const fasterSeries = loan ? payoffSeries(Number(loan.current_balance), Number(loan.payment_amount), rate, Number(extraPayment || 0)) : null;
  const payoffOn = (count: number) => loan?.next_due_date && Number.isFinite(count) ? dateAfterPayments(loan.next_due_date, loan.recurrence ?? "monthly", loan.due_day, Math.max(count - 1, 0)) : null;
  const monthYear = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "–";
  const baseEnd = baseSeries ? payoffOn(baseSeries.months) : null;
  const fasterEnd = fasterSeries ? payoffOn(fasterSeries.months) : null;
  const paymentsSooner = baseSeries && fasterSeries && Number.isFinite(baseSeries.months) ? Math.max(baseSeries.months - fasterSeries.months, 0) : 0;
  const interestSaved = baseSeries && fasterSeries && Number.isFinite(baseSeries.interest) ? Math.max(baseSeries.interest - fasterSeries.interest, 0) : 0;
  function chooseDate(choice: "today" | "yesterday" | "other") {
    setDateChoice(choice);
    if (choice === "other") return;
    const date = new Date();
    if (choice === "yesterday") date.setDate(date.getDate() - 1);
    setPaymentForm((prev) => ({ ...prev, paymentDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` }));
  }
  const milestone = loan ? milestoneLabel(loan.payments_remaining, loan.progress_percentage) : null;
  const isPayoffTarget = loan ? isPayoffTargetCategory(loan.category) : false;

  return (
    <>
      <PageHeader title={loan?.name ?? "Payment details"} backHref="/loans"
        actions={loanId ? <Link className="pg-link" href={`/loans/edit?id=${loanId}`}><Edit3 aria-hidden="true" /> Edit</Link> : null} />

      {error ? <p className="pg-error">{error}</p> : null}
      {loading ? <article className="pg-empty-card"><strong>Loading details</strong><span>Getting the latest payment information.</span></article> : null}
      {!loading && !loan ? <article className="pg-empty-card"><strong>Payment not found</strong><span>Return to My Payments and choose a payment.</span></article> : null}

      {loan ? (
        <>
          <section className="pg-detail-hero"><span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span><div className="pg-detail-title"><p className="pg-detail">{loanCategoryLabel(loan.category)} · {loan.autopay ? "Autopay" : "Manual"}</p>{loan.status !== "active" ? <span className="pg-status-pill">{loan.status === "completed" ? "Paid off" : "Archived"}</span> : null}</div></section>
          {isPayoffTarget ? <>
            <section className="pg-hero pg-hero-detail">
              <div className="pg-hero-main">
                <ProgressRing value={loan.progress_percentage} size={104} stroke={11} label={`${Math.round(loan.progress_percentage)}% paid off`}>
                  <strong>{Math.round(loan.progress_percentage)}%</strong><span>paid</span>
                </ProgressRing>
                <div className="pg-hero-copy">
                  <span className="pg-hero-label">Balance left</span>
                  <strong className="pg-hero-value">{formatMoney(loan.current_balance)}</strong>
                  <span className="pg-hero-sub">{formatMoney(loan.payment_amount, 2)} {recurrenceLabel(loan.recurrence ?? "monthly").toLowerCase()} · {formatNumber(loan.payments_remaining)} {Number(loan.interest_rate) > 0 ? "est. " : ""}payments left</span>
                </div>
              </div>
              {milestone ? <span className="pg-hero-badge">{milestone}</span> : null}
            </section>
            <article className="pg-insight-card"><Sparkles aria-hidden="true" /><div><strong>{relativeDueText(loan.next_due_date)} · {formatDate(loan.next_due_date)}</strong><span>{payoffInsight(loan)} {lastPaymentText(payments)}.</span></div></article>
          </> : <>
            <section className="pg-hero pg-hero-detail">
              <div className="pg-hero-copy">
                <span className="pg-hero-label">{recurrenceLabel(loan.recurrence ?? "monthly")} bill</span>
                <strong className="pg-hero-value">{formatMoney(loan.payment_amount, 2)}</strong>
                <span className="pg-hero-sub">Next due {formatDate(loan.next_due_date)}</span>
              </div>
            </section>
            <article className="pg-insight-card"><Sparkles aria-hidden="true" /><div><strong>Recurring payment</strong><span>{relativeDueText(loan.next_due_date)}. {lastPaymentText(payments)}</span></div></article>
          </>}
          <section className="pg-card pg-gap-top"><div className="pg-detail-list"><div className="pg-detail-line"><span><CreditCard aria-hidden="true" /> {isPayoffTarget ? "Monthly Payment" : "Recurring Payment"}</span><strong>{formatMoney(loan.payment_amount, 2)}</strong></div>{isPayoffTarget ? <div className="pg-detail-line"><span><Percent aria-hidden="true" /> Interest Rate</span><strong>{loan.interest_rate ?? "0"}%</strong></div> : null}<div className="pg-detail-line"><span><CalendarDays aria-hidden="true" /> Start Date</span><strong>{formatDate(loan.start_date)}</strong></div><div className="pg-detail-line"><span><CalendarDays aria-hidden="true" /> Recurrence</span><strong>{recurrenceLabel(loan.recurrence ?? "monthly")}</strong></div>{isPayoffTarget ? <div className="pg-detail-line"><span><CalendarClock aria-hidden="true" /> Estimated Payoff</span><strong>{formatDate(loan.estimated_payoff_date)}</strong></div> : null}<div className="pg-detail-line"><span><CalendarDays aria-hidden="true" /> Next Payment</span><strong>{formatDate(loan.next_due_date)}</strong></div></div></section>
          {loan.status === "active" ? (
            <section className="pg-card pg-gap-top">
              <h2>Record a payment</h2>
              <div className="pg-field">
                <label htmlFor="record-amount">Amount</label>
                <div className="pg-money"><span>$</span><input id="record-amount" className="pg-input" inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value.replace(/[^\d.]/g, "") }))} /></div>
              </div>
              <div className="pg-field">
                <span className="pg-field-label">Paid on <b className="pg-field-value">{formatDate(paymentForm.paymentDate)}</b></span>
                <ChipGroup label="Payment date" value={dateChoice} onChange={chooseDate} options={[{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }, { value: "other", label: "Other day" }]} />
                {dateChoice === "other" ? <MiniCalendar label="Payment date" value={paymentForm.paymentDate} max={currentLocalDate()} onChange={(value) => setPaymentForm((prev) => ({ ...prev, paymentDate: value }))} /> : null}
              </div>
              <button className="pg-button" disabled={saving} onClick={() => setConfirmingPayment(true)}>{saving ? "Saving…" : "Mark payment as made"}</button>
            </section>
          ) : null}
          {isPayoffTarget && loan.status === "active" && baseSeries && Number.isFinite(baseSeries.months) && baseSeries.months > 0 ? (
            <section className="pg-card pg-gap-top pg-payoff-card">
              <div className="pg-card-head"><h2><TrendingDown aria-hidden="true" /> Payoff plan</h2><span className="pg-detail">Debt-free {monthYear(fasterEnd ?? baseEnd)}</span></div>
              <ChipGroup label="Extra per payment" scroll value={extraPayment} onChange={setExtraPayment}
                options={["0", "25", "50", "100", "200"].map((value) => ({ value, label: value === "0" ? "No extra" : `+$${value}` }))} />
              <PayoffChart base={baseSeries.points} faster={Number(extraPayment) > 0 && fasterSeries ? fasterSeries.points : undefined}
                startLabel="Now" endLabel={monthYear(baseEnd)} fasterEndLabel={Number(extraPayment) > 0 ? monthYear(fasterEnd) : undefined} />
              <div className="pg-payoff-stats">
                <div><span>Paid off</span><b>{monthYear(Number(extraPayment) > 0 ? fasterEnd : baseEnd)}</b></div>
                <div><span>Sooner</span><b>{Number(extraPayment) > 0 ? `${formatNumber(paymentsSooner)} ${paymentsSooner === 1 ? "payment" : "payments"}` : "–"}</b></div>
                <div><span>{rate > 0 ? "Interest saved" : "Payments left"}</span><b>{rate > 0 ? (Number(extraPayment) > 0 ? formatMoney(interestSaved) : "–") : formatNumber(Number(extraPayment) > 0 && fasterSeries ? fasterSeries.months : baseSeries.months)}</b></div>
              </div>
              <p className="pg-section-note">{Number(extraPayment) > 0 ? `Paying ${formatMoney(Number(loan.payment_amount) + Number(extraPayment), 2)} instead of ${formatMoney(loan.payment_amount, 2)}. The faded line is your current pace.` : "Pick an extra amount to see how much sooner you'd be done."}</p>
            </section>
          ) : null}
          <section className="pg-action-row pg-gap-top"><button className="pg-button secondary" type="button" disabled={statusSaving} onClick={() => void updateStatus("completed")}>Mark complete</button><button className="pg-button secondary pg-danger-text" type="button" disabled={deleting || statusSaving} onClick={() => setConfirmingDelete(true)}>Delete</button></section>
          <section className="pg-section-head"><h2>Recent Payments</h2><Link className="pg-link" href={`/loans/payments?id=${loan.id}`}>View All</Link></section>
          <div className="pg-stack">{payments.slice(0, 3).map((payment) => <article className="pg-list-card" key={payment.id}><div className="pg-row"><span className="pg-detail">{formatDate(payment.payment_date)}</span><strong>{formatMoney(payment.amount, 2)}</strong></div></article>)}{payments.length === 0 ? <article className="pg-empty-card"><strong>No payment history</strong><span>{isPayoffTarget ? "Record a payment to start the payoff timeline." : "Record a payment to keep your recurring payment history up to date."}</span></article> : null}</div>
        </>
      ) : null}

      {confirmingPayment && loan ? <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm payment"><section className="pg-modal"><h2>Confirm payment</h2><p className="pg-muted">This will record {formatMoney(paymentAmount, 2)} for {loan.name} on {formatDate(paymentForm.paymentDate)}.</p><div className="pg-detail-list"><div className="pg-detail-line"><span>Balance After</span><strong>{formatMoney(balanceAfterPayment, 2)}</strong></div><div className="pg-detail-line"><span>Payments Left After</span><strong>{formatNumber(paymentsLeftAfterPayment)}</strong></div><div className="pg-detail-line"><span>Final Payment</span><strong>{balanceAfterPayment === 0 ? "Yes" : "No"}</strong></div></div><div className="pg-action-row"><button className="pg-button secondary" type="button" onClick={() => setConfirmingPayment(false)}>Cancel</button><button className="pg-button" type="button" disabled={saving} onClick={() => { setConfirmingPayment(false); void handlePayment(); }}>Confirm</button></div></section></div> : null}
      {confirmingDelete && loan ? <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete loan"><section className="pg-modal"><h2>Delete this account?</h2><p className="pg-muted">Delete {loan.name}? This will permanently remove the loan and its payment history from your local Tally data.</p><div className="pg-action-row"><button className="pg-button secondary" type="button" onClick={() => setConfirmingDelete(false)}>Cancel</button><button className="pg-button pg-danger" type="button" disabled={deleting} onClick={() => { setConfirmingDelete(false); void handleDelete(); }}>Delete</button></div></section></div> : null}
    </>
  );
}
