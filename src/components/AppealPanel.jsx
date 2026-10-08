import { useState } from "react";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { mmss, secondsUntil } from "../lib/format.js";

// AppealPanel (B4: { dispute, account }) — SPEC 8.6. Shown interactively during
// the Appeal period, read-only afterwards. Funding math follows the engine
// (required[], challenger pays double, first-half challenger window), which is
// the source of truth for every error path.
const SIDES = [
  { side: 1, label: "Pay the freelancer" },
  { side: 2, label: "Refund the client" },
];

export default function AppealPanel({ dispute, account }) {
  const { state, act } = useJuri();
  const [amounts, setAmounts] = useState({ 1: "", 2: "" });

  if (dispute.period !== "Appeal" && dispute.period !== "Executed") return null;

  const deal = state.deals.find((d) => d.id === dispute.dealId);
  const court = state.courts.find((c) => c.id === dispute.courtId);
  const r = dispute.rounds[dispute.round];
  const now = JuriDAO.nowOf(state);
  const winSecs = state.params.Appeal;
  const winEnd = dispute.periodStart + winSecs;
  const over = now >= winEnd;
  const lastRound = dispute.round >= JuriDAO.MAX_ROUNDS - 1;
  const nextSize = 2 * r.numDraws + 1;
  const firstHalfOver = now > dispute.periodStart + winSecs / 2;

  const withdrawable = [];
  if (dispute.period === "Executed") {
    dispute.rounds.forEach((round, ri) => {
      [1, 2].forEach((s) => {
        if ((round.contrib[s] && round.contrib[s][account] || 0) > 0) withdrawable.push({ round: ri, side: s, amount: round.contrib[s][account] });
      });
    });
  }

  const fund = (side) => {
    const amt = Math.round(Number(amounts[side]));
    if (!(amt > 0)) return;
    const taken = act((s) => JuriDAO.fundAppeal(s, account, dispute.id, side, amt));
    if (taken !== undefined) {
      pushToast(`Funded ${(taken / 1000000).toFixed(4)} ETH on side ${side === 1 ? "1 (pay the freelancer)" : "2 (refund the client)"}`, "success");
      setAmounts({ ...amounts, [side]: "" });
    }
  };

  const fundRemaining = (side) => {
    const remaining = Math.max(0, r.required[side] - r.funded[side]);
    setAmounts({ ...amounts, [side]: String(remaining) });
  };

  const execute = () => {
    const ok = act((s) => {
      JuriDAO.executeRuling(s, dispute.id);
      return true;
    });
    if (ok === true) pushToast("Ruling executed", "success");
  };

  const withdraw = (roundIndex, side) => {
    const payout = act((s) => JuriDAO.withdrawAppealFunds(s, account, dispute.id, roundIndex, side));
    if (payout !== undefined) pushToast(`Withdrew ${(payout / 1000000).toFixed(4)} ETH`, "success");
  };

  if (dispute.period === "Executed") {
    return (
      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Appeal summary</h2>
        <p className="text-sm text-gray-300">
          Final ruling: <b>{rulingText(dispute.finalRuling)}</b>. {withdrawable.length === 0
            ? "You have no appeal funds to withdraw."
            : "Your contributed appeal funds can be withdrawn below."}
        </p>
        {withdrawable.length > 0 && (
          <ul className="space-y-2">
            {withdrawable.map(({ round, side, amount }) => (
              <li key={`${round}-${side}`} className="flex items-center justify-between gap-2 flex-wrap text-sm bg-[#0f0b1a] border border-[#3a2f5a] rounded-xl p-3">
                <span>
                  Round {round + 1} · side {side === 1 ? "pay the freelancer" : "refund the client"} — {(
                    amount / 1000000
                  ).toFixed(4)} ETH contributed
                </span>
                <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white" onClick={() => withdraw(round, side)}>
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // ---- Appeal period: interactive ----
  const challenger = r.ruling !== 0 ? (r.ruling === 1 ? 2 : 1) : null;

  return (
    <section className="bg-[#1c1530] rounded-2xl border border-[#8b5cf6] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="font-semibold">Appeal window</h2>
          <p className="text-sm text-gray-300">
            Current ruling: <b>{rulingText(r.ruling)}</b> · Round {dispute.round + 1} · next jury size{" "}
            <b>{nextSize}</b> (2 × {r.numDraws} + 1)
          </p>
        </div>
        <span className="text-[#38bdf8] font-mono">{over ? "window over" : mmss(secondsUntil(state, winEnd))}</span>
      </div>

      {lastRound && (
        <p className="text-sm text-gray-400 border border-[#3a2f5a] rounded-lg p-2">No further appeals after round {dispute.round + 1}.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {SIDES.map(({ side, label }) => {
          const required = r.required[side] || 0;
          const funded = r.funded[side] || 0;
          const remaining = Math.max(0, required - funded);
          const full = r.fullyFunded[side];
          const isChallenger = challenger === side;
          const disabledSecondHalf = isChallenger && firstHalfOver;
          const disabled = !isChallenger && full;
          const partyName = side === 1
            ? (deal && (state.accounts[deal.freelancer]?.name || deal.freelancer)) || "the freelancer"
            : (deal && (state.accounts[deal.client]?.name || deal.client)) || "the client";
          const pct = required > 0 ? Math.min(100, Math.round((funded / required) * 100)) : 0;
          return (
            <div key={side} className="bg-[#0f0b1a] border border-[#3a2f5a] rounded-xl p-3 space-y-2">
              <div className="flex justify-between gap-2 text-sm flex-wrap">
                <span className="font-medium text-gray-200">Side {side} — {label}</span>
                <span className="text-gray-400">{(funded / 1000000).toFixed(4)} / {(required / 1000000).toFixed(4)} ETH</span>
              </div>
              <div className="h-2 rounded-full bg-[#3a2f5a] overflow-hidden">
                <div className="h-full bg-[#8b5cf6]" style={{ width: `${pct}%` }} />
              </div>
              {isChallenger && (
                <p className="text-xs text-amber-300">Pays double because it is challenging the ruling.</p>
              )}
              {disabledSecondHalf && (
                <p className="text-xs text-red-300">The challenging side can only be funded in the first half of the appeal window.</p>
              )}
              {full && <p className="text-xs text-emerald-300">Fully funded.</p>}
              <div className="flex gap-2">
                <input
                  className="flex-1 min-w-0 min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 text-sm"
                  type="number" min="0" step="0.001"
                  value={amounts[side]}
                  onChange={(e) => setAmounts({ ...amounts, [side]: e.target.value })}
                  disabled={disabled || disabledSecondHalf || lastRound || over}
                  placeholder={full ? "funded" : `${(remaining / 1000000).toFixed(4)} remaining`}
                />
                <button
                  className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-3 text-white text-sm whitespace-nowrap disabled:opacity-40"
                  onClick={() => fund(side)}
                  disabled={disabled || disabledSecondHalf || lastRound || over}
                >
                  Fund this side
                </button>
              </div>
              <button
                className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 text-sm text-[#38bdf8] disabled:opacity-40"
                onClick={() => fundRemaining(side)}
                disabled={disabled || disabledSecondHalf || lastRound || over || remaining === 0}
              >
                Fund remaining ({partyName})
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-400">
        Rules: the ruling's side pays the round cost; the challenging side pays double; if only one side is fully
        funded when the window ends it wins by default and its contributors are refunded; if both are funded a new{" "}
        <b>{nextSize}</b>-juror round starts; if nobody funds, the ruling stands.
      </p>

      <button
        className="min-h-[44px] rounded-lg bg-emerald-500 px-4 text-white disabled:opacity-40"
        onClick={execute}
        disabled={!over && !lastRound}
      >
        {over || lastRound ? "Execute ruling" : "Execute ruling when the window ends"}
      </button>
    </section>
  );
}

function rulingText(ruling) {
  if (ruling === 1) return "Freelancer paid";
  if (ruling === 2) return "Client refunded";
  return "No majority: split 50/50";
}