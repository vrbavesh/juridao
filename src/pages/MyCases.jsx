import { useState } from "react";
import { Link } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { secondsUntil, mmss } from "../lib/format.js";
import EmptyState from "../components/EmptyState.jsx";

// SPEC 8.9 — My cases with tabs.
export default function MyCases() {
  const { state, account } = useJuri();
  const [tab, setTab] = useState("vote pending");
  const cases = JuriDAO.jurorCases(state, account);

  const groups = {
    "vote pending": cases.filter((c) => !c.closed && (c.status === "needs commit" || c.status === "needs reveal")),
    "in progress": cases.filter((c) => !c.closed && (c.status === "committed" || c.status === "revealed" || c.status === "missed")),
    closed: cases.filter((c) => c.closed),
  };
  const list = groups[tab];

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 space-y-4">
      <h1 className="text-2xl font-bold">My cases</h1>
      <div className="flex gap-2 border-b border-[#3a2f5a]">
        {Object.keys(groups).map((k) => (
          <button key={k} className={`min-h-[44px] px-4 capitalize ${tab === k ? "border-b-2 border-[#8b5cf6] text-white" : "text-gray-400"}`} onClick={() => setTab(k)}>
            {k} ({groups[k].length})
          </button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState text="Nothing here yet" /> : (
        <ul className="space-y-2">
          {list.map((c) => {
            const d = state.disputes.find((x) => x.id === c.disputeId);
            const court = d ? state.courts.find((x) => x.id === d.courtId) : null;
            return (
              <li key={c.disputeId} className="bg-[#1c1530] border border-[#3a2f5a] rounded-xl p-4 text-sm flex flex-wrap justify-between gap-2">
                <span>#{c.disputeId} — {court ? court.name : ""}</span>
                <span className="text-gray-300 flex-1 min-w-[200px]">{d ? d.question : ""}</span>
                <span className="text-[#38bdf8]">{d ? `${d.period} · ${mmss(secondsUntil(state, JuriDAO.periodEnd(state, d)))}` : ""}</span>
                <span className="text-gray-400">{c.status}</span>
                <Link to={`/cases/${c.disputeId}`} className="text-[#8b5cf6]">Open</Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
