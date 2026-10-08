import { Link } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, juri, secondsUntil, mmss } from "../lib/format.js";
import RingChart from "../components/RingChart.jsx";
import EmptyState from "../components/EmptyState.jsx";
import BuyJuriModal from "../components/BuyJuriModal.jsx";
import { useState } from "react";

// SPEC 8.8 — juror dashboard.
export default function Juror() {
  const { state, account } = useJuri();
  const [buyOpen, setBuyOpen] = useState(false);
  const pending = state.pending[account] || { eth: 0, juri: 0 };
  const cases = JuriDAO.jurorCases(state, account);
  const stats = JuriDAO.jurorStats(state, account);
  const notes = JuriDAO.notificationsFor(state, account).slice(0, 5);

  const stakedCourts = state.courts
    .map((c) => ({ court: c, stake: (state.stake[c.id] && state.stake[c.id][account]) || 0 }))
    .filter((x) => x.stake > 0);

  const open = cases.filter((c) => !c.closed);
  const votePending = open.filter((c) => c.status === "needs commit" || c.status === "needs reveal");
  const inProgress = open.filter((c) => c.status === "committed" || c.status === "revealed" || c.status === "missed");
  const closed = cases.filter((c) => c.closed);

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Juror dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Pending ETH">{ethFromMicro(pending.eth)}</Card>
        <Card title="Pending JURI">{juri(pending.juri)}</Card>
        <Card title="Vote pending">{votePending.length}</Card>
        <Card title="In progress / closed">{inProgress.length} / {closed.length}</Card>
      </div>
      <p className="text-sm"><Link to="/rewards" className="text-[#38bdf8]">Claim on the Rewards page →</Link></p>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 flex items-center gap-6">
        <RingChart pct={stats.performancePct} />
        <div className="text-sm text-gray-300">
          <p>Performance: <b>{stats.performancePct}%</b> coherent ({stats.coherent} of {stats.settled} settled cases)</p>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Your staked courts</h2>
        {stakedCourts.length === 0 ? <EmptyState text="Nothing here yet" /> : (
          <ul className="text-sm space-y-1">
            {stakedCourts.map(({ court, stake }) => (
              <li key={court.id} className="text-gray-300">
                {court.name}: {juri(stake)} JURI · draw chance {court.totalStaked > 0 ? Math.round((stake / court.totalStaked) * 100) : 0}%
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Ongoing cases</h2>
        {open.length === 0 ? <EmptyState text="Nothing here yet" /> : (
          <ul className="space-y-2">
            {open.map((c) => {
              const d = state.disputes.find((x) => x.id === c.disputeId);
              const tag = c.status === "needs commit" ? "Commit needed" : c.status === "needs reveal" ? "Reveal needed" : "Waiting";
              return (
                <li key={c.disputeId} className="bg-[#1c1530] border border-[#3a2f5a] rounded-xl p-3 text-sm flex justify-between flex-wrap gap-2">
                  <span>Case #{c.disputeId} — {d ? d.question : ""}</span>
                  <span className="text-[#38bdf8]">{tag}{d ? ` · ${mmss(secondsUntil(state, JuriDAO.periodEnd(state, d)))}` : ""}</span>
                  <Link to={`/cases/${c.disputeId}`} className="text-[#8b5cf6]">Open</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Latest notifications</h2>
        {notes.length === 0 ? <EmptyState text="Nothing here yet" /> : (
          <ul className="text-sm space-y-1">
            {notes.map((n, i) => (
              <li key={i}><Link to={n.link} className="text-[#38bdf8]">{n.text}</Link></li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2">
        <Link to="/courts" className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 py-2.5 text-white">Join a court</Link>
        <button className="min-h-[44px] rounded-lg border border-[#38bdf8] text-[#38bdf8] px-4" onClick={() => setBuyOpen(true)}>Get JURI</button>
      </div>
      <BuyJuriModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-[#1c1530] border border-[#3a2f5a] rounded-2xl p-4">
      <div className="text-xs uppercase text-gray-500">{title}</div>
      <div className="text-xl font-bold mt-1">{children}</div>
    </div>
  );
}
