import { useId, type ReactNode } from "react";

type ProgressRingProps = {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  children?: ReactNode;
};

/** The Tally ring: a muted track with a blue-to-violet arc, starting at 12 o'clock. */
export function ProgressRing({ value, size = 132, stroke = 12, label, children }: ProgressRingProps) {
  const id = `pg-ring-${useId().replace(/:/g, "")}`;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);
  const visible = clamped > 0 ? Math.max(clamped, 1.5) : 0;
  return (
    <div className="pg-ring" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(clamped)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle className="pg-ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        {visible > 0 ? (
          <circle className="pg-ring-arc" cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#${id})`} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${(circumference * visible) / 100} ${circumference}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </svg>
      {children ? <div className="pg-ring-center">{children}</div> : null}
    </div>
  );
}
