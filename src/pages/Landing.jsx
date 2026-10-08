import { Link } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import { ethFromMicro, juri } from "../lib/format.js";

// SPEC 8.1 — all copy; live stats labelled "demo data".
const WHY = [
  ["Random jurors", "A stake-weighted draw, not a fixed panel: nobody can predict who will decide the next case, and the two parties are always excluded from their own jury."],
  ["Fair incentives", "Vote with the majority and you earn the case's fee in ETH and in JURI. Vote against the majority — or fail to reveal — and your locked JURI is forfeited."],
  ["Transparent", "Every commit, reveal, funding move and penalty is written to the case log. After the reveal phase, choices and justifications are public; before it, only counts are visible."],
  ["Automatic enforcement", "Once a ruling executes, the escrowed ETH moves on its own: pay the freelancer, refund the client, or split 50/50 on no-majority. No human operator can override it."],
];

const STEPS = [
  ["Create the deal", "The client locks the agreed ETH in the case. Deadline, criteria and the court are fixed up front."],
  ["Evidence", "Both sides upload text evidence. Files are fingerprinted so nothing is swapped after the fact."],
  ["Jurors drawn", "Stake-weighted random draw — a juror can be drawn more than once, each draw locking JURI."],
  ["Vote (sealed)", "Jurors commit a hidden hash first, then reveal. Nobody can see or copy anyone's vote until the reveal phase."],
  ["Appeal", "Either side can fund the opposing ruling. If both sides fully fund, the case goes to a larger jury."],
  ["Ruling", "The winning ruling executes automatically: ETH is paid out, penalties redistribute, everyone can claim rewards."],
];

const FAQ = [
  ["Is this real money?", "No. Everything here is a simulation: dummy ETH and a dummy JURI token, no wallet, no network, no backend."],
  ["What does JURI do?", "JURI is the jury token. You stake it to join a court; parts of your stake lock when you are drawn; coherent jurors earn ETH fees and JURI rewards."],
  ["What happens if jurors disagree?", "The plurality of revealed votes wins. A 50/50 tie pays out 0 — the deal splits 50/50. If nobody reveals, ruling 0 as well."],
  ["Can a losing party keep appealing forever?", "No. A side may challenge only in the ruling's favour's first half of the window, MAX_ROUNDS is 3, and no appeals run after round 3."],
];

export default function Landing() {
  const { state } = useJuri();
  const executed = state.disputes.filter((d) => d.period === "Executed").length;
  const totalStaked = state.courts.reduce((n, c) => n + (c.totalStaked || 0), 0);
  const lockedEth = state.deals
    .filter((d) => ["Created", "Delivered", "Disputed"].includes(d.status))
    .reduce((n, d) => n + d.amount, 0);

  return (
    <div className="max-w-6xl mx-auto px-3 py-8 space-y-10">
      <section className="text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Disputes resolved by a decentralized jury</h1>
        <p className="text-gray-400">When a smart contract can't decide who is right, JuriDAO can.</p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link to="/deals/new" className="min-h-[44px] inline-flex items-center rounded-lg bg-[#8b5cf6] text-white px-5">Create a deal</Link>
          <Link to="/juror" className="min-h-[44px] inline-flex items-center rounded-lg border border-[#38bdf8] text-[#38bdf8] px-5">Become a juror</Link>
        </div>
      </section>

      <section className="bg-[#1c1530] rounded-2xl border border-[#3a2f5a] p-6 text-sm text-gray-300 space-y-1">
        <p>Sam hires Deepa to build a landing page and locks 1 ETH in the deal.</p>
        <p>Deepa delivers but Sam does not respond — Approve or Dispute? A centralized platform decides arbitrarily.</p>
        <p>JuriDAO puts the question to a random, staked jury. The ruling — pay Deepa, refund Sam, or split — executes itself.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">How a case runs</h2>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-4">
              <div className="text-[#8b5cf6] font-bold">{i + 1}.</div>
              <div className="font-medium">{t}</div>
              <p className="text-sm text-gray-400 mt-1">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Why JuriDAO</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {WHY.map(([t, d]) => (
            <div key={t} className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-4">
              <div className="font-medium">{t}</div>
              <p className="text-sm text-gray-400 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-1">Live stats <span className="text-xs text-gray-500 align-middle">(demo data)</span></h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-4 text-center">
            <div className="text-2xl font-bold text-[#8b5cf6]">{executed}</div>
            <div className="text-xs text-gray-400">Disputes executed</div>
          </div>
          <div className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-4 text-center">
            <div className="text-2xl font-bold text-[#8b5cf6]">{juri(totalStaked)}</div>
            <div className="text-xs text-gray-400">JURI staked</div>
          </div>
          <div className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-4 text-center">
            <div className="text-2xl font-bold text-[#8b5cf6]">{ethFromMicro(lockedEth)}</div>
            <div className="text-xs text-gray-400">ETH locked in deals</div>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-5">
          <h3 className="font-semibold">You hire freelancers</h3>
          <p className="text-sm text-gray-400 mt-1">Create a deal, lock the budget, set the criteria. Raise a dispute if delivery falls short — or if the client goes silent past the deadline.</p>
        </div>
        <div className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-5">
          <h3 className="font-semibold">You take freelance work</h3>
          <p className="text-sm text-gray-400 mt-1">Deliver with evidence, dispute unfair silence, and stake JURI on the side to show skin in the game.</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="bg-[#1c1530] rounded-xl border border-[#3a2f5a] p-4">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="text-sm text-gray-400 mt-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-gray-500 py-4">
        Inspired by Kleros. Simulation for hackathon demo.
      </footer>
    </div>
  );
}
