import JuriDAO from "../lib/juridao-engine.js";
import { secondsUntil, mmss } from "../lib/format.js";
import { useJuri } from "../lib/store.js";

// PhaseTracker (B4: { dispute }) — Evidence → Jurors drawn → Voting (Commit) →
// Reveal → Appeal window → Final, with the current round number and a live
// countdown to periodEnd (SPEC 8.5). Display-only.
const ORDER = [
  { key: "Evidence", label: "Evidence" },
  { key: "Drawn", label: "Jurors drawn" },
  { key: "Commit", label: "Voting (Commit)" },
  { key: "Reveal", label: "Reveal" },
  { key: "Appeal", label: "Appeal window" },
  { key: "Executed", label: "Final" },
];

function currentIndex(period) {
  switch (period) {
    case "Evidence": return 0;
    case "Commit": return 2;
    case "Reveal": return 3;
    case "Appeal": return 4;
    case "Executed": return 5;
    default: return 5;
  }
}

export default function PhaseTracker({ dispute }) {
  const { state } = useJuri();
  const now = JuriDAO.nowOf(state);
  const idx = currentIndex(dispute.period);
  const ended = now >= JuriDAO.periodEnd(state, dispute);
  const label = dispute.period === "Executed" ? "Final — case closed" : ended ? "Time is up" : mmss(secondsUntil(state, JuriDAO.periodEnd(state, dispute)));

  return (
    <div className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-4">
      <ol className="flex flex-wrap gap-x-2 gap-y-2 text-sm items-center">
        {ORDER.map((s, i) => {
          const done = dispute.period === "Executed" ? i < 5 : i < idx;
          const current = i === idx;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 whitespace-nowrap ${
                  current ? "bg-[#8b5cf6] border-[#8b5cf6] text-white"
                  : done ? "border-[#3a2f5a] text-gray-400"
                  : "border-[#3a2f5a] text-gray-600"
                }`}
              >
                {done ? "✓ " : ""}{s.label}
              </span>
              {i < ORDER.length - 1 && <span className="text-gray-600">→</span>}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 text-sm text-gray-300 flex gap-3 flex-wrap">
        <span>Round {dispute.round + 1} of {dispute.rounds.length}</span>
        {dispute.period !== "Executed" && <span className="text-[#38bdf8]">{label}</span>}
      </div>
    </div>
  );
}