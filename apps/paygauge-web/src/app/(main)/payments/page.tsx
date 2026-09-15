"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import { type Loan, type Payment, deletePayment, formatDate, formatMoney, getLoans, getPayments } from "../../../lib/api";

export default function Page() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loanById = useMemo(() => new Map(loans.map((loan) => [loan.id, loan])), [loans]);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const [paymentData, loanData] = await Promise.all([getPayments(), getLoans()]);
      setPayments(paymentData);
      setLoans(loanData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment history is unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function handleDelete(paymentId: string) {
    setDeleting(paymentId);
    setError(null);
    try {
      await deletePayment(paymentId);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payment");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <header className="pg-header">
        <Link className="pg-link" href="/loans"><ArrowLeft aria-hidden="true" /> Back</Link>
        <h1 className="pg-title" style={{ fontSize: 16 }}>Payment History</h1>
        <span />
      </header>

      {error ? <p className="pg-error">{error}</p> : null}
      {loading ? <article className="pg-empty-card"><strong>Loading payments</strong><span>Building the payoff timeline.</span></article> : null}

      <div className="pg-stack">
        {payments.map((payment) => {
          const loan = loanById.get(payment.loan_id);
          return (
            <article className="pg-list-card" key={payment.id}>
              <div className="pg-row">
                <div className="pg-left">
                  <span className={`pg-token ${categoryTone(loan?.category)}`}>
                    {loan ? <LoanCategoryIcon category={loan.category} /> : <CheckCircle2 aria-hidden="true" />}
                  </span>
                  <div>
                    <p className="pg-name">{loan?.name ?? "Loan Payment"}</p>
                    <p className="pg-detail">{formatDate(payment.payment_date)} | #{payment.payment_number}</p>
                  </div>
                </div>
                <div className="pg-amount">
                  <strong>{formatMoney(payment.amount, 2)}</strong>
                  <button className="pg-link" type="button" disabled={deleting === payment.id} onClick={() => void handleDelete(payment.id)} style={{ background: "transparent", border: 0, padding: 0, marginTop: 4 }}>
                    <Trash2 aria-hidden="true" /> Undo
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && payments.length === 0 ? (
        <article className="pg-empty-card">
          <strong>No payments recorded</strong>
          <span>Payments you mark as made will appear here with correction controls.</span>
          <Link className="pg-button" href="/loans">Record Payment</Link>
        </article>
      ) : null}
    </>
  );
}
