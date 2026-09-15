"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { LoanCategoryIcon, loanCategories } from "../../../../components/loans/LoanCategoryIcon";
import { type LoanCategory, formatDate, getLoan, previewNextDueDate, updateLoan } from "../../../../lib/api";

export default function Page() {
  const router = useRouter();
  const [loanId, setLoanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", category: "personal" as LoanCategory, originalAmount: "", currentBalance: "", paymentAmount: "", totalPayments: "", paymentsMade: "", startDate: "", dueDay: "", interestRate: "0", autopay: false, notes: "", status: "active" });
  const nextDuePreview = previewNextDueDate(form.startDate, form.dueDay);

  useEffect(() => {
    setLoanId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  useEffect(() => {
    async function loadLoan(id: string) {
      try {
        const loan = await getLoan(id);
        setForm({ name: loan.name, category: loan.category, originalAmount: loan.original_amount, currentBalance: loan.current_balance, paymentAmount: loan.payment_amount, totalPayments: loan.total_number_of_payments ? String(loan.total_number_of_payments) : "", paymentsMade: String(loan.payments_made), startDate: loan.start_date ?? "", dueDay: loan.due_day ? String(loan.due_day) : "", interestRate: loan.interest_rate ?? "0", autopay: loan.autopay, notes: loan.description ?? "", status: loan.status });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Loan is unavailable");
      } finally {
        setLoading(false);
      }
    }
    if (loanId) void loadLoan(loanId);
    else setLoading(false);
  }, [loanId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loanId) return;
    setSaving(true);
    setError(null);
    try {
      await updateLoan(loanId, { name: form.name, category: form.category, description: form.notes || null, original_amount: Number(form.originalAmount).toFixed(2), current_balance: Number(form.currentBalance).toFixed(2), payment_amount: Number(form.paymentAmount).toFixed(2), total_number_of_payments: form.totalPayments ? Number(form.totalPayments) : null, payments_made: Number(form.paymentsMade || 0), interest_rate: Number(form.interestRate || 0).toFixed(4), start_date: form.startDate || null, due_day: form.dueDay ? Number(form.dueDay) : null, autopay: form.autopay, status: form.status });
      router.push(`/loans/detail?id=${loanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="pg-header"><Link className="pg-link" href={loanId ? `/loans/detail?id=${loanId}` : "/loans"}><ArrowLeft aria-hidden="true" /> Back</Link><h1 className="pg-title" style={{ fontSize: 16 }}>Edit Loan</h1><button className="pg-link" form="edit-loan-form" style={{ background: "transparent", border: 0 }} disabled={saving}>Save</button></header>
      {loading ? <article className="pg-empty-card"><strong>Loading loan</strong><span>Preparing editable fields.</span></article> : null}
      {error ? <p className="pg-error">{error}</p> : null}
      {!loading && loanId ? <form id="edit-loan-form" className="pg-form" onSubmit={handleSubmit}>
        <div className="pg-field"><label>Loan Name</label><input className="pg-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
        <div className="pg-field"><label>Icon</label><div className="pg-category-grid">{loanCategories.map((category) => <button className={`pg-category-option ${form.category === category.value ? "active" : ""}`} type="button" key={category.value} onClick={() => setForm((prev) => ({ ...prev, category: category.value }))}><LoanCategoryIcon category={category.value} /><span>{category.label}</span></button>)}</div></div>
        <div className="pg-grid-2"><div className="pg-field"><label>Original Amount</label><input className="pg-input" inputMode="decimal" value={form.originalAmount} onChange={(event) => setForm((prev) => ({ ...prev, originalAmount: event.target.value }))} /></div><div className="pg-field"><label>Current Balance</label><input className="pg-input" inputMode="decimal" value={form.currentBalance} onChange={(event) => setForm((prev) => ({ ...prev, currentBalance: event.target.value }))} /></div></div>
        <div className="pg-grid-2"><div className="pg-field"><label>Monthly Payment</label><input className="pg-input" inputMode="decimal" value={form.paymentAmount} onChange={(event) => setForm((prev) => ({ ...prev, paymentAmount: event.target.value }))} /></div><div className="pg-field"><label>Total Payments</label><input className="pg-input" inputMode="numeric" value={form.totalPayments} onChange={(event) => setForm((prev) => ({ ...prev, totalPayments: event.target.value }))} /></div></div>
        <div className="pg-grid-2"><div className="pg-field"><label>Payments Made</label><input className="pg-input" inputMode="numeric" value={form.paymentsMade} onChange={(event) => setForm((prev) => ({ ...prev, paymentsMade: event.target.value }))} /></div><div className="pg-field"><label>Status</label><select className="pg-select" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></div></div>
        <div className="pg-grid-2"><div className="pg-field"><label>Start Date</label><input className="pg-input" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} /></div><div className="pg-field"><label>Due Day</label><select className="pg-select" value={form.dueDay} onChange={(event) => setForm((prev) => ({ ...prev, dueDay: event.target.value }))}><option value="">None</option>{Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <option key={day} value={day}>{day}</option>)}</select></div></div>
        <article className="pg-empty-card"><strong>Date Preview</strong><span>Next due would be {nextDuePreview ? formatDate(nextDuePreview.toISOString().slice(0, 10)) : "not set"}.</span></article>
        <div className="pg-field"><label>Interest Rate Optional</label><input className="pg-input" inputMode="decimal" value={form.interestRate} onChange={(event) => setForm((prev) => ({ ...prev, interestRate: event.target.value }))} /></div>
        <label className="pg-row pg-card" style={{ padding: 12 }}><span>Autopay</span><input type="checkbox" checked={form.autopay} onChange={(event) => setForm((prev) => ({ ...prev, autopay: event.target.checked }))} /></label>
        <div className="pg-field"><label>Notes Optional</label><textarea className="pg-textarea" rows={4} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        <button className="pg-button" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
      </form> : null}
    </>
  );
}
