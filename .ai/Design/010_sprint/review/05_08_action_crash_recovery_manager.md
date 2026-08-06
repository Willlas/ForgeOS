# Action 05_08 — Crash recovery manager (restart + backoff + cap)

## Objective
Create a `CrashRecoveryManager` that decides whether and when to restart the
daemon after a crash, using exponential backoff (05_03) and a hard `maxRetries`
cap. It consumes `onCrash` events from the crash detector (05_07) and drives an
injected `restartFn`, so the restart *mechanism* (spawning a new daemon) stays in
`@aer/cli` while the *policy* lives here.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 05_10 (the supervisor wires this manager to the detector + the
  spawn function).

## Why it matters
Design 05 §"Public Interfaces" requires `CrashRecoveryManager.start(maxRetries,
initialBackoffMs)`, `stop()`, and `recordCrash()`, and the DoD requires *"Crashed
daemon automatically restarts (with max retry limit to prevent infinite loops)."*
Today `restartDaemon()` (`daemon.ts:64-67`) is manual only and there is no cap or
backoff, so a crash-looping daemon would either never restart or restart
forever. This manager makes the policy explicit, tested, and loop-safe.

## Prerequisites
- **05_03** (backoff calculator) — `computeBackoffDelay` + `shouldRetry`.
- **05_07** (crash detector) — the manager subscribes to `onCrash`.
- **05_01** (lifecycle types) — `BackoffPolicy`, `RestartDecision`.

## Steps
1. Create `packages/runtime/src/core/lifecycle/crash-recovery-manager.ts`.
2. Export a `CrashRecoveryManager` class constructed with:
   - `restartFn: () => Promise<void>` — injected; the actual spawn (wired in
     05_10). Injected so tests count calls without spawning.
   - optional `policy: BackoffPolicy` (default `DEFAULT_BACKOFF_POLICY`).
   - optional `logger`.
3. `start(maxRetries: number, initialBackoffMs?: number): void` — store
   `maxRetries`, reset the attempt counter to 0, and mark the manager active.
   (This does **not** subscribe to the detector — the caller wires `detector.onCrash`
   to `recordCrash` so the manager stays decoupled from the detector type. See
   05_10.)
4. `async recordCrash(detectedPid?: number): Promise<void>` — the core policy:
   a. If not active, return.
   b. Increment the attempt counter.
   c. If `shouldRetry(attempt, maxRetries)` is false: log "max retries reached",
      transition (via an injected optional `onGiveUp` callback) and return
      without restarting.
   d. Otherwise compute `delayMs = computeBackoffDelay(attempt, policy)`,
      `await new Promise(r => setTimeout(r, delayMs))`, then `await restartFn()`.
      Catch and log `restartFn` failures — a failed restart consumes the attempt
      but does not crash the manager.
5. `stop(): void` — mark inactive and clear any in-flight backoff timer if one is
   pending (store the timer handle so `stop` can cancel a pending restart).
6. `getAttemptCount(): number` — return the current attempt counter (for tests +
   observability).

## Files
- **NEW** `packages/runtime/src/core/lifecycle/crash-recovery-manager.ts`
- **DEPENDS ON** `./types.js`, `./backoff.js`
- **READ-ONLY** `packages/runtime/src/dispatcher.ts` (backoff formula reference
  L349)

## Constraints
- The restart **mechanism is injected** (`restartFn`) — never import `@aer/cli`
  or spawn here. The manager owns *policy* only.
- **Hard cap is mandatory** — once `attempt > maxRetries`, never restart again
  until `start` is called again (resets the counter). This prevents infinite
  restart loops (a core DoD requirement).
- The backoff `setTimeout` between attempts must be **cancellable** by `stop()`,
  so shutting the supervisor down does not leave a pending restart firing later.
- `restartFn` failure must be caught — it should consume the attempt (counter
  already incremented) and let the next crash try again, subject to the cap.
- `recordCrash` is `async` and the caller may `await` it; ensure re-entrancy is
  safe (a second crash while a backoff is pending should not start a second
  parallel restart — guard with an `inFlight` flag).
- Never throw out of `recordCrash` — catch internally and log.

## Verification
- `npm run build` green.
- Scratch (fake timers + a counting `restartFn`): call `start(3)`; fire
  `recordCrash` four times. The first three each wait their backoff then call
  `restartFn` (count 3); the fourth returns without calling it (cap reached).
- Scratch: `getAttemptCount()` equals 4 after the above.
- Scratch: `stop()` during a pending backoff cancels the restart (the counting
  `restartFn` is not invoked).
- Scratch: a `restartFn` that rejects does not throw out of `recordCrash` and the
  attempt counter still advances.
- `npm test` still green.
