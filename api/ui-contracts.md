# UI Contracts (B4) — component props & hook shapes

Source of truth for cross-dev component/hook usage. Spec authority sits above this doc: if a component disagrees with SPEC, fix the code and note the change here. Changes to any prop shape land in a PR that updates this file first, then the implementation.

Generated/owned by Dev3 (D3-0); frozen at D3-1 merge. Verify: `npm run check` + a manual render pass of every page.

## Hooks & helpers (Dev1-owned, consumed by everyone)

| Export | Shape | Notes |
|---|---|---|
| `useJuri()` | → `{ state, account, setAccount, act }` | read-only `state`; actions only via `act(fn)` |
| `act(fn)` | `fn: (state) => any` → returns fn's return or `undefined` on thrown error | on engine throw: red toast with `error.message`, state unchanged |
| `pushToast(text, kind)` | `kind: "info" \| "success" \| "error"` | green=success, red=error, purple=info |
| `ethFromMicro(v)` | → `"x.xxxx ETH"` | |
| `ethToMicro(eth)` | → integer micro-ETH | |
| `juri(v)` | → `"1,000"` | |
| `mmss(s)` | → `"mm:ss"` | countdowns (Admin adds §3 count) |
| `JuriDAO` (default from `src/lib/juridao-engine.js`) | engine API per `api/engine-api.yaml` | never mutate its return shapes |
| `juriState()` | `() => state` | console helper (SPEC §3.9) |

## Chrome (Dev3)

| Component | Props | Behavior |
|---|---|---|
| `Banner` | none | exact text "Simulation mode: dummy ETH and dummy JURI, no real money." on every page |
| `Toast` | none | renders `getToasts()`; mounted once in App |
| `Header` | none | logo, nav (Home/Deals/Courts/My Cases/Rewards/Guide), bell + unread count (from `notificationsFor` minus `juri_notifications_read`), account selector, ETH+JURI balances, Buy JURI → `<BuyJuriModal open onClose>`, Deals\|Juror toggle → navigates `/deals` or `/juror`, menu button below 768 px, all controls ≥44 px |
| `EmptyState` | `{ text = "Nothing here yet" }` | dashed border panel |

## Display primitives

| Component | Props | Owner |
|---|---|---|
| `StatCard` (inline pattern) | `{ label, value, sub? }` — see Courts/Juror pages | Dev3 spec, Dev1 used |
| `Countdown` | `secondsLeft` → `mm:ss`, "0:00" at expiry | shared pattern: `mmss` helper |
| `RingChart` | `{ pct = 0, size = 96 }` → SVG ring aria-label "Performance N%" | Dev1 |

## Domain components (consumed across pages)

| Component | Props | Notes |
|---|---|---|
| `BuyJuriModal` | `{ open, onClose }` | Dev1; ETH input, live JURI preview, Buy, Faucet; closes on success |
| `FlowTestRunner` | none | Dev3 mounts in Admin (D3-3) and TestLab (D3-4); runs `runFlowTests(JuriDAO)`, "N of 21 passed", Copy/Download report, last 10 runs in `juri_testlab_runs` |
| `JurorInspector` | `{ disputes?: state.disputes }` | Dev3, TestLab Panel C |
| `CourtRow` | Deals table row | inline |
| `PhaseTracker`, `EvidenceList`, `EvidenceForm`, `VotePanel`, `DealCard`, `AppealPanel` | per SPEC 8.x field lists | Dev2 owns; used inside Dev2 pages. Do not import from Dev3 pages except DisputeDetail public link |

## Page conventions (all pages)

- Every page works with zero data (empty state), links banner + header, mobile-safe ≤640 px (tables → stacked cards, ≥44 px controls, no sideways scroll at 375 px).
- Engine rule: UI never displays secrets — no juror `choice` before dispute `period` is `Appeal` or `Executed`; only counts ("N of M committed").
- Time source is `JuriDAO.nowOf(state)`, never `Date.now()`, so Admin skip controls work.
- Links: notifications carry `{at, text, link}` — always render the `link` or a fallback to `/deals/:id`/`/cases/:id`.
