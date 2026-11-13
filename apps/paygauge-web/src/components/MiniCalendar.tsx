"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { localDateKey, monthDays } from "../lib/calendar";

type MiniCalendarProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** Optional ISO date; earlier days are disabled. */
  min?: string;
  /** Optional ISO date; later days are disabled. */
  max?: string;
};

/** In-app date picker styled like the Calendar tab, replacing Android's native date dialog. */
export function MiniCalendar({ value, onChange, label, min, max }: MiniCalendarProps) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const today = localDateKey(new Date());
  const title = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month);

  return (
    <div className="pg-mini-cal" role="group" aria-label={label}>
      <div className="pg-mini-cal-head">
        <button type="button" className="pg-icon-ghost" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft aria-hidden="true" /></button>
        <strong aria-live="polite">{title}</strong>
        <button type="button" className="pg-icon-ghost" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="pg-calendar-grid pg-mini-cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <strong key={`${day}-${index}`} aria-hidden="true">{day}</strong>)}
        {monthDays(month).map((date, index) => {
          if (!date) return <span aria-hidden="true" key={`blank-${index}`} />;
          const disabled = Boolean((min && date < min) || (max && date > max));
          return (
            <button type="button" key={date} disabled={disabled}
              className={`pg-day ${value === date ? "active" : ""} ${date === today ? "today" : ""}`}
              aria-pressed={value === date}
              aria-label={new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00`))}
              onClick={() => onChange(date)}>
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
