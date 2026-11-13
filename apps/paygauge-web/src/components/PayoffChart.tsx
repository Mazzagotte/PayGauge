import { useId } from "react";

import type { PayoffPoint } from "../lib/api";

type PayoffChartProps = {
  base: PayoffPoint[];
  faster?: PayoffPoint[];
  startLabel: string;
  endLabel: string;
  fasterEndLabel?: string;
};

const W = 320;
const H = 140;
const PAD = { top: 10, right: 8, bottom: 22, left: 8 };

/** Balance-over-time lines: current pace (muted) vs. with extra payments (accent). */
export function PayoffChart({ base, faster, startLabel, endLabel, fasterEndLabel }: PayoffChartProps) {
  const id = useId().replace(/:/g, "");
  const maxX = Math.max(base.length - 1, 1);
  const maxY = Math.max(base[0]?.balance ?? 0, 1);
  const x = (month: number) => PAD.left + (month / maxX) * (W - PAD.left - PAD.right);
  const y = (balance: number) => PAD.top + (1 - balance / maxY) * (H - PAD.top - PAD.bottom);
  const path = (points: PayoffPoint[]) => points.map((point, index) => `${index ? "L" : "M"}${x(point.month).toFixed(1)},${y(point.balance).toFixed(1)}`).join(" ");
  const accent = faster && faster.length > 1 ? faster : base;
  const area = `${path(accent)} L${x(accent[accent.length - 1].month).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const fasterEnd = faster && faster.length > 1 ? x(faster[faster.length - 1].month) : null;

  return (
    <svg className="pg-payoff-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Balance reaches zero ${fasterEndLabel ?? endLabel}`}>
      <defs>
        <linearGradient id={`${id}-line`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3B82F6" stopOpacity=".18" /><stop offset="1" stopColor="#3B82F6" stopOpacity="0" /></linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} className="pg-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(maxY * fraction)} y2={y(maxY * fraction)} />)}
      <line className="pg-chart-axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />
      <path d={area} fill={`url(#${id}-fill)`} />
      {faster && faster.length > 1 ? <path d={path(base)} className="pg-chart-base" fill="none" /> : null}
      <path d={path(accent)} fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {fasterEnd !== null ? <circle cx={fasterEnd} cy={y(0)} r="4" className="pg-chart-dot" /> : null}
      <circle cx={x(maxX)} cy={y(0)} r="3" className="pg-chart-dot muted" />
      <text x={PAD.left} y={H - 6} className="pg-chart-label">{startLabel}</text>
      <text x={W - PAD.right} y={H - 6} className="pg-chart-label" textAnchor="end">{endLabel}</text>
      {fasterEnd !== null && fasterEndLabel && fasterEnd < W - PAD.right - 70 && fasterEnd > PAD.left + 50 ? (
        <text x={fasterEnd} y={H - 6} className="pg-chart-label accent" textAnchor="middle">{fasterEndLabel}</text>
      ) : null}
    </svg>
  );
}
