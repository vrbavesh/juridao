# BUILD_LOG.md

## Phase D1-0: Bootstrap, pack, contract artifacts, gates
- Status: DONE
- Date and time: 2026-10-08 (local)
- Account label: dev1
- Phase check: `node reference/juridao-engine.test.js` -> PASS ("21 of 21 engine tests passed / ALL TESTS PASSED"); `node scripts/flow.mjs` at D1-0 prints NOT BUILT YET (exit 0) per plan (b) — superseded once D1-1 landed; `node scripts/check-contract.mjs` -> PASS; `node scripts/check-format.mjs` -> PASS; `npm run build` -> PASS; old files' deletion committed at e88ff4f.
- Engine self-test: not built yet (in-app, lands with D3-3)
- Flow tests: NOT BUILT YET at D1-0; 21 of 21 after D1-1
- Files created or changed: SPEC.md (copy of JuriDAO_ThinkRoot.md), reference/ (engine, selftest, engine test, src/lib shim), api/engine-api.yaml, api/schemas/*, api/fixtures/*, scripts/check-contract.mjs, scripts/flow.mjs, scripts/check-format.mjs, .github/workflows/ci.yml, package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html, src/index.css, .gitignore, DECISIONS.md
- Deviations and decisions: see DECISIONS.md (2026-10-08 entries)
- Known issues: none
- Next single action: D1-1 engine+store+flowtests

## Phase D1-1: Engine, store, flow tests
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev1
- Phase check: `node scripts/flow.mjs` -> "21 of 21 passed"; `npm run check` green (contract check now targets src/lib copy)
- Engine self-test: not built yet
- Flow tests: 21 of 21
- Files created or changed: src/lib/juridao-engine.js, src/lib/selftest.js, src/lib/flowtests.js (verbatim), src/lib/store.js, src/lib/format.js (pulled forward), src/components/FlowTestRunner.jsx, src/components/BuyJuriModal.jsx (filled, was planned as stub), api manifest arity OK, scripts/check-contract.mjs engine target = src/lib
- Deviations and decisions: store keeper re-renders every 2 s so countdowns tick
- Known issues: none
- Next single action: D1-2 courts+token

## Phase D1-2: Courts and token
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev1
- Phase check: build OK; browser smoke (Courts page): faucet +5,000 JURI updates header + success toast; buy preview "0.1 ETH -> 1,000 JURI" visible; stake modal + unstake wired through act() with engine errors as red toasts
- Engine self-test: not built yet
- Flow tests: 21 of 21
- Files created or changed: src/pages/Courts.jsx (token card C1.1, token panel 8.7, court table, join/add-stake + unstake modals, mobile stacked cards), src/components/BuyJuriModal.jsx (C1.2: ETH input, live JURI preview, balance, Buy, Faucet; C1.3 toasts)
- Deviations and decisions: CourtRow inlined (see DECISIONS.md)
- Known issues: none
- Next single action: D1-3 juror pages

## Phase D1-3: Juror dashboard, My Cases, Rewards
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev1
- Phase check: `npm run build` + `npm run check` pass; pages render with and without data via empty states; Rewards reads `settled` + `claimed` log entries
- Engine self-test: not built yet
- Flow tests: 21 of 21
- Files created or changed: src/pages/Juror.jsx (pending, staked courts + draw chance, case counts, RingChart performancePct, ongoing cases with tags, latest 5 notifications, Join a court / Get JURI), src/pages/MyCases.jsx (tabs Vote pending / In progress / Closed), src/pages/Rewards.jsx (pending, Claim rewards, history table), src/components/RingChart.jsx, src/components/EmptyState.jsx
- Deviations and decisions: none beyond DECISIONS.md
- Known issues: CaseJuror, Deals, Dispute, Admin, TestLab, Landing, Guide, Notifications are placeholder pages owned by Dev2/Dev3 (D2-1..D3-5)
- Next single action: user asked to push; then D1-4 final verification once Dev2/Dev3 land

## Phase D3-0: ui-contracts.md
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev3
- Phase check: `api/ui-contracts.md` exists with prop contracts for every shared component (Header/Banner/Toast/EmptyState/StatCard/Countdown/RingChart/FlowTestRunner/BuyJuriModal/CourtRow/DealCard/PhaseTracker/EvidenceList/EvidenceForm/AppealPanel/VotePanel/JurorInspector/TestLab/Notifications/Admin)
- Flow tests: 21 of 21
- Files created or changed: api/ui-contracts.md
- Deviations and decisions: see DECISIONS.md
- Next single action: D3-1 shell

## Phase D3-1: Shell
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev3
- Phase check: every route renders and switches account; no sideways scroll at 375 px (nav collapses under 768 px, minimum 44 px controls, wrapped countdowns); Header mode toggle now shows active mode (Deals-ish vs Juror-ish routes)
- Flow tests: 21 of 21
- Files created or changed: src/components/Header.jsx (active mode highlight, menu closes on nav click), api/ui-contracts.md frozen
- Deviations and decisions: Dev1's provisional Header/App.jsx/placeholders are compatible and kept; BuyJuriModal (Dev1) mounted once at Header root
- Next single action: D3-2 landing/guide

## Phase D3-2: Landing and Guide
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev3
- Phase check: `npm run build` succeeds; Landing renders hero/story/6 steps/4 Why cards/live stats labelled "demo data"/audience blocks/FAQ/footer; Guide covers lifecycle example, juror definition, draw mechanics, commit/reveal, rewards+penalties worked numbers, appeals costs, what JuriDAO can(not) do, Kleros mention; both render with zero data (empty states)
- Flow tests: 21 of 21
- Files created or changed: src/pages/Landing.jsx, src/pages/Guide.jsx
- Next single action: D3-3 notifications+admin

## Phase D3-3: Notifications and Admin
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev3
- Phase check: Notifications page lists `notificationsFor` newest-first with links and read/unread (bell badge now matches: same `juri_notifications_read` rule); Admin shows demo controls — per-dispute skip, fast-forward 60 s, faucet-all, auto-stake-all-jurors, engine self-test (runSelfTest returns [{name,ok,detail}], shows "7 of 7 passed"), FlowTestRunner mounted (21 of 21), reset demo, live last-50 engine log, link to Test Lab; `npm run check` green
- Engine self-test: runSelfTest executes against the bundled module (uses throwaway state)
- Files created or changed: src/pages/Notifications.jsx, src/pages/Admin.jsx
- Next single action: D3-4 testlab

## Phase D3-4: Test Lab
- Status: DONE
- Date and time: 2026-10-08
- Account label: dev3
- Phase check: `/testlab` renders panels A–G; Panel A token tests PASS on live balances (+1,000 JURI on 0.1 ETH, +5,000 faucet, 100 ETH buy rejected with unchanged balance); Panel B seeds 1–6 each create a fresh case (with logged results, last-seed link, majority-answer selector, "one juror against majority" checkbox); Panel C JurorInspector table + three structural checks (parties excluded, total draws == round size, every drawn juror notified); Panel D reuses FlowTestRunner (21 of 21); Panel E 21-item manual checklist persisted to `juri_testlab_checks`; Panel F last-30 lab log to `juri_testlab_log`; Panel G embeds BUILD_LOG.md via Vite `?raw` import (confirmed in the build output as its own chunk, graceful fallback if disabled)
- Files created or changed: src/pages/TestLab.jsx, src/components/JurorInspector.jsx
- Deviations and decisions: see DECISIONS.md
- Next single action: D3-5 polish + demo run (blocked on Dev2 pages)

## Phase D3-5: Polish, mobile, demo run
- Status: BLOCKED (partial)
- Date and time: 2026-10-08
- Account label: dev3
- Phase check: `npm run check` green; Tailwind mobile rules applied to all Dev3 pages (menu button <768 px, stacked cards, ≥44 px controls, full-width bottom-sheet modals, no sideways scroll at 375 px by CSS review). The SPEC §13 demo script CANNOT run end-to-end until Dev2's pages exist: Deals, NewDeal, DealDetail, DisputeDetail, CaseJuror, AppealPanel are still placeholders. Seeds 1–6 confirm the engine side works (flow tests 21 of 21).
- Known issues: Deal flow pages, voting UI, appeals UI, evidence form are missing — Dev2 (D2-1..D2-4) work not started
- Next single action: Dev2 implements D2-1..D2-4; then Dev3 re-runs this phase for the full demo

## Phase D2-0: Shared formatting and evidence utils
- Status: DONE (format.js had been pulled forward by Dev1 at D1-1; Dev2 verified it line-by-line against the D2-0 spec and completed the missing half)
- Date and time: 2026-10-08
- Account label: dev2
- Phase check: `node scripts/check-format.mjs` -> PASS (8 format asserts + 8 evidence asserts); `node scripts/check-contract.mjs` -> CONTRACT CHECKS PASSED
- Engine self-test: not built yet (Admin mount is D3-3)
- Flow tests: 21 of 21
- Files created or changed: src/lib/evidence.js (new), scripts/check-format.mjs (evidence asserts added)
- Deviations and decisions: see DECISIONS.md (2026-10-08 D2-0 entries)
- Known issues: none
- Next single action: D2-1 deals
