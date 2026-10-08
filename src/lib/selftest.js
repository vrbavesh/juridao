// selftest.js: the in-app engine self-test (Admin page, "Run engine self-test").
// Usage: import { runSelfTest } from "./selftest.js"; const results = runSelfTest(JuriDAO);
// Returns [{ name, ok, detail }]. Uses its own throwaway state and never touches the live state.

export function runSelfTest(J) {
  const E = J.ETH;
  const results = [];
  const test = (name, fn) => {
    try { results.push({ name, ok: true, detail: fn() || "ok" }); }
    catch (e) { results.push({ name, ok: false, detail: e.message }); }
  };
  const eq = (got, want, what) => { if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`); };
  const disp = (s, id) => s.disputes.find((d) => d.id === id);
  const jurors = ["juror1", "juror2", "juror3", "juror4", "juror5", "juror6", "juror7"];
  const staked = () => {
    const s = J.createInitialState();
    for (const id of jurors) { J.faucet(s, id); J.stakeJuri(s, id, 2, 1000); }
    return s;
  };
  const dealOf = (s) => {
    const id = J.createDeal(s, "sam", { freelancer: "deepa", amount: E, deadline: J.nowOf(s) + 86400, courtId: 2, numJurors: 3, title: "Self-test", description: "d", criteria: ["c"] });
    J.markDelivered(s, "deepa", id, "n", "f.txt", "x");
    return id;
  };
  const voteAll = (s, did, choice) => {
    const d = disp(s, did);
    J.skipPeriod(s, did); // draw
    const addrs = Object.keys(disp(s, did).rounds[0].jurors);
    const salts = {};
    for (const a of addrs) { salts[a] = J.randomSalt(); J.commitVote(s, a, did, J.makeCommit(choice, salts[a], a)); }
    J.skipPeriod(s, did);
    for (const a of addrs) J.revealVote(s, a, did, choice, salts[a], "self-test");
    J.skipPeriod(s, did);
    return addrs;
  };

  test("Buy JURI and faucet", () => {
    const s = J.createInitialState();
    eq(J.buyTokens(s, "sam", E / 10), 1000, "JURI for 0.1 ETH");
    J.faucet(s, "sam");
    eq(s.accounts.sam.juri, 6000, "JURI after faucet");
    return "0.1 ETH = 1,000 JURI, faucet +5,000";
  });
  test("Stake and unstake", () => {
    const s = J.createInitialState();
    J.faucet(s, "juror1");
    let blocked = false;
    try { J.stakeJuri(s, "juror1", 2, 100); } catch (e) { blocked = true; }
    if (!blocked) throw new Error("staking below the minimum was allowed");
    J.stakeJuri(s, "juror1", 2, 1000);
    J.unstakeJuri(s, "juror1", 2, 500);
    eq(s.stake[2].juror1, 500, "stake");
    return "minimum enforced, unstake works";
  });
  test("Deal approve path", () => {
    const s = J.createInitialState();
    const id = dealOf(s);
    eq(s.accounts.sam.eth, 9 * E, "sam after lock");
    J.approveDeal(s, "sam", id);
    eq(s.accounts.deepa.eth, 11 * E, "deepa after approve");
    return "sam 9.0000, deepa 11.0000";
  });
  test("Dispute, ruling 1, no appeal", () => {
    const s = staked();
    const did = J.raiseDispute(s, "deepa", dealOf(s));
    eq(s.accounts.deepa.eth, 10 * E - 6000, "deepa paid the fee");
    voteAll(s, did, 1);
    J.skipPeriod(s, did);
    eq(disp(s, did).finalRuling, 1, "ruling");
    eq(s.accounts.sam.eth, 9 * E, "sam");
    eq(s.accounts.deepa.eth, 11 * E - 6000, "deepa");
    return "sam 9.0000, deepa 10.9940";
  });
  test("Dispute, ruling 2, no appeal", () => {
    const s = staked();
    const did = J.raiseDispute(s, "deepa", dealOf(s));
    voteAll(s, did, 2);
    J.skipPeriod(s, did);
    eq(disp(s, did).finalRuling, 2, "ruling");
    eq(s.accounts.sam.eth, 10 * E, "sam");
    eq(s.accounts.deepa.eth, 10 * E - 6000, "deepa");
    return "sam 10.0000, deepa 9.9940";
  });
  test("Non-reveal is penalised and stake is locked while drawn", () => {
    const s = staked();
    const did = J.raiseDispute(s, "deepa", dealOf(s));
    J.skipPeriod(s, did);
    const a = Object.keys(disp(s, did).rounds[0].jurors)[0];
    let locked = false;
    try { J.unstakeJuri(s, a, 2, 1000); } catch (e) { locked = /locked/.test(e.message); }
    if (!locked) throw new Error("a drawn juror could unstake everything");
    J.skipPeriod(s, did); J.skipPeriod(s, did); J.skipPeriod(s, did);
    const e = s.log.find((x) => x.type === "settled" && x.who === a);
    eq(e.coherent, false, "non-revealer coherent");
    if (!(e.penalty > 0)) throw new Error("no penalty applied");
    return `${a} lost ${e.penalty} JURI`;
  });
  test("Appeal with both sides funded starts a 7-juror round", () => {
    const s = staked();
    const did = J.raiseDispute(s, "deepa", dealOf(s));
    voteAll(s, did, 1);
    const r0 = disp(s, did).rounds[0];
    eq(r0.required[1], 14000, "defending side");
    eq(r0.required[2], 28000, "challenging side");
    J.fundAppeal(s, "funder", did, 1, r0.required[1]);
    J.fundAppeal(s, "sam", did, 2, r0.required[2]);
    eq(disp(s, did).round, 1, "round");
    eq(disp(s, did).rounds[1].numDraws, 7, "jurors in round 2");
    return "round 2 started with 7 jurors";
  });

  return results;
}
