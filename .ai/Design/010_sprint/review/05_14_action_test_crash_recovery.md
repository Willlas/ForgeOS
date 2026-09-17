# Action 05_14 — Tests: crash detector + crash recovery manager

## Objective
Add unit tests for the crash-detection + restart-policy pair: `CrashDetector`
(05_07) and `CrashRecoveryManager` (05_08). These prove the two DoD-critical
guarantees — a crash is detected exactly once, and the restart loop is bounded
by `maxRetries` with backoff.

## Backlog reference
- **Severity:** High (DoD-required — "crash restart loop prevention")
- **Blocks:** Nothing.

## Why it matters
Design 05 DoD requires *"Unit tests cover … crash restart loop prevention"* and
the manual test *"kill -9 → verify auto-restart → verify max retry cap."* The
loop-prevention guarantee is a safety property — without it a crash-looping
daemon could restart forever. Pinning `maxRetries` and the single-fire `onCrash`
behavior in a fast, deterministic test (no real processes) is the cheapest way
to guarantee it.

## Prerequisites
- **05_07** (crash detector) and **05_08** (crash recovery manager) complete.
  **05_01**/**05_02**/**05_03** complete (types, FSM, backoff used internally).

## Steps
1. Create `crash-detector.test.ts` (fake timers + injected `readPid`/`isAlive`):
   - `readPid` returns a fixed PID, `isAlive` returns `true` for one tick then
     `false`: `onCrash` fires exactly once with that PID.
   - Subsequent dead ticks do **not** re-fire (single emission per crash).
   - After the crash, if `isAlive` returns `true` again (restart) then `false`,
     `onCrash` fires a second time (re-arm behavior).
   - `readPid` returning `<= 0` never fires `onCrash`.
   - An unsubscribe returned by `onCrash` stops further callbacks.
   - `start` called twice runs only one poll loop.
2. Create `crash-recovery-manager.test.ts` (fake timers + a counting `restartFn`):
   - `start(3)` then call `recordCrash()` four times: `restartFn` is invoked
     three times (one per backoff), the fourth is a no-op (cap reached). Use
     `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync` to fast-forward each
     backoff.
   - `getAttemptCount()` equals 4 after the above.
   - `stop()` during a pending backoff cancels the restart (`restartFn` count
     unchanged on the next advance).
   - A `restartFn` that rejects does not throw out of `recordCrash`, and the
     attempt counter still advances (failed restart consumes the attempt).
   - Re-entrancy: a second `recordCrash` while a backoff is pending does not
     start a second parallel `restartFn` (guard via the `inFlight` flag).
   - Backoff delays respect the policy: with `jitter: false`, the wait before
     attempt N matches `computeBackoffDelay(N)`.
3. Follow the existing convention: explicit `vitest` imports, `.js` relative
   specifiers, `describe`/`it`, banner dividers. Restore real timers in
   `afterEach`.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/crash-detector.test.ts`
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/crash-recovery-manager.test.ts`
- **READ-ONLY** `packages/runtime/src/persistence/__tests__/*.test.ts`
  (convention reference)

## Constraints
- **No real processes, no real PID files** — inject `readPid`/`isAlive`/`restartFn`
  stubs. The whole point is determinism.
- Always `vi.useRealTimers()` in `afterEach` to avoid leaking fake timers.
- Assert the **cap is a hard stop** — after `maxRetries`, no further `restartFn`
  calls regardless of how many more `recordCrash` invocations arrive, until
  `start` resets the counter.
- Use relative `.js` imports (not the package barrel).
- Do not test the real `daemon.ts` wiring here — that is manual (see 05_10
  Verification); these tests cover the library modules only.

## Verification
- `npm run build` green.
- `npm test` green, with both new files passing.
- `npx vitest run packages/runtime/src/core/lifecycle/__tests__` passes with no
  open-handle warnings (timers restored, intervals stopped in tests).
- The cap test proves `restartFn` is called at most `maxRetries` times.
