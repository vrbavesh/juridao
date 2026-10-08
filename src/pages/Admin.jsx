import { useState } from "react";
import { Link } from "react-router-dom";
import { useJuri, pushToast, resetState } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { runSelfTest } from "../lib/selftest.js";
import FlowTestRunner from "../components/FlowTestRunner.jsx";
import { ethFromMicro } from "../lib/format.js";

// SPEC 8.14 — Demo controls. Visible to every account.
const ALL = ["admin", "sam", "deepa", "funder", "juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"];

export default function Admin() {
  const { state, act } = useJuri();
  const [selfResults, setSelfResults] = useState(null);
  const [selected, setSelected] = useState(() => (state.disputes[0] ? state.disputes[0].id : null));

  const skip = () => {
    if (!selected) return pushToast("No dispute selected", "error");
    const res = act((s) => JuriDAO.skipPeriod(s, selected));
    if (res !== undefined) pushToast("Phase skipped", "success");
  };
  const ff = () => { act((s) => JuriDAO.skipTime(s, 60)); pushToast("Skipped 60s", "success"); };
  const faucetAll = () => { act((s) => { ALL.forEach((id) => JuriDAO.faucet(s, id)); return true; }); pushToast("Fauceted everyone", "success"); };
  const autoStake = () => {
    act((s) => {
      for (const id of ["juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"]) {
        const staked = (s.stake[2] && s.stake[2][id]) || 0;
        if (staked >= 1000) continue;
        JuriDAO.faucet(s, id);
        JuriDAO.stakeJuri(s, id, 2, 1000);
      }
      return true;
    });
    pushToast("Auto-staked jurors in court 2", "success");
  };
  const reset = () => {
    if (window.confirm("Reset the demo? This wipes localStorage state.")) {
      resetState();
      pushToast("Demo reset", "success");
    }
  };
  const selftest = () => setSelfResults(runSelfTest(JuriDAO));

  const sel = state.disputes.find((d) => d.id === selected);
  const selCourt = sel ? state.courts.find((c) => c.id === sel.courtId) : null;

  return (
    <div className="max-w-5xl mx-auto px-3 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Demo controls</h1>
      <p className="text-sm text-gray-400">Visible to every account — this is the same control panel a demo operator uses.</p>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Phase & time controls</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-2" value={selected ?? ""} onChange={(e) => setSelected(Number(e.target.value))}>
            {state.disputes.length === 0 && <option value="">No disputes</option>}
            {state.disputes.map((d) => (
              <option key={d.id} value={d.id}>#{d.id} — {d.period} · round {d.round + 1}</option>
            ))}
          </select>
          <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] text-white px-4" onClick={skip}>Skip current phase</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={ff}>Fast forward 60s</button>
        </div>
        {sel && (
          <p className="text-sm text-gray-400">
            Dispute #{sel.id} in {sel.period}, round {sel.round + 1}{selCourt ? `, ${selCourt.name}` : ""}.
            During the Appeal period, Skip executes the ruling.
          </p>
        )}
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Juror & token controls</h2>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={faucetAll}>Give everyone test JURI</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={autoStake}>Auto-stake all jurors (court 2)</button>
          <button className="min-h-[44px] rounded-lg border border-red-500 text-red-300 px-4" onClick={reset}>Reset demo</button>
        </div>
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Engine self-test</h2>
        <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] text-white px-4" onClick={selftest}>Run engine self-test</button>
        {selfResults && (
          <>
            <ul className="mt-2 space-y-1 text-sm">
              {selfResults.map((r, i) => (
                <li key={i} className={r.ok ? "text-emerald-300" : "text-red-300"}>
                  {r.ok ? "✓" : "✗"} {r.name} — <span className="text-gray-400">{r.detail}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-300">{selfResults.filter((r) => r.ok).length} of {selfResults.length} passed</p>
          </>
        )}
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Flow tests</h2>
        <FlowTestRunner />
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Live engine log (last 50)</h2>
        <div className="max-h-64 overflow-auto text-xs text-gray-400 space-y-1">
          {state.log.slice(-50).reverse().map((l, i) => (
            <div key={i} className="font-mono">{JSON.stringify(l)}</div>
          ))}
        </div>
      </section>

      <p className="text-sm text-gray-400">
        Want the staged scenario seeds? Open the <Link to="/testlab" className="text-[#8b5cf6]">Test Lab</Link>.
        Balances in ETH: {ethFromMicro(state.accounts.sam.eth)} (Sam) · {ethFromMicro(state.accounts.deepa.eth)} (Deepa).
      </p>
    </div>
  );
}
