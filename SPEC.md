# JuriDAO — Build Specification

JuriDAO is a decentralized court for escrow disputes, inspired by Kleros.
A client locks ETH for a freelancer. If they disagree, either party raises a dispute. Random staked jurors vote (commit, then reveal). Anyone can fund an appeal. The ruling is enforced automatically by the escrow contract.

**Goal of this build:** a hackathon demo that runs end to end on a local chain with one command, showing deal → delivery → refusal → dispute → evidence → juror draw → commit → reveal → ruling → appeal → final payout → juror rewards and penalties.

---

## 0. How to work (read first)

1. Build in the phases of section 12, in order. Do not start a phase until the previous phase's tests pass.
2. After each phase run the checks listed there. If a command fails, fix the cause and rerun. Do not skip, stub, or comment out tests to make them pass.
3. Use exactly the function names, parameter orders, enum values, event names and storage keys written in this document. The frontend and tests depend on them.
4. Where this spec is silent, choose the simplest option, and note the choice in `DECISIONS.md`.
5. Definition of done is section 13.

## 1. Tech stack (fixed)

| Part | Choice |
|---|---|
| Contracts | Solidity 0.8.24, OpenZeppelin Contracts 5.x, Hardhat 2.22+ (TypeScript), `evmVersion: "cancun"` (use `"paris"` if a target chain rejects it) |
| Tests | Hardhat + ethers v6 + chai, with `@nomicfoundation/hardhat-network-helpers` |
| Frontend | Vite + React 18 + TypeScript, Tailwind CSS, react-router-dom v6, ethers v6 (no wagmi) |
| Evidence storage | `mock-ipfs` (small Express server) by default, Pinata optional via env |
| Chain for the demo | Local Hardhat node, chainId 31337, port 8545. Optional Sepolia via env. |
| Backend / indexer / database | **None.** The frontend reads contract state and event logs directly with ethers (`queryFilter` from the deploy block). |

Ports: chain 8545, mock-ipfs 5001, web 5173.

## 2. Repository layout

```text
juridao/
  package.json                  (root scripts, see section 11)
  DECISIONS.md
  contracts/
    hardhat.config.ts
    contracts/
      JuriToken.sol
      JuriCourt.sol
      JuriEscrow.sol
      interfaces/IArbitrable.sol
      interfaces/IJuriCourt.sol
    scripts/deploy.ts
    scripts/seed.ts
    scripts/keeper.ts
    scripts/export-abis.ts
    test/*.test.ts
  mock-ipfs/server.js
  web/
    public/policies/court-1.md court-2.md court-3.md
    src/
      main.tsx App.tsx routes.tsx
      lib/ (wallet.tsx, contracts.ts, format.ts, storage.ts, tx.ts, time.ts, crypto.ts, notifications.ts)
      contracts/ (abis + deployments.json, generated)
      components/ (Header, PhaseTracker, EvidenceList, EvidenceForm, AppealPanel, VotePanel, DealCard, CourtRow, StatCard, Countdown, TxButton, Toast, EmptyState)
      pages/ (Landing, Guide, Notifications, Deals, NewDeal, DealDetail, DisputeDetail, Juror, Courts, MyCases, CaseJuror, Rewards, Admin)
```

## 3. Roles and demo accounts

No login and no passwords. **Connecting a wallet is the login.** Roles depend on the case, not on the account:

| Role | Meaning |
|---|---|
| Client | Created the deal and locked the ETH |
| Freelancer | The wallet named as counterparty on the deal |
| Juror | A wallet with JURI staked in a court, drawn into a case. Parties of a case are never drawn as jurors in that case. |
| Appeal funder | Any wallet |
| Admin | The deployer wallet. Only for demo controls. |

**Demo accounts** (local chain only). Use the Hardhat default mnemonic (`test test test test test test test test test test test junk`, path `m/44'/60'/0'/0/i`):

| Index | Name | Used for |
|---|---|---|
| 0 | Admin | Deployer, owner, demo controls |
| 1 | Sam | Client |
| 2 | Deepa | Freelancer |
| 3–9 | Juror 1–7 | Staked jurors |
| 10 | Funder | Appeal funder |

## 4. Smart contracts

General rules for all contracts:
- Use revert **strings** (not custom errors) so the frontend can show them.
- Use `ReentrancyGuard` on every function that sends ETH or tokens. Follow checks, effects, interactions.
- Emit the events listed. The frontend relies on them.
- Currency: arbitration fees, deals and appeal funds are in native ETH. Staking and penalties are in JURI.

### 4.1 JuriToken (ERC-20, symbol `JURI`, 18 decimals)

```solidity
constructor(address owner, uint256 tokensPerEth, uint256 faucetAmount, uint256 faucetCooldown)
buyTokens() external payable            // mints msg.value * tokensPerEth / 1 (decimals already 18); require msg.value > 0
faucet() external                       // mints faucetAmount to msg.sender; if faucetCooldown > 0 enforce per-address cooldown
withdrawEth(address payable to) external onlyOwner
event TokensBought(address indexed buyer, uint256 ethIn, uint256 tokensOut)
event FaucetClaimed(address indexed user, uint256 amount)
```
Demo values: `tokensPerEth = 10000`, `faucetAmount = 5000e18`, `faucetCooldown = 0`.

### 4.2 IArbitrable

```solidity
interface IArbitrable { function rule(uint256 disputeId, uint256 ruling) external; }
```
Ruling values everywhere: **0 = no majority (tie or nothing revealed)**, **1 = side A wins (pay freelancer)**, **2 = side B wins (refund client)**.

### 4.3 JuriCourt

Constants: `MAX_ROUNDS = 3` (rounds are indexed 0, 1, 2; jurors per round 3, 7, 15 when starting from 3), `MAX_DRAW_ATTEMPTS = 100`, `APPEAL_LOSER_MULT_BPS = 20000`, `APPEAL_WINNER_MULT_BPS = 10000`.

Enums and structs:
```solidity
enum Period { Evidence, Commit, Reveal, Appeal, Executed }

struct CourtCfg {
  string name; string policyURI;
  uint256 minStake;        // JURI
  uint256 feePerJuror;     // wei
  uint256 alphaBps;        // locked and penalized per vote = minStake * alphaBps / 10000
  uint256 cases;           // number of disputes created in this court
  uint256 totalStaked;     // sum of stakeOf over all jurors
  bool active;
}
struct Dispute {
  uint256 courtId; address arbitrable; address partyA; address partyB; // partyA = client, partyB = freelancer
  string metaURI;          // JSON: question, answers, criteria, policy, dealId
  Period period; uint256 periodStart;
  uint256 round;           // current round index
  uint256 finalRuling; bool ruleDelivered;
}
struct Round {
  uint256 numDraws; uint256 ruling;        // ruling = plurality of revealed votes, set when Reveal ends
  uint256 feesPool;                        // feePerJuror * numDraws
  uint256 lockedPerDraw;                   // minStake*alphaBps/10000 at draw time
  uint256[3] tally;                        // index 1 and 2 used
  uint256[3] funded;                       // appeal funding raised for choice 1 and 2
  uint256[3] required;                     // set when appeal window opens
  bool[3] fullyFunded; bool appealed;
  uint256 roundCost;                       // cost of the next round = feePerJuror * (2*numDraws+1)
}
```
Storage you must provide (names flexible, behaviour fixed):
- `courts[courtId]`, `courtCount`
- `stakeOf[courtId][juror]`, `totalStaked[juror]`, `lockedStake[juror]`, `stakersOf[courtId]` (address list, add on first stake, never remove, skip zero stake when drawing)
- `disputes[id]`, `disputeCount` (ids start at 1), `rounds[id][roundIndex]`
- Per round and juror: `drawCount`, `commitOf`, `revealed`, `choiceOf`, `lockedAmount`; plus a unique-juror list per round
- Appeal contributions `contrib[id][round][choice][address]`
- `pendingEth[address]`, `pendingJuri[address]`, `treasuryEth`, `treasuryJuri`

Admin and juror functions:
```solidity
constructor(IERC20 juri, uint256 evidenceDur, uint256 commitDur, uint256 revealDur, uint256 appealDur, bool demoMode)
createCourt(string name, string policyURI, uint256 minStake, uint256 feePerJuror, uint256 alphaBps) onlyOwner returns (uint256 courtId)   // ids start at 1
stake(uint256 courtId, uint256 amount)     // pulls JURI via transferFrom (caller must approve first); resulting stake must be >= minStake
unstake(uint256 courtId, uint256 amount)   // require totalStaked[msg.sender] - amount >= lockedStake[msg.sender]; resulting stake == 0 or >= minStake
claimRewards()                             // sends pendingEth in ETH and pendingJuri in JURI to msg.sender, zeroes both first
withdrawTreasury(address to) onlyOwner
```
Dispute functions:
```solidity
arbitrationCost(uint256 courtId, uint256 numJurors) view returns (uint256)           // feePerJuror * numJurors
createDispute(uint256 courtId, uint256 numJurors, address partyA, address partyB, string metaURI) payable returns (uint256 disputeId)
    // require numJurors odd, >= 3, <= 15; require msg.value == arbitrationCost; msg.sender is the arbitrable
    // starts in Period.Evidence, round 0; cases++
submitEvidence(uint256 disputeId, string uri)    // anyone; only while period != Executed; emits Evidence event (files are stored off-chain, only the URI goes on-chain)
advancePeriod(uint256 disputeId)                 // permissionless; transitions only when the current period's duration has elapsed
demoSkipPeriod(uint256 disputeId)                // onlyOwner and demoMode only; performs the same transition as advancePeriod without waiting
commitVote(uint256 disputeId, bytes32 commit)    // period == Commit; caller must have drawCount > 0 this round; commit != 0; may overwrite until period ends
revealVote(uint256 disputeId, uint256 choice, bytes32 salt, string justification)
    // period == Reveal; choice in {1,2}; hash check; applies to ALL draws of the caller this round
fundAppeal(uint256 disputeId, uint256 choice) payable
executeRuling(uint256 disputeId)
retryRule(uint256 disputeId)                     // permissionless; if ruleDelivered == false, calls rule again
withdrawAppealFunds(uint256 disputeId, uint256 roundIndex, uint256 choice)   // only after Executed
```
Views for the frontend (return structs or tuples): `getCourt`, `getDispute`, `getRound`, `getRoundJurors(disputeId, round)` returning (address[] jurors, uint256[] draws), `getJurorStatus(disputeId, round, juror)` returning (draws, committed, revealed, choice), `appealRequired(disputeId, choice)`, `appealEnd(disputeId)`, `periodEnd(disputeId)`, `stakeOf`, `totalStaked`, `lockedStake`.

**Vote commitment (exact):**
`commit = keccak256(abi.encode(uint256 choice, bytes32 salt, address juror))`
Frontend: `ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","bytes32","address"], [choice, salt, juror]))`.

**Period transitions (`advancePeriod`)**
- Evidence → Commit: after `evidenceDur`. Draw jurors for round 0 (see below). `periodStart = now`.
- Commit → Reveal: after `commitDur`.
- Reveal → Appeal: after `revealDur`. Compute `rounds[id][round].ruling` = plurality of tally (tie or both zero → 0). Compute `required` for choices 1 and 2: let `cost = feePerJuror * (2*numDraws+1)`; the current winner pays `cost * 10000/10000`, the other side pays `cost * 20000/10000`; if ruling is 0 both pay `cost`. Store `roundCost = cost`. `periodStart = now`.
- Appeal → Executed happens only through `executeRuling`, never through `advancePeriod`.

**Juror draw (internal, `_draw(disputeId, round, count)`)**
- Eligible pool: `stakersOf[courtId]` with `stakeOf[courtId][addr] > 0`. Weight = stake. `total` = sum of weights (revert `"no stakers"` if 0).
- For `i` in `0..count-1`: attempt loop up to `MAX_DRAW_ATTEMPTS`: `seed = uint256(keccak256(abi.encode(blockhash(block.number-1), disputeId, round, i, attempt)))`, `r = seed % total`, walk the cumulative weights to find the juror. If the juror is `partyA` or `partyB`, increment `attempt` and retry. If attempts run out revert `"no eligible jurors"`.
- A juror may be drawn more than once (their `drawCount` increases). On each draw: `lockedPerDraw = minStake * alphaBps / 10000`; add it to `lockedAmount[round][juror]` and to `lockedStake[juror]`.
- `feesPool = feePerJuror * count` for round 0 comes from the dispute fee. For later rounds it comes from appeal funds (`roundCost`).
- This randomness is for the demo only. Document that production would use a verifiable random source such as Kleros uses.

**Appeals (`fundAppeal`)**
- Requires `period == Appeal`, `now <= periodStart + appealDur`, `round < MAX_ROUNDS - 1`, `choice` in {1,2}.
- The side that is **not** the current ruling (when ruling != 0) may fund only during the first half of the appeal period. The current winner may fund during the whole period.
- Accept `amount = min(msg.value, required[choice] - funded[choice])`, refund any excess to the sender. Record `contrib` and `funded`. If `funded == required` set `fullyFunded[choice]`.
- When **both** choices are fully funded in the same round: set `appealed = true`, increment `round`, create the next round with `numDraws = 2*prevDraws + 1`, `feesPool = roundCost`, `period = Commit`, `periodStart = now`, draw the new jurors immediately. (Evidence stays open during appeals, it is allowed while `period != Executed`.)

**Execution (`executeRuling`)**
- Allowed when `period == Appeal` and (`now > periodStart + appealDur` or `round == MAX_ROUNDS - 1`).
- Final ruling: if only choice 1 is fully funded in the last round, final = 1. If only choice 2, final = 2. Otherwise final = `rounds[id][round].ruling`.
- Set `period = Executed`, `finalRuling`.
- Settle **every round** `0..round` (see below).
- Last, call `IArbitrable(arbitrable).rule(disputeId, finalRuling)` inside `try/catch`. On failure emit `RuleFailed` and leave `ruleDelivered = false`; `retryRule` can be called later.

**Juror settlement per round (coherence is judged against that round's own plurality `rounds[id][r].ruling`)**
For each unique juror `j` in the round with `w = drawCount`:
- `L = lockedAmount[r][j]`; release it: `lockedStake[j] -= L`.
- `coherent = revealed && (choice == roundRuling || roundRuling == 0)`.
- If not coherent: `penalty = min(L, stakeOf[courtId][j])`; reduce `stakeOf` and `totalStaked` (and the court's `totalStaked`); `penaltyPool += penalty`.
- Let `cw` = sum of weights of coherent jurors. If `cw > 0`: each coherent juror gets `feesPool * w / cw` ETH and `penaltyPool * w / cw` JURI credited to `pendingEth` / `pendingJuri`. If `cw == 0`: the fees and penalties go to `treasuryEth` / `treasuryJuri`.
- Emit `JurorSettled(disputeId, round, juror, coherent, ethReward, juriReward, juriPenalty)` for every juror.

**Appeal fund withdrawal (`withdrawAppealFunds`)**
- Require `period == Executed`. `c = contrib[id][round][choice][msg.sender]`, zero it, then:
  - If `!rounds[id][round].appealed`: refund `c` (nobody loses money when an appeal fails to be fully funded).
  - Else: `total = funded[1] + funded[2]`, `pool = total - roundCost`. If `finalRuling` is 1 or 2 and `choice == finalRuling`: payout `pool * c / funded[choice]`. If `finalRuling` is 1 or 2 and `choice != finalRuling`: payout 0. If `finalRuling == 0`: payout `pool * c / total`.
- Emit `AppealWithdrawn`.

Events (exact names):
```solidity
CourtCreated(uint256 indexed courtId, string name)
Staked(address indexed juror, uint256 indexed courtId, uint256 amount)
Unstaked(address indexed juror, uint256 indexed courtId, uint256 amount)
DisputeCreated(uint256 indexed disputeId, uint256 indexed courtId, address indexed arbitrable, address partyA, address partyB, string metaURI)
Evidence(uint256 indexed disputeId, address indexed submitter, string uri)
PeriodChanged(uint256 indexed disputeId, uint8 period, uint256 round)
JurorsDrawn(uint256 indexed disputeId, uint256 round, address[] jurors, uint256[] draws)
VoteCommitted(uint256 indexed disputeId, uint256 round, address indexed juror)
VoteRevealed(uint256 indexed disputeId, uint256 round, address indexed juror, uint256 choice, string justification)
AppealFunded(uint256 indexed disputeId, uint256 round, uint256 choice, address indexed funder, uint256 amount)
NewRound(uint256 indexed disputeId, uint256 round, uint256 numDraws)
RulingExecuted(uint256 indexed disputeId, uint256 finalRuling)
RuleFailed(uint256 indexed disputeId)
JurorSettled(uint256 indexed disputeId, uint256 round, address indexed juror, bool coherent, uint256 ethReward, uint256 juriReward, uint256 juriPenalty)
RewardsClaimed(address indexed juror, uint256 eth, uint256 juri)
AppealWithdrawn(uint256 indexed disputeId, uint256 round, uint256 choice, address indexed funder, uint256 amount)
```

### 4.4 JuriEscrow

One contract holds **all deals** (each deal is a record with an id). The "escrow smart contract" Sam and Deepa create is a deal inside it.

```solidity
enum DealStatus { Created, Delivered, Approved, Disputed, Resolved }

struct Deal {
  address client; address freelancer; uint256 amount; uint256 deadline;
  uint256 courtId; uint256 numJurors; string metaURI;      // metaURI = JSON: description, deliveryCriteria[], title
  string deliveryURI; uint256 deliveredAt;
  DealStatus status; uint256 disputeId; address initiator; uint256 ruling;
}

constructor(IJuriCourt court)
createDeal(address freelancer, uint256 deadline, uint256 courtId, uint256 numJurors, string metaURI) payable returns (uint256 dealId)
    // msg.value is the deal amount, must be > 0; freelancer != msg.sender and != address(0); deadline > now; numJurors odd 3..15; deal ids start at 1
markDelivered(uint256 dealId, string deliveryURI)   // only freelancer; status Created -> Delivered
approve(uint256 dealId)                             // only client; status Created or Delivered -> Approved; pays freelancer
raiseDispute(uint256 dealId, string disputeMetaURI) payable
    // client or freelancer; allowed if status == Delivered, or (status == Created and now > deadline and caller is client)
    // msg.value must equal court.arbitrationCost(courtId, numJurors); initiator = msg.sender
    // sets status Disputed, then calls court.createDispute{value: msg.value}(courtId, numJurors, client, freelancer, disputeMetaURI)
rule(uint256 disputeId, uint256 ruling) external    // only the court address; status Disputed -> Resolved
    // ruling 1: send amount to freelancer. ruling 2: send amount to client. ruling 0: split 50/50 (remainder to client).
    // set status and ruling BEFORE sending ETH
dealsOf(address) view returns (uint256[])
getDeal(uint256) view returns (Deal)
disputeToDeal(uint256 disputeId) view returns (uint256)

events: DealCreated(dealId, client, freelancer, amount), Delivered(dealId), Approved(dealId), DisputeRaised(dealId, disputeId, initiator), Resolved(dealId, ruling)
```
Fee model for the demo (MVP): **the party who raises the dispute pays the arbitration fee**, non-refundable. Record this in `DECISIONS.md` and list "loser pays via fee reserve" as future work.

## 5. Evidence storage and dispute templates

`web/src/lib/storage.ts` exports `uploadFile(file)` and `uploadJson(obj)`, each returning a URI string, and `resolveUri(uri)` returning a fetchable URL.

- **Default: mock-ipfs.** `mock-ipfs/server.js` (Express, CORS enabled): `POST /upload?name=<filename>` with the raw body stores the bytes under `sha256(body)` on disk and returns `{ uri: "ipfs://mock-<sha256>", hash }`. `GET /ipfs/mock-<hash>` returns the bytes. The frontend shows a "fingerprint" badge: after fetching a file, recompute SHA-256 in the browser and show **✔ Verified** if it matches the hash in the URI, **✖ Mismatch** otherwise. This demonstrates the tamper-proof property.
- **Optional: Pinata**, used when `VITE_PINATA_JWT` is set. Show the CID as the fingerprint (no recompute).
- Dispute template JSON uploaded when raising a dispute:
  `{ "version": 1, "dealId": n, "title": "...", "question": "Did the freelancer deliver what was agreed?", "answers": [ {"id":1,"label":"Pay the freelancer"}, {"id":2,"label":"Refund the client"} ], "criteria": ["..."], "deliveryURI": "...", "courtId": n }`
- Evidence item JSON: `{ "title": "...", "description": "...", "fileURI": "...", "fileName": "...", "role": "client|freelancer|other" }`. The file is uploaded first, then the JSON, and the JSON URI goes into `submitEvidence`.

## 6. Frontend architecture

**Wallet (`lib/wallet.tsx`)** exposes a React context with: `address`, `signer`, `provider`, `chainId`, `connectMetaMask()`, `disconnect()`, `isDemoMode`, `demoAccounts`, `switchDemoAccount(index)`.
- Demo mode is on when `VITE_DEMO_MODE=true` and the chain is 31337. It builds signers from the Hardhat mnemonic and the accounts table in section 3, and shows an **account switcher dropdown** in the header (Admin, Sam, Deepa, Juror 1–7, Funder). This lets one browser tab play every role.
- On other chains use MetaMask only. If the chain is wrong, show a "Switch network" banner and block transactions.

**Contracts (`lib/contracts.ts`)**: returns typed ethers Contract instances from `contracts/deployments.json` (addresses and `deployBlock`) and the generated ABIs.

**Data access**: custom hooks that poll every 3 seconds and also refresh after each confirmed transaction: `useDeals`, `useDeal(id)`, `useDispute(id)`, `useCourts`, `useJurorCases(address)`, `useBalances`, `useNotifications`. Event history comes from `queryFilter(filter, deployBlock, "latest")`.

**Time (`lib/time.ts`)**: chain time = `Date.now()/1000 + offset`, where `offset = latestBlock.timestamp - Date.now()/1000` measured on load and refreshed every 15 seconds. All countdowns use this.

**Transactions (`lib/tx.ts`, `TxButton`)**: every write goes through one wrapper that shows toast states (waiting for wallet → pending → confirmed / failed) and decodes revert strings into readable messages. Disable buttons while pending. Multi-step flows (approve then stake) show a step indicator.

**Vote salt handling (`lib/crypto.ts`)**: on commit, generate 32 random bytes and store the salt and choice and justification in `localStorage` under the key `juri:vote:{chainId}:{disputeId}:{round}:{address}`. Also offer a **Download backup** button and show a warning. On reveal, read it from `localStorage`; if missing, let the juror paste the salt and choose manually.

**Notifications (`lib/notifications.ts`)**: no backend. Derive items for the connected address from current state and event logs, newest first, with read-state in `localStorage`:
- You were drawn in case #N (JurorsDrawn includes you)
- Commit your vote, with time left (period Commit and you are drawn and not committed)
- Reveal your vote now (period Reveal and you committed and not revealed)
- A dispute was raised on your deal; the evidence period is open
- Appeal window is open; time left
- A new round started (NewRound)
- Ruling executed, deal resolved (RulingExecuted for your deals or cases)
- You have rewards to claim (pendingEth or pendingJuri > 0)

**Keeper (`scripts/keeper.ts`)**: a Node script that every 3 seconds checks all disputes and calls `advancePeriod` when a period has elapsed and `executeRuling` when allowed, using the Admin account. The UI also shows a manual **Advance phase** / **Execute ruling** button for any user when the timer has ended.

## 7. Pages and features

Header on every page: logo, nav (Home, Deals, Courts, My Cases, Guide), notification bell with unread count, **Connect Wallet** button (and the demo account switcher in demo mode), ETH and JURI balances, a **Deals / Juror** mode toggle.

### 7.1 Landing `/`
1. Hero: headline "Disputes resolved by a decentralized jury", subline "When a smart contract can't decide who is right, JuriDAO can.", buttons **Create a deal** and **Become a juror**.
2. Problem: the Sam and Deepa story in three short lines (ETH stuck).
3. How it works: six icons in a row (Create, Evidence, Jurors drawn, Vote, Appeal, Ruling).
4. Why JuriDAO: cards for random jurors, on-chain transparency, automatic enforcement, one card for the team's own extra feature.
5. Live stats read from contracts: disputes resolved, total JURI staked, total ETH currently locked in deals. Label as demo data on a local chain.
6. Two audience blocks: "I have a deal" and "I want to earn as a juror".
7. FAQ (who are the jurors, how much does it cost, what if I disagree with the ruling) and footer with "Inspired by Kleros".

### 7.2 Connect wallet
Header button. No signup or role selection. After connecting, show balances and the mode toggle. Show a **Get test tokens** shortcut (faucet) in demo mode.

### 7.3 Deals dashboard `/deals` (client and freelancer)
- Stat cards: active deals, in dispute, completed, total ETH locked.
- Table or cards for deals where the user is client or freelancer: id, title, counterparty, amount, deadline, status badge, "Action needed" tag.
- **Create deal** button.

### 7.4 Create escrow `/deals/new`
Fields: freelancer (counterparty) wallet address (validated), amount in ETH, delivery deadline (datetime), title, description, delivery criteria (add or remove a list of lines, at least one required), court (dropdown of active courts with fee per juror), number of jurors (3, 5, 7).
- Show a cost preview: deal amount, and "if disputed, the party who raises it pays N ETH (feePerJuror × jurors)".
- Validate: no self-deal, amount > 0, deadline in the future, address format.
- On submit: upload metadata JSON, then `createDeal{value: amount}`; navigate to the deal page.

### 7.5 Deal detail `/deals/:id`
- Header: title, status badge, parties, amount, deadline countdown.
- Timeline: Created → Delivered → (Approved | Disputed → Resolved).
- Description and delivery criteria.
- **Freelancer actions** (status Created): upload deliverable and **Mark as delivered**.
- **Client actions** (status Delivered or Created): **Approve and release payment**, **Raise dispute** (also allowed after the deadline if nothing was delivered).
- **Freelancer** may **Raise dispute** when status is Delivered.
- A warning that raising a dispute freezes the funds and costs the arbitration fee.
- When Disputed or Resolved, a banner links to the dispute page and shows the ruling and where the ETH went.

### 7.6 Raise dispute (modal on the deal page)
Shows what happens next, the fee to pay and who pays it, the question and two answers jurors will see, and the court policy link. Confirm uploads the template JSON, then calls `raiseDispute{value: fee}`. After confirmation navigate to the dispute page.

### 7.7 Dispute detail `/disputes/:id` (public view for parties, funders and anyone)
- Header: dispute id, linked deal, court, question and the two answers.
- **PhaseTracker**: Evidence → Jurors drawn → Voting (Commit) → Reveal → Appeal window → Final, with the current step highlighted, the round number, and a countdown. Show **Advance phase** when the timer has ended (and **Demo skip** for Admin in demo mode).
- **Evidence**: list from `Evidence` events grouped by party (client, freelancer, other), each with title, description, file link and the fingerprint badge. **Add evidence** form (title, description, file) available until the case is executed.
- **Jurors**: after the draw, show how many jurors were drawn (addresses shortened) and progress: "N of M committed", "N of M revealed". **Never show anyone's choice before the reveal period.**
- **Result** (after reveal): vote counts per answer and each juror's justification.
- **AppealPanel** (see 7.8).
- **Final**: ruling banner, payout outcome, and an **Execute ruling** button when allowed.

### 7.8 Appeals (inside the dispute page)
Visible when the period is Appeal. Shows:
- The current ruling and round number, the number of jurors in the next round, and the countdown to the end of the appeal window.
- For each side (choice 1 and 2): a **funding bar** (`funded / required`), the cost required for that side (the side that would overturn the ruling pays double), and a **Fund this side** form with an amount input and a **Fund remaining** shortcut. Disable the challenger side after half the window with the reason shown.
- A rules box: anyone can fund; if only one side is fully funded it wins by default; if both are fully funded a new round starts with 2n+1 jurors; funders on the side that matches the final ruling share everything raised minus the round cost (so the cheaper defending side can double its money, while the challenger side gets its own money back), and the losing side gets nothing; if no one funds, the ruling becomes final; no more appeals after round 3 (jurors 3 → 7 → 15).
- After execution: **Withdraw my appeal funds / rewards** for the connected wallet's contributions, per round and side.
- When a new round starts the page returns to "Jurors drawn" and shows earlier rounds in a collapsible history with their results.

### 7.9 Juror dashboard `/juror`
- Rewards total (ETH and JURI pending) with a link to **Rewards**.
- Staked courts with amount and drawing chance (stake ÷ court total).
- Case counts: vote pending, in progress, closed.
- **Voting performance**: percentage of settled rounds where the juror was coherent (from `JurorSettled` events), shown as a ring chart.
- Ongoing cases list with action tags "Commit needed" or "Reveal needed".
- Recent notifications, and buttons **Join a court** and **Get test tokens**.

### 7.10 Courts `/courts`
- Table: name, minimum stake, fee per juror, number of cases, total staked, your stake, your chance of being drawn.
- **Join a court** modal: amount input (min stake enforced), step 1 `approve`, step 2 `stake`, with a step indicator. For courts already joined offer **Add stake** and **Unstake** (blocked with an explanation while stake is locked in a case).
- **Buy tokens** panel: ETH amount → JURI preview, then `buyTokens{value}`. In demo mode also a **Free faucet** button.

### 7.11 My cases `/cases`
Tabs **Vote pending**, **In progress**, **Closed**. Each row: case number, court, question, deadline, your status (needs commit, committed, needs reveal, revealed, settled). Built from `JurorsDrawn` events that include the connected address.

### 7.12 Case page for jurors `/cases/:id`
- The question, the two answers, the court policy (rendered markdown from `policyURI`), and the delivery criteria.
- Evidence from both sides with fingerprint badges.
- **Commit step** (period Commit): choose an answer, write the reasoning, press **Seal my vote**. The app computes the commitment, stores the salt locally, and sends `commitVote`. Show "Your vote is sealed. Nobody can see it. Remember to come back to reveal." Provide **Download backup**.
- **Reveal step** (period Reveal): one button **Reveal my vote**. The app reads the stored salt and sends `revealVote` with the choice and reasoning. Fall back to manual salt entry if the local salt is missing.
- Warnings: "If you don't commit and reveal, or you vote against the majority, you lose the stake locked for this case."
- After the result: the round's outcome, whether you were coherent, and your reward or penalty (ETH and JURI) from `JurorSettled`.

### 7.13 Rewards `/rewards`
Pending ETH and JURI, a **Claim rewards** button, and a history table (case, round, coherent or not, reward, penalty) from `JurorSettled` events plus claimed totals from `RewardsClaimed`.

### 7.14 Guide `/guide`
Static content: the six-step lifecycle with the running example, what a juror is, how jurors are chosen (stake-weighted random draw, repeats allowed, parties excluded), **commit and reveal** in plain words, rewards and penalties with the worked example from section 14, appeals with the cost rules, what disputes JuriDAO can and cannot solve, and a short "Inspired by Kleros" note.

### 7.15 Notifications `/notifications`
List of derived notifications (section 6), read and unread state, each item linking to the relevant page.

### 7.16 Demo admin `/admin` (only when demo mode is on)
- Buttons per dispute: **Skip current period** (`demoSkipPeriod`), **Execute ruling**, **Advance phase**.
- **Fund test wallets**: gives the demo accounts JURI via faucet from each account.
- Live event log (last 50 contract events).
- Link to restart instructions (restart the node and rerun `npm run deploy:local && npm run seed`).

## 8. Seed data (`scripts/seed.ts`)

Run after deploy on the local chain.
- Courts: **1 General Court** (minStake 1000 JURI, fee 0.005 ETH, alpha 5000), **2 Freelance & Services Court** (minStake 500 JURI, fee 0.002 ETH, alpha 5000), **3 Code Court** (minStake 2000 JURI, fee 0.01 ETH, alpha 7000). Each with a `policyURI` of `/policies/court-N.md`.
- Jurors 1–7 (account indices 3–9): call `faucet()`, approve, and stake 1000–3000 JURI each (different amounts) in court 2 and some in court 1.
- Do **not** create a deal automatically, so the demo can start from zero.
- Write `contracts/deployments.json` and copy it with the ABIs into `web/src/contracts/` via `export-abis.ts`.

Durations for the demo: evidence 90 s, commit 60 s, reveal 60 s, appeal 90 s (the Admin skip button makes them instant).

## 9. Security and correctness requirements

- Funds in the escrow can only leave through `approve` (to freelancer) or `rule` (called by the court). `rule` must verify `msg.sender == address(court)` and the dispute mapping.
- Parties cannot be drawn as jurors in their own dispute.
- Jurors cannot reveal in the wrong period, reveal a different choice than committed, or reveal twice.
- Unstaking cannot reduce stake below the locked amount.
- All ETH transfers use `call` with success checks, behind `nonReentrant`, with state updated first.
- Document in `DECISIONS.md`: demo randomness is not secure, courts are flat (no hierarchy or court jumps), single dispute kit, and the fee model.

## 10. Tests (write these before the frontend)

Contract tests (`npx hardhat test` must pass):
1. Deal happy path: create, deliver, approve, freelancer paid, no dispute.
2. Dispute, no appeal, freelancer wins: ETH goes to freelancer, jurors settled, `rule` called once.
3. Dispute, no appeal, client wins: ETH refunded.
4. Tie or no reveals: ruling 0 splits the deal 50/50; no coherent jurors means fees go to treasury.
5. Commit and reveal: wrong hash reverts, reveal in the wrong period reverts, non-reveal is penalized.
6. Juror draw: parties are never drawn; a juror can be drawn more than once; weights follow stake (statistical check over many disputes is optional).
7. Rewards math using the example in section 14.
8. Unstake blocked while locked, allowed after settlement.
9. Appeal: only one side funded gives that side a default win and refunds all contributors; both sides funded starts round 2 with 7 jurors; the loser side cannot fund in the second half; max rounds enforced; funder payout formula checked.
10. Only the court can call `rule`; reentrancy attempt fails; `retryRule` works after a failed `rule`.
11. `createDeal` and `raiseDispute` validation (self-deal, wrong fee, wrong caller, wrong status).

Frontend checks: `npm run build` and `npx tsc --noEmit` pass with no errors; no console errors during the demo script in section 15.

## 11. Root scripts

```text
npm run chain          # hardhat node on 8545
npm run deploy:local   # deploy token, court, escrow; export ABIs and deployments.json
npm run seed           # courts, juror funding and staking
npm run ipfs           # mock-ipfs on 5001
npm run keeper         # keeper script
npm run web            # vite dev server on 5173 (VITE_DEMO_MODE=true)
npm run test           # contract tests
npm run demo           # concurrently: chain, then deploy + seed, then ipfs, keeper, web
```
Environment files: `web/.env.example` with `VITE_DEMO_MODE`, `VITE_RPC_URL`, `VITE_IPFS_URL`, `VITE_PINATA_JWT`.

## 12. Build phases

1. **Contracts and tests.** JuriToken, JuriCourt, JuriEscrow, tests in section 10. Check: `npm run test` green.
2. **Deploy and seed scripts, ABI export, keeper, mock-ipfs.** Check: after `npm run demo` the contracts are deployed, courts exist, jurors are staked.
3. **Frontend foundation.** Wallet context with demo switcher, contracts, tx wrapper, time, header, routing, landing, guide. Check: build passes, account switching works.
4. **Courts and juror staking.** Courts page, buy tokens, faucet, join, unstake, juror dashboard (stats), rewards page.
5. **Deals.** Create deal, deals dashboard, deal detail, deliver, approve, raise dispute.
6. **Dispute flow.** Dispute page with phase tracker, evidence (upload, fingerprint), case page for jurors (commit, reveal), my cases, results.
7. **Appeals and execution.** Appeal panel, funding, new rounds, execute, withdraw funds, notifications, admin panel.
8. **Polish.** Empty states, loading states, error toasts, mobile layout, copy, and a full run of the demo script.

## 13. Definition of done

- `npm run test` and `npm run build` pass with no errors or skipped tests.
- `npm run demo` starts everything; a new person can follow section 15 without touching a terminal again.
- Every page in section 7 exists and works with real contract data (no hard-coded fake data except the clearly labeled landing-page stats).
- All three outcomes work: no appeal, appeal with one side funded, appeal with both sides funded (new round with 7 jurors).
- A juror can commit and reveal using only the UI, and sees their reward or penalty afterwards.

## 14. Worked numbers (use for the Guide page and tests)

Court 2: fee 0.002 ETH per juror, minStake 500 JURI, alpha 5000, so locked per vote = 250 JURI.
- Round 0: 3 jurors, fee 0.006 ETH (paid by the party raising the dispute). Votes: 2 for the freelancer, 1 for the client. Ruling 1.
- Each coherent juror receives 0.006 / 2 = 0.003 ETH, plus half of the incoherent juror's 250 JURI penalty (125 JURI each).
- Appeal cost for round 1: 0.002 × 7 = 0.014 ETH. Current winner (freelancer side) must raise 0.014 ETH; the challenger (client side) must raise 0.028 ETH. If both are fully funded (0.014 + 0.028 = 0.042 ETH raised), 7 jurors are drawn and the round costs 0.014 ETH. The remaining 0.028 ETH (everything raised minus the round cost) is shared by the contributors on the side that matches the final ruling. If the defending side (which paid 0.014) wins, it receives 0.028, double its money. If the challenging side (which paid 0.028) wins, it gets only its own 0.028 back. The losing side gets nothing.
- If only one side is fully funded when the window ends, that side wins by default and every contributor is refunded.

## 15. Demo script (the app must support this exactly)

1. Open `/`. Show the landing page. Connect as **Admin** and show the Courts page (jurors staked).
2. Switch to **Sam**. `/deals/new`: freelancer = Deepa, amount 1 ETH, court 2, 3 jurors, criteria "5 pages", "mobile responsive", deadline in the future. Create. 1 ETH is locked.
3. Switch to **Deepa**. Open the deal, upload a deliverable, **Mark as delivered**.
4. Switch to **Sam**. Show he does not approve, then switch back to **Deepa** and press **Raise dispute**; she pays 0.006 ETH. The deal shows Disputed and funds are frozen.
5. On the dispute page, both Sam and Deepa add evidence (files with the verified fingerprint).
6. Switch to **Admin** and use **Skip current period**. Jurors are drawn. Notifications show for the drawn jurors.
7. Switch through the drawn jurors (shown on the dispute page). Each opens **My cases → case page**, reads evidence, seals a vote. Show that the dispute page shows only "N of 3 committed".
8. **Admin** skips to Reveal. Each juror reveals. The dispute page shows 2 to 1 and the justifications.
9. The appeal window opens. Switch to **Sam** (or Funder) and fund the challenger side, then fund the other side from another wallet. A new round of 7 jurors starts; repeat the vote and reveal quickly using Admin skip.
10. **Admin** skips the appeal window; press **Execute ruling**. The escrow pays out automatically. Show the deal as Resolved with the ETH moved.
11. Switch to jurors: **Rewards** shows ETH and JURI earned or lost; **Claim rewards**. The juror dashboard shows updated voting performance.
12. Show the appeal funder withdrawing funds or rewards on the dispute page.

## 16. Out of scope (list in the README as future work)

Court hierarchy and court jumps, multiple dispute kits, verifiable randomness, a loser-pays fee reserve, margin-based penalties, AI evidence summaries, email notifications, identity or Sybil protection, and an indexer or backend.
