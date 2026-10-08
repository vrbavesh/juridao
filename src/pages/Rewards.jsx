import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, juri } from "../lib/format.js";
import EmptyState from "../components/EmptyState.jsx";

// SPEC 8.11 — Rewards: pending, claim, history from `settled` and `claimed` log entries.
export default function Rewards() {
  const { state, account, act } = useJuri();
  const pending = state.pending[account] || { eth: 0, juri: 0 };
  const settled = state.log.filter((e) => e.type === "settled" && e.who === account).reverse();
  const claimed = state.log.filter((e) => e.type === "claimed" && e.who === account).reverse();

  const claim = () => {
    const res = act((s) => JuriDAO.claimRewards(s, account));
    if (res !== undefined) pushToast(`Claimed ${ethFromMicro(res.eth)} and ${juri(res.juri)} JURI`, "success");
  };

  return (
    <div className="max-w-6xl mx-auto px-3 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Rewards</h1>
      <div className="bg-[#1c1530] border border-[#3a2f5a] rounded-2xl p-5 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs uppercase text-gray-500">Pending ETH</div>
          <div className="text-xl font-bold">{ethFromMicro(pending.eth)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Pending JURI</div>
          <div className="text-xl font-bold">{juri(pending.juri)}</div>
        </div>
        <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white disabled:opacity-40" disabled={!pending.eth && !pending.juri} onClick={claim}>
          Claim rewards
        </button>
      </div>

      <section>
        <h2 className="font-semibold mb-2">History</h2>
        {settled.length === 0 && claimed.length === 0 ? <EmptyState text="Nothing here yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-2 pr-4">Case</th><th className="pb-2 pr-4">Coherent</th>
                  <th className="pb-2 pr-4">ETH reward</th><th className="pb-2 pr-4">JURI reward</th><th className="pb-2">JURI penalty</th>
                </tr>
              </thead>
              <tbody>
                {settled.map((e, i) => (
                  <tr key={i} className="border-t border-[#3a2f5a]">
                    <td className="py-2 pr-4">{e.disputeId}</td>
                    <td className="py-2 pr-4">{e.coherent ? "yes" : "no"}</td>
                    <td className="py-2 pr-4">{ethFromMicro(e.ethReward || 0)}</td>
                    <td className="py-2 pr-4">{juri(e.juriReward || 0)}</td>
                    <td className="py-2">{juri(e.penalty || 0)}</td>
                  </tr>
                ))}
                {claimed.map((e, i) => (
                  <tr key={"c" + i} className="border-t border-[#3a2f5a] text-gray-400">
                    <td className="py-2 pr-4" colSpan={1}>claimed</td>
                    <td className="py-2 pr-4">—</td>
                    <td className="py-2 pr-4">{ethFromMicro(e.eth || 0)}</td>
                    <td className="py-2 pr-4">{juri(e.juri || 0)}</td>
                    <td className="py-2">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
