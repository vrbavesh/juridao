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
