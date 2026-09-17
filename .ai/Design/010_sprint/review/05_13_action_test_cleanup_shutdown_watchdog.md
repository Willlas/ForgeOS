# Action 05_13 — Tests: cleanup coordinator + shutdown handler + watchdog

## Objective
Add unit tests for the three lifecycle modules that involve async, timers, or
both: the `CleanupCoordinator` (05_04), the `GracefulShutdownHandler` (05_05),
and the `WatchdogMonitor` (05_06). These are the "resilience core" — best-effort
cleanup, timeout-bounded shutdown, consecutive-failure detection.

## Backlog reference
- **Severity:** High (DoD-required)
- **Blocks:** Nothing.

## Why it matters
Design 05 DoD requires unit coverage of *"graceful shutdown, … watchdog timeout,
resource cleanup."* These modules carry the most failure-prone behavior
(rethrows, deadlines, interval polling), so pinning them with fake-timer tests is
where regression protection pays off most. The cleanup coordinator also owns the
IPC-socket-unlink path that closes the orphan-resource gap — it must be tested.

## Prerequisites
- **05_04** (cleanup coordinator), **05_05** (graceful shutdown handler),
  **05_06** (watchdog) complete. **05_01**/**05_02** complete (types + FSM used
  to construct the handler).

## Steps
1. Create `cleanup-coordinator.test.ts` covering:
   - Three registered cleanups run in registration order (record an array).
   - If the middle cleanup throws/rejects, `execute()` still resolves, the third
     runs, and `getFailures()` reports exactly the middle one with its name.
   - Registering the same `name` twice keeps only the latest function (the first
     is not invoked).
   - `createIpcSocketCleanup(path)` on a missing path resolves without throwing
     (use a temp dir).
2. Create `graceful-shutdown-handler.test.ts` covering (use `vi.useFakeTimers`
   and a stub `CleanupCoordinator`):
   - `trigger("sigterm")` with a coordinator that resolves fast transitions the
     FSM to `Stopping` and resolves without force-exit (assert `process.exit` was
     **not** called — spy/stub it).
   - Idempotency: a second `trigger` while the first is in flight does not
     re-run cleanup (count coordinator `execute` calls).
   - Deadline: when cleanup hangs, advancing fake timers past `timeoutMs` triggers
     the force-exit path (assert the exit-code path is reached; do this by
     spying on the module's exit hook or by injecting an `onExit` callback if the
     implementation supports it — prefer the injected callback so no real
     `process.exit` runs in the test).
   - `dispose()` removes all four `process` listeners (assert listener counts
     before/after).
3. Create `watchdog-monitor.test.ts` covering (fake timers + injected `probe`):
   - A probe returning `true` never fires `onUnresponsive`.
   - A probe returning `false` `failureThreshold` times in a row fires
     `onUnresponsive` exactly once; a subsequent `true` resets the counter.
   - A probe that never settles is treated as failure once `timeoutMs` elapses.
   - While the FSM is `Stopping`, ticks do not call the probe and do not fire.
   - `start` called twice clears the first interval (only one poll loop runs).
4. Follow the existing convention: explicit `vitest` imports, `.js` relative
   specifiers, `describe`/`it`, banner dividers. Use `vi.useFakeTimers()` /
   `vi.useRealTimers()` around timer-dependent tests.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/cleanup-coordinator.test.ts`
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/graceful-shutdown-handler.test.ts`
- **NEW** `packages/runtime/src/core/lifecycle/__tests__/watchdog-monitor.test.ts`
- **READ-ONLY** `packages/runtime/src/persistence/__tests__/*.test.ts`
  (convention reference)

## Constraints
- **Never call the real `process.exit` in tests.** If the handler (05_05) is
  implemented to call `process.exit` directly on the deadline, have 05_05 accept
  an injectable `onExit` (or test via a child process) — but prefer the design in
  05_05 where `trigger` does not exit and only the deadline does; then stub the
  deadline's exit hook. Coordinate the seam with 05_05 if needed.
- Restore real timers in `afterEach` (`vi.useRealTimers()`) so tests do not leak.
- Use injected probes/stubs — do not construct a real `Runtime` in these tests.
- Use relative `.js` imports (not the package barrel).
- Keep cleanup-coordinator tests free of timers (that file is pure async).

## Verification
- `npm run build` green.
- `npm test` green, with all three new files passing.
- `npx vitest run packages/runtime/src/core/lifecycle/__tests__` passes and no
  timer-based test leaks (no "open handles" warning).
- The deadline test proves the force-exit path is reachable when cleanup hangs.
