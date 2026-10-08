import { useState } from "react";
import JuriDAO from "../lib/juridao-engine.js";
import { runFlowTests } from "../lib/flowtests.js";

// FlowTestRunner — Panel D of Test Lab and on /admin. Reports [{ name, ok, detail }].
export default function FlowTestRunner() {
  const [results, setResults] = useState(null);
  const [runs, setRuns] = useState(() => {
    try { return JSON.parse(localStorage.getItem("juri_testlab_runs") || "[]"); } catch { return []; }
  });

  const run = () => {
    const r = runFlowTests(JuriDAO);
    setResults(r);
    const entry = { at: new Date().toISOString(), passed: r.filter((x) => x.ok).length, total: r.length };
    const next = [entry, ...runs].slice(0, 10);
    setRuns(next);
    try { localStorage.setItem("juri_testlab_runs", JSON.stringify(next)); } catch {}
  };

  const reportText = () => {
    if (!results) return "";
    const lines = results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.name} - ${r.detail}`);
    lines.push(`${results.filter((r) => r.ok).length} of ${results.length} passed`);
    return `JuriDAO flow tests - ${new Date().toISOString()}\n` + lines.join("\n");
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(reportText()); } catch {}
  };
  const download = () => {
    const blob = new Blob([reportText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `juridao-flow-tests-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const passed = results ? results.filter((r) => r.ok).length : 0;
  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center">
        <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white" onClick={run}>Run all flow tests</button>
        {results && <span className="text-sm text-gray-300">{passed} of {results.length} passed</span>}
      </div>
      {results && (
        <>
          <ul className="mt-3 space-y-1 text-sm">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? "text-emerald-300" : "text-red-300"}>
                {r.ok ? "✓" : "✗"} {r.name} — <span className="text-gray-400">{r.detail}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-3">
            <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={copy}>Copy report</button>
            <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={download}>Download report (.txt)</button>
          </div>
        </>
      )}
      {runs.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs uppercase text-gray-500">Last runs</h4>
          <ul className="text-xs text-gray-400 mt-1">
            {runs.map((r, i) => <li key={i}>{new Date(r.at).toLocaleString()} — {r.passed} of {r.total} passed</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
