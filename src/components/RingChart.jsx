export default function RingChart({ pct = 0, size = 96 }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Performance ${pct}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#3a2f5a" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke="#8b5cf6" strokeWidth="10"
        strokeDasharray={`${c * frac} ${c}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="55" textAnchor="middle" fill="#e5e0f2" fontSize="16">{pct}%</text>
    </svg>
  );
}
