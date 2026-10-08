import { evidenceBadge } from "../lib/evidence.js";

// EvidenceList (B4: { evidence }) — evidence grouped by Client / Freelancer /
// Other with fingerprint badges (SPEC 8.5 + C3). Pure presentational component.
const GROUPS = [
  { role: "client", label: "Client" },
  { role: "freelancer", label: "Freelancer" },
  { role: "other", label: "Other" },
];

export default function EvidenceList({ evidence, names }) {
  const list = evidence || [];
  if (list.length === 0) {
    return <p className="text-sm text-gray-500">No evidence yet.</p>;
  }
  return (
    <div className="space-y-4">
      {GROUPS.map(({ role, label }) => {
        const items = list.filter((e) => e.role === role);
        if (items.length === 0) return null;
        return (
          <div key={role}>
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1.5">{label}</div>
            <ul className="space-y-2">
              {items.map((e) => (
                <li key={e.id} className="bg-[#0f0b1a] border border-[#3a2f5a] rounded-xl p-3 text-sm">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span className="font-medium text-gray-200">{e.title}</span>
                    <span className="text-xs text-gray-500">
                      {names && names[e.by] ? names[e.by].name : e.by} · {formatAt(e.at)}
                    </span>
                  </div>
                  {e.description && <p className="text-gray-300 mt-1">{e.description}</p>}
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    {e.fileName ? <span>📎 {e.fileName}</span> : <span className="text-gray-600">no file</span>}
                    {e.fingerprint && (
                      <span className="font-mono text-[#38bdf8]" title={e.fingerprint}>{evidenceBadge(e.fingerprint)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function formatAt(t) {
  try {
    return new Date(t * 1000).toLocaleString();
  } catch {
    return String(t);
  }
}