"use client";

import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

type ChipGroupProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Single scrolling line instead of wrapping (hub's .hscroll). */
  scroll?: boolean;
  className?: string;
};

/** Tappable chips in place of a native <select> (hub .filter / .choice style). */
export function ChipGroup<T extends string>({ options, value, onChange, label, scroll, className = "" }: ChipGroupProps<T>) {
  return (
    <div className={`pg-chip-row ${scroll ? "scroll" : ""} ${className}`} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button type="button" role="radio" aria-checked={value === option.value} className={`pg-pill ${value === option.value ? "active" : ""}`}
          key={option.value} onClick={() => onChange(option.value)}>
          {option.icon}{option.label}
        </button>
      ))}
    </div>
  );
}
