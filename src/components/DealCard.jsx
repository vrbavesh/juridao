import { ethFromMicro, deadlineCountdown } from "../lib/format.js";
import JuriDAO from "../lib/juridao-engine.js";
import { useJuri } from "../lib/store.js";

// DealCard (B4: { deal, onOpen }) — shared deal card. Reads engine state for the
// live deadline countdown the same way Header does (display-only, no actions).
// Badge/colour mapping for deal statuses is owned here (plan §2), not re-derived
// per page. Exported helpers are reused by Deals/DealDetail.
export function dealStatusMeta(status) {
  switch (status) {
    case "Created":
      return { label: "Created", cls: "border-[#38bdf8] text-[#38bdf8]" };
    case "Delivered":
      return { label: "Delivered", cls: "border-amber-400 text-amber-300" };
    case "Approved":
      return { label: "Approved", cls: "border-emerald-400 text-emerald-300" };
    case "Disputed":
      return { label: "In dispute", cls: "border-red-400 text-red-300" };
    case "Resolved":
      return { label: "Resolved", cls: "border-[#3a2f5a] text-gray-300" };
    default:
      return { label: status, cls: "border-[#3a2f5a] text-gray-300" };
  }
}

export function dealCounterpartyName(state, deal, account) {
  const other = account === deal.client ? deal.freelancer : deal.client;
  return state.accounts[other] ? state.accounts[other].name : other;
}

// "Action needed" tag for the current account (SPEC 8.2).
export function dealActionTag(deal, account, state) {
  if (deal.status === "Created") {
    if (account === deal.freelancer) return { text: "Action needed: deliver", show: true };
    if (account === deal.client && JuriDAO.nowOf(state) > deal.deadline)
      return { text: "Action needed: raise dispute (deadline passed)", show: true };
  }
  if (deal.status === "Delivered" && account === deal.client)
    return { text: "Action needed: approve or dispute", show: true };
  if (deal.status === "Disputed") return { text: "Dispute open", show: true };
  if (deal.status === "Resolved" && deal.ruling !== null) return { text: "Resolved", show: true };
  return { text: "", show: false };
}

export default function DealCard({ deal, onOpen }) {
  const { state, account } = useJuri();
  const meta = dealStatusMeta(deal.status);
  const onnName = dealCounterpartyName(state, deal, account);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-[#1c1530] border border-[#3a2f5a] rounded-2xl p-4 hover:border-[#8b5cf6] transition-colors"
    >
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="font-semibold">
          #{deal.id} · {deal.title}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="text-sm text-gray-300 mt-1.5 space-y-0.5">
        <div>
          {onnName} · {ethFromMicro(deal.amount)}
        </div>
        <div className="text-gray-400">
          Deadline: {JuriDAO.nowOf(state) > deal.deadline ? "passed" : deadlineCountdown(state, deal.deadline)}
        </div>
        <div className="text-gray-400">
          {deal.numJurors} juror{deal.numJurors > 1 ? "s" : ""} · criteria: {deal.criteria.length}
        </div>
      </div>
    </button>
  );
}