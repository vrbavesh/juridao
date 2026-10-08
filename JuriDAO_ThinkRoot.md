# JuriDAO Simulator: Enhanced ThinkRoot Spec

**What is new in this enhanced version (read this table first, then the rest is your original spec plus additions):**

| Addition | Where |
|---|---|
| Per-phase logging so nothing is lost when you switch ThinkRoot accounts (`BUILD_LOG.md`, `HANDOFF.md`, in-app build log) | PART A |
| Dummy **JURI** jury token: buy with dummy ETH, faucet, header quick-buy, token card | PART C, section C1 |
| Visible **jury assignment**: juror inspector, draw checks, notifications | PART C, section C3 |
| One-click **dispute creation** seeds for every stage | PART C, section C4 |
| **Test Lab** page `/testlab`: 21 automated flow tests that run in the browser, seeds, checklist, downloadable report | PART C, section C4 |
| Mobile-ready rules made testable (375 px checks) | PART C, section C6 |
| Ready-to-paste **prompt for every phase**, each ending with the log step | PART C, section C7 |
| How to test everything by hand, with exact expected numbers | PART D |

**Precedence:** PART B is your spec sheet. If PART C disagrees with PART B, PART C wins.

---

# PART A: Operating protocol (logs and account switching)

ThinkRoot has no terminal, so all testing and logging happens inside the project and the app.

## A1. Why
When you switch accounts, the chat history may not come with you, but **the project files do**. So every phase must leave its record in files. If it is not in a file, assume it is lost.

## A2. The files (create in Phase 0)
| File | Purpose |
|---|---|
| `BUILD_LOG.md` (project root) | One section appended per phase, using the template in PART E. Never delete earlier sections |
| `HANDOFF.md` (project root) | Overwritten constantly: current phase, last step done, the one next action |
| `DECISIONS.md` (project root) | Every assumption or deviation, newest at the bottom |
| `reference/` | Copies of the Complete Pack files (engine, selftest, engine test) for safekeeping |

## A3. Rules for every phase
1. Before starting any phase, read `HANDOFF.md` and the last section of `BUILD_LOG.md`.
2. Build only that phase.
3. Run the phase check. Then do the **LOG STEP** (PART E, E3): append to `BUILD_LOG.md`, overwrite `HANDOFF.md`, and reply with one line: "Phase N: PASS or FAIL, next action".
4. A phase with a failed check is logged with Status BLOCKED and the exact error. Do not start the next phase.
5. From Phase 2 on, after each phase open `/admin` and press Run engine self-test, and (from Phase 9) `/testlab` Run all flow tests. The earlier results must still pass. Record the numbers in the log.
6. Update `HANDOFF.md` after every big step, not only at the phase end, in case the account runs out mid-phase.

## A4. Resuming on a new account
Open the same project, start a new chat and paste the **Resume prompt** from PART E (E4).

---

# PART B: Original spec sheet

## Overview
A browser-only simulation of JuriDAO (a decentralized court for escrow disputes) for a hackathon demo. It demonstrates deal creation, delivery, dispute, juror draw, commit/reveal voting, appeals, final payout, juror rewards and penalties, using a single JavaScript engine and localStorage.

## Look & Feel
- **Theme:** Dark purple with background #0f0b1a, cards #1c1530, accent #8b5cf6, secondary #38bdf8.
- **Layout:** React single-page app with client-side routing. Clean, neutral layout that suits the product (no additional branding beyond the theme above).
- **Mobile-ready:** layout adapts to phone, tablet and desktop, with touch-friendly controls and content that reflows to a single column on small screens.
- **Banner on every page:** "Simulation mode: dummy ETH and dummy JURI, no real money."
- Header contains logo, nav, notification bell, account selector, balances and a Deals | Juror mode toggle (see pages).
- Where the spec is silent, use the simplest option.

## 0. How to work (read first)

1. Build in the phases of section 11, in order. Do not start a phase until the previous phase's check passes.
2. Never edit `src/lib/juridao-engine.js`. It is a tested module. If the UI and the engine disagree, the UI is wrong.
3. Use exactly the function names, parameter orders, field names and storage keys written in this document.
4. Where this spec is silent, choose the simplest option.
5. Definition of done is section 12.

## 1. Tech stack (fixed)

| Part | Choice |
|---|---|
| Frontend | React single-page app, client-side routing, Tailwind CSS |
| Theme | Dark purple: background #0f0b1a, cards #1c1530, accent #8b5cf6, secondary #38bdf8 |
| Contracts | None. Replaced by `src/lib/juridao-engine.js` (ES module, default export `JuriDAO`) |
| State | One JSON object from `JuriDAO.createInitialState()`, saved to localStorage key `juridao_state_v2` |
| Backend, database, indexer | None |
| Evidence files | Read in the browser as text with FileReader; stored in state with a fingerprint |
| Wallet | None. A header account selector replaces it |

## 2. Files

```
src/
  lib/
    juridao-engine.js     (given, never edited)
    selftest.js           (given, never edited)
    store.js              loadState, saveState, useJuri() -> { state, account, setAccount, act }
  components/  Header, Banner, Toast, PhaseTracker, EvidenceList, EvidenceForm, AppealPanel,
               VotePanel, DealCard, CourtRow, StatCard, Countdown, EmptyState, RingChart
  pages/       Landing, Guide, Notifications, Deals, NewDeal, DealDetail, DisputeDetail,
               Juror, Courts, MyCases, CaseJuror, Rewards, Admin
```

Routes: `/`, `/guide`, `/notifications`, `/deals`, `/deals/new`, `/deals/:id`, `/disputes/:id`, `/juror`, `/courts`, `/cases`, `/cases/:id`, `/rewards`, `/admin`.

## 3. Architecture rules

1. **One action = one engine call.** Call the engine function with the state as the first argument, save the state, re-render. If it throws, show `error.message` in a red toast. `act(fn)` in `store.js` does this.
2. **Keeper replacement:** run `JuriDAO.autoAdvance(state)` every 2 seconds, then save and re-render.
3. **Time:** always use `JuriDAO.nowOf(state)`, never `Date.now()`, so the admin skip buttons work. Show countdowns as mm:ss.
4. **Money:** ETH is stored as integer micro-ETH (1 ETH = 1,000,000). Display `(v / 1000000).toFixed(4) + " ETH"`. Input conversion: `Math.round(eth * 1000000)`. JURI is a whole number shown with thousands separators.
5. **Types:** ids, `courtId`, `numJurors`, appeal `side` and vote `choice` must be numbers, never strings.
6. **Banner** on every page: "Simulation mode: dummy ETH and dummy JURI, no real money."
7. **Every page** has an empty state ("Nothing here yet") and works with no data.
8. **Secrecy:** never show any juror's `choice` before the dispute period is Appeal or Executed. Before that show only counts ("N of M committed").
9. Console helper: `window.JuriDAO = JuriDAO; window.juriState = () => state;`

## 4. Roles and demo accounts

No login, no passwords. The header **account selector** is the login. Roles depend on the case, not the account.

| Account id | Name | Used for |
|---|---|---|
| admin | Admin | Demo controls |
| sam | Sam (client) | Client |
| deepa | Deepa (freelancer) | Freelancer |
| juror1 to juror7 | Juror 1 to 7 | Staked jurors |
| funder | Appeal funder | Appeal funding |

Each account starts with 10 ETH and 0 JURI. The two parties of a case are never drawn as jurors in that case.

## 5. Engine reference (what the UI may call)

All functions take the state `s` first and throw `Error("message")` on invalid input.

**Constants:** `ETH` (1,000,000), `TOKENS_PER_ETH` (10,000), `FAUCET_AMOUNT` (5,000), `MAX_ROUNDS` (3), `PERIODS`.

| Area | Function | Returns / effect |
|---|---|---|
| Setup | `createInitialState()` | New state (no `s` argument) |
| Time | `nowOf(s)` | Current simulated time in seconds |
| Token | `buyTokens(s, id, ethMicro)` | JURI received. Price: 1 ETH = 10,000 JURI |
| Token | `faucet(s, id)` | +5,000 JURI |
| Staking | `stakeJuri(s, id, courtId, amount)` | Adds stake; resulting stake must be at least the court minimum |
| Staking | `unstakeJuri(s, id, courtId, amount)` | Fails with "stake is locked in an active case" while locked |
| Deals | `createDeal(s, client, { freelancer, amount, deadline, courtId, numJurors, title, description, criteria })` | Deal id. Locks `amount` from the client |
| Deals | `markDelivered(s, caller, dealId, note, fileName, fileText)` | Freelancer only |
| Deals | `approveDeal(s, caller, dealId)` | Client only; pays the freelancer |
| Deals | `raiseDispute(s, caller, dealId)` | Dispute id. Caller pays `feePerJuror x numJurors` |
| Evidence | `submitEvidence(s, caller, disputeId, { title, description, fileName, fileText })` | Allowed until Executed |
| Voting | `makeCommit(choice, salt, addr)` | Sealed vote string |
| Voting | `randomSalt()` | New salt |
| Voting | `commitVote(s, caller, disputeId, commit)` | Commit phase only; may overwrite until the phase ends |
| Voting | `revealVote(s, caller, disputeId, choice, salt, justification)` | Reveal phase only; hash must match |
| Appeals | `fundAppeal(s, caller, disputeId, side, ethMicro)` | Amount actually taken (capped at what is still required) |
| Appeals | `executeRuling(s, disputeId)` | Allowed after the appeal window (or in the last round) |
| Appeals | `withdrawAppealFunds(s, caller, disputeId, roundIndex, side)` | Payout; only after Executed |
| Rewards | `claimRewards(s, id)` | `{ eth, juri }` |
| Phases | `advancePeriod(s, disputeId, force)` | Moves to the next phase when the timer ends |
| Keeper | `autoAdvance(s)` | Advances and executes every case whose timer ended |
| Demo | `skipPeriod(s, disputeId)` | Ends the current phase now (executes the ruling during Appeal) |
| Demo | `skipTime(s, seconds)` | Moves the simulated clock |
| Reads | `jurorCases(s, id)` | `[{ disputeId, round, draws, status, closed }]` |
| Reads | `jurorStats(s, id)` | `{ settled, coherent, performancePct }` |
| Reads | `notificationsFor(s, id)` | `[{ at, text, link }]` newest first |
| Reads | `periodEnd(s, dispute)` | Time the current phase ends |
| Reads | `disputeWarning(s, dispute)` | Text if the case cannot move on, else empty |
| Reads | `fileFingerprint(text)` | Short hash for evidence badges |

`jurorCases` status values: `needs commit`, `committed`, `needs reveal`, `revealed`, `missed`, `settled`. It does not return court or question; look them up in `state.disputes` and `state.courts`.

### State shape (read-only for the UI)

```
state.params        { Evidence: 90, Commit: 60, Reveal: 60, Appeal: 90 }   // seconds
state.accounts[id]  { name, eth, juri }
state.courts[]      { id, name, minStake, feePerJuror, alphaBps, cases, totalStaked, policy }
state.stake[courtId][account]   JURI staked
state.pending[account]          { eth, juri } rewards to claim
state.treasury                  { eth, juri }
state.deals[]       { id, client, freelancer, amount, deadline, courtId, numJurors, title, description,
                      criteria[], deliveryNote, deliveryFileName, deliveryFingerprint, status,
                      disputeId, initiator, ruling }
                    status: Created | Delivered | Approved | Disputed | Resolved
state.disputes[]    { id, dealId, courtId, partyA (client), partyB (freelancer), question,
                      answers {1,2}, period, periodStart, round, rounds[], evidence[], finalRuling }
                    period: Evidence | Commit | Reveal | Appeal | Executed
dispute.rounds[i]   { numDraws, jurors{addr:{draws,commit,revealed,choice,justification,locked}},
                      ruling, feesPool, tally[0,a,b], funded[0,a,b], required[0,a,b],
                      fullyFunded[], appealed, roundCost, contrib{1:{},2:{}} }
dispute.evidence[]  { id, by, role (client|freelancer|other), title, description, fileName, fingerprint, at }
state.log[]         last 500 events { t, type, ... }; type "settled" has { disputeId, who, coherent,
                    ethReward, juriReward, penalty }
```

**Rulings everywhere:** 0 = no majority (split 50/50), 1 = pay the freelancer, 2 = refund the client.

## 6. Seed data (created by `createInitialState`)

| Court | minStake (JURI) | Fee per juror | alphaBps | Locked per vote |
|---|---|---|---|---|
| 1 General Court | 1,000 | 0.005 ETH | 5000 | 500 |
| 2 Freelance & Services Court | 500 | 0.002 ETH | 5000 | 250 |
| 3 Code Court | 2,000 | 0.010 ETH | 7000 | 1,400 |

No deals exist at the start, so the demo starts from zero. Admin page "Auto-stake all jurors" stakes jurors 1 to 7 with 1,000 JURI each in court 2.

## 7. Rules the UI must respect (summary of the engine)

- **Deal:** the client locks the amount at creation. Approve pays the freelancer. A dispute is allowed when status is Delivered, or when status is Created, the deadline has passed, and the caller is the client.
- **Fee:** the person who raises the dispute pays `feePerJuror x numJurors`. It is not refunded.
- **Draw:** random, weighted by stake. A juror can be drawn more than once (draws count as votes). Each draw locks `minStake x alpha / 10000` JURI.
- **Phases:** Evidence (90 s), then jurors drawn and Commit (60 s), Reveal (60 s), Appeal window (90 s), Executed. The Appeal phase ends through `executeRuling`.
- **Ruling:** the answer with more revealed votes wins; a tie or no reveals gives 0.
- **Penalty and reward:** a juror who did not reveal, or voted against the round's majority, loses the locked JURI. Coherent jurors share the round fees (ETH) and the penalty pool (JURI) in proportion to their draws. With no coherent jurors, both go to the treasury. A tie counts every revealed juror as coherent.
- **Appeal cost:** `feePerJuror x (2 x draws + 1)`. The ruling's side pays that; the challenging side pays double. On a tie both pay the base. The challenging side can fund only in the first half of the window.
- **Appeal outcome:** one side fully funded wins by default and every contributor is refunded. Both fully funded starts a new round with `2 x draws + 1` jurors (3, 7, 15). Funders on the final-ruling side share everything raised minus the round cost. The losing side gets nothing. Nobody funds means the ruling stands. No appeals after round 3 (`MAX_ROUNDS - 1`).
- **Execution:** the deal pays the freelancer (1), refunds the client (2), or splits 50/50 with any odd micro-ETH going to the client (0).

## 8. Pages and features

**Header (all pages):** logo, nav (Home, Deals, Courts, My Cases, Rewards, Guide), notification bell with unread count, account selector, current ETH and JURI balances, and a Deals | Juror mode toggle that sets the landing page after switching (`/deals` or `/juror`).

### 8.1 Landing `/`
Hero ("Disputes resolved by a decentralized jury" / "When a smart contract can't decide who is right, JuriDAO can." with buttons Create a deal and Become a juror); the Sam and Deepa problem story in three lines; six numbered steps (Create the deal, Evidence, Jurors drawn, Vote (sealed), Appeal, Ruling); four "Why JuriDAO" cards (Random jurors, Fair incentives, Transparent, Automatic enforcement); live stats labelled "demo data" (disputes Executed, total JURI staked from `state.courts[].totalStaked`, ETH locked in deals with status Created, Delivered or Disputed); two audience blocks; FAQ of 4 questions; footer "Inspired by Kleros. Simulation for hackathon demo."

### 8.2 Deals `/deals`
Stat cards (active, in dispute, completed, total ETH locked) and cards for deals where the account is client or freelancer: id, title, counterparty, amount, deadline, status badge, "Action needed" tag. Button Create new deal.

### 8.3 Create deal `/deals/new`
Fields: freelancer (all accounts except the current one), amount in ETH, deadline as days from now (`nowOf(state) + days x 86400`), title, description, delivery criteria (add and remove lines, at least one), court (with fee per juror), jurors (3, 5 or 7). Cost preview: "If disputed, the person who raises the dispute pays fee per juror x jurors". On submit call `createDeal`, go to `/deals/:id`.

### 8.4 Deal detail `/deals/:id`
Title, status, parties, amount, deadline countdown, description, criteria, timeline Created, Delivered, Approved or Disputed, Resolved. Freelancer (status Created): note and optional file, Mark as delivered. Client: Approve and release payment. Raise dispute (client or freelancer when Delivered; client after the deadline with no delivery) opens a confirm modal with the fee, the frozen funds warning, and the question and answers jurors will see. When Disputed or Resolved show a banner linking to the dispute and, when Resolved, the ruling and where the ETH went.

### 8.5 Dispute `/disputes/:id`
Public page. Header (number, deal, court, question, answers). PhaseTracker: Evidence, Jurors drawn, Voting (Commit), Reveal, Appeal window, Final, with round number and countdown to `periodEnd` (for Appeal: `periodStart + params.Appeal`). Yellow box when `disputeWarning` returns text. Evidence grouped Client, Freelancer, Other with fingerprint badges, and an Add evidence form (title, description, optional file) until Executed. Jurors section after the draw (names, draws, "N of M committed", "N of M revealed"; after reveal the tally, choices and justifications). Collapsible rounds history. AppealPanel. Final section with the ruling banner (1 "Freelancer paid", 2 "Client refunded", 0 "No majority: split 50/50") and payout outcome.

### 8.6 Appeals (inside the dispute page)
Shown in the Appeal period, read-only summary afterwards. Current ruling, round number, next-round jury size `2 x numDraws + 1`, countdown. Two columns (side 1 "Pay the freelancer", side 2 "Refund the client") each with funding bar `funded / required`, required amount, "pays double because it is challenging the ruling" on the challenger, amount input, Fund remaining shortcut, Fund this side button. Challenger side disabled in the second half with the reason shown. Last round shows "No further appeals". Rules box. Execute ruling button when the countdown is over. After Executed, a Withdraw appeal funds button per round and side where `round.contrib[side][account] > 0`.

### 8.7 Courts `/courts`
Token panel: balances, price line "1 ETH = 10,000 JURI (dummy)", ETH input with live JURI preview, Buy JURI, Free faucet (+5,000). Court table: name, minimum stake, fee per juror, cases, total staked, your stake, your drawing chance (0% when the court total is 0), expandable policy text. Join / add stake modal (minimum, balance) and Unstake.

### 8.8 Juror dashboard `/juror`
Pending ETH and JURI with link to Rewards; staked courts with drawing chance; case counts (vote pending, in progress, closed); ring chart with `performancePct`; ongoing cases with tags (Commit needed, Reveal needed, Waiting); latest 5 notifications; buttons Join a court and Get JURI.

### 8.9 My cases `/cases`
Tabs Vote pending, In progress, Closed from `jurorCases`. Row: case number, court, question, phase and countdown, your status, link.

### 8.10 Juror case page `/cases/:id`
If not drawn in the current round: "You were not drawn for this case". Otherwise: question, answers, court policy, delivery criteria, evidence, countdown.
- **Commit:** radio answer, reasoning, Seal my vote. `choice = Number(value)`, `salt = randomSalt()`, `commit = makeCommit(choice, salt, account)`, call `commitVote`, store `{ choice, salt, reasoning }` in localStorage key `juri_vote_{disputeId}_{round}_{account}`. Then show "Your vote is sealed. Nobody can see it. Come back to reveal." and a Download backup button.
- **Reveal:** one Reveal my vote button that reads the stored values and calls `revealVote(state, account, disputeId, Number(choice), salt, reasoning)`. If storage is missing, show inputs for the salt and the answer.
- **Warning always visible while voting is open:** "If you do not commit and reveal, or you vote against the majority, you lose the JURI locked for this case."
- **After the result:** the round outcome, whether you were coherent, and your reward or penalty from `settled` log entries.

### 8.11 Rewards `/rewards`
Pending ETH and JURI, Claim rewards button, history table from `settled` log entries (case, coherent, ETH reward, JURI reward, JURI penalty) plus `claimed` entries.

### 8.12 Guide `/guide`
Static: the six-step lifecycle with the Sam and Deepa example; what a juror is; how jurors are picked (stake-weighted random draw, repeats allowed, parties excluded); commit and reveal in plain words; rewards and penalties with the worked example in section 10; appeals and their cost rules; what JuriDAO can and cannot solve; "Inspired by Kleros".

### 8.13 Notifications `/notifications`
`notificationsFor` newest first with links. Read and unread state in localStorage; unread count on the bell.

### 8.14 Admin `/admin` (labelled "Demo controls", visible to every account)
- Per dispute: number, period, round, countdown, Skip current phase (`skipPeriod`; during Appeal it executes the ruling).
- Fast forward 60 seconds (`skipTime`).
- Give everyone test JURI (`faucet` for every account).
- Auto-stake all jurors (skip a juror who already has 1,000 or more staked in court 2; otherwise faucet, then `stakeJuri(state, id, 2, 1000)`).
- **Run engine self-test:** `runSelfTest(JuriDAO)` from `selftest.js`; show a tick or cross, name and detail per test, and a summary "7 of 7 passed". It uses its own throwaway state.
- Reset demo (confirm, then replace the state with `createInitialState()` and save).
- Live log of the last 50 `state.log` entries.

## 9. Tests

**Engine tests (Node):** `node juridao-engine.test.js` runs 21 tests and must end with `ALL TESTS PASSED`. They cover: approve path; dispute without appeal; exact reward numbers; non-reveal penalty and stake lock; tie; one-sided appeal; multi-round appeal and payouts; ETH and JURI conservation; validations; parties never drawn; keeper and notifications; per-court locks; string vote choice; commit and reveal guards; appeal timing; skip keeps the clock; no-juror warning; stats survive log trimming; late dispute and odd split; JSON round trip.

**In-app test:** Admin, Run engine self-test, must show 7 of 7 passed.

**UI checks:** `npm run build` (or ThinkRoot's build) has no errors, and the browser console shows no errors during the demo script in section 13.

## 10. Worked numbers (use for the Guide page and for checks)

Court 2: fee 0.002 ETH per juror, minimum stake 500 JURI, alpha 5000, so 250 JURI is locked per vote.
- Round 0: 3 jurors, fee 0.006 ETH, paid by whoever raises the dispute. Votes: 2 for the freelancer, 1 for the client. Ruling 1.
- Each coherent juror receives 0.006 / 2 = 0.003 ETH plus half of the incoherent juror's 250 JURI penalty: 125 JURI each.
- Appeal cost for round 1: 0.002 x 7 = 0.014 ETH. The ruling's side (freelancer) must raise 0.014 ETH; the challenger (client side) must raise 0.028 ETH. If both are funded, 7 jurors are drawn and the round costs 0.014 ETH. The remaining 0.028 ETH is shared by contributors on the side that matches the final ruling. If the defending side wins it receives 0.028, double its money. If the challenger wins it only gets its own 0.028 back. The losing side gets nothing.
- If only one side is fully funded when the window ends, that side wins by default and every contributor is refunded.
- Expected balances with no appeal: ruling 1 gives Sam 9.0000 and Deepa 10.9940 ETH; ruling 2 gives Sam 10.0000 and Deepa 9.9940 ETH.

## 11. Build phases (one ThinkRoot prompt each)

1. **Shell:** layout, header, account selector, routes, toast, banner, placeholders. Check: preview opens, account switching works.
2. **Engine and store:** add the engine, self-test and `store.js` with the 2-second `autoAdvance`. Check: app still opens, `window.JuriDAO` exists in the console.
3. **Landing and Guide.** Check: both pages render with live stats.
4. **Courts and token:** buy, faucet, stake, unstake. Check: buying 0.1 ETH gives 1,000 JURI; unstake works when not locked.
5. **Juror pages:** dashboard, My cases, Rewards.
6. **Deals:** list, create, detail, deliver, approve, raise dispute. Check: Sam shows 9.0000 ETH after creating a 1 ETH deal.
7. **Dispute and voting:** dispute page, evidence, tracker, juror case page. Check: "0 of 3 committed" appears and no choices are visible before the Appeal period.
8. **Appeals, notifications, admin.** Check: self-test shows 7 of 7; a two-sided appeal starts a 7-juror round.
9. **Polish and full demo run** (Prompt 11 in the Complete Pack).

## 12. Definition of done

- Engine tests pass in Node (21 of 21) and the in-app self-test shows 7 of 7.
- Every page in section 8 exists and reads real state (no hard-coded fake data except the landing stats labelled "demo data").
- All three outcomes work: no appeal, appeal with one side funded, appeal with both sides funded (new round with 7 jurors).
- A juror can commit and reveal using only the UI and sees the reward or penalty afterwards.
- The demo script in section 13 runs with no console errors and no terminal use.

## 13. Demo script (the app must support this exactly)

1. Open `/`. Show the landing page. As admin press Reset demo and Auto-stake all jurors; show the Courts page with staked jurors.
2. As **sam**: `/deals/new`, freelancer deepa, 1 ETH, court 2, 3 jurors, criteria "5 pages" and "mobile responsive", deadline in the future. Create. Sam shows 9.0000 ETH.
3. As **deepa**: open the deal, add a file, Mark as delivered.
4. As **sam**: show he does not approve. As **deepa**: Raise dispute; she pays 0.0060 ETH. The deal shows Disputed.
5. On the dispute page, sam and deepa each add evidence (files show fingerprints).
6. As **admin**: Skip current phase. Jurors are drawn; the notification bell shows for the drawn jurors.
7. Switch through the drawn jurors. Each opens My cases, then the case page, reads evidence and seals a vote. The dispute page shows only "N of 3 committed".
8. As **admin**: skip to Reveal. Each juror reveals. The dispute page shows the vote count and the justifications.
9. The appeal window opens. As **funder** fund side 1; as **sam** fund the challenger side. A 7-juror round starts. Vote and reveal quickly using Admin skip.
10. As **admin**: skip the appeal window. The deal shows Resolved with the ETH moved.
11. As the jurors: Rewards shows ETH and JURI earned or lost; Claim rewards. The juror dashboard shows updated performance.
12. As the appeal funder and sam: Withdraw appeal funds on the dispute page.

## 14. Out of scope (future work)

Real blockchain and wallets, the Solidity contracts (a JURI token contract is in the Complete Pack, Part D), IPFS storage, verifiable randomness, court hierarchy and court jumps, multiple dispute kits, a loser-pays fee reserve, AI evidence summaries, email notifications, identity or Sybil protection, and any backend.

---

# PART C: Enhancements (these override PART B where they differ)

## C1. The dummy jury token (JURI) and buying it
The token is **JURI**, the dummy "jury token". The ticker stays `JURI` in code and UI because the engine uses it. Everything is fake: no wallet, no real money.

Add these on top of the Courts token panel (8.7):
1. **Token card** on the Courts page titled "JURI, the jury token (dummy)" with four plain lines: "You need JURI to join a court as a juror", "When you are drawn, part of your stake is locked for that case", "Vote with the majority: you earn ETH fees and JURI", "Vote against the majority or skip: you lose the locked JURI".
2. **Header quick-buy:** a small "Buy JURI" button next to the balances. It opens `BuyJuriModal`: ETH input, live JURI preview (`ethMicro / 1000000 x 10000`), your ETH balance, Buy button, and a Faucet button. The same modal opens from the Juror dashboard "Get JURI" button.
3. **Feedback:** after a buy, a green toast "Bought 1,000 JURI for 0.1000 ETH" (use the real return value of `buyTokens`). Errors (not enough ETH, zero amount) show the engine message in a red toast and change nothing.
4. Buy and faucet go through `act()` like every other action (`buyTokens(state, account, ethMicro)`, `faucet(state, account)`).

## C2. Engine
Unchanged. Never edit `juridao-engine.js` or `selftest.js`.

## C3. Visible jury assignment
After the draw (period Commit or later) the dispute page (8.5) Jurors section gets a **"How the jury was drawn"** box:
- One line per drawn juror: name, draws, their stake weight in this court (`stake / totalStaked` as a percentage).
- A line "Parties excluded: Sam and Deepa cannot be jurors in this case" with a tick when neither party is in the jury.
- A line "Jury size: N draws" matching the round size (3, 7, 15).
- Secrecy rule 8 still applies: show no choices before Appeal.

Notifications: every drawn juror gets a notification linking to `/cases/:id` (provided by the engine through `notificationsFor`). A juror who was not drawn sees "You were not drawn for this case".

## C4. Test Lab page `/testlab`

New files: `src/pages/TestLab.jsx`, `src/lib/flowtests.js` (PART E, E1, copy exactly), `src/components/FlowTestRunner.jsx`, `src/components/JurorInspector.jsx`, `src/components/BuyJuriModal.jsx`. New route `/testlab`. Add the link "Open Test Lab" at the top of the Admin page and in the Guide footer. Visible to every account. Label: "Test Lab (simulation only)". Uses only engine calls through `act()`.

**Panel A: Token test.** Shows the current account's ETH and JURI. Buttons:
- "Buy 0.1 ETH of JURI": expects +1,000 JURI, shows green "PASS: 1,000 JURI received" or red "FAIL" by comparing balances before and after.
- "Faucet": expects +5,000, same pass/fail.
- "Try to buy 100 ETH": expects the engine to throw; shows PASS when it does.

**Panel B: Scenario seeds.** Each button creates a **new** deal and dispute from scratch, so it can be pressed again and again. Each seed first auto-stakes jurors 1 to 7 with 1,000 JURI in court 2 if fewer than 3 of them have stake there. Deal: sam to deepa, 1 ETH, court 2, 3 jurors, criteria "5 pages" and "mobile responsive", deadline `nowOf + 86400`. After a seed finishes, show a link to the new dispute and a toast.

| Button | Stops at |
|---|---|
| Seed 1: Delivered deal | Deal status Delivered, no dispute yet (test Raise dispute by hand) |
| Seed 2: Dispute in Evidence | Seed 1, then deepa raises the dispute |
| Seed 3: Jurors drawn (Commit) | Seed 2, plus evidence from both parties, then `skipPeriod`. Jurors drawn and notified, nobody has voted (test voting by hand) |
| Seed 4: Reveal phase | Seed 3, then every drawn juror commits and the phase is skipped to Reveal. Each juror's `{ choice, salt, reasoning }` is stored in localStorage under `juri_vote_{disputeId}_{round}_{account}` so a juror can press "Reveal my vote" in the UI. Controls: majority answer (1 or 2) and a checkbox "Make one juror vote against the majority" |
| Seed 5: Appeal window open | Seed 4, then all reveal and the phase is skipped to Appeal (test funding, the half-window rule, Execute) |
| Seed 6: Appeal round started | Seed 5, then funder funds side 1 and sam funds side 2 so round 1 (7 jurors) starts in Commit |

**Panel C: Jury inspector** (`JurorInspector`). A select of all disputes. For the chosen dispute and round, a table: juror name, draws, locked JURI, stake in the court, drawing weight %, status from `jurorCases`. Under it three checks with a tick or cross: "Neither party is a juror", "Total draws = round size", "Every drawn juror has a notification". Counts only, never choices, before Appeal.

**Panel D: Automated flow tests** (`FlowTestRunner`). Button "Run all flow tests" calls `runFlowTests(JuriDAO)` from `flowtests.js`. Shows a tick or cross, name and detail per test, and a summary "21 of 21 passed". It uses throwaway states and never touches live state. Buttons "Copy report" (to clipboard) and "Download report (.txt)", both with a timestamp. The last 10 runs are kept in localStorage key `juri_testlab_runs` and listed with their date and score. The same runner component also appears on the Admin page under the self-test.

**Panel E: Checklist.** The 21 manual tests of PART D as checkboxes, saved in localStorage key `juri_testlab_checks`, with "n of 21 done" and a Clear button.

**Panel F: Test Lab log.** The last 30 actions taken from this page (seed name, result, time), localStorage key `juri_testlab_log`.

**Panel G: Build log (optional).** If the project can import raw text (for example `import log from "../../BUILD_LOG.md?raw"`), show `BUILD_LOG.md` in a scrollable box. If not, leave the panel out and note it in `DECISIONS.md`.

## C5. Added routes and files
Route `/testlab`. Component list gains `BuyJuriModal`, `JurorInspector`, `FlowTestRunner`. Page list gains `TestLab`. Library gains `src/lib/flowtests.js`.

## C6. Mobile rules (make "mobile-ready" checkable)
- Below 768 px the header nav collapses into a menu button. The account selector, balances, bell and Buy JURI stay reachable.
- Tables (court table, rewards history, jury table) become stacked cards below 640 px.
- Every button, input and select is at least 44 px tall. Modals become full-width bottom sheets on phones.
- No page scrolls sideways at 375 px width. Check each page at 375, 768 and 1280 px.
- Countdowns and phase trackers stay on one readable line or wrap cleanly.

## C7. Amended build phases (replaces section 11) and the prompt for each

After every phase: the LOG STEP (PART E, E3). Paste the whole of this document into the project as `SPEC.md` first (Phase 0).

| Phase | Name | Check |
|---|---|---|
| 0 | Setup and logging files | `BUILD_LOG.md`, `HANDOFF.md`, `DECISIONS.md`, `SPEC.md` exist; Complete Pack files in `reference/` |
| 1 | Shell | Preview opens, account switching works, header collapses at 375 px |
| 2 | Engine, store, flow tests | App opens, `window.JuriDAO` exists, Admin shows "Run flow tests" and it reports **21 of 21 passed** |
| 3 | Landing and Guide | Both pages render with live stats |
| 4 | Courts and token | Buy 0.1 ETH gives 1,000 JURI; faucet +5,000; below-minimum stake gives a red toast; unstake works when not locked; header Buy JURI works |
| 5 | Juror pages | Dashboard, My cases and Rewards render with and without data |
| 6 | Deals | Sam shows 9.0000 ETH after creating a 1 ETH deal |
| 7 | Dispute and voting | "0 of 3 committed" appears; no choices visible before Appeal; "How the jury was drawn" box works |
| 8 | Appeals, notifications, admin | Self-test **7 of 7**; a two-sided appeal starts a 7-juror round |
| 9 | Test Lab | Flow tests 21 of 21 in the browser; all six seeds work |
| 10 | Polish, mobile, full demo run | Section 13 demo runs with no console errors; mobile checks pass |
| 11 | Final verification | C8 definition of done |

### Prompts (paste one per phase)

**Phase 0**
```text
Phase 0: setup only, no UI. Create SPEC.md in the project root containing the full spec document I paste after this message.
Create BUILD_LOG.md, HANDOFF.md and DECISIONS.md using the templates in SPEC.md PART E. Create a reference/ folder and
store the Complete Pack files I attach (juridao-engine.js, selftest.js, juridao-engine.test.js). If a file is missing, tell
me and stop. Then do the LOG STEP in SPEC.md PART E3.
```
**Phase 1**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 1: Shell. Follow SPEC.md Look & Feel, sections 1 to 4 and C6.
Layout, header with account selector, nav, mobile menu, banner, toast, routes for every page in section 2 plus /testlab
(placeholders with empty states). Dark purple theme. Check: preview opens, account switching works, header collapses at
375 px. Then do the LOG STEP in SPEC.md PART E3.
```
**Phase 2**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 2: Engine, store, flow tests. Copy juridao-engine.js and
selftest.js from reference/ into src/lib/ and never edit them. Write store.js (loadState, saveState, useJuri, act) with
the 2-second autoAdvance, and window.JuriDAO and window.juriState. Create src/lib/flowtests.js exactly as in SPEC.md PART E
E1, and src/components/FlowTestRunner.jsx (button Run all flow tests, tick or cross per test, summary "N of 21 passed").
Show FlowTestRunner on the Admin page. Check: Run all flow tests shows 21 of 21 passed. Then do the LOG STEP in
SPEC.md PART E3 and write the exact score in the log.
```
**Phase 3**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 3: Landing (8.1) and Guide (8.12) using live stats from
state. Check: both pages render. Then do the LOG STEP. Also press Run all flow tests and log the score.
```
**Phase 4**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 4: Courts and token. Build 8.7 plus SPEC.md C1: token card,
BuyJuriModal, header Buy JURI button, faucet, stake modal, unstake. Use act() for every action and show engine errors
as red toasts. Check: buying 0.1 ETH gives 1,000 JURI; faucet +5,000; staking 100 in court 2 gives a red toast;
unstake works when not locked. Then do the LOG STEP and log the flow-test score.
```
**Phase 5**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 5: Juror pages 8.8, 8.9, 8.11 (dashboard, My cases,
Rewards) with empty states. Then do the LOG STEP and log the flow-test score.
```
**Phase 6**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 6: Deals 8.2, 8.3, 8.4: list, create, detail, deliver,
approve, raise dispute with the confirm modal. Check: Sam shows 9.0000 ETH after creating a 1 ETH deal and deepa shows
9.9940 ETH after raising a dispute. Then do the LOG STEP and log the flow-test score.
```
**Phase 7**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 7: Dispute and voting: 8.5 and 8.10 plus SPEC.md C3
(How the jury was drawn box). Evidence with fingerprints, PhaseTracker, juror case page with seal and reveal.
Check: "0 of 3 committed" appears and no choices are visible before Appeal. Then do the LOG STEP and log the
flow-test score.
```
**Phase 8**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 8: Appeals 8.6, Notifications 8.13, Admin 8.14 including
the engine self-test. Check: self-test shows 7 of 7; a two-sided appeal starts a 7-juror round. Then do the LOG STEP
and log both scores.
```
**Phase 9**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 9: build the Test Lab page exactly as SPEC.md C4 (panels
A to G), reusing FlowTestRunner and creating JurorInspector. Check: Run all flow tests shows 21 of 21 and each of the
six seeds works and produces a dispute I can continue by hand. Then do the LOG STEP.
```
**Phase 10**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 10: polish. Apply SPEC.md C6 mobile rules to every page,
check empty states, then run the section 13 demo script start to finish and fix anything that breaks. Check: no
console errors and no sideways scroll at 375 px. Then do the LOG STEP.
```
**Phase 11**
```text
Read HANDOFF.md and the last section of BUILD_LOG.md. Phase 11: final verification per SPEC.md C8. Run the self-test and
the flow tests, record both scores, list every deviation from DECISIONS.md, and append a FINAL REPORT section to
BUILD_LOG.md. Set HANDOFF.md to ALL DONE. Then do the LOG STEP.
```

## C8. Definition of done (adds to section 12)
- Engine self-test shows 7 of 7 and the flow tests show 21 of 21 (both in the app). Engine tests passed in Node when the Complete Pack was made.
- All six Test Lab seeds work and each resulting case can be finished by hand.
- All 21 manual tests of PART D are ticked in the Test Lab checklist.
- No console errors during the section 13 demo; no sideways scroll at 375 px.
- `BUILD_LOG.md` has a section for every phase 0 to 11 plus a FINAL REPORT; `HANDOFF.md` says ALL DONE.


---

# PART D: How to test everything (for the human)

Everything is dummy: ETH and the JURI token are fake and nothing leaves your browser. State lives in localStorage, so a reload keeps it, and **Admin, Reset demo** wipes it.

## D1. Three ways to test
| Way | Where | Best for |
|---|---|---|
| **A. Automated flow tests** | `/testlab` Panel D (also on `/admin`) | Checking rules and money maths in seconds, with a downloadable report |
| **B. Engine self-test** | `/admin`, Run engine self-test (7 of 7) | Checking the given engine in the browser |
| **C. Manual walkthrough** | The 21 tests below, using Test Lab seeds to skip set-up | Checking screens, buttons, secrecy and mobile layout |

## D2. Quick start
1. Open the app, then `/admin`, press **Reset demo**, then **Auto-stake all jurors**. Court 2 now has 7,000 JURI staked.
2. Open `/testlab`, press **Run all flow tests**. Expect **21 of 21 passed**. Press **Download report**.
3. Work through the manual tests below. Tick each in Test Lab Panel E.

Account cheat sheet: use the header selector as the login. sam = client, deepa = freelancer, juror1 to juror7 = jurors (only the ones drawn can vote), funder = appeal funder, admin = skips phases and resets. Each account starts with 10 ETH and 0 JURI.

## D3. The 21 manual tests

Expected numbers assume you pressed Reset demo first and use court 2 (fee 0.002 ETH per juror, minimum stake 500 JURI, 250 JURI locked per vote) with 3 jurors.

### Token (the dummy JURI)
| # | Do | Expect |
|---|---|---|
| M01 | Admin: Reset demo. Look at any page | Banner "Simulation mode: dummy ETH and dummy JURI" on every page. Every account has 10.0000 ETH and 0 JURI |
| M02 | As juror1, Courts, type 0.1 ETH in Buy JURI | Preview shows 1,000 JURI. After Buy: ETH 9.9000, JURI 1,000. Try 50 ETH: red error toast, balances unchanged |
| M03 | Press Free faucet | JURI rises by 5,000 (now 6,000). Header balance updates immediately |

### Staking
| # | Do | Expect |
|---|---|---|
| M04 | As juror1, join court 2 with 100 JURI | Red toast: below the minimum stake of 500. Nothing staked |
| M05 | Join court 2 with 1,000 JURI | Your stake 1,000. Drawing chance is above 0%. Court 1 and 3 show 0% for you. Unstake 500 works (not locked yet) |
| M06 | As admin, Auto-stake all jurors (after a Reset) | Courts page: court 2 total staked 7,000. Each juror has 1,000 |

### Deal and dispute creation
| # | Do | Expect |
|---|---|---|
| M07 | As sam, New deal: freelancer deepa, 1 ETH, court 2, 3 jurors, criteria "5 pages" and "mobile responsive", 7 days | Redirects to the deal. **Sam shows 9.0000 ETH.** Cost preview mentions 0.0060 ETH for 3 jurors |
| M08 | As deepa, open the deal, add a small .txt file, Mark as delivered | Status Delivered. Fingerprint shown. As sam, there is an "Action needed" tag and no approval has happened |
| M09 | As deepa, Raise dispute, read the confirm modal, confirm | Modal shows the 0.0060 fee, the frozen-funds warning, the question and answers. **Deepa shows 9.9940 ETH.** Deal status Disputed with a link to the dispute |
| M10 | On the dispute page as sam, add evidence with a file. As deepa, add evidence with a file | Evidence grouped under Client and Freelancer, each with a fingerprint badge. The tracker is on Evidence with a mm:ss countdown |

### Assigning juries
| # | Do | Expect |
|---|---|---|
| M11 | As admin, Skip current phase (or in Test Lab use Seed 3). Open Test Lab, Jury inspector, pick the dispute | Period is Commit. Exactly 3 draws across the table. All three checks tick: neither party is a juror, total draws = 3, every drawn juror has a notification. Switch to a drawn juror: the bell shows a notification and My cases lists the case. Switch to a juror who was not drawn: the case page says "You were not drawn for this case". Sam and deepa never appear |
| M12 | As a drawn juror, try to unstake everything. Then look at the public dispute page as anyone | Unstake fails with "stake is locked in an active case". The dispute page shows only "N of 3 committed", **no choices anywhere** |

### Voting
| # | Do | Expect |
|---|---|---|
| M13 | Each drawn juror: My cases, open the case, read evidence and criteria, pick an answer, write reasoning, Seal my vote. Then Admin skips to Reveal, and each juror presses Reveal my vote | After sealing: "Your vote is sealed" and a Download backup button. The warning about losing locked JURI is always visible while voting is open. The count moves "1 of 3 committed" to "3 of 3 committed". After reveal: tally, choices and justifications appear on the dispute page, and only from then on |

### The three appeal outcomes
Use Seed 5 (Appeal window open) to reach this point quickly. Note the ruling shown.

| # | Do | Expect |
|---|---|---|
| M14 | In the Appeal window look at the two columns. Fund a bit from funder. Press Admin Fast forward 60 seconds (window is 90 s) | Ruling side requires 0.0140 ETH (0.002 x 7). Challenger side requires 0.0280 ETH and says it pays double. Funding bars update. In the second half the challenger side is disabled and the reason is shown. Fund remaining fills the exact amount |
| M15 | **Outcome A, no appeal.** Fund nothing. Admin skips the appeal window | Ruling executes. Ruling 1: **sam 9.0000, deepa 10.9940.** Ruling 2: **sam 10.0000, deepa 9.9940.** The deal shows Resolved and where the ETH went |
| M16 | **Outcome B, one side funded.** Fresh seed. Fund only the ruling side in full (0.0140). Skip the window | Ruling stands, no new round. Withdraw appeal funds returns the full 0.0140 to the funder |
| M17 | **Outcome C, both sides funded.** Seed 5, then funder funds the ruling side 0.0140 and sam funds the challenger side 0.0280. (Or press Seed 6) | Round 2 begins with **7 draws** (2 x 3 + 1) and the tracker shows round 2 in Commit. Vote and reveal with the new drawn jurors (use Admin skip). After the window, ruling executes and money moves. The round history is collapsible |

### Rewards and after
| # | Do | Expect |
|---|---|---|
| M18 | As each juror, open Rewards, then Claim rewards. Then open the Juror dashboard | Rewards history shows case, coherent yes or no, ETH reward, JURI reward, JURI penalty. With 3 distinct jurors, one draw each, a 2 to 1 vote and no appeal: each coherent juror gets 0.0030 ETH and 125 JURI; the one who voted against the majority loses 250 JURI. Pending drops to zero after Claim and balances in the header rise. Performance ring chart changes |
| M19 | As funder and as sam (in Outcome C), open the dispute page and press Withdraw appeal funds | Button appears per round and side where you contributed. The winning-side funder gets a share; the losing side gets nothing (funder lost 0.0140 in the example, sam gets back his 0.0280) |

### Persistence and automation
| # | Do | Expect |
|---|---|---|
| M20 | Reload the browser. Then start a new dispute and **do not touch Admin**: wait 90 seconds | Everything is still there after the reload. The Evidence phase moves to Commit by itself (the 2-second keeper). Open the browser console: `JuriDAO` and `juriState()` exist and there are no red errors. Finally Admin, Reset demo returns to a clean state |

Tick each test in Test Lab Panel E as you go.

### Mobile
| # | Do | Expect |
|---|---|---|
| M21 | Narrow the browser to 375 px wide (or use the phone). Visit Home, Deals, a deal, a dispute, Courts, a case, Rewards, Admin and Test Lab | No sideways scrolling. The nav is a menu button. Tables turn into stacked cards. Buttons are easy to tap. Modals fill the width. Buy JURI works from the header |

## D4. Test matrix (what each test covers)

| Area | Automated | Manual |
|---|---|---|
| Buy JURI, faucet, rejection of too-large buy | T01 to T03 | M02, M03 |
| Staking minimum, unstake, lock | T04, T09 | M04 to M06, M12 |
| Deal create, approve, validations, late dispute | T05, T06, T20 | M07, M08 |
| Dispute creation, fee, evidence, fingerprints | T07 | M09, M10 |
| **Jury assignment**, parties excluded, notified | T07, T08 | M11 |
| Commit and reveal guards, secrecy | T10, T11 | M12, M13 |
| Rulings 1, 2 and 0, exact balances, ETH conservation | T12 to T14 | M15 |
| Penalties and rewards, claiming | T15, T16 | M18 |
| Appeals: none, one side, both sides, withdraw | T17, T18 | M14, M16, M17, M19 |
| Keeper and persistence | T19, T21 | M20 |

## D5. If something fails
1. Read the failure detail line in the Test Lab report; it says expected versus got.
2. In the app, open the console and run `juriState()` to see the state, and `juriState().log.slice(-20)` for the last events.
3. A failure in one of the 21 flow tests with the real engine means either the test or the UI is wrong, not the engine (spec section 0 rule 2). Exception: T18 asserts that the new round starts at the moment both sides are fully funded. If the engine starts it later (for example at the end of the window), change that test, record it in `DECISIONS.md`, and note it in BUILD_LOG.md.
4. T15 and T16 print "skipped" about 2 percent of the time (the random draw picked only one distinct juror). Run again.
5. Admin, Reset demo fixes a corrupted state.


---

# PART E: Code and templates (copy verbatim)

## E1. `src/lib/flowtests.js`
Create exactly this file in Phase 2. It is new code, not the given engine. It may be extended but not weakened. It runs in the browser and in Node, and exports `runFlowTests(JuriDAO)`, which returns `[{ name, ok, detail }]`.

```js
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
```

## E2. Templates

`BUILD_LOG.md` (append one section per phase):
```markdown
## Phase N: <name>
- Status: DONE | PARTIAL | BLOCKED
- Date and time:
- Account label: <e.g. account-1>
- Phase check: <the check text> -> PASS or FAIL, with evidence
- Engine self-test: <e.g. 7 of 7, or "not built yet">
- Flow tests: <e.g. 21 of 21, or failing test names and details>
- Files created or changed:
- Deviations and decisions: <also copied to DECISIONS.md>
- Known issues:
- Next single action:
```

`HANDOFF.md` (overwrite on every update):
```markdown
# HANDOFF (read me first)
- Last updated: <date and time> by <account label>
- Current phase: N <name>
- Status: IN PROGRESS | PHASE DONE, NEXT NOT STARTED | ALL DONE
- Last completed step:
- NEXT single action:
- Half-finished work or risks:
- Last scores: self-test <x of 7>, flow tests <x of 21>
```

`DECISIONS.md` (append):
```markdown
- <date> | Phase N | <what was assumed or changed> | <why>
```

## E3. LOG STEP (end of every phase)
1. Append a section to `BUILD_LOG.md` using the template in E2.
2. Overwrite `HANDOFF.md` using the template in E2.
3. Append any assumptions to `DECISIONS.md`.
4. Reply with exactly one line: "Phase N: PASS or FAIL. Flow tests x of 21. Next action: ...".
5. If the check failed, set Status to BLOCKED and do not start the next phase.

## E4. Resume prompt (paste into a new account or new chat)
```text
You are continuing the JuriDAO simulator build in this project. Read HANDOFF.md, then the last two sections of
BUILD_LOG.md, then DECISIONS.md, then SPEC.md (PART A protocol, PART B spec, PART C overrides). Open /admin and run the
engine self-test, and open /testlab and run the flow tests if those pages exist. Tell me the current phase and the scores.
If they disagree with HANDOFF.md, trust the app and fix HANDOFF.md. Then continue with the NEXT single action. Never edit
src/lib/juridao-engine.js or src/lib/selftest.js. Do the LOG STEP at the end of every phase.
```

## E5. Optional: running the flow tests in Node
If you ever have a terminal, save the two lines below as `scripts/flow.mjs` with `"type": "module"` in `package.json` and run `node scripts/flow.mjs`.
```js
import JuriDAO from "../src/lib/juridao-engine.js";
import { runFlowTests } from "../src/lib/flowtests.js";
const r = runFlowTests(JuriDAO); r.forEach(x => console.log(x.ok ? "PASS" : "FAIL", x.name, "-", x.detail));
console.log(`${r.filter(x => x.ok).length} of ${r.length} passed`);
```
