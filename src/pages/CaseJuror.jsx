import { Link, useParams } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { mmss, secondsUntil } from "../lib/format.js";
import EmptyState from "../components/EmptyState.jsx";
import EvidenceList from "../components/EvidenceList.jsx";
import VotePanel, { voteStorageKey } from "../components/VotePanel.jsx";

// SPEC 8.10 — Juror case page. Read the case, seal a vote, reveal it, then see
// the reward/penalty from the settled log.
export default function CaseJuror() {
  const { id } = useParams();
  const { state, account } = useJuri();
  const dispute = state.disputes.find((d) => d.id === Number(id));

  if (!dispute) return <EmptyState text="Case not found." />;

  const deal = state.deals.find((d) => d.id === dispute.dealId);
  const court = state.courts.find((c) => c.id === dispute.courtId);
  const round = dispute.rounds[dispute.round];
  const me = round.jurors[account];
  const drawn = !!me;
  const votingOpen = dispute.period === "Commit" || dispute.period === "Reveal";
  let storedVote = null;
  if (drawn) {
    try {
      storedVote = JSON.parse(localStorage.getItem(voteStorageKey(dispute, account)) || "null");
    } catch {
      storedVote = null;
    }
  }

  const settledEntries = state.log.filter(
    (e) => e.type === "settled" && e.disputeId === dispute.id && e.who === account
  );
  const mySettled = settledEntries[settledEntries.length - 1];

  return (
    <div className="max-w-4xl mx-auto px-3 py-6 space-y-6">
      <p className="text-sm flex gap-3 flex-wrap">
        <Link to="/cases" className="text-[#38bdf8]">← My cases</Link>
        <Link to={`/disputes/${dispute.id}`} className="text-[#38bdf8]">Public dispute page →</Link>
      </p>

      {!drawn && (
        <div className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
          <h1 className="text-xl font-bold mb-1">Case #{dispute.id}</h1>
          <p className="text-sm text-gray-300">You were not drawn for this case.</p>
        </div>
      )}

      {drawn && (
        <>
          <header className="space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">Case #{dispute.id}</h1>
              <span className="rounded-full border border-[#8b5cf6] text-[#c4b5fd] px-3 py-1 text-sm">
                {dispute.period} · Round {dispute.round + 1}
              </span>
            </div>
            <p className="text-sm text-gray-300">
              {court ? court.name : "Court " + dispute.courtId} · {votingOpen
                ? mmss(secondsUntil(state, JuriDAO.periodEnd(state, dispute))) + " left"
                : ""}
            </p>
            <p className="text-sm text-gray-200 bg-[#1c1530] border border-[#3a2f5a] rounded-xl p-3">{dispute.question}</p>
            <div className="text-sm text-gray-300">
              <b>1</b> — {dispute.answers[1]} · <b>2</b> — {dispute.answers[2]}
            </div>
            {deal && (
              <p className="text-sm text-gray-400">
                Deal: <Link to={`/deals/${deal.id}`} className="text-[#38bdf8]">#{deal.id} {deal.title}</Link>
              </p>
            )}
          </header>

          {court && (
            <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
              <h2 className="font-semibold text-sm mb-1">Court policy</h2>
              <p className="text-sm text-gray-300">{court.policy}</p>
            </section>
          )}

          {deal && (
            <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
              <h2 className="font-semibold mb-2">Delivery criteria</h2>
              <ul className="list-disc pl-5 text-sm text-gray-300 space-y-0.5">
                {deal.criteria.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </section>
          )}

          <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
            <h2 className="font-semibold">Evidence</h2>
            <EvidenceList evidence={dispute.evidence} names={state.accounts} />
          </section>

          {votingOpen && (
            <div className="bg-amber-950/50 border border-amber-400/60 text-amber-200 rounded-xl p-3 text-sm">
              If you do not commit and reveal, or you vote against the majority, you lose the JURI locked for this case.
            </div>
          )}

          <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
            <h2 className="font-semibold mb-3">Your vote</h2>
            <VotePanel dispute={dispute} account={account} storedVote={storedVote} />
          </section>

          {dispute.period === "Executed" && (
            <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-2">
              <h2 className="font-semibold">Result</h2>
              {mySettled ? (
                <>
                  <p className={mySettled.coherent ? "text-emerald-300 text-sm" : "text-red-300 text-sm"}>
                    Round {mySettled.round + 1}: you {mySettled.coherent ? "voted with the majority" : "did not vote with the majority (or did not reveal)"}.
                  </p>
                  <ul className="text-sm text-gray-300 space-y-0.5">
                    {mySettled.ethReward > 0 && <li>ETH reward: {(mySettled.ethReward / 1000000).toFixed(4)} ETH</li>}
                    {mySettled.juriReward > 0 && <li>JURI reward: {mySettled.juriReward} JURI</li>}
                    {mySettled.penalty > 0 && <li className="text-red-300">JURI penalty: −{mySettled.penalty} JURI</li>}
                    {mySettled.ethReward === 0 && mySettled.juriReward === 0 && mySettled.penalty === 0 && (
                      <li className="text-gray-500">No reward or penalty in this round.</li>
                    )}
                  </ul>
                  <p className="text-xs text-gray-500">
                    Claim rewards from the <Link to="/rewards" className="text-[#38bdf8]">Rewards page</Link>.
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400">This round did not involve you.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}