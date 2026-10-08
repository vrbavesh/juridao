import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";
import { ethToMicro, ethFromMicro } from "../lib/format.js";

// SPEC 8.3 — Create deal. All validation errors surface as red toasts from the
// engine via act(); submit-only-on-valid keeps the happy path clean.
export default function NewDeal() {
  const { state, account, act } = useJuri();
  const navigate = useNavigate();

  const candidates = useMemo(
    () => Object.keys(state.accounts).filter((id) => id !== account),
    [state.accounts, account]
  );
  const [freelancer, setFreelancer] = useState("");
  const [amount, setAmount] = useState("1");
  const [days, setDays] = useState("3");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState(["", ""]);
  const [courtId, setCourtId] = useState(2);
  const [numJurors, setNumJurors] = useState(3);

  const court = state.courts.find((c) => c.id === Number(courtId)) || state.courts[1];
  const fee = court ? court.feePerJuror * Number(numJurors) : 0;
  const amountMicro = Number(amount) > 0 ? ethToMicro(Number(amount)) : 0;
  const validCriteria = criteria.map((c) => c.trim()).filter(Boolean);
  const canSubmit =
    freelancer &&
    amountMicro > 0 &&
    Number(days) >= 1 &&
    title.trim() &&
    validCriteria.length >= 1;

  const setCriterion = (i, v) => setCriteria(criteria.map((c, j) => (j === i ? v : c)));
  const addCriterion = () => setCriteria([...criteria, ""]);
  const removeCriterion = (i) => criteria.length > 1 && setCriteria(criteria.filter((_, j) => j !== i));

  const submit = () => {
    if (!canSubmit) {
      pushToast("Fill in the freelancer, amount, deadline, title and at least one criterion", "error");
      return;
    }
    const deadline = JuriDAO.nowOf(state) + Math.floor(Number(days)) * 86400;
    const o = {
      freelancer,
      amount: amountMicro,
      deadline,
      courtId: Number(courtId),
      numJurors: Number(numJurors),
      title: title.trim(),
      description: description.trim(),
      criteria: validCriteria,
    };
    const id = act((s) => JuriDAO.createDeal(s, account, o));
    if (id !== undefined) {
      pushToast(`Deal created — ${ethFromMicro(amountMicro)} locked`, "success");
      navigate(`/deals/${id}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-3 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Create a deal</h1>

      <div className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-5 space-y-4">
        <label className="block">
          <span className="text-sm text-gray-300">Freelancer</span>
          <select
            className="mt-1 w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
            value={freelancer}
            onChange={(e) => setFreelancer(e.target.value)}
          >
            <option value="">Select a freelancer…</option>
            {candidates.map((id) => (
              <option key={id} value={id}>
                {state.accounts[id].name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-sm text-gray-300">Amount (ETH)</span>
            <input
              className="mt-1 w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
              type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-300">Deadline (days)</span>
            <input
              className="mt-1 w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
              type="number" min="1" step="1" value={days} onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-300">Jurors</span>
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
              value={numJurors}
              onChange={(e) => setNumJurors(Number(e.target.value))}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={7}>7</option>
            </select>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-300">Court</span>
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
              value={courtId}
              onChange={(e) => setCourtId(Number(e.target.value))}
            >
              {state.courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {ethFromMicro(c.feePerJuror)}/juror
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end text-sm text-gray-300">
            <div>
              Locks <b>{ethFromMicro(amountMicro)}</b> from your balance.
              <br />
              If disputed, the raiser pays the fee: {ethFromMicro(fee)} ({ethFromMicro(court ? court.feePerJuror : 0)} × {numJurors}).
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm text-gray-300">Title</span>
          <input
            className="mt-1 w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
            value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Landing page"
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-300">Description</span>
          <textarea
            className="mt-1 w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 py-2 min-h-[88px]"
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What the freelancer should build"
          />
        </label>

        <div>
          <span className="text-sm text-gray-300">Delivery criteria</span>
          <p className="text-xs text-gray-500 mb-2">Jurors judge the delivery against these. Add at least one.</p>
          <div className="space-y-2">
            {criteria.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3"
                  value={c}
                  onChange={(e) => setCriterion(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. 5 pages" : i === 1 ? "e.g. mobile responsive" : "Another criterion…"}
                />
                <button
                  className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 text-sm disabled:opacity-40"
                  onClick={() => removeCriterion(i)}
                  disabled={criteria.length <= 1}
                  aria-label="Remove criterion"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button className="mt-2 min-h-[44px] rounded-lg border border-[#38bdf8] text-[#38bdf8] px-3 text-sm" onClick={addCriterion}>
            + Add criterion
          </button>
        </div>

        <button
          className="w-full min-h-[44px] rounded-lg bg-[#8b5cf6] text-white disabled:opacity-40"
          onClick={submit}
        >
          Create deal
        </button>
        <p className="text-xs text-gray-500">
          <Link to="/deals" className="text-[#38bdf8]">← Back to deals</Link>
        </p>
      </div>
    </div>
  );
}