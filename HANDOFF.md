# HANDOFF (read me first)
- Last updated: 2026-10-08 by dev2
- Current phase: Dev2 D2-0..D2-5 DONE and merged; Dev3 D3-5 and Dev1 D1-4 are the only open phases
- Status: IN PROGRESS (Dev1 D1-0..D1-3 done; Dev3 D3-0..D3-4 done; Dev2 D2-0..D2-5 done)
- Last completed step: D2-5 (end-to-end browser smoke of D2 + DealCard counterparty fix, PR #6) — main HEAD `0acce05`
- NEXT single action: Dev3 runs D3-5 (full §13 demo run + mobile audit); Dev1 runs D1-4 (final verification C8). Both were blocked on Dev2 and are now unblocked.
- Half-finished work or risks: none in product code. Harness notes only: the in-app browser panel cannot drive the native header account <select> (dev testing used a temporary `#as=` hash switch, fully reverted); Vite HMR full-reloads wipe panel state after store.js edits, so restart the dev server before long browser sessions; seeded demo state survives same-document navigation only.
- Last scores: `npm run check` green on main — engine 21/21, flow tests 21 of 21, contract PASS, format PASS, build OK. Landing/deals/dispute/vote/appeal flows smoke-verified live.