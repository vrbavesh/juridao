// juridao-engine.test.js: run with  node juridao-engine.test.js   (needs "type": "module" in package.json)
// 21 engine tests. Must end with the line ALL TESTS PASSED.
import J from "./src/lib/juridao-engine.js";

const E = J.ETH;
const JURORS = ["juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"];
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const eq = (got, want, what) => { if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`); };
const ok = (c, what) => { if (!c) throw new Error(what); };
const throws = (fn, what, contains) => {
  let m = null;
  try { fn(); } catch (e) { m = e.message; }
  if (m === null) throw new Error(`${what}: expected an error`);
  if (contains && !m.toLowerCase().includes(contains.toLowerCase())) throw new Error(`${what}: got "${m}", wanted "${contains}"`);
};
const disp = (s, id) => s.disputes.find((d) => d.id === id);
const deal = (s, id) => s.deals.find((d) => d.id === id);
const jurorsOf = (s, id) => { const d = disp(s, id); return d.rounds[d.round].jurors; };
const settled = (s, did, who) => s.log.filter((e) => e.type === "settled" && e.disputeId === did && e.who === who);
const totalEth = (s) => Object.values(s.accounts).reduce((a, x) => a + x.eth, 0) + Object.values(s.pending).reduce((a, x) => a + x.eth, 0) + s.treasury.eth;
const totalJuri = (s) => {
  let t = s.treasury.juri;
  for (const a of Object.values(s.accounts)) t += a.juri;
  for (const p of Object.values(s.pending)) t += p.juri;
  for (const c of Object.values(s.stake)) for (const v of Object.values(c)) t += v;
  return t;
};

function fresh(ids = JURORS, stake = 1000) {
  const s = J.createInitialState();
  for (const id of ids) { J.faucet(s, id); J.stakeJuri(s, id, 2, stake); }
  return s;
}
function mkDeal(s, o = {}) {
  const id = J.createDeal(s, "sam", { freelancer: "deepa", amount: E, deadline: J.nowOf(s) + 86400, courtId: 2, numJurors: 3, title: "Job", description: "d", criteria: ["a", "b"], ...o });
  J.markDelivered(s, "deepa", id, "n", "f.txt", "hello");
  return id;
}
function toCommit(s, o) { const did = J.raiseDispute(s, "deepa", mkDeal(s, o)); J.skipPeriod(s, did); return did; }
function vote(s, did, plan) {
  const js = jurorsOf(s, did);
  const addrs = Object.keys(js);
  const sec = {};
  addrs.forEach((a, i) => {
    const p = plan(a, js[a].draws, i);
    sec[a] = { ...p, salt: J.randomSalt() };
    J.commitVote(s, a, did, J.makeCommit(p.choice, sec[a].salt, a));
  });
  J.skipPeriod(s, did);
  for (const a of addrs) if (sec[a].reveal !== false) J.revealVote(s, a, did, sec[a].choice, sec[a].salt, "why");
  J.skipPeriod(s, did);
  return addrs;
}
// retry until the random draw gives three different jurors with one vote each
function distinctCase(plan) {
  for (let i = 0; i < 200; i++) {
    const s = fresh();
    const did = toCommit(s);
    const addrs = Object.keys(jurorsOf(s, did));
    if (addrs.length === 3) { const addrsOrdered = vote(s, did, (a, d, k) => plan(k)); return { s, did, addrs: addrsOrdered }; }
  }
  throw new Error("could not draw 3 distinct jurors in 200 tries");
}

test("01 approve path", () => {
  const s = fresh();
  const id = mkDeal(s);
  eq(s.accounts.sam.eth, 9 * E, "locked");
  J.approveDeal(s, "sam", id);
  eq(s.accounts.deepa.eth, 11 * E, "paid");
  eq(deal(s, id).status, "Approved", "status");
});
test("02 dispute without appeal (ruling 1 and ruling 2)", () => {
  for (const [choice, sam, deepa] of [[1, 9 * E, 11 * E - 6000], [2, 10 * E, 10 * E - 6000]]) {
    const s = fresh();
    const did = toCommit(s);
    vote(s, did, () => ({ choice }));
    J.skipPeriod(s, did);
    eq(disp(s, did).finalRuling, choice, "ruling");
    eq(s.accounts.sam.eth, sam, "sam");
    eq(s.accounts.deepa.eth, deepa, "deepa");
    eq(deal(s, 1).status, "Resolved", "deal status");
  }
});
test("03 exact reward numbers (2 vs 1, three jurors)", () => {
  const { s, did, addrs } = distinctCase((k) => ({ choice: k === 2 ? 2 : 1 }));
  J.skipPeriod(s, did);
  eq(disp(s, did).finalRuling, 1, "ruling");
  for (const [k, a] of addrs.entries()) {
    const e = settled(s, did, a)[0];
    if (k === 2) { eq(e.coherent, false, "minority coherent"); eq(e.penalty, 250, "penalty"); eq(e.ethReward, 0, "minority ETH"); }
    else { eq(e.coherent, true, "majority coherent"); eq(e.ethReward, 3000, "ETH reward 0.003"); eq(e.juriReward, 125, "JURI reward"); }
  }
});
test("04 non-reveal penalty and stake lock", () => {
  const s = fresh();
  const did = toCommit(s);
  const a = Object.keys(jurorsOf(s, did))[0];
  throws(() => J.unstakeJuri(s, a, 2, 1000), "unstake while drawn", "locked");
  const before = s.stake[2][a];
  const draws = jurorsOf(s, did)[a].draws;
  vote(s, did, (x, d, i) => ({ choice: 1, reveal: x !== a }));
  J.skipPeriod(s, did);
  eq(s.stake[2][a], before - 250 * draws, "stake after penalty");
  J.unstakeJuri(s, a, 2, s.stake[2][a]); // lock is released after execution
});
test("05 tie gives ruling 0 and a 50/50 split", () => {
  const s = fresh();
  const did = toCommit(s);
  vote(s, did, () => ({ choice: 1, reveal: false }));
  J.skipPeriod(s, did);
  eq(disp(s, did).finalRuling, 0, "ruling");
  eq(s.accounts.sam.eth, 9 * E + E / 2, "sam");
  eq(s.accounts.deepa.eth, 10 * E + E / 2 - 6000, "deepa");
});
test("06 one-sided appeal: default win and refund", () => {
  const s = fresh();
  const did = toCommit(s);
  vote(s, did, () => ({ choice: 2 }));
  eq(disp(s, did).rounds[0].required[2], 14000, "defending");
  eq(disp(s, did).rounds[0].required[1], 28000, "challenger");
  J.fundAppeal(s, "funder", did, 1, 28000); // challenger fully funded alone
  J.skipPeriod(s, did);
  eq(disp(s, did).finalRuling, 1, "challenger wins by default");
  eq(s.accounts.sam.eth, 9 * E, "sam");
  J.withdrawAppealFunds(s, "funder", did, 0, 1);
  eq(s.accounts.funder.eth, 10 * E, "refund");
});
test("07 multi-round appeal and payouts (defender wins and doubles)", () => {
  const s = fresh();
  const did = toCommit(s);
  vote(s, did, () => ({ choice: 1 }));
  J.fundAppeal(s, "funder", did, 1, 14000);
  J.fundAppeal(s, "sam", did, 2, 28000);
  eq(disp(s, did).round, 1, "round");
  vote(s, did, () => ({ choice: 1 }));
  J.skipPeriod(s, did);
  eq(disp(s, did).finalRuling, 1, "final");
  J.withdrawAppealFunds(s, "funder", did, 0, 1);
  eq(s.accounts.funder.eth, 10 * E - 14000 + 28000, "defender received double");
  J.withdrawAppealFunds(s, "sam", did, 0, 2);
  eq(s.accounts.sam.eth, 9 * E - 28000, "challenger lost");
});
test("08 ETH and JURI are conserved", () => {
  const s = fresh();
  const eth0 = totalEth(s), juri0 = totalJuri(s);
  eq(juri0, s.juriMinted, "JURI supply");
  const did = toCommit(s);
  vote(s, did, (a, d, i) => ({ choice: i === 0 ? 2 : 1, reveal: i !== 1 }));
  const r0 = disp(s, did).rounds[0];
  J.fundAppeal(s, "funder", did, 1, r0.required[1]);
  J.fundAppeal(s, "sam", did, 2, r0.required[2]);
  vote(s, did, (a, d, i) => ({ choice: 2 }));
  J.skipPeriod(s, did);
  for (const who of ["sam", "funder", "deepa"]) { try { J.withdrawAppealFunds(s, who, did, 0, 1); } catch (e) {} try { J.withdrawAppealFunds(s, who, did, 0, 2); } catch (e) {} }
  eq(totalEth(s), eth0, "ETH");
  eq(totalJuri(s), juri0, "JURI");
});
test("09 validations", () => {
  const s = fresh();
  const base = { freelancer: "deepa", amount: E, deadline: J.nowOf(s) + 100, courtId: 2, numJurors: 3, title: "t", description: "", criteria: ["c"] };
  throws(() => J.createDeal(s, "sam", { ...base, amount: 99 * E }), "too much ETH");
  throws(() => J.createDeal(s, "sam", { ...base, amount: 0 }), "zero amount");
  throws(() => J.createDeal(s, "sam", { ...base, freelancer: "sam" }), "self deal");
  throws(() => J.createDeal(s, "sam", { ...base, deadline: J.nowOf(s) - 5 }), "past deadline");
  throws(() => J.createDeal(s, "sam", { ...base, criteria: [] }), "no criteria");
  throws(() => J.createDeal(s, "sam", { ...base, numJurors: 4 }), "even jurors");
  throws(() => J.buyTokens(s, "sam", 0), "buy zero");
  J.faucet(s, "admin");
  throws(() => J.stakeJuri(s, "admin", 2, 100), "below min");
  throws(() => J.stakeJuri(s, "nobody", 2, 1000), "unknown account");
  throws(() => J.claimRewards(s, "sam"), "empty claim");
});
test("10 parties are never drawn as jurors", () => {
  const s = fresh(["sam", "deepa", ...JURORS]); // parties stake too
  for (let i = 0; i < 5; i++) {
    const did = toCommit(s);
    const a = Object.keys(jurorsOf(s, did));
    ok(!a.includes("sam") && !a.includes("deepa"), "a party was drawn");
    vote(s, did, () => ({ choice: 1 }));
    J.skipPeriod(s, did);
  }
});
test("11 keeper and notifications", () => {
  const s = fresh();
  const did = J.raiseDispute(s, "deepa", mkDeal(s));
  ok(J.notificationsFor(s, "sam").length > 0, "sam notified of the dispute");
  J.skipTime(s, 91);
  ok(J.autoAdvance(s) >= 1, "autoAdvance did nothing");
  eq(disp(s, did).period, "Commit", "period");
  for (const a of Object.keys(jurorsOf(s, did))) ok(J.notificationsFor(s, a).length > 0, "juror notified");
  J.skipTime(s, 61); J.autoAdvance(s);
  eq(disp(s, did).period, "Reveal", "period");
  J.skipTime(s, 61); J.autoAdvance(s);
  eq(disp(s, did).period, "Appeal", "period");
  J.skipTime(s, 91); J.autoAdvance(s);
  eq(disp(s, did).period, "Executed", "period");
  const n = J.notificationsFor(s, "sam");
  ok(n[0].at >= n[n.length - 1].at, "newest first");
});
test("12 locks are per court", () => {
  const s = fresh();
  for (const id of JURORS) { J.faucet(s, id); J.stakeJuri(s, id, 1, 1000); }
  const did = toCommit(s); // court 2 case
  const a = Object.keys(jurorsOf(s, did))[0];
  J.unstakeJuri(s, a, 1, 1000); // court 1 stake is not locked by a court 2 case
  throws(() => J.unstakeJuri(s, a, 2, 1000), "court 2 stake locked", "locked");
});
test("13 string vote choice is accepted", () => {
  const s = fresh();
  const did = toCommit(s);
  const a = Object.keys(jurorsOf(s, did))[0];
  eq(J.makeCommit("1", "x", a), J.makeCommit(1, "x", a), "same hash");
  J.commitVote(s, a, did, J.makeCommit("2", "salt", a));
  J.skipPeriod(s, did);
  J.revealVote(s, a, did, "2", "salt", "string choice");
  eq(jurorsOf(s, did)[a].choice, 2, "stored as a number");
});
test("14 commit and reveal guards", () => {
  const s = fresh();
  const did = J.raiseDispute(s, "deepa", mkDeal(s));
  throws(() => J.commitVote(s, "juror1", did, "x"), "commit in Evidence");
  J.skipPeriod(s, did);
  const a = Object.keys(jurorsOf(s, did))[0];
  const outsider = ["sam", "admin", "funder"][0];
  throws(() => J.commitVote(s, outsider, did, "x"), "commit by a non-juror", "not drawn");
  const salt = J.randomSalt();
  J.commitVote(s, a, did, J.makeCommit(1, salt, a));
  throws(() => J.revealVote(s, a, did, 1, salt, ""), "reveal in Commit");
  J.skipPeriod(s, did);
  throws(() => J.revealVote(s, a, did, 2, salt, ""), "wrong choice", "match");
  throws(() => J.revealVote(s, a, did, 1, "bad", ""), "wrong salt", "match");
  throws(() => J.revealVote(s, a, did, 3, salt, ""), "invalid choice");
  J.revealVote(s, a, did, 1, salt, "ok");
  throws(() => J.revealVote(s, a, did, 1, salt, "ok"), "double reveal", "already");
});
test("15 appeal timing", () => {
  const s = fresh();
  const did = toCommit(s);
  vote(s, did, () => ({ choice: 1 }));
  throws(() => J.executeRuling(s, did), "execute inside the window", "still open");
  J.skipTime(s, 50); // past the first half of the 90 s window
  throws(() => J.fundAppeal(s, "sam", did, 2, 1000), "challenger in the second half", "first half");
  J.fundAppeal(s, "funder", did, 1, 1000); // defending side may still fund
  J.skipTime(s, 50);
  throws(() => J.fundAppeal(s, "funder", did, 1, 1000), "funding after the window", "over");
  J.executeRuling(s, did);
  eq(disp(s, did).period, "Executed", "period");
});
test("16 skip keeps the clock", () => {
  const s = fresh();
  const did = J.raiseDispute(s, "deepa", mkDeal(s));
  const t0 = J.nowOf(s);
  J.skipPeriod(s, did);
  ok(Math.abs(J.nowOf(s) - t0) <= 2, "skipPeriod moved the clock");
  eq(disp(s, did).periodStart, J.nowOf(s), "new period starts now");
  const end = J.periodEnd(s, disp(s, did));
  eq(end - disp(s, did).periodStart, 60, "Commit lasts 60 s");
  J.skipTime(s, 100);
  ok(J.nowOf(s) >= t0 + 100, "skipTime moves the clock");
});
test("17 no-juror warning", () => {
  const s = J.createInitialState();
  const did = J.raiseDispute(s, "deepa", mkDeal(s));
  ok(J.disputeWarning(s, disp(s, did)).length > 0, "warning expected");
  J.skipPeriod(s, did);
  eq(disp(s, did).period, "Evidence", "cannot move on without jurors");
  J.faucet(s, "juror1"); J.stakeJuri(s, "juror1", 2, 1000);
  eq(J.disputeWarning(s, disp(s, did)), "", "warning clears");
  J.skipPeriod(s, did);
  eq(disp(s, did).period, "Commit", "now it moves on");
});
test("18 stats survive log trimming", () => {
  const s = fresh();
  const did = toCommit(s);
  vote(s, did, () => ({ choice: 1 }));
  J.skipPeriod(s, did);
  const a = Object.keys(jurorsOf(s, did))[0];
  for (let i = 0; i < 600; i++) s.log.push({ t: 0, type: "noise" });
  s.log.splice(0, s.log.length - 500);
  eq(J.jurorStats(s, a).settled, 1, "settled count");
  eq(J.jurorStats(s, a).performancePct, 100, "performance");
});
test("19 late dispute by the client", () => {
  const s = fresh();
  const id = J.createDeal(s, "sam", { freelancer: "deepa", amount: E, deadline: J.nowOf(s) + 1000, courtId: 2, numJurors: 3, title: "t", description: "", criteria: ["c"] });
  throws(() => J.raiseDispute(s, "sam", id), "before the deadline");
  J.skipTime(s, 1500);
  throws(() => J.raiseDispute(s, "deepa", id), "freelancer on an undelivered deal");
  throws(() => J.raiseDispute(s, "juror1", id), "stranger");
  const did = J.raiseDispute(s, "sam", id);
  eq(deal(s, id).status, "Disputed", "status");
  eq(s.accounts.sam.eth, 9 * E - 6000, "sam paid the fee");
  ok(did > 0, "dispute id");
});
test("20 odd amount splits 50/50 with the extra micro-ETH to the client", () => {
  const s = fresh();
  const did = toCommit(s, { amount: 1000001 });
  vote(s, did, () => ({ choice: 1, reveal: false }));
  J.skipPeriod(s, did);
  eq(disp(s, did).finalRuling, 0, "ruling");
  eq(s.accounts.deepa.eth, 10 * E + 500000 - 6000 , "freelancer half (rounded down)");
  eq(s.accounts.sam.eth, 10 * E - 1000001 + 500001, "client half plus the odd micro-ETH");
});
test("21 JSON round trip", () => {
  const s = fresh();
  const did = toCommit(s);
  vote(s, did, () => ({ choice: 2 }));
  const s2 = JSON.parse(JSON.stringify(s));
  J.skipPeriod(s2, did);
  eq(disp(s2, did).finalRuling, 2, "ruling after reload");
  eq(JSON.stringify(J.createInitialState()).length > 100, true, "initial state is plain JSON");
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`FAIL  ${t.name}\n        ${e.message}`); }
}
console.log(`\n${tests.length - failed} of ${tests.length} engine tests passed`);
if (failed) { console.log("SOME TESTS FAILED"); process.exit(1); }
console.log("ALL TESTS PASSED");
