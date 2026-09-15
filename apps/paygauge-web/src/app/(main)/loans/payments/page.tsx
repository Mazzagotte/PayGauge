"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../../components/loans/LoanCategoryIcon";
import { type Loan, type Payment, deletePayment, formatDate, formatMoney, getLoan, getLoanPayments } from "../../../../lib/api";

export default function Page() {
  const [loanId, setLoanId] = useState<string | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoanId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  async function loadHistory(id: string) {
    setLoading(true);
    setError(null);
    try {
      const [loanData, paymentData] = await Promise.all([getLoan(id), getLoanPayments(id)]);
      setLoan(loanData);
      setPayments(paymentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment history is unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loanId) void loadHistory(loanId);
    else setLoading(false);
  }, [loanId]);

  async function handleDelete(paymentId: string) {
    setDeleting(paymentId);
    setError(null);
    try {
      await deletePayment(paymentId);
      if (loanId) await loadHistory(loanId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payment");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <header className="pg-header"><Link className="pg-link" href={loanId ? `/loans/detail?id=${loanId}` : "/loans"}><ArrowLeft aria-hidden="true" /> Back</Link><h1 className="pg-title" style={{ fontSize: 16 }}>Payment History</h1><span /></header>
      {loan ? <section className="pg-detail-hero"><span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span><div><p className="pg-name">{loan.name}</p><p className="pg-detail">{loan.payments_remaining} payments left</p></div></section> : null}
      {error ? <p className="pg-error">{error}</p> : null}
      {loading ? <article className="pg-empty-card"><strong>Loading payments</strong><span>Reading payment history.</span></article> : null}
      <div className="pg-stack">{payments.map((payment) => <article className="pg-list-card" key={payment.id}><div className="pg-row"><div className="pg-left"><CheckCircle2 aria-hidden="true" style={{ color: "var(--pg-success)", width: 17, height: 17 }} /><div><p className="pg-name">{formatDate(payment.payment_date)}</p><p className="pg-detail">Payment #{payment.payment_number}</p></div></div><div className="pg-amount"><strong>{formatMoney(payment.amount, 2)}</strong><button className="pg-link" type="button" disabled={deleting === payment.id} onClick={() => setConfirmingDelete(payment)} style={{ background: "transparent", border: 0, padding: 0, marginTop: 4 }}><Trash2 aria-hidden="true" /> Undo</button></div></div></article>)}</div>
      {!loading && payments.length === 0 ? <article className="pg-empty-card"><strong>No payment history</strong><span>Payments for this loan will appear here.</span></article> : null}
      {confirmingDelete ? <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Undo payment"><section className="pg-modal"><h2 style={{ margin: 0 }}>Undo Payment</h2><p className="pg-muted">Remove the {formatMoney(confirmingDelete.amount, 2)} payment from {formatDate(confirmingDelete.payment_date)}? PayGauge will recalculate the loan balance and payments left.</p><div className="pg-action-row"><button className="pg-button dark" type="button" onClick={() => setConfirmingDelete(null)}>Cancel</button><button className="pg-button" type="button" disabled={deleting === confirmingDelete.id} onClick={() => { const paymentId = confirmingDelete.id; setConfirmingDelete(null); void handleDelete(paymentId); }}>Undo Payment</button></div></section></div> : null}
    </>
  );
}
