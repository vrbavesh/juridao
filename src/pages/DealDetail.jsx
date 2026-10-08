import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethFromMicro, deadlineCountdown } from "../lib/format.js";
import { readFileAsText, evidenceBadge } from "../lib/evidence.js";
import EmptyState from "../components/EmptyState.jsx";
import { dealStatusMeta } from "../components/DealCard.jsx";

// SPEC 8.4 — Deal detail: timeline, deliver / approve / raise-dispute actions,
// and a linking banner once a dispute exists.
export default function DealDetail() {
  const { id } = useParams();
  const { state, account, act } = useJuri();
  const dealId = Number(id);
  const deal = state.deals.find((d) => d.id === dealId);

  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  if (!deal) return <EmptyState text="Deal not found." />;

  const meta = dealStatusMeta(deal.status);
  const court = state.courts.find((c) => c.id === deal.courtId);
  const other = account === deal.client ? deal.freelancer : deal.client;
  const otherName = state.accounts[other] ? state.accounts[other].name : other;
  const now = JuriDAO.nowOf(state);
  const deadlineOver = now > deal.deadline;
  const isClient = account === deal.client;
  const isFreelancer = account === deal.freelancer;
  const dispute = deal.disputeId !== null ? state.disputes.find((d) => d.id === deal.disputeId) : undefined;
  const fee = court ? court.feePerJuror * deal.numJurors : 0;

  const canDeliver = isFreelancer && deal.status === "Created";
  const canApprove = isClient && deal.status === "Delivered";
  const canRaise =
    (isClient && deal.status === "Delivered") ||
    (isFreelancer && deal.status === "Delivered") ||
    (isClient && deal.status === "Created" && deadlineOver);

  const deliver = async () => {
    let fileText = "";
    let fileName = "";
    if (file) {
      try {
        fileText = await readFileAsText(file);
        fileName = file.name || "";
      } catch (e) {
        pushToast(e.message || "Could not read the file", "error");
        return;
      }
    }
    setNoteBusy(true);
    const ok = act((s) => {
      JuriDAO.markDelivered(s, account, deal.id, note, fileName, fileText);
      return true;
    });
    setNoteBusy(false);
    if (ok === true) pushToast("Work delivered — fingerprint recorded", "success");
  };

  const approve = () => {
    const ok = act((s) => {
      JuriDAO.approveDeal(s, account, deal.id);
      return true;
    });
    if (ok === true) pushToast(`Payment released to ${otherName}`, "success");
  };

  const raiseDispute = () => {
    const did = act((s) => JuriDAO.raiseDispute(s, account, deal.id));
    if (did !== undefined) {
      setDisputeOpen(false);
      pushToast(`Dispute #${did} raised — fee ${ethFromMicro(fee)} paid`, "success");
    }
  };

  const question = `Was the work for "${deal.title}" delivered as agreed? Criteria: ${deal.criteria.join("; ")}`;

  return (
    <div className="max-w-5xl mx-auto px-3 py-6 space-y-6">
      <p className="text-sm">
        <Link to="/deals" className="text-[#38bdf8]">← Back to deals</Link>
      </p>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Deal #{deal.id} · {deal.title}</h1>
          <p className="text-sm text-gray-300 mt-1">
            {isClient ? "You are the client" : isFreelancer ? "You are the freelancer" : "Viewing as third party"} ·{" "}
            {ethFromMicro(deal.amount)} locked
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm ${meta.cls}`}>{meta.label}</span>
      </div>

      {(deal.status === "Disputed" || deal.status === "Resolved") && dispute && (
        <div className="bg-[#3a2f5a]/40 border border-[#8b5cf6] rounded-xl p-4 text-sm flex justify-between items-center flex-wrap gap-2">
          <span>
            {deal.status === "Disputed"
              ? `Dispute #${dispute.id} is in the ${dispute.period} phase.`
              : `Dispute #${dispute.id} is final — ${rulingText(deal.ruling)}.`}{" "}
            {deal.status === "Resolved" && deal.ruling !== null && (
              <span className="text-gray-300"> · {deal.ruling === 1 ? ethFromMicro(deal.amount) + " went to " + (state.accounts[deal.freelancer]?.name || deal.freelancer) : deal.ruling === 2 ? ethFromMicro(deal.amount) + " went back to " + (state.accounts[deal.client]?.name || deal.client) : "the amount was split 50/50."}</span>
            )}
          </span>
          <Link to={`/disputes/${dispute.id}`} className="text-[#8b5cf6] underline">Open dispute →</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3 text-sm">
          <h2 className="font-semibold text-base">Details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-gray-500">Client</dt><dd>{state.accounts[deal.client]?.name || deal.client}</dd>
            <dt className="text-gray-500">Freelancer</dt><dd>{state.accounts[deal.freelancer]?.name || deal.freelancer}</dd>
            <dt className="text-gray-500">Amount</dt><dd>{ethFromMicro(deal.amount)}</dd>
            <dt className="text-gray-500">Deadline</dt>
            <dd>{deadlineOver ? <span className="text-red-300">passed</span> : deadlineCountdown(state, deal.deadline)}</dd>
            <dt className="text-gray-500">Court</dt><dd>{court ? court.name : deal.courtId}</dd>
            <dt className="text-gray-500">Jurors</dt><dd>{deal.numJurors} (fee {ethFromMicro(fee)} if disputed)</dd>
            {deal.deliveryFileName && (
              <>
                <dt className="text-gray-500">Delivery</dt>
                <dd>
                  {deal.deliveryFileName}
                  {deal.deliveryFingerprint && (
                    <span className="ml-2 font-mono text-xs text-[#38bdf8]" title={deal.deliveryFingerprint}>
                      {evidenceBadge(deal.deliveryFingerprint)}
                    </span>
                  )}
                </dd>
                {deal.deliveryNote && (
                  <>
                    <dt className="text-gray-500">Note</dt>
                    <dd>{deal.deliveryNote}</dd>
                  </>
                )}
              </>
            )}
          </dl>
          {deal.description && <p className="text-gray-300">{deal.description}</p>}
          <div>
            <div className="text-gray-500 mb-1">Delivery criteria</div>
            <ul className="list-disc pl-5 space-y-0.5 text-gray-300">
              {deal.criteria.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        </section>

        <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
          <h2 className="font-semibold text-base">Timeline</h2>
          <Timeline status={deal.status} delivered={deal.status !== "Created"} />
        </section>
      </div>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-3">
        <h2 className="font-semibold">Actions</h2>
        {canDeliver && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Mark the work as delivered. The optional file produces a fingerprint jurors can verify.</p>
            <textarea
              className="w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 py-2 min-h-[72px]"
              value={note} onChange={(e) => setNote(e.target.value)} placeholder="Delivery note…"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 min-h-[44px]">
                <input type="file" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
              </label>
              <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white disabled:opacity-40" onClick={deliver} disabled={noteBusy}>
                Mark as delivered
              </button>
            </div>
          </div>
        )}
        {canApprove && (
          <div className="flex flex-wrap gap-2">
            <button className="min-h-[44px] rounded-lg bg-emerald-500 px-4 text-white" onClick={approve}>
              Approve and release payment
            </button>
            <button className="min-h-[44px] rounded-lg border border-red-400 text-red-300 px-4" onClick={() => setDisputeOpen(true)}>
              Raise dispute
            </button>
          </div>
        )}
        {canRaise && !canApprove && (
          <button className="min-h-[44px] rounded-lg border border-red-400 text-red-300 px-4" onClick={() => setDisputeOpen(true)}>
            Raise dispute
          </button>
        )}
        {!canDeliver && !canApprove && !canRaise && (
          <p className="text-sm text-gray-500">
            {deal.status === "Created" && isClient && !deadlineOver
              ? "Waiting for the freelancer to deliver. After the deadline with no delivery you can raise a dispute."
              : deal.status === "Created" && !isClient && !isFreelancer
              ? "This deal is waiting for delivery."
              : "No action available for your role right now."}
          </p>
        )}
      </section>

      {disputeOpen && (
        <DisputeModal
          title={deal.title}
          amount={deal.amount}
          fee={fee}
          question={question}
          balance={state.accounts[account].eth}
          onClose={() => setDisputeOpen(false)}
          onConfirm={raiseDispute}
        />
      )}
    </div>
  );
}

function Timeline({ status, delivered }) {
  const steps = ["Created", "Delivered", "Approved / Disputed", "Resolved"];
  const idx = status === "Created" ? 0 : status === "Delivered" ? 1 : status === "Approved" || status === "Disputed" ? 2 : 3;
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const done = delivered ? i <= idx : i === 0;
        const current = i === idx;
        return (
          <li key={s} className={`flex items-center gap-2 text-sm ${current ? "text-white" : done ? "text-gray-400" : "text-gray-600"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${current ? "bg-[#8b5cf6]" : done ? "bg-[#3a2f5a]" : "bg-[#0f0b1a] border border-[#3a2f5a]"}`}>
              {done && !current ? "✓" : i + 1}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function DisputeModal({ title, amount, fee, question, balance, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#1c1530] rounded-t-2xl sm:rounded-2xl border border-[#3a2f5a] w-full sm:max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">Raise a dispute?</h3>
        <p className="text-sm text-gray-300">
          Raising a dispute about <b>“{title}”</b> costs <b className="text-red-300">{ethFromMicro(fee)}</b> (fee per juror × jurors). The fee is not refunded.
        </p>
        <p className="text-sm text-red-300 bg-red-950/40 border border-red-500/50 rounded-lg p-3">
          Warning: the locked {ethFromMicro(amount)} stays frozen until a ruling is executed.
        </p>
        <div className="text-sm text-gray-300">
          <div className="text-gray-500 mb-1">Jurors will decide this question:</div>
          <p className="font-mono text-xs text-gray-200 bg-[#0f0b1a] border border-[#3a2f5a] rounded-lg p-3">{question}</p>
        </div>
        <div className="text-sm text-gray-300">
          Answers: <b>1</b> — Yes. Pay the freelancer · <b>2</b> — No. Refund the client
        </div>
        <div className="text-xs text-gray-500">Your ETH balance: {ethFromMicro(balance)}</div>
        <div className="flex gap-2 pt-1">
          <button className="flex-1 min-h-[44px] rounded-lg border border-[#3a2f5a] text-sm" onClick={onClose}>Cancel</button>
          <button className="flex-1 min-h-[44px] rounded-lg bg-red-500 text-white text-sm" onClick={onConfirm}>Raise dispute</button>
        </div>
      </div>
    </div>
  );
}

function rulingText(ruling) {
  if (ruling === 1) return "Freelancer paid";
  if (ruling === 2) return "Client refunded";
  return "No majority: split 50/50";
}