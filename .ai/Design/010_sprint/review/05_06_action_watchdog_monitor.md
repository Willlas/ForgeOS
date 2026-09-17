# Action 05_06 — Watchdog monitor

## Objective
Create a `WatchdogMonitor` that periodically probes the Runtime/daemon health and,
after `N` consecutive failed or timed-out probes, fires `onUnresponsive`. This is
the daemon-level counterpart to the existing worker-level watchdog
(`worker-runtime.ts:252-354`): it watches the whole process, not individual
workers.

## Backlog reference
- **Severity:** High
- **Blocks:** 05_09 (the daemon may register the watchdog and react to
  unresponsiveness), and 05_10 (the supervisor can treat unresponsive as a
  crash trigger).

## Why it matters
Design 05 §"Public Interfaces" requires `WatchdogMonitor.start(intervalMs,
timeoutMs)` and `onUnresponsive(callback)`, and the DoD requires *"Watchdog
detects unresponsive Runtime and triggers restart or alert."* Today the Runtime's
own `performHealthCheck()` (`runtime.ts:563-600`) only *logs* warnings and takes
no action; there is no mechanism to detect a hung daemon (event loop stalled,
probe never returns). The watchdog turns "silent hang" into an actionable signal.

## Prerequisites
- **05_02** (state machine) — the watchdog reads `getState()` to decide whether
  to probe (no point probing when already `Stopping`/`Crashed`).

## Steps
1. Create `packages/runtime/src/core/lifecycle/watchdog-monitor.ts`.
2. Export a `WatchdogMonitor` class constructed with:
   - `stateMachine: LifecycleStateMachine`
   - `probe: () => Promise<boolean>` — injected health probe returning `true` for
     healthy, `false` (or throwing / timing out) for unhealthy. **Injected** so
     tests can simulate failure without a real Runtime.
   - optional `logger` (default `console`).
3. `start(intervalMs: number, timeoutMs: number, failureThreshold = 3): void`:
   - Store an `unresponsive` callback registry.
   - Schedule a `setInterval(intervalMs)` that, on each tick:
     a. If the FSM state is `Stopping`, `Crashed`, or `Restarting`, skip the tick
        (no false alarms during shutdown/restart).
     b. Race `probe()` against a `setTimeout(timeoutMs)`; if the probe rejects,
        resolves `false`, or the timeout wins, increment a consecutive-failure
        counter; otherwise reset it to 0.
     c. When the counter reaches `failureThreshold`, invoke every registered
        `onUnresponsive` callback **once** (and reset the counter so it can fire
        again after a recovery gap).
4. `onUnresponsive(cb: () => void): () => void` — register a listener, return an
   unsubscribe function (mirror the FSM's `onStateChange` convention).
5. `stop(): void` — `clearInterval` the timer and set it to null. Make `start`
   idempotent: calling `start` while running first stops the previous timer.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/watchdog-monitor.ts`
- **DEPENDS ON** `./types.js`, `./lifecycle-state-machine.js`
- **READ-ONLY** `packages/runtime/src/worker-runtime.ts` (worker watchdog pattern
  L252-354 — heartbeat + missed-count threshold), `packages/runtime/src/core/runtime.ts`
  (`performHealthCheck` L563-600)

## Constraints
- The health probe is **injected**, not hard-coded — the module must not import
  `Runtime` or `@aer/cli`. This keeps it unit-testable with fake timers and a
  stub probe.
- Do **not** `unref()` the interval timer in production code — the watchdog
  should keep the daemon alive (it is a liveness monitor). Tests will use
  vitest's fake timers, so this is fine.
- A single fluke failure must **not** fire `onUnresponsive` — require
  `failureThreshold` consecutive failures (default 3).
- Skip probing while the FSM is in a terminal/transition state (`Stopping`,
  `Crashed`, `Restarting`) to avoid false alarms during an orderly shutdown.
- The probe-vs-timeout race must clean up the losing timer (clear it) to avoid
  leaking handles.
- Never throw out of the interval callback — catch probe/race errors internally
  and count them as a failure.

## Verification
- `npm run build` green.
- Scratch (fake timers): probe returns `false` 3× in a row at `intervalMs`;
  after the 3rd tick `onUnresponsive` fires exactly once; a recovery (`true`)
  resets the counter.
- Scratch (fake timers): probe hangs; with `timeoutMs` shorter than the probe
  resolution, the failure counter increments.
- Scratch: while FSM is `Stopping`, the interval ticks but the probe is not
  called and `onUnresponsive` does not fire.
- Scratch: `start` twice — the first interval is cleared (only one timer runs).
- `npm test` still green.
