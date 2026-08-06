# Action 05_12 — Tests: lifecycle state machine + backoff

## Objective
Add the unit-test suite for the pure-logic foundation modules: the
`LifecycleStateMachine` (05_02) and the backoff calculator (05_03). These are
side-effect-free, so no timers or temp dirs are needed — the tests are plain
assertions, the fastest and easiest entry point into the lifecycle test surface.

## Backlog reference
- **Severity:** High (DoD-required — "Unit tests cover … lifecycle")
- **Blocks:** Nothing.

## Why it matters
Design 05 DoD requires *"Unit tests cover: graceful shutdown, crash restart loop
prevention, watchdog timeout, resource cleanup"* — and the state machine + backoff
calculator underpin all of those. Testing them first, in isolation, locks the
transition map and the backoff formula before the async/timer-dependent modules
build on them. The existing `persistence/__tests__/*.test.ts` files set the
convention to follow.

## Prerequisites
- **05_02** (state machine) and **05_03** (backoff) complete.

## Steps
1. Create the test directory `packages/runtime/src/core/lifecycle/__tests__/`.
2. Create `lifecycle-state-machine.test.ts` covering:
   - Default initial state is `Starting`; custom initial state honored.
   - Each allowed transition succeeds and `getState()` reflects the target (e.g.
     `Starting → Running`, `Running → Crashed → Restarting → Running`).
   - Listeners fire with `(from, to)` on a real change, in registration order.
   - An unsubscribe function returned by `onStateChange` stops further callbacks.
   - Illegal transitions **throw** and name both states (e.g. `Stopping → Running`).
   - Same-state transition (`Running → Running`) is a no-op and does **not** fire
     listeners.
   - A listener that throws does not prevent the state change or other listeners.
3. Create `backoff.test.ts` covering:
   - With `jitter: false`, `computeBackoffDelay(1)` === `initialDelayMs` and
     `computeBackoffDelay(n)` === `initialDelayMs * multiplier^(n-1)`.
   - The result is clamped to `maxDelayMs` for large attempts.
   - With `jitter: true`, the result is in `[0, clampedBase]` (stub
     `Math.random` to fixed values and assert the bounds).
   - `shouldRetry(attempt, maxRetries)` boundary: `true` at `attempt === maxRetries`,
     `false` one beyond.
   - Defensive inputs: `attempt < 1` normalizes to attempt 1; a negative policy
     field falls back to the default and the function does not throw.
4. Follow the existing convention exactly: `import { describe, it, expect,
   beforeEach } from "vitest"`, relative `.js` specifiers
   (`from "../lifecycle-state-machine.js"`), top-level `describe("<Module>")`
   with nested `describe("<behavior>")` + `it("should ...")`.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/lifecycle-state-machine.test.ts`
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/backoff.test.ts`
- **READ-ONLY** `packages/runtime/src/persistence/__tests__/state-store.test.ts`
  (convention reference)

## Constraints
- **No timers, no I/O, no temp dirs** in these two files — both modules are pure.
  Do not import `beforeEach`/`afterEach` you do not need.
- Use relative `.js` imports from the test files to the modules under test (do
  not import via `@aer/runtime-lib` — keeps these tests independent of the barrel
  in 05_11).
- Do not test private internals (the transition map) directly — assert behavior
  via `transition`/`getState`/listeners.
- Keep each `it` focused on one assertion group; mirror the existing files' use
  of banner-comment dividers.

## Verification
- `npm run build` green.
- `npm test` green, with the new files included and passing.
- `npx vitest run packages/runtime/src/core/lifecycle/__tests__` runs only these
  two files and they pass.
- No new flaky behavior (jitter tests pin `Math.random`).
