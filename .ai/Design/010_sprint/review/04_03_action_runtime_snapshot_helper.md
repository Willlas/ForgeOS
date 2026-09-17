# Action 04_03 — Runtime snapshot helper

## Objective
Add a convenience method on the `Runtime` class that produces a plain-serializable
snapshot from the existing `getState()`, `getHealth()`, and metrics-summary
accessors. This gives the state-store (04_02) and daemon (04_06) one call to
capture everything Design 04 wants persisted.

## Backlog reference
- **Severity:** High
- **Blocks:** 04_06 (daemon lifecycle writes) — the daemon calls this to feed
  the state-store.

## Why it matters
All data sources already exist (`Runtime.getState`, `Runtime.getHealth`,
`MetricsCollector.getSummary`), but there is no single call that composes them
into a JSON-safe shape. Without it, the daemon would assemble the snapshot inline,
mixing concerns. Design 04 §"Components to Modify" lists "Runtime Metrics
subsystem — Must expose data in a format consumable by the persistence layer."

## Prerequisites
- 04_02 defines the `RuntimeStateSnapshot` shape — align this helper's output to
  that interface exactly.

## Steps
1. Open `packages/runtime/src/core/runtime.ts`.
2. Add a method on `Runtime`, e.g.:
   ```ts
   getSnapshot(): RuntimeStateSnapshot
   ```
   That composes:
   - `pid: process.pid`
   - `state: this.getState()`
   - `healthy: this.getHealth().healthy`
   - `startedAt: this.getHealth().startedAt` (ISO string)
   - `uptimeSeconds: this.getHealth().uptimeSeconds`
   - `health: <serializable subset of getHealth()>`
   - `metrics: this.getMetricsCollector().getSummary()`
   - `capturedAt: new Date().toISOString()`
   - `schemaVersion: <match StateStore>`
3. Ensure the output is **plain JSON-serializable**: convert any Date to ISO
   string, drop Maps/Sets, keep only records/arrays/primitives.
4. Import the `RuntimeStateSnapshot` type from `./persistence/state-store.js` (or
   re-declare and have the state-store import from runtime — pick one owner for
   the type to avoid a cycle; recommend the type lives in `state-store.ts` and
   runtime imports it).
5. Export the method via the existing barrel (it's on `Runtime`, already exported).

## Files
- **EDIT** `packages/runtime/src/core/runtime.ts` (add `getSnapshot`)
- **READ-ONLY** `packages/runtime/src/persistence/state-store.ts` (type owner)
- **READ-ONLY** `packages/runtime/src/core/metrics.ts` (`getSummary` source)

## Constraints
- Do **not** change the existing `getState`/`getHealth` signatures.
- Output must be JSON-safe (no `undefined`-bearing class instances, no cycles).
- Avoid creating a circular import between `runtime.ts` and `state-store.ts` —
  only the *type* crosses the boundary, using `import type`.
- No I/O in this method — it is a pure in-memory projection. The state-store
  handles disk writes.

## Verification
- `npm run build` green.
- `JSON.parse(JSON.stringify(runtime.getSnapshot()))` does not throw and round-trips.
- The returned object's `metrics` field matches `MetricsCollector.getSummary()`.
- `npm test` still green.
