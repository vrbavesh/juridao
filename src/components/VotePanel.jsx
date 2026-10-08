import { useState } from "react";
import { useJuri, pushToast } from "../lib/store.js";
import JuriDAO from "../lib/juridao-engine.js";

// VotePanel (B4: { dispute, account, storedVote }) — SPEC 8.10. Commit (sealed
// vote + localStorage backup) and Reveal (button from the stored vote, or
// fallback inputs when storage is missing). All engine calls through act().
export function voteStorageKey(dispute, account) {
  return `juri_vote_${dispute.id}_${dispute.round}_${account}`;
}

export default function VotePanel({ dispute, account, storedVote }) {
  const { state, act } = useJuri();
  const [choice, setChoice] = useState("1");
  const [reasoning, setReasoning] = useState("");
  const [fbSalt, setFbSalt] = useState("");
  const [fbAnswer, setFbAnswer] = useState("1");
  const [fbReason, setFbReason] = useState("");

  const round = dispute.rounds[dispute.round];
  const me = round.jurors[account];
  const key = voteStorageKey(dispute, account);

  if (!me) {
    return <p className="text-sm text-gray-300">You were not drawn for this case.</p>;
  }

  const saveBackup = (v) => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // storage unavailable; the backup just won't persist
    }
  };

  const sealVote = () => {
    const c = Number(choice);
    const salt = JuriDAO.randomSalt();
    const commit = JuriDAO.makeCommit(c, salt, account);
    const ok = act((s) => {
      JuriDAO.commitVote(s, account, dispute.id, commit);
      return true;
    });
    if (ok === true) {
      saveBackup({ choice: c, salt, reasoning });
      pushToast("Your vote is sealed. Nobody can see it. Come back to reveal.", "success");
    }
  };

  const revealWith = (c, salt, justification) => {
    const ok = act((s) => {
      JuriDAO.revealVote(s, account, dispute.id, Number(c), salt, justification);
      return true;
    });
    if (ok === true) pushToast("Vote revealed", "success");
  };

  const revealStored = () => {
    if (!storedVote) return;
    const c = storedVote.choice;
    const salt = storedVote.salt;
    if (c === undefined || !salt) {
      pushToast("The saved vote is incomplete — use the fallback fields below.", "error");
      return;
    }
    revealWith(c, salt, storedVote.reasoning || "");
  };

  const downloadBackup = () => {
    if (!storedVote) {
      pushToast("Nothing saved yet — seal a vote first.", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(storedVote, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- phase-sensitive panels ----
  if (dispute.period === "Commit") {
    if (me.commit) {
      return (
        <div className="space-y-2 text-sm">
          <p className="text-emerald-300 font-medium">Your vote is sealed. Nobody can see it. Come back to reveal.</p>
          <p className="text-gray-400">A backup was saved for this browser. For another browser, use the fallback salt + answer fields during Reveal.</p>
          <button className="min-h-[44px] rounded-lg border border-[#3a2f5a] px-4" onClick={downloadBackup}>
            Download backup
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-300">Seal your vote. Your answer and reasoning stay hidden until the Reveal phase.</p>
        <div className="space-y-2">
          {[
            ["1", dispute.answers[1]],
            ["2", dispute.answers[2]],
          ].map(([v, label]) => (
            <label key={v} className="flex items-center gap-2 text-sm text-gray-200 min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 cursor-pointer">
              <input type="radio" name={`vote-${dispute.id}`} value={v} checked={choice === v} onChange={() => setChoice(v)} />
              <span><b>{v}</b> — {label}</span>
            </label>
          ))}
        </div>
        <textarea
          className="w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 py-2 min-h-[72px] text-sm"
          placeholder="Your reasoning (shown publicly after you reveal)"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
        />
        <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white" onClick={sealVote}>
          Seal my vote
        </button>
      </div>
    );
  }

  if (dispute.period === "Reveal") {
    if (me.revealed) {
      return (
        <p className="text-sm text-emerald-300">
          You revealed your vote: {me.choice === 1 ? "Answer 1 — pay the freelancer" : "Answer 2 — refund the client"}.
        </p>
      );
    }
    if (storedVote && storedVote.choice !== undefined && storedVote.salt) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">Your sealed vote backup is here. Reveal it now.</p>
          <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white" onClick={revealStored}>
            Reveal my vote
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          No saved vote found for this browser. Enter the salt and answer you sealed with, then reveal.
        </p>
        <div className="space-y-2">
          {[
            ["1", dispute.answers[1]],
            ["2", dispute.answers[2]],
          ].map(([v, label]) => (
            <label key={v} className="flex items-center gap-2 text-sm text-gray-200 min-h-[44px] rounded-lg border border-[#3a2f5a] px-3 cursor-pointer">
              <input type="radio" name={`fb-${dispute.id}`} value={v} checked={fbAnswer === v} onChange={() => setFbAnswer(v)} />
              <span><b>{v}</b> — {label}</span>
            </label>
          ))}
          <input
            className="w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 text-sm font-mono"
            placeholder="Your salt (from the sealed vote backup)"
            value={fbSalt}
            onChange={(e) => setFbSalt(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 py-2 min-h-[64px] text-sm"
            placeholder="Justification (optional)"
            value={fbReason}
            onChange={(e) => setFbReason(e.target.value)}
          />
        </div>
        <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white" onClick={() => revealWith(fbAnswer, fbSalt, fbReason)}>
          Reveal my vote
        </button>
      </div>
    );
  }

  if (me.commit && !me.revealed) {
    return <p className="text-sm text-red-300">You committed but did not reveal — you lose the JURI locked for this case.</p>;
  }
  const awaiting = dispute.period === "Evidence" ? "Jurors will be drawn when the Evidence phase ends." : dispute.period === "Executed" ? "This case is closed." : "";
  return <p className="text-sm text-gray-400">{awaiting || "No vote action needed right now."}</p>;
}