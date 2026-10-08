# JuriDAO Simulator — 3-Dev Blueprint

**Objective:** Build the JuriDAO hackathon simulator per `SPEC.md` (= `JuriDAO_ThinkRoot.md`) with three developers (Dev1, Dev2, Dev3) working simultaneously and shipping through one GitHub repo: `https://github.com/vrbavesh/juridao`.

**Mode:** Git + remote available, `gh` not installed → branch-per-step with PRs created manually in the GitHub web UI; CI runs the same gate via GitHub Actions (no `gh` needed). Rollback = revert one merge commit per step.

**Root:** `C:\JuriDAO` · **Spec:** `SPEC.md` (canonical requirements; this plan never overrides it). **Rationale log:** `DECISIONS.md`.

---

## 0. How to read this plan

- §1 contract-first artifacts and §2 API-design conventions govern every step.
- §3 ownership map is the concurrency contract: each file has exactly one owner.
- §4 git workflow. §5 wave graph (what may run in parallel). §6 the steps.
- Every step is self-contained: a cold agent needs only `SPEC.md`, `DECISIONS.md`, `HANDOFF.md`, the manifest, and the step itself.

---

## 1. Contract-first architecture

There is no HTTP backend (SPEC §1). The boundaries that exist — and their canonical artifacts — are:

| # | Boundary | Canonical artifact | Consumers | Owner |
|---|---|---|---|---|
| B1 | Engine ↔ UI | `src/lib/juridao-engine.js` (frozen, copied verbatim from `reference/`) **+ its transcription** `api/engine-api.yaml` | every page/component | Dev1 writes the transcription in D1-0; engine never edited by anyone |
| B2 | Off-chain JSON shapes | `api/schemas/*.schema.json` (state, account, court, deal, dispute, round, evidence-item, notification, settled-log, flow-test-result) | store.js, seeds, TestLab | Dev1 (D1-0) |
| B3 | localStorage keys | registry block `x-storage-keys` inside `api/engine-api.yaml` | all writers/readers | Dev1 writes the registry; anyone may add a key via manifest-first PR |
| B4 | Component props | `api/ui-contracts.md` | every shared component | Dev3 drafts in D3-0, freezes in D3-1 |

### B1 manifest content (`api/engine-api.yaml`)

- **Operations:** every SPEC §5 function as `{ name, params: ordered[{name,type}], returns, throws: [message substrings], purity: pure|state-mutating, phase-guard: commit-phase|reveal-phase|... }`. Numeric-typed params are marked `type: number` — `courtId`, `numJurors`, `side`, `choice`, ids where numeric (SPEC §3.5: ids, courtId, numJurors, appeal side, vote choice are numbers, never strings).
- **Enums:** periods (`Evidence|Commit|Reveal|Appeal|Executed`), deal statuses, rulings (0/1/2 with meanings), `jurorCases` status values, notification types. Each enum value documented exactly once, here and nowhere else in prose.
- **Constants:** `ETH`, `TOKENS_PER_ETH`, `FAUCET_AMOUNT`, `MAX_ROUNDS`, `PERIODS`, `TOKENS_PER_ETH` price line.
- **`x-storage-keys`:** `juridao_state_v2`, `juri_vote_{disputeId}_{round}_{account}`, `juri_testlab_runs`, `juri_testlab_checks`, `juri_testlab_log`, `juri_notifications_read`.

### Rules

1. **Artifact-first.** UI never expects a shape the manifest/schemas don't declare. Any change to `api/engine-api.yaml`, `api/schemas/*`, or `api/ui-contracts.md` lands in its own PR, merged before the consumer PR.
2. **Engine is frozen (SPEC §0.2).** Never edit `src/lib/juridao-engine.js`, `selftest.js`, `juridao-engine.test.js`, `flowtests.js` (new code but fixed verbatim from SPEC §E1). If UI and engine disagree, the UI is wrong. The single scripted exception: SPEC §D5 allows editing **T18** in `flowtests.js` if the engine opens round-1 later than `fundAppeal` — record in `DECISIONS.md`.
3. **Both sides verify against the same artifact.** `scripts/check-contract.mjs` must pass on every PR. Its engine target is `reference/juridao-engine.js` at D1-0 (before `src/lib/` exists); the D1-1 PR swaps the target constant to `src/lib/juridao-engine.js` and records the swap in `DECISIONS.md`. Checks: (a) every manifest operation exists on the engine's default export — arity rule: `fn.length` must equal the manifest's count of *required* parameters (manifest marks optional params explicitly), and manifest params must be `>= fn.length` (JS `fn.length` stops at the first defaulted parameter, so never compare to the full parameter count); (b) storage-key gate scans only the arguments of `localStorage.getItem/setItem/removeItem` calls (not free text, not comments) and requires every key/template-prefix to appear in `x-storage-keys`, and vice versa; (c) `JuriDAO.createInitialState()` passes a pragmatic shape check — required top-level keys present (`params`, `accounts`, `courts`, `stake`, `pending`, `treasury`, `deals`, `disputes`, `log`) plus per-type asserts on critical fields (`params` are non-negative seconds numbers; `accounts` is a non-empty map of `{name, eth, juri}`; `disputes`/`deals` arrays). A strict full-state JSON Schema is deliberately NOT used (brittle: any additive engine field would false-fail); (d) one driven scenario (create deal → deliver → dispute → evidence → skip → commit → reveal → appeal-window) produces a state that still passes (c).
4. **No duplicate truths.** Periods, statuses, ruling semantics, money formatting (`(v/1000000).toFixed(4) + " ETH"`, micro-ETH integers), and storage keys are defined once — in the manifest. Pages import `JuriDAO` for engine values where possible; literal enum strings come from a single generated helper only if the manifest names one (default: no helper, direct literals matched to the contract check).

### Freshness / contract gate (part of `npm run check`, run before every PR)

```bash
node reference/juridao-engine.test.js   # 21 engine tests -> "ALL TESTS PASSED"
node scripts/flow.mjs                   # flow tests -> "21 of 21 passed"
node scripts/check-contract.mjs         # manifest <-> engine <-> storage registry <-> state schema
npm run build
```

---

## 2. API-design conventions (adapted for a no-HTTP app)

`api-design` targets REST; this project has no HTTP surface. The transferable rules, applied to the boundaries we do have:

- **Operations map to SPEC §5 exactly** — the engine's public functions are the API. Function names, parameter orders, and return shapes are contractual (§B1). New UI must not invent parallel engine wrappers with different shapes.
- **Error envelope:** engines throw `Error("message")`; the *only* place that surfaces errors is `act()` in `src/lib/store.js`, which shows the engine's `error.message` in a red toast and changes nothing. No stack traces, no generic fallbacks unless the engine gave no message. (Analog of "never expose internals".)
- **Statuses as status codes:** `status: Created | Delivered | Approved | Disputed | Resolved` and `period: Evidence | Commit | ...` are the semantic "HTTP codes" of a case. The UI renders them and gates actions by them; it never invents a seventh value. Badges/colors are a display mapping owned by the component, not re-deried per page.
- **Idempotency notes the UI relies on:** `commitVote` may overwrite during Commit; `faucet` is repeatable; `buyTokens` returns the real JURI amount; `skipPeriod` during Appeal executes the ruling; `autoAdvance` is a no-op when no timer ended. UI copy must not promise otherwise (e.g., don't render a disabled buy button when the engine would throw first — actually, do disable on invalid input, but surface the engine message on submit).
- **Versioning:** state-schema version is in the storage key (`juridao_state_v2`). No migrations; a v3 would be a new key and a new contract PR. LocalStorage `juri_vote_*` entries are per dispute+round+account, as the spec names them — no reformatting.
- **Naming:** routes are plural nouns, fixed by SPEC §2 (`/deals`, `/disputes/:id`, ...). Pages map 1:1 to those resources. Identifiers are strings in storage, numbers where the spec says numbers (SPEC §3.5).
- **Error/response shapes for the one "report API":** FlowTestRunner reports `[{ name, ok, detail }]` — this shape is consumed by the panel, "Copy report", "Download report", and `juri_testlab_runs`. Never attach extra fields without a manifest update (B2).

---

## 3. Ownership map (concurrency contract)

One owner per file. "New" = created by D3-1 placeholder skeleton (D3-1) unless noted.

| Area | Files | Owner |
|---|---|---|
| Packaging / tooling | `package.json`, `package-lock.json`, `vite.config.*`, `tailwind.config.*`, `.gitignore`, `.github/workflows/ci.yml`, `scripts/*` | Dev1 |
| Pack + logs | `reference/*`, `SPEC.md`, `BUILD_LOG.md`, `DECISIONS.md`, `handoff/dev1.md` | Dev1 (logs append-only, own section headings) |
| Contract artifacts | `api/engine-api.yaml`, `api/schemas/*` | Dev1 |
| Shell / routing / theme | `src/App.jsx` (frozen after D3-1), `src/main.jsx`, `src/index.css`, `Header`, `Banner`, `Toast`, `EmptyState`, `StatCard`, `Countdown`, + every page placeholder | Dev3 (creates skeleton) |
| PhaseTracker, EvidenceList, EvidenceForm, VotePanel, DealCard, AppealPanel | created and owned by Dev2 (D2-2/D2-3/D2-1/D2-4) | Dev2 |
| RingChart | created and owned by Dev1, used in D1-3 | Dev1 |
| BuyJuriModal | Dev1 stubs the file in D1-1 (placeholder render, fixed export name) so Dev3's Header can import it; Dev1 fills the body in D1-2 | Dev1 |
| UI contracts | `api/ui-contracts.md` | Dev3 (frozen at D3-1) |
| Store | `src/lib/store.js` | Dev1 |
| Engine | `src/lib/juridao-engine.js`, `src/lib/selftest.js`, `src/lib/flowtests.js` | Dev1 copies verbatim (never edits) |
| Format / evidence utils | `src/lib/format.js`, `src/lib/evidence.js` | Dev2 |
| FlowTestRunner | `src/components/FlowTestRunner.jsx` | Dev1 (body), Dev3 mounts it (Admin D3-3, TestLab D3-4) |
| Token/courts | `src/pages/Courts.jsx`, `CourtRow` | Dev1 |
| Juror pages | `src/pages/Juror.jsx`, `MyCases.jsx`, `Rewards.jsx` | Dev1 |
| Deals | `Deals`, `NewDeal`, `DealDetail`, `DealCard` | Dev2 |
| Dispute | `DisputeDetail`, `EvidenceList`, `EvidenceForm`, `PhaseTracker` | Dev2 |
| Voting | `VotePanel`, `CaseJuror` | Dev2 |
| Appeals | `AppealPanel` | Dev2 |
| Landing/Guide/Notifications | `Landing`, `Guide`, `Notifications` | Dev3 |
| Admin | `Admin` (mounts Dev1's `FlowTestRunner` + `runSelfTest`) | Dev3 |
| Test Lab | `TestLab`, `JurorInspector` | Dev3 |
| Integration | `HANDOFF.md`, full demo run, final report | Dev3 owns HANDOFF.md; Dev1 runs gates in D1-4 |

Rules: a non-owner never edits another's file; cross-file needs (a prop, a key) go through `api/ui-contracts.md` / `x-storage-keys` (B3/B4), then one PR each.

---

## 4. Git workflow (`gh`-free, one repo)

- Branch per step: `devN/<step-id>-<slug>` (e.g. `dev2/d2-2-dispute-page`). One step = one PR. No direct pushes to `main` after D1-0.
- Before PR: `git fetch && git rebase origin/main`, then `npm run check` (all four gates green) — paste the result into the PR description; CI (`.github/workflows/ci.yml`) re-runs it on the PR.
- Reviewer: one of the other two devs. At W1 only D1-0 is active, so Dev2 or Dev3 reviews it while blocking W2 (review duty doubles as onboarding). Merge: **merge commit (not squash)** so a step reverts as a unit.
- Hotspot files and the tiebreak rule: `package.json` / lockfile / `store.js` / `App.jsx` / theme — Dev1/Dev3 only, by the ownership table. `BUILD_LOG.md`, `DECISIONS.md`, `handoff/devN.md` are append-only with dev-tagged headings; on same-EOF merge conflict, keep both entries and log the resolution in `DECISIONS.md`.
- `main` stays green: if a merge turns a gate red, the merger fixes forward in 15 minutes or reverts the merge commit.

---

## 5. Wave graph

```
W1  D1-0 bootstrap + manifest + gates            (Dev1; needs repo URL + Complete Pack from you)
W2  D1-1 engine+store+flowtests ∥ D2-0 utils ∥ D3-0 ui-contracts
W3  D3-1 shell                                    (gate on D1-1, D2-0; W2 merged)
W4  D1-2 courts+token ∥ D2-1 deals ∥ D3-2 landing+guide
W5  D1-3 juror pages ∥ D2-2 dispute page ∥ D3-3 notifications+admin
W6  D2-3 vote flow ∥ D3-4 testlab                (D3-4 merges AFTER D2-3; its seed-4/reveal
                                                    E2E check runs on the merged tree)
W7  D2-4 appeals                                  (needs D2-2 and D2-3 merged)
W8  D3-5 polish + full demo run                   (needs D2-4 for the demo's appeal step)
W9  D1-4 final verification + C8 DoD              (needs all)
```

- Step-metadata `depends` fields are authoritative; wave annotations are the summary view and must never disagree (a step with an unmet dependency is not mergeable, wave row notwithstanding).

- P-pair "merge rule": steps in the same wave touch disjoint files (by §3) except shared read-only artifacts; their PRs may be developed concurrently and merged in any order, but each must be rebased onto `main` *after* its wave-mate merges and re-pass `npm run check` before it is considered done.
- Model tier: D1-0, D2-3, D2-4, D1-4 run on the strongest available model; all other steps on the default model.
- Global invariant after every merge: `npm run check` green. From W3 onward, the app must open with no console errors.

---

## 6. Steps

**LOG STEP (SPEC §E3) is part of every step's Exit, for every dev:** append a section to `BUILD_LOG.md` (dev-tagged heading, one per step), append assumptions to `DECISIONS.md`, overwrite your own `handoff/devN.md`, and put the one-line result ("Phase N: PASS/FAIL. Flow tests x of 21. Next action: …") in the PR description. D3-1 also refreshes the root `HANDOFF.md` at each wave boundary. Deviations from the spec go in `DECISIONS.md`, newest at the bottom.

**Placeholder convention:** D3-1 creates every page placeholder (`pages/*.jsx` for all routes). After that merge, the feature owner named in §3 owns those files; D3-1's placeholders carry no logic, so the transfer conflicts with nothing.

### D1-0 — Bootstrap, pack, contract artifacts, gates · *strongest* · Dev1 · depends: none (needs: repo URL, Complete Pack)

**Context:** Repo `https://github.com/vrbavesh/juridao` (origin already set). Spec = `JuriDAO_ThinkRoot.md`. Working tree contains uncommitted deletions of the old chain-based files (`contracts/`, `api/openapi.yaml`, `plans/juridao-build.md` from the superseded plan). `gh` unavailable. This step makes the repo match SPEC's Phase 0 and creates the contract artifacts everything else is verified against.

**Tasks:**
1. Copy `JuriDAO_ThinkRoot.md` verbatim to `SPEC.md`.
2. Create the spec's log files from PART E2 templates: `BUILD_LOG.md`, `HANDOFF.md`, `DECISIONS.md`, and `handoff/dev1.md|dev2.md|dev3.md`.
3. **Obtain the Complete Pack** — `juridao-engine.js`, `selftest.js`, `juridao-engine.test.js`. If you (the user) have not supplied them, stop and report BLOCKED (spec Phase 0 rule). Place them in `reference/`. `DECISIONS.md` entry: their origin.
4. Commit the working-tree deletions (old chain plan artifacts) with a `DECISIONS.md` entry: superseded by ThinkRoot spec, recoverable at commit `e88ff4f`.
5. Scaffold Vite + React + react-router-dom + Tailwind; theme tokens from SPEC (`#0f0b1a`, `#1c1530`, `#8b5cf6`, `#38bdf8`). `package.json` scripts: `dev`, `build`, `test:engine`, `test:flow`, `check:contract`, `check` (all four). Record the Vite choice in `DECISIONS.md` (spec says "npm run build (or ThinkRoot's build)").
6. `api/engine-api.yaml` per §B1 (transcribe SPEC §5; enums; `x-storage-keys`). `api/schemas/`: `state`, `deal`, `dispute`, `round`, `evidence-item`, `account`, `court`, `notification`, `flow-test-result` (+ fixtures in `api/fixtures/`).
7. `scripts/check-contract.mjs` (the four checks in §B1), `scripts/flow.mjs` (SPEC §E5), `.github/workflows/ci.yml` (`npm ci && npm run check`).
8. Push `main` to origin; open the PR for this step and merge after CI green.

**Verify:** `node reference/juridao-engine.test.js` ends `ALL TESTS PASSED`; `node scripts/check-contract.mjs` passes (engine target: `reference/`); `node scripts/flow.mjs` prints `NOT BUILT YET` (exit 0 — `src/lib/flowtests.js` lands at D1-1; from D1-1 the same script must print `21 of 21 passed` and exits 1 on any failure); `npm run build` succeeds; old files' deletion committed; `git status` clean.

**Exit:** artifacts and gates committed to `main`; all three devs can `git pull` and run `npm run check` (which is fully green from D1-0 onward).

### D1-1 — Engine, store, flow tests · default · Dev1 · depends: D1-0

**Context:** SPEC Phase 2. Frozen modules copied verbatim; `store.js` is the only state owner; every action = one engine call through `act()`; a 2-second keeper runs `autoAdvance`.

**Tasks:**
1. Copy `juridao-engine.js`, `selftest.js` from `reference/` into `src/lib/`. Never edit. Copy `flowtests.js` from SPEC §E1 verbatim into `src/lib/flowtests.js`.
2. `src/lib/store.js`: `loadState`, `saveState` (key `juridao_state_v2`), `useJuri()` → `{ state, account, setAccount, act }`; `act(fn)` calls the engine with `state` first, saves, sets error → red toast, re-renders; keeper: `JuriDAO.autoAdvance(state)` every 2 s then save; `window.JuriDAO`/`window.juriState` helpers.
3. **Swap the `check-contract.mjs` engine target constant** from `reference/` to `src/lib/juridao-engine.js` (same PR; record in `DECISIONS.md`).
4. **Stub `src/components/BuyJuriModal.jsx`** — an exported component with the real name/path that renders a placeholder. D3-1's Header imports this stub (D3-1 builds in W3, D1-2 fills the body later in W4, same file, disjoint in time).
5. `src/components/FlowTestRunner.jsx`: "Run all flow tests" → `runFlowTests(JuriDAO)`; tick/cross per test, summary "N of 21 passed", "Copy report", "Download report (.txt)" (timestamp), last 10 runs in `juri_testlab_runs`.
6. Do not mount FlowTestRunner into Admin yet — Admin is D3-3 (its file owned by Dev3). It is exported and verified via `scripts/flow.mjs` and mounted by Dev3 in D3-3.

**Verify:** `node scripts/flow.mjs` → `21 of 21 passed`; `npm run check` green (now running against the `src/lib/` engine copy).

**Exit:** store helpers importable; flow tests green in Node; FlowTestRunner builds. Commit.

### D2-0 — Shared formatting & evidence utils · default · Dev2 · depends: D1-0

**Context:** SPEC §3.4/§3.8 money and fingerprint rules are needed by both Dev1 (courts balances) and Dev2 (deals). Both must format identically or screens drift.

**Tasks:**
1. `src/lib/format.js`: `ethFromMicro(v)` → `(v/1000000).toFixed(4) + " ETH"`; `ethToMicro(eth)` → `Math.round(eth*1000000)`; `juri(v)` thousands separators; `mmss(seconds)`; deadline countdown helper using `JuriDAO.nowOf(state)` — never `Date.now()`.
2. `src/lib/evidence.js`: `readFileAsText(file)` (FileReader → smart text), `evidenceBadge(fingerprint)`.
3. Add a micro-assert script `scripts/check-format.mjs` (pure-function asserts: 1000000→"1.0000 ETH", 1000→"1,000", 90→"01:30") and wire into `npm run check`.

**Verify:** `node scripts/check-format.mjs` prints PASS; `npm run check` green.

**Exit:** utils committed; both Dev1/Dev2 import them rather than hand-rolling.

### D3-0 — UI contracts doc · default · Dev3 · depends: D1-0

**Context:** §B4. Dev1/Dev2 code against props Dev3 will render.

**Tasks:** `api/ui-contracts.md` — for every component in SPEC §2 + C5: purpose, props with types, empty-state text, mock/demo-data rules. Mark every prop list as "frozen at D3-1; changes require a manifest PR".

**Verify:** no code — document reviewed by Dev1+Dev2 in its PR. **Exit:** doc merged.

### D3-1 — Shell · *strongest* · Dev3 · depends: D1-1, D2-0, D3-0

**Context:** SPEC Phase 1. Everything below the routing layer is placeholder duty; philosophy: create every file once, owners fill bodies later. Needs `store.js` (D1-1) for the account selector/balances.

**Tasks:**
1. `src/App.jsx` with all routes from SPEC §2 + `/testlab`; each page component created as a placeholder rendering the page title + "Nothing here yet" empty state.
2. Header: logo, nav (Home, Deals, Courts, My Cases, Rewards, Guide), bell with unread count (from `juri_notifications_read` registry key), account selector (11 accounts), ETH/JURI balances, Deals|Juror mode toggle (sets landing on next switch), "Buy JURI" button → opens `BuyJuriModal` (Dev1's component exported with this exact name/path; render it once at shell root — body filled in D1-2), mobile menu button below 768 px (C6).
3. Banner on every page: "Simulation mode: dummy ETH and dummy JURI, no real money."
4. Toast system: red for engine errors, green for feedback (wording mandated in C1.3 for buys).
4b. The Header renders `<BuyJuriModal/>` from Dev1's D1-1 stub (filled later — D3-1 never writes that file).
5. Theme tokens from D1-0; tables-become-stacked-cards pattern stub; all interactive controls ≥ 44 px tall.
6. Freeze `api/ui-contracts.md`.

**Verify:** `npm run dev` → every route opens; account switching re-renders balances (10.0000 ETH each); no console errors; no sideways scroll at 375 px; `npm run check` green.

**Exit:** skeleton + chrome committed; all page bodies still placeholders.

### D1-2 — Courts & token · default · Dev1 · depends: D3-1

**Context:** SPEC 8.7 + C1. Phase 4 check numbers are the exit.

**Tasks:** token card ("JURI, the jury token (dummy)" per C1.1), BuyJuriModal (ETH input → live JURI preview `ethMicro/1000000*10000`, Buy → `buyTokens`, Faucet → `faucet`, green/red toasts per C1.3), faucet, courts table (name, minStake, fee, cases, totalStaked, your stake, draw chance), join/add-stake modal (min, balance, below-min → red toast), unstake (works when unlocked; engine error red toast when locked), policy expandable.

**Verify (phase check):** buy 0.1 ETH → JURI 1,000 and toast "Bought 1,000 JURI for 0.1000 ETH"; faucet → +5,000; stake 100 in court 2 → red toast (min 500); unstake when unlocked works; header Buy JURI opens the same modal; `npm run check` green.

**Exit:** phase-4 numbers pass on screen; C6 mobile rules applied to these pages.

### D2-1 — Deals · default · Dev2 · depends: D3-1

**Context:** SPEC 8.2–8.4. Phase 6: Sam shows 9.0000 ETH after creating a 1 ETH deal; deepa shows 9.9940 after raising the dispute — this one crosses into D2-2, so D2-1 verifies through approve only. Read `src/lib/format.js`.

**Tasks:** deals list (stat cards: active, in dispute, completed, total ETH locked; per-card id, title, counterparty, amount, deadline, status badge, action-needed tag), NewDeal (freelancer select, amount ETH→micro, deadline as days from now, title, description, criteria add/remove ≥1, court, jurors 3/5/7, cost preview "fee × jurors", submit → createDeal → `/deals/:id`), DealDetail (timeline, parties, countdown, description, criteria; freelancer: note + optional file → markDelivered; client: approveDeal; Raise dispute confirm modal with fee + frozen-funds warning + question/answers).

**Verify:** create 1 ETH deal court 2 → Sam 9.0000 ETH; markDelivered shows fingerprint; approveDeal → freelancer paid; validations give red toasts; empty states; `npm run check` green.

**Exit:** all deal statuses renderable; C6 rules applied.

### D3-2 — Landing & Guide · default · Dev3 · depends: D3-1

**Context:** SPEC 8.1 + 8.12. Landing needs live state (disputes executed, total JURI staked, ETH locked) labeled "demo data".

**Tasks:** Landing (hero, Sam/Deepa 3-line story, six steps, four Why cards, live stats labeled demo data, two audience blocks, FAQ ×4, footer), Guide (six-step lifecycle with example, juror definition, selection, commit/reveal, worked penalty/reward numbers from §10, appeals cost rules, JuriDAO scope, "Inspired by Kleros").

**Verify:** both render with zero data and with seeded data; stats match `state.courts`/deals; `npm run check` green. **Exit:** committed.

### D1-3 — Juror dashboard, My Cases, Rewards · default · Dev1 · depends: D3-1

**Context:** SPEC 8.8/8.9/8.11.

**Tasks:** Juror (pending ETH/JURI, staked courts with draw chance, case counts, ring chart with `performancePct`, ongoing cases with tags, latest 5 notifications, Join a court + Get JURI buttons), My Cases (tabs Vote pending/In progress/Closed from `jurorCases`; row: case number, court, question, phase+countdown, your status), Rewards (pending, Claim, history from `settled` + `claimed` log entries).

**Verify:** all three render with and without data; claim button zeroes pending; dashboard ring value = `jurorStats.performancePct`; `npm run check` green. **Exit:** committed.

### D2-2 — Dispute page · *strongest* · Dev2 · depends: D3-1

**Context:** SPEC 8.5 + C3. Secrecy rule 8 is the core constraint: before Appeal, show only counts — never any juror's `choice`.

**Tasks:** header (number, deal, court, question, answers); PhaseTracker (Evidence, Jurors drawn, Voting(Commit), Reveal, Appeal window, Final; round number; countdown to `periodEnd`, Appeal → `periodStart + params.Appeal`); yellow `disputeWarning` box; evidence grouped Client/Freelancer/Other with fingerprint badges + Add-evidence form until Executed; Jurors section (after draw: names, draws, "N of M committed", "N of M revealed"; after reveal: tally, choices, justifications); **"How the jury was drawn" box (C3):** one line per juror (name, draws, stake weight %), parties-excluded tick, jury size N; collapsible rounds history; final ruling banner + where the ETH went.

**Verify:** "0 of 3 committed" appears with no choices anywhere before Appeal; jury-drawn box matches `state.disputes`; deal link; `npm run check` green. **Exit:** phase-7 check passes.

### D3-3 — Notifications & Admin · default · Dev3 · depends: D3-1, D1-1

**Context:** SPEC 8.13 + 8.14. Admin is "Demo controls" but visible to every account; mounts Dev1's FlowTestRunner and selftest module. Requires D1-1 (owns `src/lib/selftest.js`, `src/components/FlowTestRunner.jsx`) and D3-1.

**Tasks:** Notifications page (`notificationsFor` newest-first, links, read/unread — read state in `juri_notifications_read`, dev3-registered), bell badge bound to unread count; Admin per-dispute controls (period, round, countdown, Skip = `skipPeriod` (during Appeal executes ruling)), Fast forward 60 s (`skipTime`), faucet-for-everyone, auto-stake-all-jurors (faucet then `stakeJuri(state, id, 2, 1000)`, skip jurors already ≥1,000 staked in court 2), **Run engine self-test** (`runSelfTest(JuriDAO)` from `src/lib/selftest.js`, tick/cross + name/detail per test, "7 of 7 passed"), **Run all flow tests** (Dev1's FlowTestRunner, "21 of 21 passed"), Reset demo (confirm → `createInitialState`), live log of last 50 `state.log` entries, link to `/testlab`.

**Verify:** self-test shows 7 of 7; flow-test runner shows 21 of 21 on this page; notification bell shows unread drawn-juror notices; reset works; `npm run check` green. **Exit:** committed.

### D2-3 — Juror case page (commit/reveal) · *strongest* · Dev2 · depends: D2-2, D3-1

**Context:** SPEC 8.10. This page and D3-4's Seed 4 share the `juri_vote_{disputeId}_{round}_{account}` storage shape — that key is registry-fixed in D1-0, so both devs can code in parallel *after D1-0 has merged* (pull `main` first so the registry, engine copy, and store all exist). D3-4's merged E2E test then goes through this UI.

**Tasks:** if not drawn → "You were not drawn for this case"; else question, answers, court policy, delivery criteria, evidence, countdown. Commit: radio answer + reasoning → `choice = Number(value)`, `salt = randomSalt()`, `commit = makeCommit(choice, salt, account)` → `commitVote`; store `{ choice, salt, reasoning }` under the registry key; show "Your vote is sealed...", warning always visible ("If you do not commit and reveal, or you vote against the majority, you lose the JURI locked for this case."), Download backup. Reveal: one button reads stored values → `revealVote(state, account, disputeId, Number(choice), salt, reasoning)`; fallback inputs for **salt + answer + a reasoning/justification field** (needed by `revealVote`) when storage is missing. After result: round outcome, coherence, reward/penalty from `settled` log.

**Verify:** commit → "Your vote is sealed"; reveal → choices appear only on the dispute page from then on; missing-storage fallback works; flow tests still 21/21; `npm run check` green. **Exit:** phase-7 vote half passes.

### D3-4 — Test Lab · default · Dev3 · depends: D2-3 (merge after), D3-3

**Context:** SPEC C4. Uses store + engine only. D2-3 must be merged first so Seed 4's stored votes can be revealed in your UI; code may start earlier on a branch, but merge after D2-3 and run the Seed-4 → reveal E2E check on the merged tree.

**Tasks:** `/testlab` page + route link from Admin and Guide footer. Panel A token test (buy 0.1 → expect +1,000, faucet +5,000, buy-100-ETH expect throw; pass/fail badges from balance deltas). Panel B six scenario seeds: each creates fresh deal+dispute (sam→deepa, 1 ETH, court 2, 3 jurors, criteria "5 pages"/"mobile responsive", deadline `nowOf + 86400`); Seed 1 Delivered; Seed 2 + dispute by deepa; Seed 3 + evidence both + skipPeriod (Commit); Seed 4 + all drawn jurors commit + skip to Reveal, storing `{ choice, salt, reasoning }` under the registry key, with majority-answer control (1/2) and "one juror votes against the majority" checkbox; Seed 5 + all reveal + skip to Appeal; Seed 6 + funder funds side 1, sam funds side 2 → round 1 in Commit. Panel C `JurorInspector` (select dispute+round, table: name, draws, locked JURI, court stake, drawing weight %, status from `jurorCases`; three checks with tick/cross; counts only before Appeal). Panel D FlowTestRunner (Dev1's) + copy/download + last-10 runs. Panel E 21-test checklist in `juri_testlab_checks` ("n of 21 done", Clear). Panel F last-30 lab actions in `juri_testlab_log`. Panel G BUILD_LOG.md raw import if the build allows, else note in DECISIONS.md.

**Verify:** flow tests 21 of 21 in the browser; all six seeds produce a continue-by-hand dispute; Seed 4 → a drawn juror can press "Reveal my vote" in D2-3's page; `juri_testlab_*` keys all in `src/` match the registry; `npm run check` green. **Exit:** phase-9 check passes.

### D2-4 — Appeals · *strongest* · Dev2 · depends: D2-2, D2-3

**Context:** SPEC 8.6. Money-exact page; the engine is scheduler of round transitions, this page renders them.

**Tasks:** Appeal panel inside the dispute page (Appeal period interactive; read-only summary after): current ruling, round number, next jury size `2*numDraws+1`, countdown; two columns (side 1 "Pay the freelancer", side 2 "Refund the client") with funding bars `funded/required`, required amounts, "pays double because it is challenging the ruling" on the challenger, amount input, Fund remaining, Fund this side; challenger disabled in second half with reason; last round "No further appeals"; rules box; Execute ruling button when countdown over; after Executed, Withdraw appeal funds per round/side where `round.contrib[side][account] > 0`.

**Verify:** fund one side fully → ruling stands, no new round; both fully funded → 7-juror round starts (round 1, Commit); Execute + withdraw math matches §10 numbers; `npm run check` green. **Exit:** phase-8 appeal half passes (two-sided appeal starts 7-juror round).

### D3-5 — Polish, mobile, demo run · default · Dev3 · depends: D2-4, D3-4, D1-3

**Context:** SPEC phase 10 + C6 + §13 demo script. Every dev already applied C6 to their own pages; this step audits and runs the full script.

**Tasks:** audit all pages at 375/768/1280 (no sideways scroll at 375, nav menu button, tables → stacked cards, ≥44 px controls, full-width bottom-sheet modals, countdowns wrap cleanly); empty states present everywhere; run SPEC §13 demo start to finish twice; fix or file owner-tagged issues; record C6 evidence in `BUILD_LOG.md`.

**Verify:** §13 script completes with no console errors and no terminal use; `window.JuriDAO`/`juriState()` present; `npm run check` green. **Exit:** HANDOFF.md updated: demo green, polish done.

### D1-4 — Final verification · *strongest* · Dev1 · depends: all

**Context:** SPEC phase 11 + C8.

**Tasks:** run `node reference/juridao-engine.test.js` (expect ALL TESTS PASSED), engine self-test in `/admin` (expect 7 of 7), flow tests in Test Lab and via node (expect 21 of 21); tick the 21 manual checks in Test Lab Panel E after Dev3's demo evidence; list every deviation from `DECISIONS.md`; append `## FINAL REPORT` section to `BUILD_LOG.md`; set `HANDOFF.md` to ALL DONE; push; final PR review by Dev3.

**Verify:** C8 list — both in-app scores present, all six seeds shown working in `BUILD_LOG.md`, 21/21 manual checks ticked, no console errors in the demo, no sideways scroll at 375 px, every phase 0–11 (mapped: D1-0→0, D3-1→1, D1-1→2, D3-2→3, D1-2→4, D1-3→5, D2-1→6, D2-2/D2-3→7, D3-3/D2-4→8, D3-4→9, D3-5→10, D1-4→11) has a `BUILD_LOG.md` section.

**Exit:** C8 fully checked; HANDOFF.md says ALL DONE.

---

## 7. Definition of done (from SPEC C8, mapped to steps)

- D1-1: flow tests 21 of 21 in Node. D3-3: self-test 7 of 7 and FlowTestRunner on Admin. D3-4: 21 of 21 in browser + six seeds work in hand.
- D1-2/D1-3/D2-1/D2-2/D2-3/D2-4/D3-2/D3-3: every page reads real state; zero hard-coded data outside the landing's labeled "demo data" stats.
- D2-4: the three appeal outcomes all reachable and verifiable; payouts match §10.
- D2-3: a juror can commit+reveal using only the UI and later sees reward/penalty.
- D3-5: §13 demo runs clean. D1-4: logs complete, ALL DONE.

---

## 8. Plan mutation protocol

- Split/insert/reorder a step: allowed only with a changelog note; the wave rule "a file has one owner" and the artifact-first rule in §1.1 are inviolable.
- Skip a step: only if its exit check already passes (paste output into the changelog).
- Abandon a step or deviate from SPEC: record in `DECISIONS.md` with why and what was rejected.
- Cross-dev blocker (manifest ambiguity): the owner of the artifact fixes the artifact first; consumers rebase.

## 9. Changelog

- 2026-10-08: plan created. Choices recorded: repo `https://github.com/vrbavesh/juridao` (remote added, user-provided); Complete Pack sourcing assigned to D1-0 (Dev1) per user's answer; `gh` absent → web-UI PRs + CI via Actions; T18 exception preserved from SPEC §D5; old chain-artifact deletions committed at D1-0 with DECISIONS entry.
- 2026-10-08: post-adversarial-review revisions. (a) D1-0 gate contradiction fixed: `flow.mjs` prints `NOT BUILT YET` with exit 0 until D1-1, then the full "21 of 21 passed"/exit-1 behavior. (b) `check-contract.mjs` engine target explicitly starts at `reference/` and D1-1 swaps it to `src/lib/` (same PR, logged). (c) Arity check is now required-params-vs-`fn.length` with explicit `optional` markers in the manifest. (d) Storage-key gate scans only `localStorage.*Item` call arguments; template prefixes whitelisted. (e) Full-state JSON Schema replaced by a required-key + critical-field assert checker (brittle strict schema rejected). (f) PhaseTracker and RingChart are single-owner (Dev2 / Dev1 respectively); BuyJuriModal is stubbed by Dev1 in D1-1 before Dev3's D3-1 imports it. (g) D3-3 declares its D1-1 dependency. (h) Wave-graph annotations made subordinate to step metadata. (i) **Documented deviation from SPEC PART A/C7:** the Admin "Run flow tests → 21 of 21" check moves from spec-Phase-2 (D1-1) to D3-3 (W5); D1-1 proves the runner via `scripts/flow.mjs` in Node — visually equivalent gate, documented because Phase 2's check text names the Admin page. (j) **Documented deviation from SPEC PART A2:** root `HANDOFF.md` remains canonical and is refreshed by Dev3 at wave boundaries; per-dev files under `handoff/` are additive, each dev overwriting only their own (spec's single-overwritten HANDOFF.md would serialize three people). (k) Seed-4 reasoning input fallback added to D2-3. (l) D1-0 review duty assigned to Dev2/Dev3 at W1.
