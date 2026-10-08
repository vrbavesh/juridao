import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { readFileAsText } from "../lib/evidence.js";
import EmptyState from "../components/EmptyState.jsx";
import PhaseTracker from "../components/PhaseTracker.jsx";
import EvidenceList from "../components/EvidenceList.jsx";
import EvidenceForm from "../components/EvidenceForm.jsx";

// SPEC 8.5 + C3 — Dispute page. Public. Header, PhaseTracker, warning box,
// evidence (grouped + add form), jurors section with the "How the jury was
// drawn" box, collapsible rounds history, final ruling banner.
export default function DisputeDetail() {
  const { id } = useParams();
  const { state, account, act } = useJuri();
  const [openRounds, setOpenRounds] = useState({});
  const dispute = state.disputes.find((d) => d.id === Number(id));

  if (!dispute) return <EmptyState text="Dispute not found." />;

  const deal = state.deals.find((d) => d.id === dispute.dealId);
  const court = state.courts.find((c) => c.id === dispute.courtId);
  const names = state.accounts;
  const warning = JuriDAO.disputeWarning(state, dispute);
  const r = dispute.rounds[dispute.round];
  const drawn = r ? Object.keys(r.jurors) : [];
  const committed = drawn.filter((a) => r.jurors[a].commit).length;
  const revealed = drawn.filter((a) => r.jurors[a].revealed).length;
  const canShowChoices = dispute.period === "Reveal" || dispute.period === "Appeal" || dispute.period === "Executed";

  const addEvidence = async (title, description, fileName, fileObj) => {
    let fileText = "";
    if (fileObj) {
      try {
        fileText = await readFileAsText(fileObj);
      } catch (e) {
        pushToast(e.message || "Could not read the file", "error");
        return;
      }
    }
    const evId = act((s) =>
      JuriDAO.submitEvidence(s, account, dispute.id, { title, description, fileName, fileText })
    );
    if (evId !== undefined) pushToast("Evidence submitted", "success");
  };

  const toggleRound = (ri) => setOpenRounds({ ...openRounds, [ri]: !openRounds[ri] });

  return (
    <div className="max-w-5xl mx-auto px-3 py-6 space-y-6">
      <p className="text-sm">
        {deal && <Link to={`/deals/${deal.id}`} className="text-[#38bdf8]">← Back to deal #{deal.id}</Link>}
      </p>

      {/* Header (SPEC 8.5) */}
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">Dispute #{dispute.id}</h1>
          <span className="rounded-full border border-[#8b5cf6] text-[#c4b5fd] px-3 py-1 text-sm">{dispute.period}</span>
        </div>
        <p className="text-sm text-gray-300">
          {deal && <Link to={`/deals/${deal.id}`} className="text-[#38bdf8]">{deal.title}</Link>} ·{" "}
          {court ? court.name : "Court " + dispute.courtId} · Round {dispute.round + 1}
        </p>
        <p className="text-sm text-gray-200 bg-[#1c1530] border border-[#3a2f5a] rounded-xl p-3">{dispute.question}</p>
        <div className="text-sm text-gray-300">
          <b>1</b> — {dispute.answers[1]} · <b>2</b> — {dispute.answers[2]}
        </div>
      </header>

      <PhaseTracker dispute={dispute} />

      {warning && (
        <div className="bg-amber-950/50 border border-amber-400/60 text-amber-200 rounded-xl p-3 text-sm">{warning}</div>
      )}

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Evidence</h2>
        <EvidenceList evidence={dispute.evidence} names={names} />
        {dispute.period !== "Executed" && <EvidenceForm onSubmit={addEvidence} />}
      </section>

      <JurorsSection
        dispute={dispute}
        state={state}
        r={r}
        drawn={drawn}
        committed={committed}
        revealed={revealed}
        canShowChoices={canShowChoices}
      />

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Rounds history</h2>
        <ul className="space-y-2">
          {dispute.rounds.map((round, ri) => (
            <li key={ri} className="border border-[#3a2f5a] rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] text-sm text-left"
                onClick={() => toggleRound(ri)}
              >
                <span>
                  Round {ri + 1} — {Object.values(round.jurors).reduce((n, j) => n + j.draws, 0)} draws
                  {ri === dispute.round ? " (current)" : ""}
                </span>
                <span className="text-gray-400">{openRounds[ri] ? "▾" : "▸"}</span>
              </button>
              {openRounds[ri] && (
                <div className="px-4 pb-3 text-sm text-gray-300 space-y-1">
                  <div>Jurors drawn: {Object.keys(round.jurors).length} · draws: {Object.values(round.jurors).reduce((n, j) => n + j.draws, 0)}</div>
                  <div>Ruling: {rulingText(round.ruling)}</div>
                  {round.tally && round.tally[0] !== undefined && (
                    <div>Tally — Answer 1: {round.tally[1]}, Answer 2: {round.tally[2]}</div>
                  )}
                  {ri < dispute.round && round.funded && (round.funded[1] > 0 || round.funded[2] > 0) && (
                    <div>
                      Appeal funding — side 1: {(round.funded[1] / 1000000).toFixed(4)} ETH, side 2: {(round.funded[2] / 1000000).toFixed(4)} ETH
                    </div>
                  )}
                  {ri < dispute.round && dispute.period === "Executed" && <div>Settled: {roundSettled(round)}</div>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {dispute.period === "Executed" && (
        <section className="bg-[#1c1530] border border-[#8b5cf6] rounded-2xl p-5 space-y-2">
          <h2 className="font-semibold">Final ruling</h2>
          <p className="text-lg font-bold text-[#8b5cf6]">{rulingText(dispute.finalRuling)}</p>
          <p className="text-sm text-gray-300">{payoutText(deal, dispute.finalRuling, names)}</p>
        </section>
      )}
    </div>
  );
}

function JurorsSection({ dispute, state, r, drawn, committed, revealed, canShowChoices }) {
  if (dispute.period === "Evidence") {
    return (
      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Jurors</h2>
        <p className="text-sm text-gray-500">Jurors are drawn when the Evidence phase ends.</p>
      </section>
    );
  }
  const court = state.courts.find((c) => c.id === dispute.courtId);
  const totalStaked = (court && court.totalStaked) || 0;
  const partyNames = [state.accounts[dispute.partyA]?.name || dispute.partyA, state.accounts[dispute.partyB]?.name || dispute.partyB];
  const partiesExcluded = !drawn.some((a) => a === dispute.partyA || a === dispute.partyB);
  const totalDraws = drawn.reduce((n, a) => n + r.jurors[a].draws, 0);

  return (
    <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-4">
      <h2 className="font-semibold">Jurors</h2>

      <div className="text-sm text-gray-300 space-y-1">
        <div>
          Committed: <b>{committed} of {drawn.length}</b>
        </div>
        {dispute.period !== "Commit" && (
          <div>
            Revealed: <b>{revealed} of {drawn.length}</b>
          </div>
        )}
      </div>

      {canShowChoices && (
        <div className="text-sm text-gray-300">
          <div className="text-gray-500 mb-1">Tally</div>
          <p>Answer 1 (pay the freelancer): <b>{r.tally[1]}</b> · Answer 2 (refund the client): <b>{r.tally[2]}</b></p>
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-gray-200 mb-1.5">Drawn jurors</div>
        <ul className="space-y-2">
          {drawn.map((a) => {
            const j = r.jurors[a];
            return (
              <li key={a} className="bg-[#0f0b1a] border border-[#3a2f5a] rounded-xl p-3 text-sm">
                <div className="flex justify-between gap-2 flex-wrap">
                  <span className="font-medium text-gray-200">{state.accounts[a]?.name || a}</span>
                  <span className="text-gray-400">{j.draws} draw{j.draws > 1 ? "s" : ""}</span>
                </div>
                {canShowChoices && j.choice === 0 && !j.revealed
                  ? <div className="text-gray-500 mt-1">Did not reveal</div>
                  : canShowChoices && (
                      <div className="mt-1 text-gray-300">
                        Chose: <b>{j.choice === 1 ? "Answer 1 — pay the freelancer" : "Answer 2 — refund the client"}</b>
                        {j.justification && <div className="text-xs text-gray-400 mt-0.5">{j.justification}</div>}
                      </div>
                    )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* C3 "How the jury was drawn" box */}
      <div className="bg-[#0f0b1a] border border-[#3a2f5a] rounded-xl p-3 text-sm">
        <div className="font-medium text-gray-200 mb-1.5">How the jury was drawn</div>
        <ul className="space-y-0.5 text-gray-300">
          {drawn.map((a) => {
            const j = r.jurors[a];
            const st = (state.stake[dispute.courtId] && state.stake[dispute.courtId][a]) || 0;
            const pct = totalStaked > 0 ? Math.round((st / totalStaked) * 100) : 0;
            return (
              <li key={a}>
                <b>{state.accounts[a]?.name || a}</b> — {j.draws} draw{j.draws > 1 ? "s" : ""}, stake weight {pct}%
              </li>
            );
          })}
        </ul>
        <p className={partiesExcluded ? "text-emerald-300 mt-1.5" : "text-red-300 mt-1.5"}>
          {partiesExcluded ? "✓" : "✗"} Parties excluded: {partyNames.join(" and ")} cannot be jurors in this case
        </p>
        <p className="text-gray-300">Jury size: {totalDraws} draw{totalDraws === 1 ? "" : "s"} (round size {r.numDraws})</p>
      </div>
    </section>
  );
}

function roundSettled(round) {
  return `fees pool ${(round.feesPool / 1000000).toFixed(4)} ETH · ${Object.keys(round.jurors).length} jurors`;
}

function rulingText(ruling) {
  if (ruling === 1) return "Freelancer paid";
  if (ruling === 2) return "Client refunded";
  return "No majority: split 50/50";
}

function payoutText(deal, final, names) {
  if (!deal) return "";
  const cli = names[deal.client]?.name || deal.client;
  const free = names[deal.freelancer]?.name || deal.freelancer;
  if (final === 1) return `${(deal.amount / 1000000).toFixed(4)} ETH went to ${free} (the freelancer).`;
  if (final === 2) return `${(deal.amount / 1000000).toFixed(4)} ETH went back to ${cli} (the client).`;
  return `The amount was split 50/50 between ${cli} and ${free}.`;
}