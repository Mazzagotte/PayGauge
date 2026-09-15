"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useState } from "react";

import { LoanCategoryIcon, categoryConfidence, categoryTone, inferLoanCategory, loanCategories } from "../../../../components/loans/LoanCategoryIcon";
import { addMonthsToDate, createLoan, estimatePaymentsRemaining, formatDate, formatMoney, previewNextDueDate, zeroInterestMismatch } from "../../../../lib/api";

export default function Page() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "Engagement Ring",
    originalAmount: "6000",
    currentBalance: "2400",
    paymentAmount: "200",
    totalPayments: "30",
    startDate: "2026-09-15",
    dueDay: "5",
    interestRate: "0",
    autopay: true,
    notes: "",
  });
  const nextDuePreview = previewNextDueDate(form.startDate, form.dueDay);
  const estimatedRemaining = estimatePaymentsRemaining(form.currentBalance || form.originalAmount, form.paymentAmount);
  const mismatch = zeroInterestMismatch(form.originalAmount, form.paymentAmount, form.totalPayments);
  const inferredCategory = inferLoanCategory(form.name);
  const inferredLabel = loanCategories.find((category) => category.value === inferredCategory)?.label ?? "Other";
  const nextDueDate = nextDuePreview?.toISOString().slice(0, 10) ?? null;
  const duePreviewDates = nextDueDate && form.dueDay
    ? [0, 1, 2].map((month) => addMonthsToDate(nextDueDate, Number(form.dueDay), month))
    : [];
  const validationMessages = [
    Number(form.currentBalance) > Number(form.originalAmount) ? "Current balance is higher than the original amount." : null,
    Number(form.totalPayments) > 0 && estimatedRemaining > Number(form.totalPayments) ? "Balance suggests more payments than the total payment count." : null,
    Number(form.currentBalance) > 0 && Number(form.paymentAmount) > Number(form.currentBalance) ? "The next payment appears to be a final payment." : null,
    Number(form.dueDay) >= 29 ? "This due day will roll to the last valid day in shorter months." : null,
  ].filter(Boolean);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const originalAmount = Number(form.originalAmount);
    const currentBalance = Number(form.currentBalance || form.originalAmount);
    const paymentAmount = Number(form.paymentAmount);
    const totalPayments = Number(form.totalPayments);
    const dueDay = Number(form.dueDay);

    if (!form.name || !originalAmount || !paymentAmount || !totalPayments) {
      setError("Loan name, original amount, monthly payment, and total payments are required.");
      setSaving(false);
      return;
    }

    try {
      const loan = await createLoan({
        name: form.name,
        category: inferredCategory,
        description: form.notes || null,
        original_amount: originalAmount.toFixed(2),
        current_balance: currentBalance.toFixed(2),
        payment_amount: paymentAmount.toFixed(2),
        total_number_of_payments: totalPayments,
        payments_made: 0,
        interest_rate: Number(form.interestRate || 0).toFixed(4),
        start_date: form.startDate || null,
        due_day: dueDay || null,
        autopay: form.autopay,
        status: "active",
      });
      router.push(`/loans/detail?id=${loan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="pg-header">
        <Link className="pg-link" href="/loans"><ArrowLeft aria-hidden="true" /> Close</Link>
        <h1 className="pg-title" style={{ fontSize: 16 }}>Add Loan</h1>
        <button className="pg-link" form="add-loan-form" style={{ background: "transparent", border: 0 }} disabled={saving}>Save</button>
      </header>

      {error ? <p className="pg-error">{error}</p> : null}

      <form id="add-loan-form" className="pg-form" onSubmit={handleSubmit}>
        <div className="pg-field">
          <label>Loan Name</label>
          <input className="pg-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </div>

        <article className="pg-list-card">
          <div className="pg-row">
            <div className="pg-left">
              <span className={`pg-token ${categoryTone(inferredCategory)}`}><LoanCategoryIcon category={inferredCategory} /></span>
              <div>
                <p className="pg-name">Icon selected automatically</p>
                <p className="pg-detail">{inferredLabel} icon based on "{form.name || "loan name"}"</p>
                <p className="pg-detail">{categoryConfidence(form.name, inferredCategory)}</p>
              </div>
            </div>
          </div>
        </article>

        <div className="pg-grid-2">
          <div className="pg-field"><label>Original Amount</label><input className="pg-input" inputMode="decimal" value={form.originalAmount} onChange={(event) => setForm((prev) => ({ ...prev, originalAmount: event.target.value }))} /></div>
          <div className="pg-field"><label>Current Balance</label><input className="pg-input" inputMode="decimal" value={form.currentBalance} onChange={(event) => setForm((prev) => ({ ...prev, currentBalance: event.target.value }))} onFocus={() => setForm((prev) => ({ ...prev, currentBalance: prev.currentBalance || prev.originalAmount }))} /></div>
        </div>

        <div className="pg-grid-2">
          <div className="pg-field"><label>Monthly Payment</label><input className="pg-input" inputMode="decimal" value={form.paymentAmount} onChange={(event) => setForm((prev) => ({ ...prev, paymentAmount: event.target.value }))} /></div>
          <div className="pg-field"><label>Total Payments</label><input className="pg-input" inputMode="numeric" value={form.totalPayments} onChange={(event) => setForm((prev) => ({ ...prev, totalPayments: event.target.value }))} /></div>
        </div>

        <div className="pg-grid-2">
          <div className="pg-field"><label>Start Date</label><input className="pg-input" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} /></div>
          <div className="pg-field">
            <label>Due Day</label>
            <select className="pg-select" value={form.dueDay} onChange={(event) => setForm((prev) => ({ ...prev, dueDay: event.target.value }))}>
              {Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <option key={day} value={day}>{day}</option>)}
            </select>
          </div>
        </div>

        <article className="pg-empty-card">
          <strong>Loan Preview</strong>
          <span>Next due: {nextDuePreview ? formatDate(nextDuePreview.toISOString().slice(0, 10)) : "Choose a start date and due day"}</span>
          {duePreviewDates.length ? <span>Next three: {duePreviewDates.map(formatDate).join(" | ")}</span> : null}
          <span>Estimated remaining payments from balance: {estimatedRemaining}</span>
          {mismatch !== 0 ? <span>{formatMoney(Math.abs(mismatch), 2)} {mismatch > 0 ? "more than" : "less than"} the original amount across scheduled payments.</span> : <span>Payment schedule lines up with the original amount.</span>}
          {validationMessages.map((message) => <span key={message}>{message}</span>)}
        </article>

        <div className="pg-field"><label>Interest Rate Optional</label><input className="pg-input" inputMode="decimal" value={form.interestRate} onChange={(event) => setForm((prev) => ({ ...prev, interestRate: event.target.value }))} /></div>
        <label className="pg-row pg-card" style={{ padding: 12 }}>
          <span>Autopay</span>
          <input type="checkbox" checked={form.autopay} onChange={(event) => setForm((prev) => ({ ...prev, autopay: event.target.checked }))} />
        </label>
        <div className="pg-field"><label>Notes Optional</label><textarea className="pg-textarea" rows={4} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        <button className="pg-button" disabled={saving}>{saving ? "Saving..." : "Save Loan"}</button>
      </form>
    </>
  );
}
