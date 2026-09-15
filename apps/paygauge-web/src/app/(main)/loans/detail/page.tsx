"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, CalendarDays, CreditCard, DollarSign, Edit3, Percent, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../../components/loans/LoanCategoryIcon";
import { extraPaymentProjection, type Loan, type Payment, formatDate, formatMoney, getLoan, getLoanPayments, lastPaymentText, milestoneLabel, payoffInsight, recordLoanPayment, relativeDueText, updateLoan } from "../../../../lib/api";

export default function Page() {
  const [loanId, setLoanId] = useState<string | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentDate: new Date().toISOString().slice(0, 10) });
  const [extraPayment, setExtraPayment] = useState("50");

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

  const paymentAmount = Number(paymentForm.amount || loan?.payment_amount || 0);
  const balanceAfterPayment = Math.max(Number(loan?.current_balance ?? 0) - paymentAmount, 0);
  const paymentsLeftAfterPayment = Math.max((loan?.payments_remaining ?? 0) - 1, 0);
  const projection = loan ? extraPaymentProjection(loan, Number(extraPayment || 0)) : null;
  const milestone = loan ? milestoneLabel(loan.payments_remaining, loan.progress_percentage) : null;

  return (
    <>
      <header className="pg-header">
        <Link className="pg-link" href="/loans"><ArrowLeft aria-hidden="true" /> Back</Link>
        <h1 className="pg-title" style={{ fontSize: 16 }}>Loan Details</h1>
        {loanId ? <Link className="pg-link" href={`/loans/edit?id=${loanId}`}><Edit3 aria-hidden="true" /> Edit</Link> : <span />}
      </header>

      {error ? <p className="pg-error">{error}</p> : null}
      {loading ? <article className="pg-empty-card"><strong>Loading details</strong><span>Getting the latest payoff progress.</span></article> : null}
      {!loading && !loan ? <article className="pg-empty-card"><strong>Loan not found</strong><span>Return to My Loans and choose a loan.</span></article> : null}

      {loan ? (
        <>
          <section className="pg-detail-hero"><span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span><div><p className="pg-name">{loan.name}</p><span className="pg-pill active" style={{ display: "inline-block", marginTop: 6 }}>{loan.status}</span></div></section>
          <section className="pg-two-metrics"><div><p className="pg-big-number">{formatMoney(loan.current_balance)}</p><p className="pg-muted">Remaining Balance</p></div><div style={{ textAlign: "right" }}><p className="pg-big-number">{loan.payments_remaining}</p><p className="pg-muted">Payments Left</p></div></section>
          <div className={`pg-progress ${loan.status === "completed" ? "green" : ""}`}><span style={{ width: `${Math.max(3, loan.progress_percentage)}%` }} /></div>
          <div className="pg-progress-meta"><span>{milestone ?? `${loan.progress_percentage}% complete`}</span><span>{loan.payments_made} of {loan.total_number_of_payments ?? "?"} payments</span></div>
          <article className="pg-insight-card" style={{ marginTop: 14 }}><Sparkles aria-hidden="true" /><div><strong>{payoffInsight(loan)}</strong><span>{relativeDueText(loan.next_due_date)}. {lastPaymentText(payments)}</span></div></article>
          <section className="pg-card" style={{ marginTop: 18 }}><div className="pg-detail-list"><div className="pg-detail-line"><span><CreditCard aria-hidden="true" /> Monthly Payment</span><strong>{formatMoney(loan.payment_amount, 2)}</strong></div><div className="pg-detail-line"><span><DollarSign aria-hidden="true" /> Original Amount</span><strong>{formatMoney(loan.original_amount, 2)}</strong></div><div className="pg-detail-line"><span><Percent aria-hidden="true" /> Interest Rate</span><strong>{loan.interest_rate ?? "0"}%</strong></div><div className="pg-detail-line"><span><CalendarDays aria-hidden="true" /> Start Date</span><strong>{formatDate(loan.start_date)}</strong></div><div className="pg-detail-line"><span><CalendarClock aria-hidden="true" /> Estimated Payoff</span><strong>{formatDate(loan.estimated_payoff_date)}</strong></div><div className="pg-detail-line"><span><CalendarDays aria-hidden="true" /> Next Payment</span><strong>{formatDate(loan.next_due_date)}</strong></div></div></section>
          {loan.status === "active" ? <section className="pg-card" style={{ marginTop: 14 }}><h2 style={{ marginBottom: 12 }}>Record Payment</h2><div className="pg-grid-2"><input className="pg-input" inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} aria-label="Payment amount" /><input className="pg-input" type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))} aria-label="Payment date" /></div><button className="pg-button" style={{ marginTop: 10 }} disabled={saving} onClick={() => setConfirmingPayment(true)}>{saving ? "Saving..." : "Mark Payment as Made"}</button></section> : null}
          {loan.status === "active" ? <section className="pg-card" style={{ marginTop: 14 }}><h2 style={{ marginBottom: 12 }}>Extra Payment Simulator</h2><div className="pg-field"><label>Extra per payment</label><input className="pg-input" inputMode="decimal" value={extraPayment} onChange={(event) => setExtraPayment(event.target.value)} /></div>{projection ? <div className="pg-detail-list" style={{ marginTop: 12 }}><div className="pg-detail-line"><span>New Payments Left</span><strong>{projection.newPaymentsRemaining}</strong></div><div className="pg-detail-line"><span>Payments Saved</span><strong>{projection.paymentsSaved}</strong></div><div className="pg-detail-line"><span>Projected Payoff</span><strong>{formatDate(projection.payoffDate)}</strong></div></div> : null}</section> : null}
          <section className="pg-action-row" style={{ marginTop: 14 }}><button className="pg-button secondary" type="button" disabled={statusSaving} onClick={() => void updateStatus("completed")}>Mark Complete</button><button className="pg-button dark" type="button" disabled={statusSaving} onClick={() => setConfirmingArchive(true)}>Archive</button></section>
          <section className="pg-section-head"><h2>Recent Payments</h2><Link className="pg-link" href={`/loans/payments?id=${loan.id}`}>View All</Link></section>
          <div className="pg-stack">{payments.slice(0, 3).map((payment) => <article className="pg-list-card" key={payment.id}><div className="pg-row"><span className="pg-detail">{formatDate(payment.payment_date)}</span><strong>{formatMoney(payment.amount, 2)}</strong></div></article>)}{payments.length === 0 ? <article className="pg-empty-card"><strong>No payment history</strong><span>Record a payment to start the payoff timeline.</span></article> : null}</div>
        </>
      ) : null}

      {confirmingPayment && loan ? <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm payment"><section className="pg-modal"><h2 style={{ margin: 0 }}>Confirm Payment</h2><p className="pg-muted">This will record {formatMoney(paymentAmount, 2)} for {loan.name} on {formatDate(paymentForm.paymentDate)}.</p><div className="pg-detail-list"><div className="pg-detail-line"><span>Balance After</span><strong>{formatMoney(balanceAfterPayment, 2)}</strong></div><div className="pg-detail-line"><span>Payments Left After</span><strong>{paymentsLeftAfterPayment}</strong></div><div className="pg-detail-line"><span>Final Payment</span><strong>{balanceAfterPayment === 0 ? "Yes" : "No"}</strong></div></div><div className="pg-action-row"><button className="pg-button dark" type="button" onClick={() => setConfirmingPayment(false)}>Cancel</button><button className="pg-button" type="button" disabled={saving} onClick={() => { setConfirmingPayment(false); void handlePayment(); }}>Confirm</button></div></section></div> : null}
      {confirmingArchive && loan ? <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Archive loan"><section className="pg-modal"><h2 style={{ margin: 0 }}>Archive Loan</h2><p className="pg-muted">Archive {loan.name}? It will be hidden from active payoff totals, but its history will stay available.</p><div className="pg-action-row"><button className="pg-button dark" type="button" onClick={() => setConfirmingArchive(false)}>Cancel</button><button className="pg-button" type="button" disabled={statusSaving} onClick={() => { setConfirmingArchive(false); void updateStatus("archived"); }}>Archive</button></div></section></div> : null}
    </>
  );
}
