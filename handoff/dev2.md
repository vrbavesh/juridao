# handoff/dev2.md
- Done: D2-0 complete. `src/lib/format.js` (pulled forward by Dev1) verified against the D2-0 spec; `src/lib/evidence.js` added (`readFileAsText`, `evidenceBadge`); `scripts/check-format.mjs` extended with evidence asserts. D2-1 deals started on `dev2/d2-1-deals`.
- Scores: format check PASS, contract check PASS, flow tests 21 of 21, engine tests ALL TESTS PASSED, build OK.
- Waiting on you: D2-1 (in progress), D2-2 dispute page, D2-3 vote flow, D2-4 appeals.
- Contract: engine API in api/engine-api.yaml; storage keys in x-storage-keys; act() in src/lib/store.js; void engine calls must return a sentinel from the act() closure (act returns undefined both on success and on error for void ops).
