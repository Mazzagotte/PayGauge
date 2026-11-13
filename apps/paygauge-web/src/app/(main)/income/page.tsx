"use client";

import Link from "next/link";
import { PageHeader } from "../../../components/navigation/PageHeader";
import { useEffect, useState, type FormEvent } from "react";

import { formatMoney, getIncomeBreakdown, updateMonthlyIncome, type IncomeBreakdown } from "../../../lib/api";

const colors = { debt: "#2563EB", bills: "#8B5CF6", housing: "#F59E0B" };
const remainderColor = "var(--pg-track)";

export default function Page() {
  const [breakdown, setBreakdown] = useState<IncomeBreakdown | null>(null);
  const [incomeInput, setIncomeInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getIncomeBreakdown().then(data => {
      setBreakdown(data);
      setIncomeInput(data.monthlyIncome ?? "");
    }).catch(err => setError(err instanceof Error ? err.message : "Income breakdown is unavailable."));
  }, []);

  async function saveIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateMonthlyIncome(incomeInput);
      const data = await getIncomeBreakdown();
      setBreakdown(data);
      setIncomeInput(data.monthlyIncome ?? "");
      setStatus("Monthly take-home income saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save monthly income.");
    } finally {
      setSaving(false);
    }
  }

  const income = Number(breakdown?.monthlyIncome ?? 0);
  const scheduled = breakdown?.groups.reduce((total, group) => total + Math.round(Number(group.scheduled) * 100), 0) ?? 0;
  const paid = breakdown?.groups.reduce((total, group) => total + Math.round(Number(group.paid) * 100), 0) ?? 0;
  const committed = scheduled / 100;
  const paidAmount = paid / 100;
  const remainder = Math.max(income - committed, 0);
  const graphTotal = Math.max(income, committed);
  const percentage = (amount: number) => income > 0 ? `${(amount / income * 100).toFixed(1)}%` : "Set income";
  let end = 0;
  const segments = breakdown?.groups.map(group => {
    const start = end;
    end += graphTotal > 0 ? Number(group.scheduled) / graphTotal * 100 : 0;
    return `${colors[group.key]} ${start}% ${end}%`;
  }) ?? [];
  segments.push(`${remainderColor} ${end}% 100%`);

  return (
    <>
      <PageHeader title="Income breakdown" subtitle="Your income compared with tracked payments." />
      {error ? <p className="pg-error" role="alert">{error}</p> : null}
      {!breakdown && !error ? <p className="pg-muted" role="status">Loading income breakdown...</p> : null}

      {breakdown ? (
        <section className="pg-card pg-settings-card" aria-labelledby="breakdown-heading">
          <div className="pg-settings-heading">
            <h2 id="breakdown-heading">{breakdown.month}</h2>
            <p className="pg-section-note">Scheduled commitments, not a complete spending budget.</p>
          </div>
          {income > 0 ? (
            <div className="pg-income-chart" role="img" aria-label={`Scheduled tracked payments: ${formatMoney(committed, 2)}, ${percentage(committed)} of take-home income. ${breakdown.groups.map(group => `${group.label}: ${formatMoney(group.scheduled, 2)}, ${percentage(Number(group.scheduled))}`).join(". ")}. ${income >= committed ? `Income left after scheduled payments: ${formatMoney(remainder, 2)}.` : `Commitments exceed income by ${formatMoney(committed - income, 2)}.`}`}>
              <div className="pg-income-donut" style={{ background: `conic-gradient(${segments.join(", ")})` }}>
                <div className="pg-income-center"><strong>{percentage(committed)}</strong><span>committed</span></div>
              </div>
            </div>
          ) : <p className="pg-muted">Save your monthly take-home income to see the graph and percentages.</p>}
          <dl className="pg-income-legend">
            {breakdown.groups.map(group => (
              <div key={group.key}>
                <dt><span className="pg-income-dot" style={{ background: colors[group.key] }} />{group.label}</dt>
                <dd><strong>{formatMoney(group.scheduled, 2)}</strong><span>{percentage(Number(group.scheduled))}</span></dd>
              </div>
            ))}
            {income > 0 ? <div><dt><span className="pg-income-dot" style={{ background: remainderColor }} />{committed > income ? "Over income" : "Income left after scheduled payments"}</dt><dd><strong>{formatMoney(Math.abs(income - committed), 2)}</strong><span>{percentage(Math.abs(income - committed))}</span></dd></div> : null}
          </dl>
          {committed > income && income > 0 ? <p className="pg-error">Tracked commitments exceed your monthly income. Graph slices show the share of commitments; labels show percentages of income.</p> : null}
          <div className="pg-income-totals">
            <div><span>Scheduled</span><strong>{formatMoney(committed, 2)}</strong><span>{percentage(committed)} of income</span></div>
            <div><span>Recorded paid</span><strong>{formatMoney(paidAmount, 2)}</strong><span>{percentage(paidAmount)} of income</span></div>
          </div>
          <div className="pg-income-paid-bar" role="progressbar" aria-label="Income used by recorded payments" aria-valuemin={0} aria-valuemax={100} aria-valuenow={income > 0 ? Math.min(paidAmount / income * 100, 100) : 0} aria-valuetext={`${formatMoney(paidAmount, 2)} recorded paid; ${percentage(paidAmount)} of income`}>
            <span style={{ width: `${income > 0 ? Math.min(paidAmount / income * 100, 100) : 0}%` }} />
          </div>
          <p className="pg-section-note pg-settings-note">Recorded paid includes payments dated this month through today. Autopay is not paid until confirmed. The graph excludes groceries, gas, savings, and anything else you have not tracked. Income after commitments is not necessarily available to spend.</p>
          <Link className="pg-link pg-settings-note" href="/loans/">Manage tracked payments</Link>
        </section>
      ) : null}
      <section className="pg-card pg-settings-card" aria-labelledby="income-heading">
        <div className="pg-settings-heading">
          <h2 id="income-heading">Monthly take-home income</h2>
          <p className="pg-section-note">Use pay after taxes and deductions. This is an editable monthly baseline, not bank-linked income.</p>
        </div>
        <form className="pg-income-form" onSubmit={event => void saveIncome(event)}>
          <div className="pg-field">
            <label htmlFor="monthly-income">Monthly amount ($)</label>
            <input id="monthly-income" className="pg-input" type="number" inputMode="decimal" min="0.01" step="0.01" required value={incomeInput} disabled={!breakdown || saving} onChange={event => setIncomeInput(event.target.value)} />
          </div>
          <button className="pg-button secondary" type="submit" disabled={!breakdown || saving}>{saving ? "Saving..." : "Save income"}</button>
        </form>
        {status ? <p className="pg-muted" role="status">{status}</p> : null}
      </section>
    </>
  );
}
