"use client";

import Link from "next/link";
import { PageHeader } from "../../../components/navigation/PageHeader";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import { type Loan, formatDate, formatMoney, getLoans } from "../../../lib/api";
import { localDateKey, monthDays, paymentsForMonth } from "../../../lib/calendar";

function compactMoney(value: number) {
  if (value >= 10000) return `$${Math.round(value / 1000)}k`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(value)}`;
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [month, setMonth] = useState<Date | null>(null);
  const [today, setToday] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const payments = useMemo(() => month ? paymentsForMonth(loans, month) : [], [loans, month]);
  const cells = useMemo(() => month ? monthDays(month) : [], [month]);
  const total = payments.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0) / 100;
  const visible = selected ? payments.filter((payment) => payment.dueDate === selected) : payments;
  const dates = Array.from(new Set(visible.map((payment) => payment.dueDate)));
  const dayTotal = (date: string) => payments.filter((payment) => payment.dueDate === date).reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0) / 100;
  const weeks = useMemo(() => {
    const rows: { label: string; dates: string[]; total: number }[] = [];
    for (let index = 0; index < cells.length; index += 7) {
      const dates = cells.slice(index, index + 7).filter((date): date is string => Boolean(date));
      if (!dates.length) continue;
      const total = payments.filter((payment) => dates.includes(payment.dueDate)).reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0) / 100;
      const fmt = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
      rows.push({ label: dates.length > 1 ? `${fmt(dates[0])} – ${Number(dates[dates.length - 1].slice(-2))}` : fmt(dates[0]), dates, total });
    }
    return rows;
  }, [cells, payments]);
  const maxWeek = Math.max(...weeks.map((week) => week.total), 0);
  const monthLabel = month ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month) : "Loading month";

  useEffect(() => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setToday(localDateKey(now));
    async function load() {
      try {
        setLoans(await getLoans());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Calendar is unavailable");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function changeMonth(offset: number) {
    if (!month) return;
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelected(null);
  }

  function showToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setToday(localDateKey(now));
    setSelected(null);
  }

  return (
    <>
      <PageHeader title="Calendar" subtitle="Plan ahead with your upcoming payment schedule." />
      {error ? <p className="pg-error" role="alert">{error}</p> : null}
      <div className="pg-calendar-month-nav">
        <button type="button" className="pg-calendar-nav-button" aria-label="Previous month" disabled={!month} onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
        <h2 aria-live="polite">{monthLabel}</h2>
        <button type="button" className="pg-calendar-nav-button" aria-label="Next month" disabled={!month} onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" /></button>
      </div>
      <section className="pg-card" aria-label="Monthly payment calendar">
        <div className="pg-row pg-calendar-total">
          <div><strong>{loading ? "..." : formatMoney(total, 2)}</strong><p className="pg-detail">{payments.length} upcoming {payments.length === 1 ? "payment" : "payments"} this month</p></div>
          <button className="pg-link pg-calendar-text-button" type="button" onClick={showToday}>Today</button>
        </div>
        <div className="pg-calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
          {cells.map((date, index) => {
            if (!date) return <span aria-hidden="true" key={`blank-${index}`} />;
            const due = payments.filter((payment) => payment.dueDate === date);
            return (
              <button className={`pg-day ${selected === date ? "active" : ""} ${date === today ? "today" : ""} ${due.length ? "due" : ""}`} type="button" key={date}
                aria-label={`${formatDate(date)}: ${due.length} ${due.length === 1 ? "payment" : "payments"}`}
                aria-pressed={selected === date} aria-current={date === today ? "date" : undefined}
                onClick={() => setSelected(selected === date ? null : date)}>
                <span className="pg-day-num">{Number(date.slice(-2))}</span>
                {due.length ? <span className="pg-day-amt">{compactMoney(dayTotal(date))}</span> : null}
              </button>
            );
          })}
        </div>
        {maxWeek > 0 ? (
          <div className="pg-week-totals" aria-label="Totals by week">
            {weeks.map((week) => (
              <div className="pg-week" key={week.label}>
                <span>{week.label}</span>
                <span className="pg-week-bar"><span style={{ width: `${maxWeek ? (week.total / maxWeek) * 100 : 0}%` }} /></span>
                <b>{week.total ? formatMoney(week.total) : "–"}</b>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <div className="pg-section-head">
        <h2>{selected ? formatDate(selected) : "This month's payments"}</h2>
        {selected ? <button type="button" className="pg-link pg-calendar-text-button" onClick={() => setSelected(null)}>Show month</button> : null}
      </div>
      <div className="pg-stack">
        {dates.map((date) => {
          const group = visible.filter((payment) => payment.dueDate === date);
          const groupTotal = group.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0) / 100;
          return (
            <section className="pg-list-card" aria-label={`Payments due ${formatDate(date)}`} key={date}>
              <div className="pg-row"><h3 className="pg-name">{formatDate(date)}</h3><strong>{formatMoney(groupTotal, 2)} total</strong></div>
              <div className="pg-calendar-agenda">
                {group.map((payment) => (
                  <Link className="pg-row" href={`/loans/detail?id=${payment.loan.id}`} key={payment.id}>
                    <div className="pg-left">
                      <span className={`pg-token ${categoryTone(payment.loan.category)}`}><LoanCategoryIcon category={payment.loan.category} /></span>
                      <div><p className="pg-name">{payment.loan.name}</p><p className="pg-detail">{payment.loan.autopay ? "Autopay scheduled" : "Manual payment"}</p></div>
                    </div>
                    <strong>{formatMoney(payment.amount, 2)}</strong>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {loading ? <article className="pg-empty-card"><strong>Loading calendar</strong><span>Finding upcoming payments.</span></article> : null}
      {!loading && !error && visible.length === 0 ? (
        <article className="pg-empty-card"><strong>{selected ? "No payments on this date" : "No upcoming payments this month"}</strong>
          <span>{selected ? "Select another day or show the full month." : "Past paid items are in account payment history. Browse another month or add a payment."}</span>
          {loans.length === 0 ? <Link className="pg-button" href="/loans/new">Add Payment</Link> : null}
        </article>
      ) : null}
    </>
  );
}
