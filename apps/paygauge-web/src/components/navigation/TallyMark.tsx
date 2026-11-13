// Tally logo: a progress ring showing what's left, in the mazzagotte.dev mark square.
export function TallyMark({ size = 32 }: { size?: number }) {
  return (
    <span className="pg-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size * 0.78} height={size * 0.78}>
        <defs>
          <linearGradient id="tally-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3B82F6" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="13" />
        <circle cx="50" cy="50" r="34" fill="none" stroke="url(#tally-ring)" strokeWidth="13" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 34 * 0.72} 999`} transform="rotate(-90 50 50)" />
      </svg>
    </span>
  );
}
