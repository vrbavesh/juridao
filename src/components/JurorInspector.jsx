import JuriDAO from "../lib/juridao-engine.js";
import { juri } from "../lib/format.js";

// Panel C of /testlab: jury table + three structural checks for a dispute round.
export default function JurorInspector({ state, disputeId, roundIndex }) {
  const d = state.disputes.find((x) => x.id === disputeId);
  if (!d) return <p className="text-sm text-gray-400">Pick a dispute to see its jury.</p>;
  const r = d.rounds[roundIndex];
  if (!r) return <p className="text-sm text-gray-400">No round {roundIndex + 1} for this dispute yet.</p>;
  const court = state.courts.find((c) => c.id === d.courtId);
  const addrs = Object.keys(r.jurors || {});
  const totalDraws = addrs.reduce((n, a) => n + (r.jurors[a].draws || 0), 0);

  const check = (ok, label) => (
    <li key={label} className={ok ? "text-emerald-300" : "text-red-300"}>{ok ? "✓" : "✗"} {label}</li>
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase">
              <th className="py-2 pr-4">Juror</th>
              <th className="py-2 pr-4">Draws</th>
              <th className="py-2 pr-4">Locked JURI</th>
              <th className="py-2 pr-4">Court stake</th>
              <th className="py-2 pr-4">Drawing weight</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {addrs.map((a) => {
              const j = r.jurors[a];
              const stake = (state.stake[d.courtId] && state.stake[d.courtId][a]) || 0;
              const weight = court && court.totalStaked > 0 ? Math.round((stake / court.totalStaked) * 100) : 0;
              const cases = JuriDAO.jurorCases(state, a).filter((c) => c.disputeId === d.id && c.round === roundIndex);
              const status = cases[0] ? cases[0].status : "not in this round";
              return (
                <tr key={a} className="border-t border-[#3a2f5a]">
                  <td className="py-2 pr-4">{state.accounts[a]?.name || a}</td>
                  <td className="py-2 pr-4">{j.draws}</td>
                  <td className="py-2 pr-4">{juri(j.locked ?? 0)}</td>
                  <td className="py-2 pr-4">{juri(stake)}</td>
                  <td className="py-2 pr-4">{weight}%</td>
                  <td className="py-2 pr-4">{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="text-sm space-y-1">
        {check(!addrs.includes(d.partyA) && !addrs.includes(d.partyB), "Neither party is a juror")}
        {check(totalDraws === r.numDraws, `Total draws = round size (${totalDraws} of ${r.numDraws})`)}
        {check(addrs.every((a) => JuriDAO.notificationsFor(state, a).length > 0), "Every drawn juror has a notification")}
      </ul>
    </div>
  );
}
