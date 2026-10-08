import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useJuri, pushToast, getState } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, juri } from "../lib/format.js";
import FlowTestRunner from "../components/FlowTestRunner.jsx";
import JurorInspector from "../components/JurorInspector.jsx";

// SPEC C4 — Test Lab. All seeds create a fresh deal+dispute; nothing here edits
// the engine, everything goes through act().
const JURORS = ["juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"];

const MANUAL_TESTS = [
  ["M01", "Reset demo: banner on every page, all accounts show 10.0000 ETH / 0 JURI"],
  ["M02", "juror1 buys 0.1 ETH of JURI: preview 1,000, ETH 9.9000, JURI 1,000; buy 50 ETH -> red toast"],
  ["M03", "Free faucet: +5,000 JURI, header balance updates immediately"],
  ["M04", "juror1 joins court 2 with 100 JURI: red toast, below minimum 500"],
  ["M05", "Join with 1,000: stake 1,000, draw chance > 0%, unstake 500 works when unlocked"],
  ["M06", "Admin auto-stake all jurors after reset: court 2 total 7,000, each 1,000"],
  ["M07", "Sam: new deal 1 ETH / court 2 / 3 jurors / criteria -> Sam shows 9.0000 ETH"],
  ["M08", "Deepa delivers with a .txt file: Status Delivered, fingerprint shown, Sam has Action needed"],
  ["M09", "Deepa raises dispute: confirms fee 0.0060 modal, Deepa shows 9.9940, deal Disputed"],
  ["M10", "Sam and Deepa add evidence with files: grouped by party, fingerprint badges, tracker on Evidence"],
  ["M11", "Admin skips to Commit: exactly 3 draws, parties excluded, notifications for drawn jurors"],
  ["M12", "Drawn juror can't unstake: 'stake is locked'; dispute page shows only 'N of 3 committed'"],
  ["M13", "Jurors seal votes, admin skips to Reveal, jurors reveal: count moves 1->3 of 3, then tally/choices"],
  ["M14", "Appeal window: sides require 0.0140 / 0.0280, funding bars, second half challenger disabled, Fund remaining"],
  ["M15", "Outcome A no appeal: ruling 1 -> sam 9.0000, deepa 10.9940; ruling 2 -> sam 10.0000, deepa 9.9940"],
  ["M16", "Outcome B one side funded: ruling stands, Withdraw refunds funder in full"],
  ["M17", "Outcome C both funded: new round with 7 draws, ruling executes, money moves"],
  ["M18", "Jurors claim rewards: history shows coherent/ETH/JURI/penalty; performance ring updates"],
  ["M19", "Funder and sam withdraw appeal funds: winner share, loser gets nothing"],
  ["M20", "Reload: state persists, Evidence auto-advances by keeper, console has JuriDAO and juriState()"],
  ["M21", "375 px: no sideways scroll, nav menu button, tables become cards, Buy JURI works in header"],
];

export default function TestLab() {
  const { state, account, act } = useJuri();
  const [pa, setPa] = useState([]);
  const [inspectorDid, setInspectorDid] = useState(() => (state.disputes[0] ? state.disputes[0].id : null));
  const [inspectorRound, setInspectorRound] = useState(0);
  const [lastSeed, setLastSeed] = useState(null);
  const [checks, setChecks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("juri_testlab_checks") || "[]")); } catch { return new Set(); }
  });
  const [log, setLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("juri_testlab_log") || "[]"); } catch { return []; }
  });
  const [majority, setMajority] = useState(1);
  const [minority, setMinority] = useState(false);
  const [buildLog, setBuildLog] = useState("__loading__");

  useEffect(() => {
    let alive = true;
    import("../../BUILD_LOG.md?raw")
      .then((m) => { if (alive) setBuildLog(m.default); })
      .catch(() => { if (alive) setBuildLog(null); });
    return () => { alive = false; };
  }, []);

  const record = (name, ok, detail) => {
    const entry = { at: new Date().toISOString(), name, ok, detail };
    setLog((prev) => {
      const next = [entry, ...prev].slice(0, 30);
      try { localStorage.setItem("juri_testlab_log", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const paAdd = (name, ok, detail) => setPa((r) => [...r, { name, ok, detail }]);
  const saveChecks = (set) => { setChecks(set); try { localStorage.setItem("juri_testlab_checks", JSON.stringify([...set])); } catch {} };

  // ---- Panel A ----
  const panelA = (kind) => {
    const J = JuriDAO;
    if (kind === "buy") {
      const before = getState().accounts[account].juri;
      const res = act((s) => J.buyTokens(s, account, J.ETH / 10));
      const after = getState().accounts[account].juri;
      paAdd("Buy 0.1 ETH of JURI", res === 1000 && after - before === 1000, `got +${after - before} JURI (res ${res})`);
      record("Token buy", res === 1000 && after - before === 1000, `+${after - before} JURI`);
    } else if (kind === "faucet") {
      const before = getState().accounts[account].juri;
      act((s) => J.faucet(s, account));
      const after = getState().accounts[account].juri;
      paAdd("Faucet", after - before === 5000, `got +${after - before} JURI`);
      record("Faucet", after - before === 5000, `+${after - before} JURI`);
    } else if (kind === "buy100") {
      const before = getState().accounts[account].eth;
      const res = act((s) => J.buyTokens(s, account, 100 * J.ETH));
      const after = getState().accounts[account].eth;
      paAdd("Try to buy 100 ETH", res === undefined && after === before, "expected rejection; balance unchanged");
      record("Buy 100 ETH", res === undefined && after === before, "rejected as expected");
    }
  };

  // ---- Panel B: seeds ----
  const ensureStaked = (s) => {
    const stakedCount = JURORS.filter((id) => ((s.stake[2] || {})[id] || 0) >= 1000).length;
    if (stakedCount < 3) {
      for (const id of JURORS) { JuriDAO.faucet(s, id); JuriDAO.stakeJuri(s, id, 2, 1000); }
    }
  };
  const newDeal = (s) => JuriDAO.createDeal(s, "sam", {
    freelancer: "deepa", amount: JuriDAO.ETH, deadline: JuriDAO.nowOf(s) + 86400,
    courtId: 2, numJurors: 3, title: "Landing page", description: "Build a landing page",
    criteria: ["5 pages", "mobile responsive"],
  });

  const seeds = (n) => {
    try {
      let dealId = null;
      let did = null;
      act((s) => {
        ensureStaked(s);
        dealId = newDeal(s);
        if (n >= 1) JuriDAO.markDelivered(s, "deepa", dealId, "All done", "site.txt", "hello world");
        if (n >= 2) did = JuriDAO.raiseDispute(s, "deepa", dealId);
        if (n >= 3) {
          JuriDAO.submitEvidence(s, "sam", did, { title: "Brief", description: "What we agreed", fileName: "brief.txt", fileText: "5 pages, mobile responsive" });
          JuriDAO.submitEvidence(s, "deepa", did, { title: "Delivery", description: "What I built", fileName: "site.txt", fileText: "hello world" });
          JuriDAO.skipPeriod(s, did); // -> Commit, jurors drawn
        }
        if (n >= 4) {
          const d = s.disputes.find((x) => x.id === did);
          const addrs = Object.keys(d.rounds[d.round].jurors);
          addrs.forEach((a, i) => {
            const against = minority && i === 0;
            const choice = against ? (majority === 1 ? 2 : 1) : Number(majority);
            const salt = JuriDAO.randomSalt();
            JuriDAO.commitVote(s, a, did, JuriDAO.makeCommit(choice, salt, a));
            try { localStorage.setItem(`juri_vote_${did}_${d.round}_${a}`, JSON.stringify({ choice, salt, reasoning: "T Lab seed vote" })); } catch {}
          });
          JuriDAO.skipPeriod(s, did); // -> Reveal
        }
        if (n >= 5) {
          const d = s.disputes.find((x) => x.id === did);
          const addrs = Object.keys(d.rounds[d.round].jurors);
          for (const a of addrs) {
            try {
              const stored = JSON.parse(localStorage.getItem(`juri_vote_${did}_${d.round}_${a}`) || "null");
              if (stored) JuriDAO.revealVote(s, a, did, Number(stored.choice), stored.salt, stored.reasoning || "T Lab seed vote");
            } catch {}
          }
          JuriDAO.skipPeriod(s, did); // -> Appeal
        }
        if (n >= 6) {
          const d = s.disputes.find((x) => x.id === did);
          const req = d.rounds[d.round].required;
          JuriDAO.fundAppeal(s, "funder", did, 1, req[1]);
          JuriDAO.fundAppeal(s, "sam", did, 2, req[2]);
        }
        return true;
      });
      setLastSeed({ n, dealId, did });
      const label = ["Delivered deal", "Dispute in Evidence", "Jurors drawn (Commit)", "Reveal phase", "Appeal window open", "Appeal round started"][n - 1];
      pushToast(`Seed ${n}: ${label} created`, "success");
      record(`Seed ${n}`, true, label);
    } catch (e) {
      pushToast(e.message || "Seed failed", "error");
      record(`Seed ${n}`, false, e.message || "error");
    }
  };

  const inspectorDispute = state.disputes.find((d) => d.id === inspectorDid) || state.disputes[0] || null;
  const roundCount = inspectorDispute ? inspectorDispute.rounds.length : 0;

  return (
    <div className="max-w-5xl mx-auto px-3 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Test Lab</h1>
      <p className="text-sm text-gray-400">Simulation only. Uses the live engine on throwaway seeds — never real state beyond demo data.</p>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel A — Token test</h2>
        <p className="text-sm text-gray-400 mb-3">Current account balance: {ethFromMicro(state.accounts[account].eth)} · {juri(state.accounts[account].juri)} JURI</p>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] text-white px-4" onClick={() => panelA("buy")}>Buy 0.1 ETH of JURI</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => panelA("faucet")}>Faucet</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => panelA("buy100")}>Try to buy 100 ETH</button>
        </div>
        {pa.length > 0 && (
          <ul className="mt-3 text-sm space-y-1">
            {pa.map((r, i) => (
              <li key={i} className={r.ok ? "text-emerald-300" : "text-red-300"}>{r.ok ? "✓" : "✗"} {r.name} — {r.detail}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel B — Scenario seeds</h2>
        <p className="text-sm text-gray-400 mb-3">Each button creates a fresh deal and dispute from scratch. Seed 4 stores juror votes in localStorage so they can press “Reveal my vote” on the case page.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => seeds(1)}>Seed 1: Delivered deal</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => seeds(2)}>Seed 2: Dispute in Evidence</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => seeds(3)}>Seed 3: Jurors drawn (Commit)</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => seeds(4)}>Seed 4: Reveal phase</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => seeds(5)}>Seed 5: Appeal window open</button>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={() => seeds(6)}>Seed 6: Appeal round started</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-300">
          <label>Majority answer
            <select className="ml-2 min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-2" value={majority} onChange={(e) => setMajority(Number(e.target.value))}>
              <option value={1}>1 — pay the freelancer</option>
              <option value={2}>2 — refund the client</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={minority} onChange={(e) => setMinority(e.target.checked)} />
            Make one juror vote against the majority
          </label>
        </div>
        {lastSeed && (
          <p className="mt-3 text-sm">
            Last seed #{lastSeed.n}:{" "}
            {lastSeed.did ? (
              <Link className="text-[#8b5cf6]" to={`/disputes/${lastSeed.did}`}>Open dispute #{lastSeed.did}</Link>
            ) : (
              <Link className="text-[#8b5cf6]" to={`/deals/${lastSeed.dealId}`}>Open deal #{lastSeed.dealId}</Link>
            )}
          </p>
        )}
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel C — Jury inspector</h2>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select className="min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-2" value={inspectorDispute ? inspectorDid ?? inspectorDispute.id : ""} onChange={(e) => { setInspectorDid(Number(e.target.value)); setInspectorRound(0); }}>
            {state.disputes.length === 0 && <option value="">No disputes yet — run a seed first</option>}
            {state.disputes.map((d) => <option key={d.id} value={d.id}>#{d.id} — {d.period}, round {d.round + 1}</option>)}
          </select>
          <select className="min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-2" value={inspectorRound} onChange={(e) => setInspectorRound(Number(e.target.value))}>
            {Array.from({ length: roundCount }).map((_, i) => <option key={i} value={i}>Round {i + 1}</option>)}
          </select>
        </div>
        <JurorInspector state={state} disputeId={inspectorDispute ? inspectorDispute.id : null} roundIndex={inspectorRound} />
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel D — Automated flow tests</h2>
        <FlowTestRunner />
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel E — Manual test checklist ({checks.size} of {MANUAL_TESTS.length} done)</h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {MANUAL_TESTS.map(([id, label]) => (
            <label key={id} className="flex gap-2 text-sm items-start">
              <input
                type="checkbox"
                checked={checks.has(id)}
                onChange={() => {
                  const next = new Set(checks);
                  next.has(id) ? next.delete(id) : next.add(id);
                  saveChecks(next);
                }}
              />
              <span><span className="font-mono text-gray-500">{id}</span> {label}</span>
            </label>
          ))}
        </div>
        <button className="mt-4 min-h-[44px] rounded-lg border border-[#3a2f5a] px-4 text-sm" onClick={() => saveChecks(new Set())}>Clear checklist</button>
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel F — Test Lab log (last {log.length})</h2>
        {log.length === 0 ? <p className="text-sm text-gray-500">No lab actions yet.</p> : (
          <ul className="mt-2 text-xs text-gray-400 space-y-1 max-h-48 overflow-auto">
            {log.map((l, i) => (
              <li key={i}>{new Date(l.at).toLocaleString()} — {l.name}: <span className={l.ok ? "text-emerald-300" : "text-red-300"}>{l.ok ? "ok" : "fail"}</span> {l.detail}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5">
        <h2 className="font-semibold mb-2">Panel G — Build log</h2>
        {buildLog === "__loading__" ? <p className="text-sm text-gray-500">Loading BUILD_LOG.md…</p>
          : buildLog === null ? <p className="text-sm text-gray-500">BUILD_LOG.md not available to this build (raw import disabled).</p>
          : <pre className="max-h-64 overflow-auto text-xs text-gray-400 whitespace-pre-wrap">{buildLog}</pre>}
      </section>
    </div>
  );
}
