import { Link } from "react-router-dom";
import { useJuri } from "../lib/store.js";
import { ethFromMicro, juri } from "../lib/format.js";

// SPEC 8.1: hero, story, six steps, four Why cards, live "demo data" stats, audience blocks, FAQ, footer.
export default function Landing() {
  const { state } = useJuri();
  const executed = state.disputes.filter((d) => d.period === "Executed").length;
  const totalStaked = state.courts.reduce((a, c) => a + (c.totalStaked || 0), 0);
  const lockedEth = state.deals
    .filter((d) => d.status === "Created" || d.status === "Delivered" || d.status === "Disputed")
    .reduce((a, d) => a + (d.amount || 0), 0);

  const features = [
    ["Random jurors", "Anyone staking JURI can be drawn. Parties to a case can never be drawn as its jurors."],
    ["Fair incentives", "Vote with the majority and you share the fees. Vote against it or skip, and you lose the JURI locked for that vote."],
    ["Transparent", "Every draw, commit, reveal, ruling and payout is recorded on the case page for anyone to audit."],
    ["Automatic enforcement", "The ruling executes by itself. No one can refuse to pay or block the verdict."],
  ];
  const steps = [
    "Create the deal",
    "Evidence",
    "Jurors drawn",
    "Vote (sealed)",
    "Appeal",
    "Ruling",
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-12">
      <section className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-bold text-gray-100">Disputes resolved by a decentralized jury</h1>
        <p className="text-[#38bdf8] text-lg">When a smart contract can't decide who is right, JuriDAO can.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link to="/deals/new" className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[#8b5cf6] text-white px-6">Create a deal</Link>
          <Link to="/juror" className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[#38bdf8] text-[#38bdf8] px-6">Become a juror</Link>
        </div>
      </section>

      <section className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-6 space-y-2 text-sm text-gray-300">
        <p>Sam hires Deepa to build a landing page. The site is delivered, but Sam says it is not what was agreed.</p>
        <p>They cannot resolve it themselves. A court contract cannot read the brief either.</p>
        <p>JuriDAO draws staked jurors, takes sealed votes, lets anyone appeal, and pays out the ruling automatically.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">How it works</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map((s, i) => (
            <li key={s} className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4 flex gap-3 items-start">
              <span className="rounded-full bg-[#8b5cf6]/20 text-[#8b5cf6] w-7 h-7 flex items-center justify-center text-sm shrink-0">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Why JuriDAO</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map(([t, d]) => (
            <div key={t} className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4">
              <h3 className="font-semibold">{t}</h3>
              <p className="text-sm text-gray-400 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-1">Live stats <span className="text-xs text-gray-500">(demo data)</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><div className="text-2xl font-bold text-[#8b5cf6]">{executed}</div><div className="text-xs text-gray-400">Disputes Executed</div></div>
          <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><div className="text-2xl font-bold text-[#38bdf8]">{juri(totalStaked)}</div><div className="text-xs text-gray-400">Total JURI staked</div></div>
          <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><div className="text-2xl font-bold text-emerald-400">{ethFromMicro(lockedEth)}</div><div className="text-xs text-gray-400">ETH locked in deals</div></div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4">
          <h3 className="font-semibold">Clients & freelancers</h3>
          <p className="text-sm text-gray-400 mt-1">Escrow the pay, deliver or approve, and let the jury settle real disagreements fairly.</p>
        </div>
        <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4">
          <h3 className="font-semibold">Jurors</h3>
          <p className="text-sm text-gray-400 mt-1">Stake JURI, get drawn, vote honestly, and earn fees — or lose your locked stake.</p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">FAQ</h2>
        <div className="space-y-3 text-sm">
          <details className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><summary className="font-semibold cursor-pointer">Is this real money?</summary><p className="text-gray-400 mt-2">No. ETH and JURI are dummy balances for the demo. Nothing leaves your browser.</p></details>
          <details className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><summary className="font-semibold cursor-pointer">Who picks the jurors?</summary><p className="text-gray-400 mt-2">A stake-weighted random draw from staked jurors. Parties to the case are never drawn.</p></details>
          <details className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><summary className="font-semibold cursor-pointer">What happens if I abstain or vote against the majority?</summary><p className="text-gray-400 mt-2">You lose the JURI locked for that vote. Coherent jurors share the fees and penalties.</p></details>
          <details className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4"><summary className="font-semibold cursor-pointer">Can I appeal a ruling?</summary><p className="text-gray-400 mt-2">Yes. Either side can fund an appeal; if both sides fund it, a fresh larger jury re-decides.</p></details>
        </div>
      </section>

      <footer className="text-center text-xs text-gray-500 border-t border-[#3a2f5a] pt-6">
        Inspired by Kleros. Simulation for hackathon demo.
      </footer>
    </div>
  );
}
