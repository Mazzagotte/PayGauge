"use client";

import Link from "next/link";
import { PageHeader } from "../../../components/navigation/PageHeader";
import { ArrowUpRight, Search, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import { ChipGroup } from "../../../components/ChipGroup";
import { type Loan, daysUntil, formatDate, formatMoney, formatNumber, getLoans, recurrenceLabel } from "../../../lib/api";

type Filter = "all" | "payoff" | "ongoing" | "soon" | "autopay" | "done";
type Sort = "due" | "balance" | "name";

function matches(loan: Loan, filter: Filter) {
  if (filter === "done") return loan.status !== "active";
  if (loan.status === "archived") return false;
  if (filter === "payoff" || filter === "ongoing") return loan.payment_type === filter;
  if (filter === "autopay") return loan.status === "active" && loan.autopay;
  if (filter === "soon") { const days = daysUntil(loan.next_due_date); return loan.status === "active" && days !== null && days <= 14; }
  return true;
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("due");
  const [error, setError] = useState<string | null>(null);

  const filteredLoans = useMemo(() => loans.filter((loan) => matches(loan, filter) && loan.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "balance") return Number(b.current_balance) - Number(a.current_balance) || a.name.localeCompare(b.name);
    return (a.next_due_date ?? "9999").localeCompare(b.next_due_date ?? "9999") || a.name.localeCompare(b.name);
  }), [filter, sort, loans, query]);
  const count = (value: Filter) => loans.filter((loan) => matches(loan, value)).length;

  useEffect(() => {
    async function loadLoans() {
      try {
        setLoans(await getLoans());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payments are unavailable");
      } finally {
        setLoading(false);
      }
    }
    void loadLoans();
  }, []);

  function clearFilters() {
    setFilter("all");
    setQuery("");
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" }, { value: "payoff", label: "Debts" }, { value: "ongoing", label: "Bills" },
    { value: "soon", label: "Due soon" }, { value: "autopay", label: "Autopay" }, { value: "done", label: "Paid off" },
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="Your debts and recurring bills." />

      <label className="pg-search-field pg-payments-search">
        <Search aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payments" aria-label="Search payments" />
      </label>

      <ChipGroup<Filter> label="Filter payments" scroll className="pg-filter-chips" value={filter} onChange={setFilter}
        options={filters.map((item) => ({ value: item.value, label: <>{item.label}{!loading && item.value !== "all" ? <span className="pg-chip-count">{count(item.value)}</span> : null}</> }))} />

      <div className="pg-list-toolbar">
        <span>{loading ? "Loading…" : `${filteredLoans.length} ${filteredLoans.length === 1 ? "account" : "accounts"}`}</span>
        <div className="pg-segmented pg-sort" role="radiogroup" aria-label="Sort by">
          {([["due", "Due"], ["balance", "Balance"], ["name", "A–Z"]] as const).map(([value, label]) => (
            <button type="button" role="radio" aria-checked={sort === value} className={sort === value ? "active" : ""} key={value} onClick={() => setSort(value)}>{label}</button>
          ))}
        </div>
      </div>

      {error ? <p className="pg-error" role="alert">{error}</p> : null}
      {loading ? <article className="pg-empty-card"><strong>Loading payments</strong><span>Checking your accounts...</span></article> : null}

      <div className="pg-stack" aria-label="Payment accounts">
        {filteredLoans.map((loan) => {
          const isDebt = loan.payment_type === "payoff";
          const progress = Math.max(0, Math.min(100, loan.progress_percentage));
          return (
            <article className="pg-loan-card pg-payment-account" key={loan.id}>
              <Link href={`/loans/detail?id=${loan.id}`}>
                <div className="pg-row">
                  <div className="pg-left">
                    <span className={`pg-token ${categoryTone(loan.category)}`}><LoanCategoryIcon category={loan.category} /></span>
                    <div className="pg-payment-account-name"><h2 className="pg-name">{loan.name}</h2><p className="pg-detail">{recurrenceLabel(loan.recurrence ?? "monthly")}</p></div>
                  </div>
                  <div className="pg-amount"><strong>{formatMoney(loan.payment_amount, 2)}</strong><span>per payment</span></div>
                </div>
                <div className="pg-payment-account-meta">
                  <span>{loan.status === "active" ? `Next due ${formatDate(loan.next_due_date)}` : loan.status === "completed" ? "Completed" : "Archived"}</span>
                  {loan.status === "active" ? <span className="pg-payment-badge">{loan.autopay ? "Autopay" : "Manual"}</span> : null}
                </div>
                {isDebt ? (
                  <div className="pg-payment-debt-details">
                    <div className="pg-row">
                      <div><strong>{formatMoney(loan.current_balance, 2)}</strong><span> balance remaining</span></div>
                      <span>{formatNumber(loan.payments_remaining)} est. payments left</span>
                    </div>
                    <div className={`pg-progress ${loan.status === "completed" ? "green" : ""}`} role="progressbar" aria-label={`${loan.name} balance paid off`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <p className="pg-section-note">{Number(loan.current_balance) > Number(loan.original_amount) ? "Balance exceeds original amount" : `${formatNumber(progress, 2)}% of balance paid off`}</p>
                  </div>
                ) : null}
              </Link>
            </article>
          );
        })}
      </div>

      {!loading && !error && filteredLoans.length === 0 ? (
        <article className="pg-empty-card pg-loans-empty">
          <div className="pg-empty-icon"><WalletCards aria-hidden="true" /></div>
          <div>
            <strong>{loans.length === 0 ? "Your payment picture starts here" : "No matching payments"}</strong>
            <span>{loans.length === 0 ? "Add a debt or recurring bill to get started." : "Try another search or clear your filters."}</span>
          </div>
          {loans.length === 0 ? <Link className="pg-button" href="/loans/new">Add your first payment <ArrowUpRight aria-hidden="true" /></Link> : <button className="pg-button secondary" type="button" onClick={clearFilters}>Clear filters</button>}
        </article>
      ) : null}
    </>
  );
}
