# DECISIONS.md

Log format: date, decision, why, alternative rejected.

## Mandated by SPEC §9

### 2026-10-08 — Demo randomness is not secure
The juror draw seeds with `blockhash(block.number-1)`, which is predictable/manipulable by miners and large players. Acceptable only because this is a local-chain hackathon demo. **Rejected alternative:** integrating a VRF (Chainlink) — adds external dependencies and is out of scope (SPEC §16 lists verifiable randomness as future work).

### 2026-10-08 — Courts are flat
No court hierarchy, no "court jumps" (Kleros-style appellate courts). A single `JuriCourt` holds flat court configs; appeals happen inside the same dispute. **Rejected alternative:** modeling appellate levels — SPEC §16 lists it as future work.

### 2026-10-08 — Single dispute kit
One dispute template (the SPEC §5 JSON: one question, two answers). No pluggable kit registry. **Rejected alternative:** registry of dispute kits — future work per SPEC §16.

### 2026-10-08 — Fee model: dispute raiser pays, non-refundable
The party who calls `raiseDispute` pays the arbitration fee; it is not refunded and not reallocated on loss. **Rejected alternative:** loser-pays via fee reserve — listed as future work (SPEC §16).

## Declared deviations from SPEC process/layout

### 2026-10-08 — Step plan reorders SPEC §12 phases
The blueprint (`plans/juridao-build.md`) runs mock-ipfs (S6) during phase 1, may run S9a ∥ S9b (phases 4–5) under worktree isolation, and can only fully satisfy the phase-2 `npm run demo` check at S12 (S7's interim check = deploy+seed assertions). **Why:** contract-first boundaries and parallel opportunity. SPEC §0.1's per-step test gating is still honored — no step starts before its dependencies' verification passes. **Rejected:** rigid phase order (slower, no contract-first artifact discipline).

### 2026-10-08 — Layout additions beyond SPEC §2 tree
Added `api/` (openapi.yaml, JSON Schemas, fixtures — the contract-first boundary artifacts) and `web/src/contracts/generated.ts` (typed ABI + schema-derived TS types). **Why:** machine-checkable boundaries between contracts/mock-ipfs and the frontend. **Rejected:** hand-written types duplicated in frontend code (drift risk).

## B2 resolutions (SPEC §5 silent points)

### 2026-10-08 — mock-ipfs response details
- `hash` field = bare sha256 hex; URI = `ipfs://mock-<sha256>`; `resolveUri` maps it to `${VITE_IPFS_URL}/ipfs/mock-<sha256>`.
- Status codes: `POST /upload` → **201**; empty body → **400**; unknown hash → **404**. Error envelope: `{ "error": { "code", "message" } }`.
- **Why:** standard REST semantics (api-design); spec fixed neither codes nor envelope. **Rejected:** 200-for-everything (hides failures from the fetch layer).

## Demo-mode decisions

### 2026-10-08 — Appeal window skip in demo mode
SPEC forbids Appeal → Executed via `advancePeriod`, but SPEC §15 step 10 requires "Admin skips the appeal window; press Execute ruling". **Decision:** during `Period.Appeal`, `demoSkipPeriod` (onlyOwner + demoMode) rewinds `periodStart` by `appealDur` so the window reads as elapsed; the period stays `Appeal` and `executeRuling` (which the Admin presses separately) performs the transition — exactly matching SPEC's "Appeal → Executed only through executeRuling". **Rejected alternative:** allowing `advancePeriod` to execute during Appeal (violates SPEC §4.3); a skip flag gating `executeRuling` (extra storage when a timestamp rewind is simpler). Implemented + tested in S4.

### 2026-10-08 — Challenger half-window restriction when ruling == 0
SPEC's half-window rule is scoped "(when ruling != 0)". **Decision:** on a tie (`ruling == 0`) both sides are treated as challengers: both may fund only during the first half of the appeal window. **Why:** a tie means neither side "wins" to defend; symmetric treatment is the simplest reading. **Rejected:** letting both fund the whole window (inconsistent with the cost asymmetry being meaningless on a tie anyway). Test in S4 (SPEC §10 item 9).

## B4 mock mode (pre-prod prototype testing)

### 2026-10-08 — VITE_MOCK_DATA flag scope and gate
`VITE_MOCK_DATA=true` makes data hooks and `lib/storage.ts` return fixtures from `web/src/mocks/` so every page can be tested with no chain and no mock-ipfs server. **Scope:** hooks + storage only — pages never import `web/src/mocks/` directly. Fixtures are typed by B1 generated types (structurally valid against B3 schemas). **Gate:** S12's `npm run check:mock` fails the build if mock modules leak into a prod build (flag unset). **Rejected:** a separate mock-only page tree (double maintenance, drift from real pages).
