// src/lib/flowtests.js
// Full-flow tests for JuriDAO. Uses ONLY the public engine API (spec section 5).
// Runs on throwaway states and never touches the live app state.
// If a test fails, first suspect the test or the UI, never edit the engine to make it pass.
// Export: runFlowTests(JuriDAO) -> [{ name, ok, detail }]

export function runFlowTests(J) {
  const E = J.ETH;
  const results = [];
  const JURORS = ["juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"];

  const disp = (s, id) => s.disputes.find((d) => d.id === id);
  const deal = (s, id) => s.deals.find((d) => d.id === id);
  const jurorsOf = (s, did) => { const d = disp(s, did); return d.rounds[d.round].jurors; };
  const eq = (got, want, what) => { if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`); };
  const assert = (cond, what) => { if (!cond) throw new Error(what); };
  const fails = (fn, what, contains) => {
    let msg = null;
    try { fn(); } catch (e) { msg = e.message; }
    if (msg === null) throw new Error(`${what}: expected an error but none was thrown`);
    if (contains && !msg.toLowerCase().includes(contains.toLowerCase())) {
      throw new Error(`${what}: error was "${msg}", expected it to mention "${contains}"`);
    }
    return msg;
  };
  const test = (name, fn) => {
    try { results.push({ name, ok: true, detail: fn() || "ok" }); }
    catch (e) { results.push({ name, ok: false, detail: e.message }); }
  };
  const totalEth = (s) =>
    Object.values(s.accounts).reduce((a, x) => a + x.eth, 0) +
    Object.values(s.pending).reduce((a, x) => a + (x.eth || 0), 0) +
    s.treasury.eth;

  // ---------- helpers ----------
  function fresh() {
    const s = J.createInitialState();
    for (const id of JURORS) { J.faucet(s, id); J.stakeJuri(s, id, 2, 1000); }
    return s;
  }
  function newDeal(s, numJurors = 3) {
    const id = J.createDeal(s, "sam", {
      freelancer: "deepa", amount: 1 * E, deadline: J.nowOf(s) + 86400, courtId: 2, numJurors,
      title: "Landing page", description: "Build a landing page", criteria: ["5 pages", "mobile responsive"],
    });
    J.markDelivered(s, "deepa", id, "All done", "site.txt", "hello world");
    return id;
  }
  // Delivered deal -> dispute raised by deepa -> evidence from both -> jurors drawn (period Commit)
  function openCase(s, numJurors = 3) {
    const dealId = newDeal(s, numJurors);
    const did = J.raiseDispute(s, "deepa", dealId);
    J.submitEvidence(s, "sam", did, { title: "Brief", description: "What we agreed", fileName: "brief.txt", fileText: "5 pages, mobile responsive" });
    J.submitEvidence(s, "deepa", did, { title: "Delivery", description: "What I built", fileName: "site.txt", fileText: "hello world" });
    J.skipPeriod(s, did);
    return { dealId, did };
  }
  // plan(addr, draws, index) -> { choice: 1|2, reveal: boolean }. Ends in the Appeal period.
  function runVotes(s, did, plan) {
    eq(disp(s, did).period, "Commit", "period before commit");
    const js = jurorsOf(s, did);
    const addrs = Object.keys(js);
    const secrets = {};
    addrs.forEach((a, i) => {
      const p = plan(a, js[a].draws, i);
      secrets[a] = { choice: p.choice, reveal: p.reveal !== false, salt: J.randomSalt() };
      J.commitVote(s, a, did, J.makeCommit(p.choice, secrets[a].salt, a));
    });
    J.skipPeriod(s, did);
    eq(disp(s, did).period, "Reveal", "period after commit");
    for (const a of addrs) {
      if (secrets[a].reveal) J.revealVote(s, a, did, secrets[a].choice, secrets[a].salt, "test reasoning");
    }
    J.skipPeriod(s, did);
    eq(disp(s, did).period, "Appeal", "period after reveal");
    return { addrs, secrets };
  }
  function execute(s, did) {
    J.skipPeriod(s, did); // during Appeal this executes the ruling
    eq(disp(s, did).period, "Executed", "period after execute");
  }
  function withdrawAll(s, did, who) {
    const d = disp(s, did);
    let n = 0;
    d.rounds.forEach((r, i) => {
      for (const side of [1, 2]) {
        if (r.contrib && r.contrib[side] && r.contrib[side][who] > 0) { J.withdrawAppealFunds(s, who, did, i, side); n++; }
      }
    });
    return n;
  }
  const settled = (s, did, who) => s.log.filter((e) => e.type === "settled" && e.disputeId === did && e.who === who);

  // ---------- 1. token ----------
  test("T01 Buy JURI: 0.1 ETH gives 1,000 JURI", () => {
    const s = J.createInitialState();
    const before = s.accounts.sam.eth;
    const got = J.buyTokens(s, "sam", E / 10);
    eq(got, 1000, "JURI returned");
    eq(s.accounts.sam.juri, 1000, "sam JURI");
    eq(s.accounts.sam.eth, before - E / 10, "sam ETH");
    return "0.1 ETH -> 1,000 JURI";
  });
  test("T02 Buy JURI: more ETH than the balance is rejected", () => {
    const s = J.createInitialState();
    const m = fails(() => J.buyTokens(s, "sam", 100 * E), "buy 100 ETH");
    return `rejected: ${m}`;
  });
  test("T03 Faucet gives +5,000 JURI", () => {
    const s = J.createInitialState();
    J.faucet(s, "juror1");
    eq(s.accounts.juror1.juri, 5000, "juror1 JURI");
    return "+5,000";
  });

  // ---------- 2. staking ----------
  test("T04 Staking: below minimum rejected, valid stake accepted, partial unstake works", () => {
    const s = J.createInitialState();
    J.faucet(s, "juror1");
    fails(() => J.stakeJuri(s, "juror1", 2, 100), "stake 100 in court 2 (minimum 500)");
    J.stakeJuri(s, "juror1", 2, 1000);
    eq(s.stake[2].juror1, 1000, "stake after join");
    J.unstakeJuri(s, "juror1", 2, 500);
    eq(s.stake[2].juror1, 500, "stake after unstake");
    return "min enforced, stake 1000 then 500";
  });

  // ---------- 3. deal ----------
  test("T05 Deal: create locks ETH, approve pays the freelancer", () => {
    const s = fresh();
    const id = J.createDeal(s, "sam", { freelancer: "deepa", amount: 1 * E, deadline: J.nowOf(s) + 86400, courtId: 2, numJurors: 3, title: "t", description: "d", criteria: ["c"] });
    eq(s.accounts.sam.eth, 9 * E, "sam after create");
    J.markDelivered(s, "deepa", id, "n", "f.txt", "x");
    J.approveDeal(s, "sam", id);
    eq(s.accounts.deepa.eth, 11 * E, "deepa after approve");
    eq(deal(s, id).status, "Approved", "deal status");
    return "sam 9.0000, deepa 11.0000";
  });
  test("T06 Deal validations", () => {
    const s = fresh();
    const base = { freelancer: "deepa", amount: 1 * E, deadline: J.nowOf(s) + 86400, courtId: 2, numJurors: 3, title: "t", description: "d", criteria: ["c"] };
    fails(() => J.createDeal(s, "sam", { ...base, amount: 50 * E }), "amount above balance");
    fails(() => J.createDeal(s, "sam", { ...base, freelancer: "sam" }), "client equals freelancer");
    const id = J.createDeal(s, "sam", base);
    fails(() => J.markDelivered(s, "sam", id, "n", "", ""), "client marking delivered");
    fails(() => J.approveDeal(s, "deepa", id), "freelancer approving");
    return "all four invalid actions rejected";
  });

  // ---------- 4. dispute, jury assignment ----------
  test("T07 Dispute: raiser pays fee, evidence stored with fingerprints, jurors drawn on skip", () => {
    const s = fresh();
    const dealId = newDeal(s);
    const did = J.raiseDispute(s, "deepa", dealId);
    eq(s.accounts.deepa.eth, 10 * E - 6000, "deepa after paying fee (0.0060)");
    eq(deal(s, dealId).status, "Disputed", "deal status");
    J.submitEvidence(s, "sam", did, { title: "A", description: "a", fileName: "a.txt", fileText: "abc" });
    const ev = disp(s, did).evidence;
    eq(ev.length, 1, "evidence count");
    eq(ev[0].fingerprint, J.fileFingerprint("abc"), "fingerprint");
    eq(ev[0].role, "client", "evidence role");
    J.skipPeriod(s, did);
    eq(disp(s, did).period, "Commit", "period");
    const addrs = Object.keys(jurorsOf(s, did));
    const draws = addrs.reduce((a, x) => a + jurorsOf(s, did)[x].draws, 0);
    eq(draws, 3, "total draws");
    return `drawn: ${addrs.map((a) => a + "x" + jurorsOf(s, did)[a].draws).join(", ")}`;
  });
  test("T08 Jury assignment: parties never drawn, jurors get a notification (4 cases)", () => {
    const s = fresh();
    for (let i = 0; i < 4; i++) {
      const { did } = openCase(s);
      const addrs = Object.keys(jurorsOf(s, did));
      assert(addrs.length >= 1, "nobody was drawn");
      assert(!addrs.includes("sam") && !addrs.includes("deepa"), "a party was drawn as juror");
      for (const a of addrs) assert(J.notificationsFor(s, a).length > 0, `${a} has no notification`);
      runVotes(s, did, () => ({ choice: 1 }));
      execute(s, did);
    }
    return "4 cases, no party drawn, notifications present";
  });
  test("T09 Stake is locked while a juror is drawn", () => {
    const s = fresh();
    const { did } = openCase(s);
    const a = Object.keys(jurorsOf(s, did))[0];
    fails(() => J.unstakeJuri(s, a, 2, 1000), "unstake all while drawn", "locked");
    return `${a} cannot unstake while locked`;
  });

  // ---------- 5. voting guards ----------
  test("T10 Voting guards: phase, hash and wrong-phase actions", () => {
    const s = fresh();
    const dealId = newDeal(s);
    const did = J.raiseDispute(s, "deepa", dealId);
    fails(() => J.commitVote(s, "juror1", did, J.makeCommit(1, "x", "juror1")), "commit during Evidence");
    J.skipPeriod(s, did);
    const a = Object.keys(jurorsOf(s, did))[0];
    const salt = J.randomSalt();
    J.commitVote(s, a, did, J.makeCommit(1, salt, a));
    fails(() => J.revealVote(s, a, did, 1, salt, "r"), "reveal during Commit");
    J.skipPeriod(s, did);
    fails(() => J.revealVote(s, a, did, 2, salt, "r"), "reveal with a different choice (hash mismatch)");
    J.revealVote(s, a, did, 1, salt, "r");
    return "all guards hold";
  });
  test("T11 Secrecy data: no choice is revealed before reveal phase", () => {
    const s = fresh();
    const { did } = openCase(s);
    const js = jurorsOf(s, did);
    const a = Object.keys(js)[0];
    J.commitVote(s, a, did, J.makeCommit(2, J.randomSalt(), a));
    const j = jurorsOf(s, did)[a];
    assert(j.revealed !== true, "marked revealed too early");
    return "UI must show only counts; engine holds only the sealed commit (UI check: manual test M12)";
  });

  // ---------- 6. outcomes with no appeal ----------
  test("T12 Ruling 1 (all vote freelancer): sam 9.0000, deepa 10.9940, ETH conserved", () => {
    const s = fresh();
    const start = totalEth(s);
    const { did } = openCase(s);
    runVotes(s, did, () => ({ choice: 1 }));
    execute(s, did);
    eq(disp(s, did).finalRuling, 1, "final ruling");
    eq(s.accounts.sam.eth, 9 * E, "sam");
    eq(s.accounts.deepa.eth, 10 * E + 1 * E - 6000, "deepa");
    eq(totalEth(s), start, "total ETH conserved");
    return "sam 9.0000, deepa 10.9940";
  });
  test("T13 Ruling 2 (all vote client): sam 10.0000, deepa 9.9940", () => {
    const s = fresh();
    const { did } = openCase(s);
    runVotes(s, did, () => ({ choice: 2 }));
    execute(s, did);
    eq(disp(s, did).finalRuling, 2, "final ruling");
    eq(s.accounts.sam.eth, 10 * E, "sam");
    eq(s.accounts.deepa.eth, 10 * E - 6000, "deepa");
    return "sam 10.0000, deepa 9.9940";
  });
  test("T14 No reveals: ruling 0 splits 50/50, penalties go to treasury", () => {
    const s = fresh();
    const { did } = openCase(s);
    runVotes(s, did, () => ({ choice: 1, reveal: false }));
    execute(s, did);
    eq(disp(s, did).finalRuling, 0, "final ruling");
    eq(s.accounts.sam.eth, 9 * E + E / 2, "sam");
    eq(s.accounts.deepa.eth, 10 * E + E / 2 - 6000, "deepa");
    assert(s.treasury.juri > 0, "treasury should receive the penalty JURI");
    return `sam 9.5000, deepa 10.4940, treasury JURI ${s.treasury.juri}`;
  });
  test("T15 Non-reveal is penalised (locked JURI x draws)", () => {
    const s = fresh();
    const { did } = openCase(s);
    const { addrs } = runVotes(s, did, (a, d, i) => ({ choice: 1, reveal: i !== 0 }));
    if (addrs.length < 2) return "skipped: only one distinct juror drawn (2% chance), re-run";
    execute(s, did);
    const draws = jurorsOf(s, did)[addrs[0]].draws;
    const e = settled(s, did, addrs[0])[0];
    assert(e, "no settled entry for the non-revealer");
    eq(e.coherent, false, "non-revealer coherent");
    eq(e.penalty, 250 * draws, "penalty");
    return `${addrs[0]} lost ${e.penalty} JURI`;
  });
  test("T16 Minority juror is penalised, coherent jurors share the fees and claim", () => {
    const s = fresh();
    const { did } = openCase(s);
    const { addrs } = runVotes(s, did, (a, d, i) => ({ choice: i === 0 ? 2 : 1 }));
    if (addrs.length < 2) return "skipped: only one distinct juror drawn (2% chance), re-run";
    const js = jurorsOf(s, did);
    const v2 = js[addrs[0]].draws;
    const v1 = addrs.slice(1).reduce((n, a) => n + js[a].draws, 0);
    const expected = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
    execute(s, did);
    eq(disp(s, did).finalRuling, expected, "final ruling");
    let ethSum = 0;
    for (const a of addrs) {
      const e = settled(s, did, a)[0];
      assert(e, `no settled entry for ${a}`);
      const voted = a === addrs[0] ? 2 : 1;
      const wantCoherent = expected === 0 ? true : voted === expected;
      eq(e.coherent, wantCoherent, `${a} coherent`);
      if (!wantCoherent) eq(e.penalty, 250 * js[a].draws, `${a} penalty`);
      ethSum += e.ethReward || 0;
    }
    assert(ethSum <= 6000 && ethSum >= 5990, `coherent jurors should share about 6000 micro-ETH, got ${ethSum}`);
    const a = addrs.find((x) => (settled(s, did, x)[0].ethReward || 0) > 0);
    const p = { ...(s.pending[a] || { eth: 0, juri: 0 }) };
    const ethBefore = s.accounts[a].eth;
    const res = J.claimRewards(s, a);
    eq(res.eth, p.eth, "claimed ETH");
    eq(s.accounts[a].eth, ethBefore + p.eth, "ETH after claim");
    return `ruling ${expected}, fees shared: ${ethSum} micro-ETH, ${a} claimed ${res.eth} + ${res.juri} JURI`;
  });

  // ---------- 7. appeals ----------
  test("T17 Appeal, only the ruling side funded: it wins by default and the funder is refunded", () => {
    const s = fresh();
    const { did } = openCase(s);
    runVotes(s, did, () => ({ choice: 1 }));
    const req = disp(s, did).rounds[0].required[1];
    eq(req, 14000, "required for side 1 (0.002 x 7)");
    J.fundAppeal(s, "funder", did, 1, req);
    execute(s, did);
    const d = disp(s, did);
    eq(d.round, 0, "no new round");
    eq(d.finalRuling, 1, "final ruling");
    assert(withdrawAll(s, did, "funder") >= 1, "funder had nothing to withdraw");
    eq(s.accounts.funder.eth, 10 * E, "funder refunded in full");
    return "funded 0.0140, refunded 0.0140";
  });
  test("T18 Appeal, both sides funded: 7-juror round, final payout, ETH conserved", () => {
    const s = fresh();
    const start = totalEth(s);
    const { did } = openCase(s);
    runVotes(s, did, () => ({ choice: 1 }));
    const r0 = disp(s, did).rounds[0];
    eq(r0.required[1], 14000, "defending side required");
    eq(r0.required[2], 28000, "challenger side required (double)");
    J.fundAppeal(s, "funder", did, 1, r0.required[1]);
    J.fundAppeal(s, "sam", did, 2, r0.required[2]);
    let d = disp(s, did);
    eq(d.round, 1, "round after both sides funded (if 0, check when the engine opens the new round)");
    eq(d.rounds[1].numDraws, 7, "round 1 jurors");
    eq(d.period, "Commit", "period of new round");
    runVotes(s, did, () => ({ choice: 2 }));
    execute(s, did);
    d = disp(s, did);
    eq(d.finalRuling, 2, "final ruling");
    eq(s.accounts.sam.eth, 10 * E - 28000, "sam before withdrawing: deal refunded, appeal money still held");
    assert(withdrawAll(s, did, "sam") >= 1, "sam had nothing to withdraw");
    eq(s.accounts.sam.eth, 10 * E, "sam after withdrawing (gets his own 0.028 back)");
    withdrawAll(s, did, "funder");
    eq(s.accounts.funder.eth, 10 * E - 14000, "funder lost 0.0140 (losing side)");
    eq(totalEth(s), start, "total ETH conserved");
    return "round 1 had 7 jurors, ruling 2, sam 10.0000, funder 9.9860";
  });

  // ---------- 8. time, keeper, late dispute ----------
  test("T19 Keeper: autoAdvance moves the case when the timer ends", () => {
    const s = fresh();
    const did = J.raiseDispute(s, "deepa", newDeal(s));
    J.skipTime(s, s.params.Evidence + 1);
    J.autoAdvance(s);
    eq(disp(s, did).period, "Commit", "period after timer");
    return "Evidence -> Commit by timer";
  });
  test("T20 Late dispute: only the client, only after the deadline, with no delivery", () => {
    const s = fresh();
    const id = J.createDeal(s, "sam", { freelancer: "deepa", amount: 1 * E, deadline: J.nowOf(s) + 1000, courtId: 2, numJurors: 3, title: "t", description: "d", criteria: ["c"] });
    fails(() => J.raiseDispute(s, "sam", id), "dispute before the deadline");
    J.skipTime(s, 2000);
    fails(() => J.raiseDispute(s, "deepa", id), "freelancer disputing an undelivered deal");
    const did = J.raiseDispute(s, "sam", id);
    assert(did !== undefined, "client could not raise the late dispute");
    return "client raised the late dispute";
  });
  test("T21 Persistence: state survives a JSON round trip and keeps working", () => {
    const s = fresh();
    const { did } = openCase(s);
    const s2 = JSON.parse(JSON.stringify(s));
    runVotes(s2, did, () => ({ choice: 1 }));
    execute(s2, did);
    eq(disp(s2, did).finalRuling, 1, "ruling after reload");
    return "ok";
  });

  return results;
}
