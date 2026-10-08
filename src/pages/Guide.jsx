import { Link } from "react-router-dom";

// SPEC 8.12 — static guide.
export default function Guide() {
  return (
    <div className="max-w-3xl mx-auto px-3 py-8 space-y-8">
      <h1 className="text-2xl font-bold">JuriDAO guide</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">The six-step lifecycle (Sam and Deepa)</h2>
        <p className="text-sm text-gray-300">
          Sam locks 1 ETH in a deal with Deepa (step 1). Deepa delivers the page; the deal moves to Delivered.
          Nobody approves, so Deepa raises the dispute and pays the juror fee (step 2). Sam and Deepa each file
          evidence with fingerprints (step 3). A random stake-weighted jury is drawn (step 4), jurors seal their
          votes, then reveal them (step 5). The ruling executes automatically — pay Deepa, refund Sam, or split
          50/50 on a tie (step 6). Either party can fund an appeal in the appeal window, but both sides must
          fully fund it or the ruling stands.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">What is a juror?</h2>
        <p className="text-sm text-gray-300">
          A juror is any staked account. You buy JURI, stake it in a court, and become eligible for draws in
          that court. You cannot be drawn in a case where you are the client or the freelancer.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">How jurors are picked</h2>
        <p className="text-sm text-gray-300">
          Each round draws jurors proportionally to their stake in the case's court (stake-weighted random).
          A juror can be drawn more than once; every draw counts as a vote and locks
          <code className="bg-[#0f0b1a] px-1 rounded"> minStake × alpha / 10000 </code>
          JURI for that case. Round 0 uses 3 draws, but a fully funded appeal doubles it: 7, then 15.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Commit and reveal, in plain words</h2>
        <p className="text-sm text-gray-300">
          During the commit phase you store a hash of your answer, a random salt, and your address — so nobody
          can see your choice. During the reveal phase you publish the real answer; the engine recomputes the
          hash and rejects anything that does not match. Until the case leaves the reveal phase, the dispute
          page shows only "N of M committed / revealed", never the choices.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Rewards and penalties — worked example</h2>
        <p className="text-sm text-gray-300">
          Court 2: fee 0.002 ETH/juror, min stake 500 JURI, alpha 5000 → 250 JURI locked per draw. Round 0:
          3 jurors, fee pool 0.006 ETH, votes 2-for-1. Ruling 1. Each coherent juror receives 0.006/2 = 0.003
          ETH plus half of the forfeited 250 JURI (125 each). The juror who voted against the majority loses
          250 JURI. If no juror is coherent, both pools go to the treasury.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Appeals and their costs</h2>
        <p className="text-sm text-gray-300">
          A ruling costs <code className="bg-[#0f0b1a] px-1 rounded">fee × (2 × draws + 1)</code>. The side holding the ruling
          pays that base; the challenger pays double, and may only fund in the first half of the window. If only
          one side fully funds, that side wins by default and every contributor is refunded. If both fully fund, a
          new round with <code className="bg-[#0f0b1a] px-1 rounded">2 × draws + 1</code> jurors starts. Funders on the final-ruling
          side share everything raised minus the round cost; the losing side gets nothing. No appeals after round 3.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">What JuriDAO can and cannot solve</h2>
        <p className="text-sm text-gray-300">
          Good for: freelance deliverable disputes, escrowed milestone payouts, and any case where evidence is
          textual and the question is binary. Not good for: disputes needing licensed experts, jurisdiction,
          real money enforcement, or appeals to higher authority  - it is a simulation, not a court of law.
        </p>
      </section>

      <section>
        <p className="text-sm text-gray-400">Inspired by Kleros.</p>
        <p className="text-sm mt-2">
          Inside the demo: open <Link to="/admin" className="text-[#8b5cf6]">/admin</Link> for time skips, staking
          all jurors, self-test, and reset. Open <Link to="/testlab" className="text-[#8b5cf6]">/testlab</Link> for the
          automated flow tests and scenario seeds.
        </p>
      </section>

      <footer className="text-center text-xs text-gray-500 py-4">
        Need the automated checks? <Link to="/testlab" className="text-[#8b5cf6]">Open Test Lab</Link>.
      </footer>
    </div>
  );
}
