# Action 05_02 — Lifecycle state machine (FSM)

## Objective
Create a finite-state-machine that owns the daemon `LifecycleState`, enforces
only-valid transitions (throwing on illegal ones), exposes the current state,
and notifies registered listeners on every change. Pure in-memory logic — no
timers, no I/O — so it is trivially unit-testable.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 05_05 (graceful shutdown handler sets `Stopping`/`Crashed`),
  05_06 (watchdog reads state), 05_07 (crash detector sets `Crashed`).

## Why it matters
Design 05 §"Components to Create" calls for a `LifecycleStateMachine` with
`transition(nextState)` that enforces valid transitions, `getState()`, and
`onStateChange(callback)`. Today the daemon mutates an ad-hoc `RuntimeState`
field directly throughout `runtime.ts` with no guard and no listeners, so
illegal transitions (e.g. `Crashed → Running` without going through `Restarting`)
are silent. The FSM makes the lifecycle contract explicit and observable, which
the watchdog, crash detector, and shutdown handler all query.

## Prerequisites
- **05_01** (lifecycle types) complete — the FSM imports `LifecycleState` from
  `./types.js`.

## Steps
1. Create `packages/runtime/src/core/lifecycle/lifecycle-state-machine.ts`.
2. Export a `LifecycleStateMachine` class (or factory) with this surface:
   - `constructor(initial?: LifecycleState)` — default `LifecycleState.Starting`.
   - `getState(): LifecycleState`.
   - `transition(next: LifecycleState): void` — look up the allowed transitions
     from a static map; if `next` is not allowed from the current state, **throw**
     an `Error` naming both states (do not silently no-op — callers must learn of
     bugs). If allowed, set the state and notify listeners.
   - `onStateChange(callback: (from: LifecycleState, to: LifecycleState) => void):
     () => void` — register a listener; return an unsubscribe function.
3. Define the allowed-transition map as a module-level constant. Authoritative
   edges (add both directions where symmetric behavior is intended):
   - `Starting → Running`, `Starting → Crashed`, `Starting → Stopping`.
   - `Running → Stopping`, `Running → Crashed`, `Running → Restarting`.
   - `Stopping → Crashed` (cleanup itself failed) — but `Stopping` has **no** edge
     back to `Running`/`Starting`.
   - `Crashed → Restarting`, `Crashed → Stopping`.
   - `Restarting → Running`, `Restarting → Crashed`, `Restarting → Stopping`.
   - Same-state transitions (`X → X`) are **no-ops** (allowed, no listener fire)
     so idempotent callers do not throw.
4. Notify listeners **after** the state field is updated, passing the previous
   and new state. Listener errors must be caught per-listener so one bad
   listener cannot break a transition.
5. Export nothing else — keep the module to the FSM and the transition map.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/lifecycle-state-machine.ts`
- **DEPENDS ON** `./types.js` (`LifecycleState`)

## Constraints
- **Pure synchronous logic only.** No `setTimeout`, no `fs`, no `process.on`. The
  FSM is a pure state holder so it can be used in tests and in the daemon without
  side effects.
- Throw on illegal transitions — never silently swallow. The error message must
  name both `from` and `to`.
- `X → X` is an allowed no-op and must **not** fire listeners (avoids spurious
  events from idempotent callers).
- Listener invocation must be defensive: wrap each callback in try/catch.
- Do not mutate the transition map at runtime; it is a frozen constant.

## Verification
- `npm run build` green.
- Scratch: construct at `Starting`; `transition(Running)` succeeds and fires the
  listener with `(Starting, Running)`.
- Scratch: from `Starting`, `transition(Stopping)` is allowed, but
  `transition(Running)` from `Stopping` throws.
- Scratch: `transition(Running)` while already `Running` does not throw and does
  not fire the listener.
- `npm test` still green.
