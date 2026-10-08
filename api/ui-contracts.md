# UI Contracts (B4 artifact)

Frozen at D3-1. Every shared component's props. Changes require a manifest PR first,
then the component, then the callers. Components render engine data read-only — they
never call the engine themselves (pages/parents do, through `useJuri().act`).

- `Header` — `{}`. Reads `useJuri()` internally. Renders logo, nav, bell (unread
  count from engine `notificationsFor` minus `juri_notifications_read`), account
  selector, ETH/JURI balances, mode toggle (navigates to /deals or /juror), Buy JURI
  button (opens `BuyJuriModal`). Mobile: nav collapses under 768 px.
- `Banner` — `{}`. Always the exact text "Simulation mode: dummy ETH and dummy JURI,
  no real money."
- `Toast` — `{}`. Renders store toasts; red for engine errors, green for success.
- `EmptyState` — `{ text?: string }` (default "Nothing here yet").
- `StatCard` — `{ label: string, value: string|number, hint?: string }`.
- `Countdown` — `{ seconds: number }` — renders mm:ss; parents compute from
  `JuriDAO.periodEnd`/`nowOf`.
- `RingChart` — `{ pct: number }` — 0..100, labelled percentage.
- `FlowTestRunner` — `{}`. Runs `runFlowTests(JuriDAO)` on throwaway states; report
  shape `[{ name, ok, detail }]`. Mounting points: Admin + TestLab.
- `BuyJuriModal` — `{ open: boolean, onClose: () => void }`.
- `CourtRow` — court object (SPEC §4 shape) + `onJoin`, `onUnstake` callbacks.
- `DealCard` — deal object + `onOpen`.
- `PhaseTracker` — `{ dispute }` with per-period labels and current-round info; the
  only owner is Dev2 (created in D2-2).
- `EvidenceList` — `{ evidence: array }` grouped by role; `EvidenceForm` —
  `{ onSubmit(title, description, fileName, fileText) }`.
- `AppealPanel` — `{ dispute, account, onWithdraw }`.
- `VotePanel` — `{ dispute, account, storedVote }`.
- `JurorInspector` — `{ state, disputeId, roundIndex }`. Dev3-owned (TestLab).
- `TestLab` page — no props. Panels A–G per SPEC C4.
- `Notifications` page — no props; read state in `juri_notifications_read`.
- `Admin` page — no props; mounts `FlowTestRunner` and the engine self-test
  (`runSelfTest(JuriDAO)`, shape `[{ name, ok, detail }]`).

Empty-state rule: every page renders its empty state when the engine data it lists
is empty. No page hard-codes data; the only "demo data" label is the Landing stats.
