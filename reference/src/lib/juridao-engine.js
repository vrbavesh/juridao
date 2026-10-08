// juridao-engine.js
// JuriDAO simulation engine. Pure JavaScript, no dependencies, no browser APIs.
// All state lives in one plain JSON object (createInitialState). Every function takes the state first
// and throws Error("message") on invalid input. Money is integer micro-ETH (1 ETH = 1,000,000).
// Rulings: 0 = no majority (split 50/50), 1 = pay the freelancer, 2 = refund the client.

const ETH = 1000000;
const TOKENS_PER_ETH = 10000;
const FAUCET_AMOUNT = 5000;
const MAX_ROUNDS = 3;
const PERIODS = ["Evidence", "Commit", "Reveal", "Appeal", "Executed"];

// ---------- small helpers ----------
function num(v, what) {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || !Number.isFinite(n)) throw new Error(`${what} must be a number`);
  return n;
}
function int(v, what) {
  const n = num(v, what);
  if (!Number.isInteger(n)) throw new Error(`${what} must be a whole number`);
  return n;
}
function nowOf(s) { return Math.floor(Date.now() / 1000) + (s.timeOffset || 0); }
function acct(s, id) {
  const a = s.accounts[id];
  if (!a) throw new Error(`Unknown account: ${id}`);
  return a;
}
function getDeal(s, id) {
  const n = int(id, "Deal id");
  const d = s.deals.find((x) => x.id === n);
  if (!d) throw new Error("Deal not found");
  return d;
}
function getDispute(s, id) {
  const n = int(id, "Dispute id");
  const d = s.disputes.find((x) => x.id === n);
  if (!d) throw new Error("Dispute not found");
  return d;
}
function getCourt(s, id) {
  const n = int(id, "Court id");
  const c = s.courts.find((x) => x.id === n);
  if (!c) throw new Error("Court not found");
  return c;
}
function logEvent(s, ev) {
  s.log.push({ t: nowOf(s), ...ev });
  if (s.log.length > 500) s.log.splice(0, s.log.length - 500);
}
function notify(s, to, text, link) {
  s.notes.push({ at: nowOf(s), to, text, link });
  if (s.notes.length > 2000) s.notes.splice(0, s.notes.length - 2000);
}
function pendingOf(s, id) {
  if (!s.pending[id]) s.pending[id] = { eth: 0, juri: 0 };
  return s.pending[id];
}
function lockPerVote(court) { return Math.floor((court.minStake * court.alphaBps) / 10000); }
function lockedOf(s, courtId, addr) {
  let sum = 0;
  for (const d of s.disputes) {
    if (d.period === "Executed" || d.courtId !== courtId) continue;
    for (const r of d.rounds) if (r.jurors[addr]) sum += r.jurors[addr].locked;
  }
  return sum;
}
function stakeOf(s, courtId, addr) { return (s.stake[courtId] && s.stake[courtId][addr]) || 0; }

// ---------- hashing (simulation grade, synchronous, works in browser and Node) ----------
function hash53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
function fileFingerprint(text) {
  if (text === undefined || text === null || text === "") return "";
  return "fp_" + hash53("file:" + String(text)).slice(0, 10);
}
function makeCommit(choice, salt, addr) {
  return "0x" + hash53(`vote|${Number(choice)}|${salt}|${addr}`);
}
function randomSalt() {
  let out = "";
  for (let i = 0; i < 16; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

// ---------- state ----------
function createInitialState() {
  const accounts = {
    admin: { name: "Admin", eth: 10 * ETH, juri: 0 },
    sam: { name: "Sam (client)", eth: 10 * ETH, juri: 0 },
    deepa: { name: "Deepa (freelancer)", eth: 10 * ETH, juri: 0 },
    funder: { name: "Appeal funder", eth: 10 * ETH, juri: 0 },
  };
  for (let i = 1; i <= 7; i++) accounts["juror" + i] = { name: "Juror " + i, eth: 10 * ETH, juri: 0 };
  const pending = {};
  for (const id of Object.keys(accounts)) pending[id] = { eth: 0, juri: 0 };
  return {
    version: 2,
    timeOffset: 0,
    params: { Evidence: 90, Commit: 60, Reveal: 60, Appeal: 90 },
    accounts,
    courts: [
      { id: 1, name: "General Court", minStake: 1000, feePerJuror: 5000, alphaBps: 5000, cases: 0, totalStaked: 0,
        policy: "For any dispute that fits no other court. Jurors vote on whether the delivered work meets the agreed criteria. When in doubt, follow the written criteria of the deal." },
      { id: 2, name: "Freelance & Services Court", minStake: 500, feePerJuror: 2000, alphaBps: 5000, cases: 0, totalStaked: 0,
        policy: "For freelance and service jobs. Vote Pay the freelancer if the delivery meets the written criteria in substance. Vote Refund the client if key criteria are missing. Judge only what is in the criteria and the evidence." },
      { id: 3, name: "Code Court", minStake: 2000, feePerJuror: 10000, alphaBps: 7000, cases: 0, totalStaked: 0,
        policy: "For software work. Jurors should read the code and tests in the evidence. Working code that meets the written requirements earns payment; broken or missing features do not." },
    ],
    stake: { 1: {}, 2: {}, 3: {} },
    pending,
    treasury: { eth: 0, juri: 0 },
    deals: [],
    disputes: [],
    log: [],
    notes: [],
    stats: {},
    juriMinted: 0,
    nextEvidenceId: 1,
  };
}

// ---------- token ----------
function buyTokens(s, id, ethMicro) {
  const a = acct(s, id);
  const eth = int(ethMicro, "Amount");
  if (eth <= 0) throw new Error("Amount must be greater than zero");
  if (eth > a.eth) throw new Error("Not enough ETH");
  const juri = Math.floor((eth * TOKENS_PER_ETH) / ETH);
  if (juri <= 0) throw new Error("Amount too small to buy any JURI");
  a.eth -= eth;
  a.juri += juri;
  s.treasury.eth += eth;
  s.juriMinted += juri;
  logEvent(s, { type: "buy", who: id, eth, juri });
  return juri;
}
function faucet(s, id) {
  const a = acct(s, id);
  a.juri += FAUCET_AMOUNT;
  s.juriMinted += FAUCET_AMOUNT;
  logEvent(s, { type: "faucet", who: id, juri: FAUCET_AMOUNT });
  return FAUCET_AMOUNT;
}

// ---------- staking ----------
function stakeJuri(s, id, courtId, amount) {
  const a = acct(s, id);
  const court = getCourt(s, courtId);
  const amt = int(amount, "Amount");
  if (amt <= 0) throw new Error("Amount must be greater than zero");
  if (amt > a.juri) throw new Error("Not enough JURI");
  const after = stakeOf(s, court.id, id) + amt;
  if (after < court.minStake) throw new Error(`Minimum stake in ${court.name} is ${court.minStake} JURI`);
  a.juri -= amt;
  s.stake[court.id][id] = after;
  court.totalStaked += amt;
  logEvent(s, { type: "stake", who: id, courtId: court.id, amount: amt });
  return after;
}
function unstakeJuri(s, id, courtId, amount) {
  const a = acct(s, id);
  const court = getCourt(s, courtId);
  const amt = int(amount, "Amount");
  if (amt <= 0) throw new Error("Amount must be greater than zero");
  const staked = stakeOf(s, court.id, id);
  if (amt > staked) throw new Error("You have not staked that much");
  if (staked - lockedOf(s, court.id, id) < amt) throw new Error("stake is locked in an active case");
  const remaining = staked - amt;
  if (remaining !== 0 && remaining < court.minStake) {
    throw new Error(`Remaining stake must be 0 or at least ${court.minStake} JURI`);
  }
  s.stake[court.id][id] = remaining;
  court.totalStaked -= amt;
  a.juri += amt;
  logEvent(s, { type: "unstake", who: id, courtId: court.id, amount: amt });
  return remaining;
}

// ---------- deals ----------
function createDeal(s, client, o) {
  const c = acct(s, client);
  if (!o || typeof o !== "object") throw new Error("Deal details are missing");
  acct(s, o.freelancer);
  if (o.freelancer === client) throw new Error("The freelancer must be a different account");
  const amount = int(o.amount, "Amount");
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (amount > c.eth) throw new Error("Not enough ETH to lock this deal");
  const deadline = num(o.deadline, "Deadline");
  if (deadline <= nowOf(s)) throw new Error("The deadline must be in the future");
  const court = getCourt(s, o.courtId);
  const numJurors = int(o.numJurors, "Number of jurors");
  if (numJurors < 1 || numJurors % 2 === 0) throw new Error("Number of jurors must be odd (3, 5 or 7)");
  const title = String(o.title || "").trim();
  if (!title) throw new Error("A title is required");
  const criteria = (Array.isArray(o.criteria) ? o.criteria : []).map((x) => String(x).trim()).filter(Boolean);
  if (criteria.length < 1) throw new Error("Add at least one delivery criterion");
  c.eth -= amount;
  const id = s.deals.length + 1;
  s.deals.push({
    id, client, freelancer: o.freelancer, amount, deadline, courtId: court.id, numJurors, title,
    description: String(o.description || ""), criteria,
    deliveryNote: "", deliveryFileName: "", deliveryFingerprint: "",
    status: "Created", disputeId: null, initiator: null, ruling: null,
  });
  notify(s, o.freelancer, `${c.name} locked ${amount / ETH} ETH for you: "${title}"`, `/deals/${id}`);
  logEvent(s, { type: "deal", dealId: id, client, freelancer: o.freelancer, amount });
  return id;
}
function markDelivered(s, caller, dealId, note, fileName, fileText) {
  acct(s, caller);
  const d = getDeal(s, dealId);
  if (caller !== d.freelancer) throw new Error("Only the freelancer can mark the work as delivered");
  if (d.status !== "Created") throw new Error("This deal is not waiting for delivery");
  d.deliveryNote = String(note || "");
  d.deliveryFileName = String(fileName || "");
  d.deliveryFingerprint = fileFingerprint(fileText);
  d.status = "Delivered";
  notify(s, d.client, `Work was delivered for "${d.title}". Approve it or raise a dispute.`, `/deals/${d.id}`);
  logEvent(s, { type: "delivered", dealId: d.id });
}
function approveDeal(s, caller, dealId) {
  acct(s, caller);
  const d = getDeal(s, dealId);
  if (caller !== d.client) throw new Error("Only the client can approve");
  if (d.status !== "Delivered") throw new Error("Only a delivered deal can be approved");
  acct(s, d.freelancer).eth += d.amount;
  d.status = "Approved";
  notify(s, d.freelancer, `Payment of ${d.amount / ETH} ETH released for "${d.title}"`, `/deals/${d.id}`);
  logEvent(s, { type: "approved", dealId: d.id });
}
function raiseDispute(s, caller, dealId) {
  const a = acct(s, caller);
  const d = getDeal(s, dealId);
  if (caller !== d.client && caller !== d.freelancer) throw new Error("Only the client or the freelancer can raise a dispute");
  const lateByClient = d.status === "Created" && nowOf(s) > d.deadline && caller === d.client;
  if (d.status !== "Delivered" && !lateByClient) {
    if (d.status === "Created") throw new Error("A dispute is possible only after delivery, or by the client after the deadline");
    throw new Error("This deal cannot be disputed in its current state");
  }
  const court = getCourt(s, d.courtId);
  const fee = court.feePerJuror * d.numJurors;
  if (a.eth < fee) throw new Error("Not enough ETH to pay the dispute fee");
  a.eth -= fee;
  const id = s.disputes.length + 1;
  const now = nowOf(s);
  s.disputes.push({
    id, dealId: d.id, courtId: court.id, partyA: d.client, partyB: d.freelancer,
    question: `Was the work for "${d.title}" delivered as agreed? Criteria: ${d.criteria.join("; ")}`,
    answers: { 1: "Yes. Pay the freelancer", 2: "No. Refund the client" },
    period: "Evidence", periodStart: now, round: 0,
    rounds: [newRound(d.numJurors, fee)],
    evidence: [], finalRuling: null,
  });
  court.cases += 1;
  d.status = "Disputed";
  d.disputeId = id;
  d.initiator = caller;
  const other = caller === d.client ? d.freelancer : d.client;
  notify(s, other, `A dispute was raised on "${d.title}". Add your evidence.`, `/disputes/${id}`);
  logEvent(s, { type: "dispute", disputeId: id, dealId: d.id, by: caller, fee });
  return id;
}
function newRound(numDraws, feesPool) {
  return {
    numDraws, jurors: {}, ruling: 0, feesPool, tally: [0, 0, 0], funded: [0, 0, 0], required: [0, 0, 0],
    fullyFunded: [false, false, false], appealed: false, roundCost: 0, contrib: { 1: {}, 2: {} },
  };
}

// ---------- evidence ----------
function submitEvidence(s, caller, disputeId, o) {
  acct(s, caller);
  const d = getDispute(s, disputeId);
  if (d.period === "Executed") throw new Error("This case is closed");
  const x = o || {};
  const title = String(x.title || "").trim();
  if (!title) throw new Error("Evidence needs a title");
  const role = caller === d.partyA ? "client" : caller === d.partyB ? "freelancer" : "other";
  const ev = {
    id: s.nextEvidenceId++, by: caller, role, title, description: String(x.description || ""),
    fileName: String(x.fileName || ""), fingerprint: fileFingerprint(x.fileText), at: nowOf(s),
  };
  d.evidence.push(ev);
  logEvent(s, { type: "evidence", disputeId: d.id, by: caller });
  return ev.id;
}

// ---------- drawing ----------
function eligibleCount(s, d) {
  const court = getCourt(s, d.courtId);
  const lock = lockPerVote(court);
  let n = 0;
  for (const [addr, st] of Object.entries(s.stake[court.id] || {})) {
    if (addr === d.partyA || addr === d.partyB) continue;
    if (st - lockedOf(s, court.id, addr) >= lock && lock > 0) n++;
  }
  return n;
}
function drawJurors(s, d, round, n) {
  const court = getCourt(s, d.courtId);
  const lock = lockPerVote(court);
  const r = d.rounds[round];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    const cand = [];
    let total = 0;
    for (const [addr, st] of Object.entries(s.stake[court.id] || {})) {
      if (addr === d.partyA || addr === d.partyB) continue;
      const avail = st - lockedOf(s, court.id, addr);
      if (avail >= lock && avail > 0) { cand.push([addr, avail]); total += avail; }
    }
    if (!cand.length) break;
    let pick = Math.random() * total;
    let chosen = cand[cand.length - 1][0];
    for (const [addr, w] of cand) { pick -= w; if (pick < 0) { chosen = addr; break; } }
    if (!r.jurors[chosen]) r.jurors[chosen] = { draws: 0, commit: null, revealed: false, choice: 0, justification: "", locked: 0 };
    r.jurors[chosen].draws += 1;
    r.jurors[chosen].locked += lock;
    drawn++;
  }
  for (const [addr, j] of Object.entries(r.jurors)) {
    notify(s, addr, `You were drawn as a juror in case #${d.id} (${j.draws} vote${j.draws > 1 ? "s" : ""}). Commit your vote.`, `/cases/${d.id}`);
  }
  logEvent(s, { type: "drawn", disputeId: d.id, round, jurors: Object.keys(r.jurors), draws: drawn });
  return drawn;
}

// ---------- voting ----------
function jurorEntry(s, caller, d, forAction) {
  acct(s, caller);
  const r = d.rounds[d.round];
  const j = r.jurors[caller];
  if (!j) throw new Error("You were not drawn for this case");
  return { r, j };
}
function commitVote(s, caller, disputeId, commit) {
  const d = getDispute(s, disputeId);
  if (d.period !== "Commit") throw new Error("Votes can only be committed in the Commit phase");
  const { j } = jurorEntry(s, caller, d);
  if (!commit || typeof commit !== "string") throw new Error("A sealed vote is required");
  j.commit = commit;
  j.revealed = false;
  logEvent(s, { type: "commit", disputeId: d.id, who: caller });
}
function revealVote(s, caller, disputeId, choice, salt, justification) {
  const d = getDispute(s, disputeId);
  if (d.period !== "Reveal") throw new Error("Votes can only be revealed in the Reveal phase");
  const { r, j } = jurorEntry(s, caller, d);
  if (!j.commit) throw new Error("You did not commit a vote in this round");
  if (j.revealed) throw new Error("You already revealed your vote");
  const c = int(choice, "Choice");
  if (c !== 1 && c !== 2) throw new Error("Choice must be 1 or 2");
  if (makeCommit(c, salt, caller) !== j.commit) throw new Error("This does not match your sealed vote (wrong answer or salt)");
  j.revealed = true;
  j.choice = c;
  j.justification = String(justification || "");
  r.tally[c] += j.draws;
  logEvent(s, { type: "reveal", disputeId: d.id, who: caller });
}

// ---------- time and phases ----------
function periodEnd(s, d) { return d.periodStart + (s.params[d.period] || 0); }
function disputeWarning(s, d) {
  if (d.period === "Executed") return "";
  if (d.period === "Evidence" && eligibleCount(s, d) === 0) {
    return "No eligible juror has staked in this court, so the case cannot move on to voting. Jurors must join the court first.";
  }
  if ((d.period === "Commit" || d.period === "Reveal") && Object.keys(d.rounds[d.round].jurors).length === 0) {
    return "No jurors were drawn for this round, so nobody can vote. The ruling will be no majority.";
  }
  return "";
}
function roundRuling(r) {
  if (r.tally[1] > r.tally[2]) return 1;
  if (r.tally[2] > r.tally[1]) return 2;
  return 0;
}
function advancePeriod(s, disputeId, force) {
  const d = getDispute(s, disputeId);
  if (d.period === "Executed") return false;
  if (!force && nowOf(s) < periodEnd(s, d)) return false;
  const r = d.rounds[d.round];
  const now = nowOf(s);
  if (d.period === "Evidence") {
    const drawn = drawJurors(s, d, 0, r.numDraws);
    if (drawn === 0) return false;
    r.numDraws = drawn;
    d.period = "Commit";
    d.periodStart = now;
    logEvent(s, { type: "phase", disputeId: d.id, period: "Commit" });
    return true;
  }
  if (d.period === "Commit") {
    d.period = "Reveal";
    d.periodStart = now;
    for (const [addr, j] of Object.entries(r.jurors)) {
      if (j.commit) notify(s, addr, `Reveal your vote in case #${d.id}`, `/cases/${d.id}`);
    }
    logEvent(s, { type: "phase", disputeId: d.id, period: "Reveal" });
    return true;
  }
  if (d.period === "Reveal") {
    r.ruling = roundRuling(r);
    const court = getCourt(s, d.courtId);
    if (d.round < MAX_ROUNDS - 1) {
      const base = court.feePerJuror * (2 * r.numDraws + 1);
      r.required = [0, base, base];
      if (r.ruling === 1) r.required[2] = base * 2;
      if (r.ruling === 2) r.required[1] = base * 2;
    }
    d.period = "Appeal";
    d.periodStart = now;
    notify(s, d.partyA, `Round ${d.round + 1} ruling for case #${d.id}: ${rulingText(r.ruling)}. The appeal window is open.`, `/disputes/${d.id}`);
    notify(s, d.partyB, `Round ${d.round + 1} ruling for case #${d.id}: ${rulingText(r.ruling)}. The appeal window is open.`, `/disputes/${d.id}`);
    logEvent(s, { type: "phase", disputeId: d.id, period: "Appeal", ruling: r.ruling });
    return true;
  }
  if (d.period === "Appeal") {
    doExecute(s, d);
    return true;
  }
  return false;
}
function rulingText(x) { return x === 1 ? "freelancer paid" : x === 2 ? "client refunded" : "no majority, split 50/50"; }
function skipPeriod(s, disputeId) {
  const d = getDispute(s, disputeId);
  if (d.period === "Executed") throw new Error("This case is already executed");
  d.periodStart = nowOf(s) - (s.params[d.period] || 0);
  if (d.period === "Appeal") { executeRuling(s, d.id); return; }
  advancePeriod(s, d.id, false);
}
function skipTime(s, seconds) {
  const n = num(seconds, "Seconds");
  if (n < 0) throw new Error("Seconds must not be negative");
  s.timeOffset = (s.timeOffset || 0) + n;
  return nowOf(s);
}
function autoAdvance(s) {
  let changed = 0;
  for (const d of s.disputes) {
    for (let guard = 0; guard < 6; guard++) {
      if (d.period === "Executed") break;
      if (!advancePeriod(s, d.id, false)) break;
      changed++;
    }
  }
  return changed;
}

// ---------- appeals ----------
function fundAppeal(s, caller, disputeId, side, ethMicro) {
  const a = acct(s, caller);
  const d = getDispute(s, disputeId);
  if (d.period !== "Appeal") throw new Error("Appeals can only be funded in the Appeal window");
  if (d.round >= MAX_ROUNDS - 1) throw new Error("No further appeals are possible");
  const sd = int(side, "Side");
  if (sd !== 1 && sd !== 2) throw new Error("Side must be 1 or 2");
  const amt = int(ethMicro, "Amount");
  if (amt <= 0) throw new Error("Amount must be greater than zero");
  const r = d.rounds[d.round];
  const now = nowOf(s);
  const win = s.params.Appeal;
  if (now >= d.periodStart + win) throw new Error("The appeal window is over");
  if (r.fullyFunded[sd]) throw new Error("This side is already fully funded");
  const challenger = r.ruling !== 0 && sd !== r.ruling;
  if (challenger && now > d.periodStart + win / 2) {
    throw new Error("The challenging side can only be funded in the first half of the appeal window");
  }
  const take = Math.min(amt, r.required[sd] - r.funded[sd]);
  if (take <= 0) throw new Error("Nothing left to fund on this side");
  if (a.eth < take) throw new Error("Not enough ETH");
  a.eth -= take;
  r.funded[sd] += take;
  r.contrib[sd][caller] = (r.contrib[sd][caller] || 0) + take;
  if (r.funded[sd] >= r.required[sd]) r.fullyFunded[sd] = true;
  logEvent(s, { type: "appealFunded", disputeId: d.id, round: d.round, side: sd, who: caller, amount: take });
  if (r.fullyFunded[1] && r.fullyFunded[2]) startNextRound(s, d);
  return take;
}
function startNextRound(s, d) {
  const r = d.rounds[d.round];
  const court = getCourt(s, d.courtId);
  r.appealed = true;
  r.roundCost = court.feePerJuror * (2 * r.numDraws + 1);
  const next = newRound(2 * r.numDraws + 1, r.roundCost);
  d.rounds.push(next);
  d.round += 1;
  const drawn = drawJurors(s, d, d.round, next.numDraws);
  next.numDraws = drawn || next.numDraws;
  d.period = "Commit";
  d.periodStart = nowOf(s);
  notify(s, d.partyA, `Case #${d.id} was appealed. Round ${d.round + 1} starts with ${next.numDraws} jurors.`, `/disputes/${d.id}`);
  notify(s, d.partyB, `Case #${d.id} was appealed. Round ${d.round + 1} starts with ${next.numDraws} jurors.`, `/disputes/${d.id}`);
  logEvent(s, { type: "newRound", disputeId: d.id, round: d.round, jurors: next.numDraws });
}
function executeRuling(s, disputeId) {
  const d = getDispute(s, disputeId);
  if (d.period !== "Appeal") throw new Error("A ruling can only be executed in the Appeal period");
  const ended = nowOf(s) >= d.periodStart + s.params.Appeal;
  const last = d.round >= MAX_ROUNDS - 1;
  if (!ended && !last) throw new Error("The appeal window is still open");
  doExecute(s, d);
}
function doExecute(s, d) {
  const r = d.rounds[d.round];
  let final;
  if (r.fullyFunded[1]) final = 1;
  else if (r.fullyFunded[2]) final = 2;
  else final = r.ruling;
  r.defaultWin = !!(r.fullyFunded[1] || r.fullyFunded[2]);
  d.finalRuling = final;
  d.period = "Executed";
  d.periodStart = nowOf(s);
  settleDispute(s, d);
  const deal = s.deals.find((x) => x.id === d.dealId);
  const free = acct(s, deal.freelancer);
  const cli = acct(s, deal.client);
  if (final === 1) free.eth += deal.amount;
  else if (final === 2) cli.eth += deal.amount;
  else {
    const half = Math.floor(deal.amount / 2);
    free.eth += half;
    cli.eth += deal.amount - half;
  }
  deal.status = "Resolved";
  deal.ruling = final;
  notify(s, deal.client, `Case #${d.id} is final: ${rulingText(final)}`, `/disputes/${d.id}`);
  notify(s, deal.freelancer, `Case #${d.id} is final: ${rulingText(final)}`, `/disputes/${d.id}`);
  logEvent(s, { type: "executed", disputeId: d.id, ruling: final });
}
function settleDispute(s, d) {
  const court = getCourt(s, d.courtId);
  d.rounds.forEach((r, ri) => {
    const entries = Object.entries(r.jurors);
    const info = [];
    let penaltyPool = 0;
    let coherentDraws = 0;
    for (const [addr, j] of entries) {
      const revealed = j.revealed && (j.choice === 1 || j.choice === 2);
      const coherent = revealed && (r.ruling === 0 || j.choice === r.ruling);
      const penalty = coherent ? 0 : j.locked;
      info.push({ addr, j, coherent, penalty });
      penaltyPool += penalty;
      if (coherent) coherentDraws += j.draws;
      if (penalty > 0) {
        s.stake[court.id][addr] -= penalty;
        court.totalStaked -= penalty;
      }
    }
    let ethLeft = r.feesPool;
    let juriLeft = penaltyPool;
    const rewards = {};
    if (coherentDraws === 0) {
      s.treasury.eth += r.feesPool;
      s.treasury.juri += penaltyPool;
    } else {
      const coh = info.filter((x) => x.coherent);
      for (const x of coh) {
        const e = Math.floor((r.feesPool * x.j.draws) / coherentDraws);
        const jr = Math.floor((penaltyPool * x.j.draws) / coherentDraws);
        rewards[x.addr] = { eth: e, juri: jr };
        ethLeft -= e;
        juriLeft -= jr;
      }
      rewards[coh[0].addr].eth += ethLeft;
      rewards[coh[0].addr].juri += juriLeft;
    }
    for (const x of info) {
      const rw = rewards[x.addr] || { eth: 0, juri: 0 };
      const p = pendingOf(s, x.addr);
      p.eth += rw.eth;
      p.juri += rw.juri;
      if (!s.stats[x.addr]) s.stats[x.addr] = { settled: 0, coherent: 0 };
      s.stats[x.addr].settled += 1;
      if (x.coherent) s.stats[x.addr].coherent += 1;
      logEvent(s, { type: "settled", disputeId: d.id, round: ri, who: x.addr, coherent: x.coherent,
        ethReward: rw.eth, juriReward: rw.juri, penalty: x.penalty });
      notify(s, x.addr, x.coherent
        ? `Case #${d.id}: you voted with the majority. Reward: ${rw.eth / ETH} ETH and ${rw.juri} JURI.`
        : `Case #${d.id}: you did not vote with the majority (or did not reveal). You lost ${x.penalty} JURI.`, `/cases/${d.id}`);
    }
  });
}
function withdrawAppealFunds(s, caller, disputeId, roundIndex, side) {
  const a = acct(s, caller);
  const d = getDispute(s, disputeId);
  if (d.period !== "Executed") throw new Error("Appeal funds can only be withdrawn after the ruling is executed");
  const ri = int(roundIndex, "Round");
  const r = d.rounds[ri];
  if (!r) throw new Error("Round not found");
  const sd = int(side, "Side");
  if (sd !== 1 && sd !== 2) throw new Error("Side must be 1 or 2");
  const c = r.contrib[sd][caller] || 0;
  if (!(c > 0)) throw new Error("Nothing to withdraw");
  let payout = 0;
  if (!r.appealed) {
    payout = c;
  } else {
    if (!r.settle) {
      const pool = r.funded[1] + r.funded[2] - r.roundCost;
      r.settle = { poolLeft: pool, left: d.finalRuling === 0 ? r.funded[1] + r.funded[2] : r.funded[d.finalRuling] };
    }
    if (d.finalRuling === 0 || d.finalRuling === sd) {
      payout = Math.floor((r.settle.poolLeft * c) / r.settle.left);
      r.settle.poolLeft -= payout;
      r.settle.left -= c;
    }
  }
  r.contrib[sd][caller] = 0;
  a.eth += payout;
  logEvent(s, { type: "withdraw", disputeId: d.id, round: ri, side: sd, who: caller, amount: payout });
  return payout;
}

// ---------- rewards ----------
function claimRewards(s, id) {
  const a = acct(s, id);
  const p = pendingOf(s, id);
  if (p.eth <= 0 && p.juri <= 0) throw new Error("Nothing to claim");
  const out = { eth: p.eth, juri: p.juri };
  a.eth += p.eth;
  a.juri += p.juri;
  p.eth = 0;
  p.juri = 0;
  logEvent(s, { type: "claimed", who: id, eth: out.eth, juri: out.juri });
  return out;
}

// ---------- reads ----------
function jurorCases(s, id) {
  const out = [];
  for (const d of s.disputes) {
    let round = -1;
    d.rounds.forEach((r, i) => { if (r.jurors[id]) round = i; });
    if (round < 0) continue;
    const j = d.rounds[round].jurors[id];
    const closed = d.period === "Executed";
    let status;
    if (closed) status = "settled";
    else if (round < d.round) status = j.revealed ? "revealed" : j.commit ? "revealed" : "missed";
    else if (d.period === "Commit") status = j.commit ? "committed" : "needs commit";
    else if (d.period === "Reveal") status = j.revealed ? "revealed" : j.commit ? "needs reveal" : "missed";
    else status = j.revealed ? "revealed" : "missed";
    out.push({ disputeId: d.id, round, draws: j.draws, status, closed });
  }
  return out;
}
function jurorStats(s, id) {
  const st = s.stats[id] || { settled: 0, coherent: 0 };
  return { settled: st.settled, coherent: st.coherent, performancePct: st.settled ? Math.round((st.coherent / st.settled) * 100) : 0 };
}
function notificationsFor(s, id) {
  return s.notes.filter((n) => n.to === id).map((n) => ({ at: n.at, text: n.text, link: n.link })).reverse();
}

const JuriDAO = {
  ETH, TOKENS_PER_ETH, FAUCET_AMOUNT, MAX_ROUNDS, PERIODS,
  createInitialState, nowOf, buyTokens, faucet, stakeJuri, unstakeJuri,
  createDeal, markDelivered, approveDeal, raiseDispute, submitEvidence,
  makeCommit, randomSalt, commitVote, revealVote,
  fundAppeal, executeRuling, withdrawAppealFunds, claimRewards,
  advancePeriod, autoAdvance, skipPeriod, skipTime,
  jurorCases, jurorStats, notificationsFor, periodEnd, disputeWarning, fileFingerprint,
};
export default JuriDAO;
