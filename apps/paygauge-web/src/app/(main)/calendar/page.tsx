"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LoanCategoryIcon, categoryTone } from "../../../components/loans/LoanCategoryIcon";
import { type DashboardSummary, formatDate, formatMoney, getDashboardSummary, projectPaymentSchedule } from "../../../lib/api";

const days = Array.from({ length: 31 }, (_, index) => index + 1);

export default function Page() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const projectedPayments = useMemo(
    () => summary?.active_loans.flatMap((loan) => projectPaymentSchedule(loan, 6)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) ?? [],
    [summary],
  );
  const dueDays = useMemo(() => new Set(projectedPayments.map((payment) => new Date(`${payment.dueDate}T00:00:00`).getDate())), [projectedPayments]);

  useEffect(() => {
    async function loadSummary() {
      try {
        setSummary(await getDashboardSummary());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Calendar is unavailable");
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, []);

  return (
    <>
      <header className="pg-header">
        <Link className="pg-link" href="/dashboard"><ArrowLeft aria-hidden="true" /> Back</Link>
        <h1 className="pg-title" style={{ fontSize: 16 }}>Payment Calendar</h1>
        <span className="pg-link"><Menu aria-hidden="true" /></span>
      </header>

      {error ? <p className="pg-error">{error}</p> : null}

      <section className="pg-row" style={{ marginBottom: 18 }}>
        <span className="pg-link"><ChevronLeft aria-hidden="true" /></span>
        <strong>October 2026</strong>
        <span className="pg-link"><ChevronRight aria-hidden="true" /></span>
      </section>

      <section className="pg-card">
        <div className="pg-calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
          {days.map((day) => (
            <span className={`pg-day ${day === 5 ? "active" : ""} ${dueDays.has(day) ? "due" : ""}`} key={day}>{day}</span>
          ))}
        </div>
      </section>

      <section className="pg-section-head">
        <h2>Upcoming Payments</h2>
      </section>

      <div className="pg-stack">
        {projectedPayments.slice(0, 12).map((payment) => (
          <Link className="pg-list-card" href={`/loans/detail?id=${payment.loanId}`} key={payment.id}>
            <div className="pg-row">
              <div className="pg-left">
                <span className={`pg-token ${categoryTone(payment.category)}`}><LoanCategoryIcon category={payment.category} /></span>
                <div>
                  <p className="pg-name">{payment.name}</p>
                  <p className="pg-detail">{formatDate(payment.dueDate)}</p>
                </div>
              </div>
              <strong>{formatMoney(payment.amount, 2)}</strong>
            </div>
          </Link>
        ))}
      </div>

      {loading ? <article className="pg-empty-card" style={{ marginTop: 10 }}><strong>Loading calendar</strong><span>Finding upcoming payments.</span></article> : null}
      {!loading && projectedPayments.length === 0 ? <article className="pg-empty-card"><strong>No upcoming payments</strong><span>Add due dates to your loans to populate the calendar.</span></article> : null}
    </>
  );
}
