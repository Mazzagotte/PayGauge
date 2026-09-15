"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import { type Loan, formatDate, formatMoney, getLoans, recordLoanPayment } from "../../../lib/api";

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [confirmingLoan, setConfirmingLoan] = useState<Loan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentFormByLoan, setPaymentFormByLoan] = useState<Record<string, { amount: string; paymentDate: string }>>({});

  const activeCount = useMemo(() => loans.filter((loan) => loan.status === "active").length, [loans]);
  const completedCount = useMemo(() => loans.filter((loan) => loan.status === "completed").length, [loans]);

  async function loadLoans() {
    setLoading(true);
    setError(null);
    try {
      setLoans(await getLoans());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loans are unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLoans();
  }, []);

  async function recordPayment(loan: Loan) {
    const form = paymentFormByLoan[loan.id] ?? {
      amount: Number(loan.payment_amount).toFixed(2),
      paymentDate: new Date().toISOString().slice(0, 10),
    };
    setRecordingFor(loan.id);
    setError(null);

    try {
      await recordLoanPayment(loan.id, {
        amount: Number(form.amount || loan.payment_amount).toFixed(2),
        payment_date: form.paymentDate,
        notes: null,
        source: "manual",
      });
      await loadLoans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setRecordingFor(null);
    }
  }

  return (
    <>
      <header className="pg-header">
        <h1 className="pg-title">My Loans</h1>
        <Link className="pg-add-button" href="/loans/new" aria-label="Add loan"><Plus aria-hidden="true" /></Link>
      </header>

      <div className="pg-pill-row">
        <span className="pg-pill active">All</span>
        <span className="pg-pill">Active {activeCount}</span>
        <span className="pg-pill">Completed {completedCount}</span>
      </div>

      {error ? <p className="pg-error">{error}</p> : null}
      {loading ? <article className="pg-empty-card"><strong>Loading loans</strong><span>Checking what is left...</span></article> : null}

      <div className="pg-stack">
        {loans.map((loan) => {
          const paymentForm = paymentFormByLoan[loan.id] ?? {
            amount: Number(loan.payment_amount).toFixed(2),
            paymentDate: new Date().toISOString().slice(0, 10),
          };

          return (
            <article className="pg-loan-card" key={loan.id}>
              <Link href={`/loans/detail?id=${loan.id}`}>
                <div className="pg-row">
                  <div className="pg-left">
                    <span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span>
                    <div>
                      <p className="pg-name">{loan.name}</p>
                      <p className="pg-detail">{loan.payments_remaining} payments left</p>
                    </div>
                  </div>
                  <div className="pg-amount">
                    <strong>{formatMoney(loan.current_balance)}</strong>
                    <span>remaining</span>
                  </div>
                </div>
                <div className={`pg-progress ${loan.status === "completed" ? "green" : ""}`}>
                  <span style={{ width: `${Math.max(3, loan.progress_percentage)}%` }} />
                </div>
                <div className="pg-progress-meta">
                  <span>{formatMoney(loan.payment_amount, 2)}/month</span>
                  <span>Next: {formatDate(loan.next_due_date)}</span>
                </div>
              </Link>

              {loan.status === "active" ? (
                <div className="pg-grid-2" style={{ marginTop: 10 }}>
                  <input className="pg-input" inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentFormByLoan((prev) => ({ ...prev, [loan.id]: { ...paymentForm, amount: event.target.value } }))} aria-label="Payment amount" />
                  <input className="pg-input" type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentFormByLoan((prev) => ({ ...prev, [loan.id]: { ...paymentForm, paymentDate: event.target.value } }))} aria-label="Payment date" />
                  <button className="pg-button" style={{ gridColumn: "1 / -1" }} type="button" disabled={recordingFor === loan.id} onClick={() => setConfirmingLoan(loan)}>
                    {recordingFor === loan.id ? "Saving..." : "Mark Payment as Made"}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!loading && loans.length === 0 ? (
        <article className="pg-empty-card" style={{ marginTop: 10 }}>
          <strong>No loans yet</strong>
          <span>Add your Engagement Ring loan to start tracking payments left.</span>
          <Link className="pg-button" href="/loans/new">Add Loan</Link>
        </article>
      ) : null}

      {confirmingLoan ? (() => {
        const form = paymentFormByLoan[confirmingLoan.id] ?? {
          amount: Number(confirmingLoan.payment_amount).toFixed(2),
          paymentDate: new Date().toISOString().slice(0, 10),
        };
        const paymentAmount = Number(form.amount || confirmingLoan.payment_amount);
        const balanceAfterPayment = Math.max(Number(confirmingLoan.current_balance) - paymentAmount, 0);
        const paymentsLeftAfterPayment = Math.max(confirmingLoan.payments_remaining - 1, 0);

        return (
          <div className="pg-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm payment">
            <section className="pg-modal">
              <h2 style={{ margin: 0 }}>Confirm Payment</h2>
              <p className="pg-muted">Record {formatMoney(String(paymentAmount), 2)} for {confirmingLoan.name}?</p>
              <div className="pg-detail-list">
                <div className="pg-detail-line"><span>Payment Date</span><strong>{formatDate(form.paymentDate)}</strong></div>
                <div className="pg-detail-line"><span>Balance After</span><strong>{formatMoney(String(balanceAfterPayment), 2)}</strong></div>
                <div className="pg-detail-line"><span>Payments Left After</span><strong>{paymentsLeftAfterPayment}</strong></div>
              </div>
              <div className="pg-action-row">
                <button className="pg-button dark" type="button" onClick={() => setConfirmingLoan(null)}>Cancel</button>
                <button className="pg-button" type="button" onClick={() => { setConfirmingLoan(null); void recordPayment(confirmingLoan); }}>Confirm</button>
              </div>
            </section>
          </div>
        );
      })() : null}
    </>
  );
}
