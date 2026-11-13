"use client";

import { ArrowLeft, Check, CreditCard, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { ChipGroup } from "../../../../components/ChipGroup";
import { MiniCalendar } from "../../../../components/MiniCalendar";
import { LoanCategoryIcon, inferLoanCategory, loanCategories } from "../../../../components/loans/LoanCategoryIcon";
import { createLoan, currentLocalDate, estimatePaymentsRemaining, formatDate, formatMoney, formatNumber, isPayoffTargetCategory, type LoanCategory, type LoanRecurrence, type PaidWith } from "../../../../lib/api";
import { localDateKey } from "../../../../lib/calendar";

type Kind = "debt" | "bill";
const debtCategories: LoanCategory[] = ["loan", "financing"];
const billCategories: LoanCategory[] = ["bill", "subscription", "rent-mortgage", "insurance", "membership", "other"];
const recurrences: { value: LoanRecurrence; label: string }[] = [
  { value: "monthly", label: "Monthly" }, { value: "biweekly", label: "Every 2 weeks" }, { value: "weekly", label: "Weekly" },
  { value: "quarterly", label: "Quarterly" }, { value: "annual", label: "Yearly" },
];
const steps = ["What is it?", "How much?", "When is it due?"];

function addMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), last));
  return target;
}

function addPayments(start: string, recurrence: LoanRecurrence, count: number) {
  const date = new Date(`${start}T00:00:00`);
  if (recurrence === "weekly" || recurrence === "biweekly") {
    date.setDate(date.getDate() + count * (recurrence === "weekly" ? 7 : 14));
    return localDateKey(date);
  }
  return localDateKey(addMonths(date, count * (recurrence === "quarterly" ? 3 : recurrence === "annual" ? 12 : 1)));
}

export default function Page() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    kind: "debt" as Kind,
    category: "loan" as LoanCategory,
    total: "",
    payment: "",
    rate: "",
    nextDue: "",
    recurrence: "monthly" as LoanRecurrence,
    autopay: false,
    paidWith: "bank-account" as PaidWith,
    notes: "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  // Default the first due date to a month from today (set on the client to avoid build-time dates).
  useEffect(() => { setForm((prev) => prev.nextDue ? prev : { ...prev, nextDue: localDateKey(addMonths(new Date(), 1)) }); }, []);

  function setName(name: string) {
    setForm((prev) => {
      if (categoryTouched) return { ...prev, name };
      const inferred = inferLoanCategory(name);
      if (inferred === "personal") return { ...prev, name };
      return { ...prev, name, category: inferred, kind: isPayoffTargetCategory(inferred) ? "debt" : "bill" };
    });
  }

  function setKind(kind: Kind) {
    setForm((prev) => ({ ...prev, kind, category: kind === "debt" ? (debtCategories.includes(prev.category) ? prev.category : "loan") : (billCategories.includes(prev.category) ? prev.category : "bill") }));
  }

  const isDebt = form.kind === "debt";
  const total = Number(form.total);
  const payment = Number(form.payment);
  const estimate = isDebt && total > 0 && payment > 0 ? estimatePaymentsRemaining(form.total, form.payment, form.rate || "0") : 0;
  const payoffDate = estimate && form.nextDue ? addPayments(form.nextDue, form.recurrence, estimate - 1) : null;

  function stepError(index: number) {
    if (index === 0 && !form.name.trim()) return "Give it a name, like \"Car loan\" or \"Netflix\".";
    if (index === 1) {
      if (!(payment > 0)) return "Enter the payment amount.";
      if (isDebt && !(total > 0)) return "Enter how much is still owed.";
      if (isDebt && payment > total) return "The payment is larger than what's owed.";
      if (form.rate && !(Number(form.rate) >= 0 && Number(form.rate) < 100)) return "Interest rate should be between 0 and 100.";
      if (estimate >= 1200) return "At this payment and rate, the balance never goes down. Raise the payment.";
    }
    if (index === 2 && !form.nextDue) return "Pick the next due date.";
    return null;
  }

  function next() {
    const problem = stepError(step);
    setError(problem);
    if (!problem) setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) return next();
    const problem = [0, 1, 2].map(stepError).find(Boolean) ?? null;
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const dueDay = Number(form.nextDue.slice(-2));
      const loan = await createLoan({
        name: form.name.trim(),
        category: form.category,
        description: form.notes.trim() || null,
        original_amount: (isDebt ? total : 0).toFixed(2),
        current_balance: (isDebt ? total : 0).toFixed(2),
        payment_amount: payment.toFixed(2),
        total_number_of_payments: null,
        payment_type: isDebt ? "payoff" : "ongoing",
        paid_with: form.paidWith,
        payments_made: 0,
        interest_rate: Number(form.rate || 0).toFixed(4),
        start_date: currentLocalDate(),
        due_day: dueDay,
        next_due_date: form.nextDue,
        recurrence: form.recurrence,
        autopay: form.autopay,
        status: "active",
      });
      router.push(`/loans/detail?id=${loan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment");
      setSaving(false);
    }
  }

  const categories = loanCategories.filter((category) => (isDebt ? debtCategories : billCategories).includes(category.value));

  return (
    <>
      <header className="pg-standard-header pg-flow-header">
        <div className="pg-standard-header-title">
          {step === 0
            ? <Link className="pg-icon-ghost" href="/loans" aria-label="Close"><ArrowLeft aria-hidden="true" /></Link>
            : <button className="pg-icon-ghost" type="button" aria-label="Previous step" onClick={() => { setError(null); setStep(step - 1); }}><ArrowLeft aria-hidden="true" /></button>}
          <div className="pg-steps" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((label, index) => <span key={label} className={index <= step ? "on" : ""} />)}
          </div>
          <span className="pg-step-count">{step + 1}/{steps.length}</span>
        </div>
        <h1>{steps[step]}</h1>
      </header>

      <form className="pg-form pg-flow" onSubmit={handleSubmit} noValidate>
        {step === 0 ? (
          <>
            <div className="pg-field">
              <label htmlFor="pay-name">Name</label>
              <input id="pay-name" className="pg-input pg-input-lg" autoFocus autoComplete="off" placeholder="Car loan, Netflix, Rent…" value={form.name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="pg-field">
              <span className="pg-field-label">Type</span>
              <div className="pg-kind-grid" role="radiogroup" aria-label="Type">
                <button type="button" role="radio" aria-checked={isDebt} className={`pg-kind ${isDebt ? "active" : ""}`} onClick={() => setKind("debt")}>
                  <Landmark aria-hidden="true" /><b>Debt</b><span>Has a balance to pay off</span>
                </button>
                <button type="button" role="radio" aria-checked={!isDebt} className={`pg-kind ${!isDebt ? "active" : ""}`} onClick={() => setKind("bill")}>
                  <CreditCard aria-hidden="true" /><b>Bill</b><span>Repeats with no end date</span>
                </button>
              </div>
            </div>
            <div className="pg-field">
              <span className="pg-field-label">Category</span>
              <ChipGroup label="Category" value={form.category} onChange={(value) => { setCategoryTouched(true); set("category", value); }}
                options={categories.map((category) => ({ value: category.value, label: category.label, icon: <LoanCategoryIcon category={category.value} /> }))} />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            {isDebt ? (
              <div className="pg-field">
                <label htmlFor="pay-total">Still owed</label>
                <div className="pg-money"><span>$</span><input id="pay-total" className="pg-input pg-input-lg" inputMode="decimal" autoFocus placeholder="0" value={form.total} onChange={(event) => set("total", event.target.value.replace(/[^\d.]/g, ""))} /></div>
              </div>
            ) : null}
            <div className="pg-field">
              <label htmlFor="pay-amount">{isDebt ? "Each payment" : "Amount"}</label>
              <div className="pg-money"><span>$</span><input id="pay-amount" className="pg-input pg-input-lg" inputMode="decimal" autoFocus={!isDebt} placeholder="0" value={form.payment} onChange={(event) => set("payment", event.target.value.replace(/[^\d.]/g, ""))} /></div>
            </div>
            {isDebt ? (
              <div className="pg-field">
                <label htmlFor="pay-rate">Interest rate <span className="pg-optional">optional</span></label>
                <div className="pg-money suffix"><input id="pay-rate" className="pg-input" inputMode="decimal" placeholder="0" value={form.rate} onChange={(event) => set("rate", event.target.value.replace(/[^\d.]/g, ""))} /><span>% APR</span></div>
              </div>
            ) : null}
            {isDebt && estimate > 0 && estimate < 1200 ? (
              <article className="pg-insight-card">
                <Check aria-hidden="true" />
                <div><strong>About {formatNumber(estimate)} payments</strong><span>{payoffDate ? `Paid off around ${formatDate(payoffDate)} if you pay ${formatMoney(payment, 2)} ${recurrences.find((item) => item.value === form.recurrence)?.label.toLowerCase()}.` : null}</span></div>
              </article>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="pg-field">
              <span className="pg-field-label">How often</span>
              <ChipGroup label="How often" scroll value={form.recurrence} onChange={(value) => set("recurrence", value)} options={recurrences} />
            </div>
            <div className="pg-field">
              <span className="pg-field-label">Next due <b className="pg-field-value">{form.nextDue ? formatDate(form.nextDue) : ""}</b></span>
              {form.nextDue ? <MiniCalendar label="Next due date" value={form.nextDue} min={currentLocalDate()} onChange={(value) => set("nextDue", value)} /> : null}
            </div>
            <div className="pg-field">
              <span className="pg-field-label">Paid with</span>
              <ChipGroup label="Paid with" value={form.paidWith} onChange={(value) => set("paidWith", value)}
                options={[{ value: "bank-account", label: "Bank account" }, { value: "credit-card", label: "Credit card" }, { value: "other", label: "Other" }]} />
            </div>
            <button type="button" className="pg-toggle-row" role="switch" aria-checked={form.autopay} onClick={() => set("autopay", !form.autopay)}>
              <span><b>Autopay</b><span>You&apos;ll confirm it went through before it counts.</span></span>
              <span aria-hidden="true" className={`pg-switch ${form.autopay ? "" : "off"}`}><span /></span>
            </button>
            <div className="pg-field">
              <label htmlFor="pay-notes">Notes <span className="pg-optional">optional</span></label>
              <textarea id="pay-notes" className="pg-textarea" rows={2} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
            </div>
          </>
        ) : null}

        {error ? <p className="pg-error" role="alert">{error}</p> : null}

        <div className="pg-flow-actions">
          <button className="pg-button" type="submit" disabled={saving}>
            {step < steps.length - 1 ? "Continue" : saving ? "Saving…" : `Save ${isDebt ? "debt" : "bill"}`}
          </button>
        </div>
      </form>
    </>
  );
}
