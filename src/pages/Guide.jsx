import { Link } from "react-router-dom";

// SPEC 8.12: six-step lifecycle with Sam/Deepa example, jurors, commit/reveal, rewards & penalties
// (worked example from §10), appeals cost rules, scope, "Inspired by Kleros".
export default function Guide() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-sm text-gray-300">
      <h1 className="text-2xl font-bold">Guide</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">The six-step lifecycle — Sam & Deepa</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li><strong>Create the deal.</strong> Sam locks 1 ETH with Deepa as the freelancer, a court (with its fee and juror rules), 3 jurors and delivery criteria.</li>
          <li><strong>Evidence.</strong> Both sides can attach claims with file fingerprints while the dispute is open.</li>
          <li><strong>Jurors drawn.</strong> Stakers are drawn at random, weighted by stake. Parties (Sam, Deepa) are never drawn in their own case.</li>
          <li><strong>Vote (sealed).</strong> Each juror picks an answer, seals it with a secret salt, then reveals it later — no one sees a vote early.</li>
          <li><strong>Appeal.</strong> Either side can fund an appeal, but the side challenging the ruling pays double. Both funded means a fresh, larger jury re-decides.</li>
          <li><strong>Ruling.</strong> The deal executes: pay the freelancer, refund the client, or split 50/50 on a tie.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">What is a juror?</h2>
        <p>A juror stakes JURI (the dummy jury token) in a court. Only staked accounts are drawable. When you are drawn, part of that stake is locked for the case; your vote either stays in the majority and earns, or loses the locked part.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">How jurors are picked</h2>
        <p>Each draw picks among staked accounts with probability proportional to their court stake. Repeats are allowed: one juror can be drawn several times, and each draw counts as a vote. The two parties of the case are excluded from the draw.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Commit and reveal in plain words</h2>
        <p>A juror first <em>commits</em> a hash of <code>(choice, salt, juror)</code> — sealed, nobody can see it. Later the juror <em>reveals</em> the real choice and salt; the engine re-hashes and checks it matches. Jurors who never commit/reveal, or reveal a different choice, lose their locked JURI. While voting is open no choice is visible on any page — only counts.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Rewards and penalties — worked example</h2>
        <p>Court 2 charges 0.002 ETH per juror and locks 250 JURI per vote (min stake 500 × alpha 5000 / 10000).</p>
        <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4 my-2 space-y-2">
          <p><strong>Round 0:</strong> 3 jurors drawn, fee 0.006 ETH paid by whoever raised the dispute. Ruling: 2 votes for the freelancer, 1 for the client → ruling 1.</p>
          <p>Each coherent juror earns <code>0.006 / 2 = 0.003 ETH</code> plus half the incoherent juror's 250-JURI penalty → <code>125 JURI</code> each.</p>
          <p>If the ruling instead pays nothing anyone, ties count all revealed jurors as coherent and odd micro-ETH go to the client on a split.</p>
        </div>
        <p>With no appeal: ruling 1 → Sam 9.0000 ETH, Deepa 10.9940 ETH. Ruling 2 → Sam 10.0000 ETH, Deepa 9.9940 ETH.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Appeals and their cost</h2>
        <div className="rounded-xl bg-[#1c1530] border border-[#3a2f5a] p-4 space-y-2">
          <p>Appeal cost for a round is <code>feePerJuror × (2 × draws + 1)</code>.</p>
          <p>The side in the ruling must raise that amount. The challenging side must raise double. On a tie, both pay the base. A challenger can only fund during the first half of the window.</p>
          <p>If both sides fully fund, a new round starts with <code>2 × draws + 1</code> jurors (e.g. 7) and cost of that new round.</p>
          <p>If only one side funds fully, that side wins by default and every contributor is refunded. The ruling side's winners share everything raised minus the round cost — a defending side that wins receives double its stake (0.028 vs its 0.014). The losing side gets nothing.</p>
          <p>No funding at all → the ruling stands. No appeals after round 3 (<code>MAX_ROUNDS - 1</code>).</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">What JuriDAO can and cannot solve</h2>
        <p><strong>Can:</strong> enforce a simple escrowed ruling on delivered work, keep the money moving automatically, and incentivize jurors to vote honestly.</p>
        <p><strong>Cannot (today):</strong> real money or on-chain enforcement, identity/Sybil resistance, IPFS, verifiable randomness, court hierarchy/appeals beyond the flat model described here, multiple dispute types, loser-pays reserves, AI evidence summaries, email notifications.</p>
      </section>

      <section className="rounded-xl bg-[#1c1530] border border-[#38bdf8]/40 p-4 text-sm">
        <p>Inspired by Kleros. This is a browser-only simulation; all ETH and JURI are fake.</p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#3a2f5a] pt-4 text-xs text-gray-500">
        <span>Inspired by Kleros. Simulation for hackathon demo.</span>
        <Link to="/testlab" className="text-[#38bdf8] hover:underline min-h-[44px] inline-flex items-center">Open Test Lab</Link>
      </footer>
    </div>
  );
}
