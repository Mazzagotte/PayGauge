"use client";

import { PageHeader } from "../../../../components/navigation/PageHeader";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { ChipGroup } from "../../../../components/ChipGroup";
import { MiniCalendar } from "../../../../components/MiniCalendar";

import { LoanCategoryIcon, loanCategories } from "../../../../components/loans/LoanCategoryIcon";
import { type LoanCategory, type LoanRecurrence, type PaidWith, type PaymentType, formatDate, getLoan, isPayoffTargetCategory, previewNextDueDate, updateLoan } from "../../../../lib/api";

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return "th";
  return ["th", "st", "nd", "rd"][day % 10] ?? "th";
}

export default function Page() {
  const router = useRouter();
  const [loanId, setLoanId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingStart, setEditingStart] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other" as LoanCategory, paidWith: "other" as PaidWith, originalAmount: "", paymentAmount: "", startDate: "", dueDay: "", interestRate: "0", recurrence: "monthly" as LoanRecurrence, autopay: false, notes: "" });
  const nextDuePreview = previewNextDueDate(form.startDate, form.dueDay);
  const isPayoffTarget = isPayoffTargetCategory(form.category);

  useEffect(() => {
    setLoanId(new URLSearchParams(window.location.search).get("id"));
  }, []);

  useEffect(() => {
    async function loadLoan(id: string) {
      try {
        const loan = await getLoan(id);
        setForm({ name: loan.name, category: loan.category, paidWith: loan.paid_with, originalAmount: loan.original_amount, paymentAmount: loan.payment_amount, startDate: loan.start_date ?? "", dueDay: loan.due_day ? String(loan.due_day) : "", interestRate: loan.interest_rate ?? "0", recurrence: loan.recurrence ?? "monthly", autopay: loan.autopay, notes: loan.description ?? "" });
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

    const resolvedPaymentType: PaymentType = isPayoffTarget ? 'payoff' : 'ongoing';

    if (resolvedPaymentType === "payoff" && !Number(form.paymentAmount)) {
      setError("Payment amount is required for a payoff target.");
      setSaving(false);
      return;
    }

    try {
      await updateLoan(loanId, { name: form.name, category: form.category, payment_type: resolvedPaymentType, paid_with: form.paidWith, description: form.notes || null, original_amount: (resolvedPaymentType === "ongoing" ? 0 : Number(form.originalAmount)).toFixed(2), payment_amount: Number(form.paymentAmount).toFixed(2), total_number_of_payments: null, interest_rate: Number(form.interestRate || 0).toFixed(4), start_date: form.startDate || null, due_day: form.dueDay ? Number(form.dueDay) : null, recurrence: form.recurrence, autopay: form.autopay });
      router.push(`/loans/detail?id=${loanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update loan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Edit payment" backHref={loanId ? `/loans/detail?id=${loanId}` : "/loans"}
        actions={<button className="pg-link" type="submit" form="edit-loan-form" disabled={saving}>Save</button>} />
      {loading ? <article className="pg-empty-card"><strong>Loading loan</strong><span>Preparing editable fields.</span></article> : null}
      {error ? <p className="pg-error">{error}</p> : null}
      {!loading && loanId ? <form id="edit-loan-form" className="pg-form" onSubmit={handleSubmit}>
        <div className="pg-field"><label>Name</label><input className="pg-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
        <div className="pg-field"><span className="pg-field-label">Category</span><ChipGroup label="Category" value={form.category} onChange={(value) => setForm((prev) => ({ ...prev, category: value }))} options={loanCategories.map((category) => ({ value: category.value, label: category.label, icon: <LoanCategoryIcon category={category.value} /> }))} /></div>
        {isPayoffTarget ? <div className="pg-field"><label>Original amount</label><input className="pg-input" inputMode="decimal" value={form.originalAmount} onChange={(event) => setForm((prev) => ({ ...prev, originalAmount: event.target.value }))} /></div> : null}
        <div className="pg-field"><label>Payment amount</label><input className="pg-input" inputMode="decimal" value={form.paymentAmount} onChange={(event) => setForm((prev) => ({ ...prev, paymentAmount: event.target.value }))} /></div>
        <div className="pg-field"><span className="pg-field-label">Paid with</span><ChipGroup label="Paid with" value={form.paidWith} onChange={(value) => setForm((prev) => ({ ...prev, paidWith: value as PaidWith }))} options={[{ value: "bank-account", label: "Bank account" }, { value: "credit-card", label: "Credit card" }, { value: "other", label: "Other" }]} /></div>
                        <div className="pg-field"><span className="pg-field-label">How often</span><ChipGroup label="How often" scroll value={form.recurrence} onChange={(value) => setForm((prev) => ({ ...prev, recurrence: value as LoanRecurrence }))} options={[{ value: "monthly", label: "Monthly" }, { value: "biweekly", label: "Every 2 weeks" }, { value: "weekly", label: "Weekly" }, { value: "quarterly", label: "Quarterly" }, { value: "annual", label: "Yearly" }]} /></div>
        <div className="pg-field"><span className="pg-field-label">Due day of the month <b className="pg-field-value">{form.dueDay ? `${form.dueDay}${ordinal(Number(form.dueDay))}` : "None"}</b></span>
          <div className="pg-day-picker" role="radiogroup" aria-label="Due day">{Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <button type="button" role="radio" aria-checked={form.dueDay === day} className={`pg-day ${form.dueDay === day ? "active" : ""}`} key={day} onClick={() => setForm((prev) => ({ ...prev, dueDay: day }))}>{day}</button>)}</div>
        </div>
        <div className="pg-field"><span className="pg-field-label">Start date <b className="pg-field-value">{formatDate(form.startDate || null)}</b></span>
          {editingStart ? <MiniCalendar label="Start date" value={form.startDate} onChange={(value) => { setForm((prev) => ({ ...prev, startDate: value })); setEditingStart(false); }} /> : <button type="button" className="pg-button secondary small pg-fit" onClick={() => setEditingStart(true)}>Change start date</button>}
        </div>
                <article className="pg-insight-card"><CalendarDays aria-hidden="true" /><div><strong>Next due {nextDuePreview ? formatDate(nextDuePreview.toISOString().slice(0, 10)) : "not set"}</strong><span>Based on the start date and due day.</span></div></article>
        {isPayoffTarget ? <div className="pg-field"><label>Interest rate <span className="pg-optional">optional</span></label><input className="pg-input" inputMode="decimal" value={form.interestRate} onChange={(event) => setForm((prev) => ({ ...prev, interestRate: event.target.value }))} /></div> : null}
        <button type="button" className="pg-toggle-row" role="switch" aria-checked={form.autopay} onClick={() => setForm((prev) => ({ ...prev, autopay: !prev.autopay }))}><span><b>Autopay</b><span>You&apos;ll confirm it went through before it counts.</span></span><span aria-hidden="true" className={`pg-switch ${form.autopay ? "" : "off"}`}><span /></span></button>
        <div className="pg-field"><label>Notes <span className="pg-optional">optional</span></label><textarea className="pg-textarea" rows={3} value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
        <button className="pg-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </form> : null}
    </>
  );
}
