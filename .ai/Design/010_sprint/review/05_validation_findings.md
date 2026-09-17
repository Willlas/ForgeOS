# Objective

Convert the validation findings between the **Design 05 (Process Lifecycle
Management)** contract and its current implementation into a structured,
pass/fail gap-analysis document, **and** decompose the resulting work into a
sequence of small, self-contained tasks that a modest coding model (qwen3.6) can
execute one at a time. Design 05
(`.ai/Design/010_sprint/05_process_lifecycle_management.md`) is the authoritative
contract; the implemented code in `packages/cli/src/` (`daemon-entry.ts`,
`daemon.ts`) and `packages/runtime/src/core/runtime.ts` is the subject under
evaluation. The fourteen action plans `05_01`…`05_14` (in this folder) define the
work package; this document records compliance against each action and against the
Design's Acceptance Criteria / Definition of Done, then lists the concrete tasks.

No source code is changed by this document.

> **Headline:** Unlike Design 04 (which consolidated pre-existing, duplicated PID
> logic and shipped largely compliant), Design 05 is **entirely greenfield**. None
> of the five lifecycle modules exist. Every action `05_01`…`05_14` is
> **Not Started**. The fourteen action plans are each already sized to touch
> exactly one file, so they map one-to-one onto the tasks below; the test actions
> are split per file for digestibility.

# Current State

Design 05 has **not been started**. The `packages/runtime/src/core/lifecycle/`
directory does not exist; there are no lifecycle modules, no lifecycle barrel
exports, and no lifecycle tests. The daemon and supervisor files carry only the
Design-04 persistence wiring.

**What exists today (the substrate Design 05 builds on):**

- **Daemon entry point** (`packages/cli/src/daemon-entry.ts`): registers
  **SIGINT/SIGTERM only** (`L130-131`) plus a **duplicate** pair inside the
  keep-alive promise (`L215-216`). `shutdown()` (`L87-125`) is synchronous,
  idempotent via one `let shutdownExecuted` flag (declared *after* the function
  that reads it — `L128`), has **no timeout**, **never calls `runtime.stop()`**,
  and exits via `healthServer.close(() => process.exit(0))` which can hang
  forever if the callback never fires. There is **no `uncaughtException` and no
  `unhandledRejection` handler anywhere in the repo**. The fatal path
  (`main().catch`, `L224-241`) writes an error snapshot and `process.exit(1)`,
  bypassing any cleanup coordinator.
- **Supervisor** (`packages/cli/src/daemon.ts`): `startDaemon` (`L31-50`) spawns
  detached + `unref()` and writes the PID; there are **no `exit`/`error`
  listeners** on the child — it is fire-and-forget. `restartDaemon()` (`L64-67`)
  is manual only (no cap, no backoff). `stopDaemon()` (`L52-62`) sends SIGTERM
  with no wait, no escalation.
- **IPC socket** (`packages/runtime/src/ipc-transport.ts`): `listen()` unlinks
  the socket path pre-bind (`L41`, `fs.unlink(address, () => {})`) — but
  `close()` (`L64-74`) **only destroys the socket/server**; the `.sock` file is
  **never unlinked on shutdown** → orphaned resource on every clean stop.
  `getIpcSocketPath()` is exported (`L12-16`, `<tmpdir>/aer-daemon.sock`).
- **Runtime state** (`packages/runtime/src/core/runtime.ts`): an ad-hoc
  `RuntimeState` enum (`L29-37`) carries `Starting/Running/Stopping/Stopped` but
  **no `Crashed`, no `Restarting`**, no FSM guard, no listeners. `stop()`
  (`L218-258`) owns subsystem teardown. `performHealthCheck()` (`L563-600`) only
  *logs* warnings and takes no action.
- **Design-04 surface reused by Design 05** (already shipped from
  `@aer/runtime-lib`): `pid-manager.ts` (`isPidAlive`, `isStale`, `cleanupStale`,
  `readPidFile`, `validatePid`), `state-store.ts`, `health-check.ts`
  (`checkHealth` + `stalePidFile`). Backoff math exists inline at
  `dispatcher.ts:349` (`initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)`)
  as a reuse pattern.
- **Barrel** (`packages/runtime/src/index.ts`): the persistence surface is
  re-exported; there are **no lifecycle exports** yet.

**Design 05 Acceptance Criteria — pass status:**

| #  | Criterion | Status |
|----|-----------|--------|
| AC1 | Daemon handles SIGINT, SIGTERM, and unhandled exceptions with graceful shutdown | **Fail** — only SIGINT/SIGTERM registered; no uncaught/unhandled handler |
| AC2 | Graceful shutdown completes or fails within a configurable timeout | **Fail** — `shutdown()` has no timeout; `healthServer.close()` can hang forever |
| AC3 | Crashed daemon automatically restarts (with max retry limit) | **Fail** — supervisor is fire-and-forget; `restartDaemon` is manual, no cap/backoff |
| AC4 | Watchdog detects unresponsive Runtime and triggers restart or alert | **Fail** — no daemon-level watchdog exists (only a worker-level one) |
| AC5 | All resources (IPC listeners, PID file, temp files) cleaned up on exit | **Partial** — PID + snapshot removed; the IPC `.sock` is orphaned |
| AC6 | Shutdown logs written before process terminates | **Partial** — `console.log` lines exist, but not via a structured handler with guaranteed ordering |
| AC7 | In-flight operations completed or safely aborted during shutdown | **Fail** — no drain step; `runtime.stop()` is never invoked |

**Design 05 Definition of Done — gaps:** every DoD item is unsatisfied because
the implementation has not begun — no signal handlers beyond SIGINT/SIGTERM, no
graceful sequence, no crash detection/auto-restart, no watchdog, no clean-exit
guarantee for the IPC socket, no unit tests, no manual test. See the per-action
table and the task list.

# Per-Action Findings (05_01 → 05_14)

All fourteen actions are **Not Started**: the target files do not exist and the
behaviors they specify are absent. Each row confirms the gap against the live
codebase.

| Action | Status | Reason | Evidence |
|--------|--------|--------|----------|
| **05_01** Lifecycle types module | **Not Started** | No `packages/runtime/src/core/lifecycle/types.ts`. The only lifecycle-ish types are the ad-hoc `RuntimeState` enum (`runtime.ts:29-37`), which lacks `Crashed`/`Restarting` and has no `ShutdownContext`/`BackoffPolicy`. | `runtime.ts:29-37`; no `lifecycle/` dir |
| **05_02** Lifecycle state machine (FSM) | **Not Started** | No FSM, no transition guard, no listeners. State is mutated ad-hoc throughout `runtime.ts`. | `runtime.ts` (state field writes); no `lifecycle-state-machine.ts` |
| **05_03** Backoff calculator | **Not Started** | No `backoff.ts`. The formula exists only inline at `dispatcher.ts:349`, dispatch-specific. | `dispatcher.ts:349` |
| **05_04** Cleanup coordinator | **Not Started** | No registry, no `execute(ctx)`, no `createIpcSocketCleanup`. Cleanup is split-brain between `runtime.stop()` and `daemon-entry.ts:87-125`. IPC `.sock` never unlinked. | `daemon-entry.ts:87-125`; `ipc-transport.ts:64-74` |
| **05_05** Graceful shutdown handler | **Not Started** | No handler class; no `uncaughtException`/`unhandledRejection`; no timeout; `shutdown()` exits via `healthServer.close()` callback (can hang). | `daemon-entry.ts:87-131` |
| **05_06** Watchdog monitor | **Not Started** | No daemon-level watchdog. A worker-level watchdog exists (`worker-runtime.ts`) but watches individual workers, not the daemon process. | `worker-runtime.ts`; absence of `watchdog-monitor.ts` |
| **05_07** Crash detector | **Not Started** | No PID-liveness polling emitter. Supervisor does no monitoring after `unref()`. Reusable primitives (`isPidAlive`, `readPidFile`) do exist. | `daemon.ts:40-49` |
| **05_08** Crash recovery manager | **Not Started** | No restart policy, no backoff, no `maxRetries` cap. `restartDaemon()` is manual. | `daemon.ts:64-67` |
| **05_09** Wire daemon shutdown | **Not Started** | `daemon-entry.ts` still uses the hand-rolled `shutdown()`; `runtime.stop()` is never called; the IPC socket is not unlinked; duplicate signal handlers remain. | `daemon-entry.ts` (full) |
| **05_10** Wire supervisor restart | **Not Started** | `startDaemon` spawns + `unref()` with no `exit`/`error` listeners; no detector/recovery wiring. | `daemon.ts:31-50` |
| **05_11** Expose lifecycle API (barrel) | **Not Started** | No "Lifecycle exports" block in `packages/runtime/src/index.ts`. Lifecycle symbols are unreachable from `@aer/runtime-lib`. | `packages/runtime/src/index.ts` |
| **05_12** Tests: state machine + backoff | **Not Started** | No `packages/runtime/src/core/lifecycle/__tests__/`. | absence of test dir |
| **05_13** Tests: cleanup + shutdown + watchdog | **Not Started** | (same) | absence of test dir |
| **05_14** Tests: crash detector + recovery | **Not Started** | (same) | absence of test dir |

# Remaining Work

Because Design 05 is entirely greenfield, the work **is** the fourteen action
plans. They are decomposed below into **single-file tasks** so a modest coding
model (qwen3.6) can complete each in isolation. There is no cap on task count —
the priority is that each task is self-contained, has one clear file as its
output, and can be verified by `npm run build` plus a targeted check.

> **How to use this list:** tasks are ordered by dependency (foundation first,
> then modules, then barrel, then the two integrations, then tests). Each task
> carries the **action plan** it implements — that plan is the detailed spec; the
> row here is the quick-reference contract (Why / Outcome / Components / Deps /
> Complexity / Verification). qwen3.6 should read the cited action plan before
> starting the task. Tests are interleaved right after their module (rather than
> batched at the end) so the model verifies each module immediately while context
> is fresh.

---

## Task 1 — Lifecycle types module  ·  *(action 05_01, S)*

- **Why it is needed:** Every other lifecycle module imports `LifecycleState`,
  `ShutdownContext`, `BackoffPolicy`, `DEFAULT_BACKOFF_POLICY`, `RestartDecision`.
  Centralizing them in one pure-types file prevents drift and is the dependency
  root. Today only the unrelated `RuntimeState` enum exists (`runtime.ts:29-37`).
- **Expected outcome:** New file
  `packages/runtime/src/core/lifecycle/types.ts` exporting the `LifecycleState`
  enum (`Starting/Running/Stopping/Crashed/Restarting`, string-valued, casing
  matching `RuntimeState`), the `ShutdownReason` union, the `ShutdownContext` /
  `BackoffPolicy` interfaces, `DEFAULT_BACKOFF_POLICY`
  (`{initialDelayMs:1000, maxDelayMs:30000, multiplier:2, jitter:true}`), and the
  `RestartDecision` type. No runtime functions beyond the constant. No imports
  from other lifecycle files.
- **Components involved:** NEW `packages/runtime/src/core/lifecycle/types.ts`.
- **Dependencies:** None (first task; Design 04 complete).
- **Verification:** `npm run build` green; scratch import resolves all exports;
  `DEFAULT_BACKOFF_POLICY` type-checks against `BackoffPolicy`.
- **Complexity:** **S** — pure types + one constant.

## Task 2 — Backoff calculator  ·  *(action 05_03, S)*

- **Why it is needed:** The crash-recovery manager (Task 8) needs a tested
  exponential-backoff formula with a cap and full jitter. The math exists inline
  at `dispatcher.ts:349` but is dispatch-specific; extracting it makes the
  formula reusable and trivially testable.
- **Expected outcome:** New file
  `packages/runtime/src/core/lifecycle/backoff.ts` exporting pure
  `computeBackoffDelay(attempt, policy = DEFAULT_BACKOFF_POLICY): number`
  (`initialDelayMs * multiplier^(attempt-1)`, clamped to `maxDelayMs`, then full
  jitter in `[0, clamped]` when `policy.jitter`) and
  `shouldRetry(attempt, maxRetries): boolean`. Never throws (normalizes `attempt<1`
  to 1, falls back to defaults on non-finite/negative fields).
- **Components involved:** NEW `.../lifecycle/backoff.ts`; depends on `./types.js`.
- **Dependencies:** Task 1.
- **Verification:** `npm run build` green; with `jitter:false`,
  `computeBackoffDelay(1)===initialDelayMs`; result never exceeds `maxDelayMs`;
  `shouldRetry` boundary correct.
- **Complexity:** **S** — pure functions, no I/O.

## Task 3 — Lifecycle state machine (FSM)  ·  *(action 05_02, S)*

- **Why it is needed:** The shutdown handler, watchdog, and crash detector all
  query/transition a shared lifecycle state. Today state is mutated ad-hoc with no
  guard, so illegal transitions (e.g. `Crashed → Running` without `Restarting`)
  are silent.
- **Expected outcome:** New file
  `.../lifecycle/lifecycle-state-machine.ts` exporting a `LifecycleStateMachine`
  class: `getState()`, `transition(next)` (throws on illegal transitions naming
  both states; `X→X` is a silent no-op), `onStateChange(cb)` (returns unsubscribe;
  per-listener try/catch). A frozen module-level transition map per the action
  plan. Pure synchronous logic — no timers/fs/process.
- **Components involved:** NEW `.../lifecycle/lifecycle-state-machine.ts`; depends
  on `./types.js`.
- **Dependencies:** Task 1.
- **Verification:** `npm run build` green; `Starting→Running` succeeds and fires
  listener with `(Starting, Running)`; `Stopping→Running` throws;
  `Running→Running` is a no-op that does not fire.
- **Complexity:** **S** — pure synchronous logic.

## Task 4 — Cleanup coordinator  ·  *(action 05_04, M)*

- **Why it is needed:** Shutdown cleanup is split-brain (`runtime.stop()` vs
  `daemon-entry.ts:87-125`) and the IPC `.sock` is never unlinked. A single
  ordered, best-effort registry closes the orphan gap and gives the shutdown
  handler one resilient sequence to drive.
- **Expected outcome:** New file
  `.../lifecycle/cleanup-coordinator.ts` exporting `CleanupCoordinator`
  (`registerResource(name, cleanup)` idempotent by `name`;
  `async execute(ctx)` runs cleanups in **registration order**, await each,
  try/catch each, **never rethrows**; `getFailures()` returns the last run's
  failures) and a factory `createIpcSocketCleanup(socketPath)` that
  `fs.promises.unlink`s the path, ignoring `ENOENT`.
- **Components involved:** NEW `.../lifecycle/cleanup-coordinator.ts`; depends on
  `./types.js`. READ-ONLY `ipc-transport.ts:12-16,64-74`.
- **Dependencies:** Task 1.
- **Verification:** `npm run build` green; 3 cleanups where the middle throws →
  `execute()` resolves, the third runs, `getFailures()` reports exactly the
  middle one; `createIpcSocketCleanup` on a missing path resolves without
  throwing.
- **Complexity:** **M** — async best-effort teardown + file I/O helper.

## Task 5 — Test: state machine + backoff  ·  *(action 05_12, S)*

- **Why it is needed:** Lock the transition map and the backoff formula with fast,
  deterministic tests before the async/timer modules build on them. DoD-required.
- **Expected outcome:** New test dir
  `.../lifecycle/__tests__/` with two files:
  `lifecycle-state-machine.test.ts` (default/custom initial state; each allowed
  transition; listeners fire in order + unsubscribe works; illegal transitions
  throw naming both states; `X→X` no-op; a throwing listener does not block
  others) and `backoff.test.ts` (no-jitter formula + clamp; jitter bounds with
  `Math.random` stubbed; `shouldRetry` boundary; defensive inputs). Follow the
  existing `persistence/__tests__` convention (vitest, relative `.js` imports,
  banner dividers). **No timers, no I/O.**
- **Components involved:** NEW `.../lifecycle/__tests__/lifecycle-state-machine.test.ts`,
  NEW `.../lifecycle/__tests__/backoff.test.ts`.
- **Dependencies:** Tasks 2, 3.
- **Verification:** `npm test` green; `npx vitest run
  packages/runtime/src/core/lifecycle/__tests__` passes; jitter tests pin
  `Math.random`.
- **Complexity:** **S** — pure-logic assertions.

## Task 6 — Graceful shutdown handler  ·  *(action 05_05, M)*

- **Why it is needed:** AC1/AC2 require handling SIGINT/SIGTERM **plus**
  `uncaughtException`/`unhandledRejection` with a hard timeout that force-exits if
  cleanup hangs. Today there is no such handler and no timeout; a hung
  `healthServer.close()` wedges the process forever.
- **Expected outcome:** New file
  `.../lifecycle/graceful-shutdown-handler.ts` exporting `GracefulShutdownHandler`
  (constructed with a `CleanupCoordinator`, a `LifecycleStateMachine`, optional
  logger): `initialize(timeoutMs)` registers the four `process` handlers (keeping
  references for `dispose()`); `async trigger(reason, error?)` is idempotent
  (instance flag), builds a `ShutdownContext`, transitions FSM to `Stopping`
  (try/catch), arms a deadline `setTimeout(() => exit, timeoutMs)`,
  `await coordinator.execute(ctx)`, clears the deadline, logs `getFailures()` /
  transitions to `Crashed` on error, and **resolves without calling
  `process.exit`** in the success path (the deadline is the only force-exit
  point, keeping it unit-testable); `dispose()` removes the four listeners +
  clears the timer. Export pure `exitCodeFor(reason)` (0 for signal/explicit/
  timeout, 1 for uncaught/unhandled/fatal).
- **Components involved:** NEW `.../lifecycle/graceful-shutdown-handler.ts`;
  depends on `./types.js`, `./lifecycle-state-machine.js`,
  `./cleanup-coordinator.js`.
- **Dependencies:** Tasks 3, 4.
- **Verification:** `npm run build` green; fast-cleanup `trigger("sigterm")`
  resolves with FSM `Stopping` and no exit; hanging cleanup + short timeout
  force-exits (child-process test); double `trigger` runs cleanup once;
  `dispose()` drops the four listeners.
- **Complexity:** **M** — async, deadlines, listener lifecycle. *(The plan
  prefers an injectable `onExit`/exit seam so the deadline path is testable
  without a real `process.exit` — qwen3.6 should add that seam rather than
  calling `process.exit` directly.)*

## Task 7 — Test: graceful shutdown handler  ·  *(action 05_13 part, M)*

- **Why it is needed:** Pin the idempotency and deadline guarantees (DoD) with
  fake timers and a stub coordinator before the daemon depends on it.
- **Expected outcome:** New file
  `.../lifecycle/__tests__/graceful-shutdown-handler.test.ts` using
  `vi.useFakeTimers()` + a stub `CleanupCoordinator`: fast cleanup → FSM
  `Stopping`, no exit; idempotency (second in-flight `trigger` does not re-run
  `execute`); deadline (hang + advance past `timeoutMs` reaches the exit seam);
  `dispose()` drops all four listeners. `vi.useRealTimers()` in `afterEach`.
- **Components involved:** NEW `.../lifecycle/__tests__/graceful-shutdown-handler.test.ts`.
- **Dependencies:** Task 6.
- **Verification:** `npm test` green; deadline test proves the force-exit seam is
  reachable; no open-handle warnings.
- **Complexity:** **M** — fake timers + exit-seam stubbing. *(Coordinate the exit
  seam with Task 6: stub the injected `onExit`, never call real `process.exit`.)*

## Task 8 — Test: cleanup coordinator  ·  *(action 05_13 part, S)*

- **Why it is needed:** Verify best-effort ordering and the IPC-socket-unlink
  factory (DoD "resource cleanup"), including the `ENOENT` tolerance that closes
  the orphan gap.
- **Expected outcome:** New file
  `.../lifecycle/__tests__/cleanup-coordinator.test.ts`: three cleanups run in
  registration order; middle throws → `execute()` resolves, third runs,
  `getFailures()` reports exactly the middle one; re-register same `name` keeps
  only the latest; `createIpcSocketCleanup(path)` on a missing path resolves
  (temp dir). **No timers in this file.**
- **Components involved:** NEW `.../lifecycle/__tests__/cleanup-coordinator.test.ts`.
- **Dependencies:** Task 4.
- **Verification:** `npm test` green; failure-reporting assertion exact.
- **Complexity:** **S** — pure async, no timers.

## Task 9 — Watchdog monitor  ·  *(action 05_06, M)*

- **Why it is needed:** AC4 requires detecting a hung daemon (event loop stalled,
  probe never returns). The Runtime's own `performHealthCheck()` only logs; there
  is no mechanism to turn a silent hang into an actionable `onUnresponsive`.
- **Expected outcome:** New file `.../lifecycle/watchdog-monitor.ts` exporting
  `WatchdogMonitor` (constructed with the FSM, an injected `probe: () =>
  Promise<boolean>`, optional logger): `start(intervalMs, timeoutMs,
  failureThreshold = 3)` schedules an interval that skips when FSM is
  `Stopping/Crashed/Restarting`, races `probe()` vs `setTimeout(timeoutMs)`,
  counts consecutive failures, fires `onUnresponsive` callbacks **once** on
  reaching the threshold then resets the counter; `onUnresponsive(cb)` returns
  unsubscribe; `stop()` clears the interval; `start` is idempotent. Clears the
  losing race timer; never throws out of the interval callback. Does **not**
  `unref()` (liveness monitor keeps the daemon alive).
- **Components involved:** NEW `.../lifecycle/watchdog-monitor.ts`; depends on
  `./types.js`, `./lifecycle-state-machine.js`.
- **Dependencies:** Task 3.
- **Verification:** `npm run build` green; `false` 3× in a row fires
  `onUnresponsive` once, a `true` resets; a hanging probe + short `timeoutMs`
  increments the counter; FSM `Stopping` skips probing; double `start` runs one
  timer.
- **Complexity:** **M** — interval + race + threshold.

## Task 10 — Test: watchdog monitor  ·  *(action 05_13 part, M)*

- **Why it is needed:** Pin the consecutive-failure threshold and the probe/timeout
  race (DoD "watchdog timeout") deterministically with injected probes.
- **Expected outcome:** New file
  `.../lifecycle/__tests__/watchdog-monitor.test.ts` (fake timers + injected
  `probe`): healthy probe never fires; `false` × threshold fires once then a
  `true` resets; never-settling probe is failure after `timeoutMs`; FSM `Stopping`
  skips; double `start` clears the first interval. `vi.useRealTimers()` in
  `afterEach`.
- **Components involved:** NEW `.../lifecycle/__tests__/watchdog-monitor.test.ts`.
- **Dependencies:** Task 9.
- **Verification:** `npm test` green; no open-handle warnings (timers restored,
  intervals stopped).
- **Complexity:** **M** — fake-timer race assertions.

## Task 11 — Crash detector  ·  *(action 05_07, M)*

- **Why it is needed:** AC3 requires crash detection, which must run **outside**
  the crashed daemon. Today the supervisor is fire-and-forget after `unref()`. The
  Design-04 primitives (`isPidAlive`, `readPidFile`) exist but are not composed
  into a polling emitter.
- **Expected outcome:** New file `.../lifecycle/crash-detector.ts` exporting
  `CrashDetector` (constructed with the FSM, injected `readPid`/`isAlive` with
  defaults wrapping `readPidFile`/`isPidAlive`, optional logger):
  `start(intervalMs)` polls — skips when PID `<= 0`, tracks `lastAlivePid`, and on
  a previously-alive PID going dead transitions FSM to `Crashed` (try/catch) and
  fires `onCrash(lastAlivePid)` **once**, clearing `lastAlivePid` so a sustained
  death does not re-emit; a new live PID re-arms; `onCrash(cb)` returns
  unsubscribe; `stop()` clears the interval; `start` idempotent; never throws out
  of the callback. Export `createDefaultPidReader()` / `createDefaultIsAlive()`.
- **Components involved:** NEW `.../lifecycle/crash-detector.ts`; depends on
  `./types.js`, `./lifecycle-state-machine.js`. READ-ONLY `pid-manager.ts`,
  `health-check.ts`.
- **Dependencies:** Tasks 1, 3.
- **Verification:** `npm run build` green; alive→dead fires `onCrash` exactly once
  with the PID; subsequent dead ticks do not re-fire; a later restart (alive→dead
  again) fires a second time; PID `<= 0` never fires.
- **Complexity:** **M** — interval polling + single-fire edge.

## Task 12 — Test: crash detector  ·  *(action 05_14 part, M)*

- **Why it is needed:** Verify the single-fire-per-crash and re-arm guarantees
  deterministically (no real processes).
- **Expected outcome:** New file
  `.../lifecycle/__tests__/crash-detector.test.ts` (fake timers + injected
  `readPid`/`isAlive`): alive one tick then dead → `onCrash` fires exactly once
  with the PID; subsequent dead ticks do not re-fire; restart (alive then dead)
  fires a second time; PID `<= 0` never fires; unsubscribe stops callbacks;
  double `start` runs one poll loop. `vi.useRealTimers()` in `afterEach`.
- **Components involved:** NEW `.../lifecycle/__tests__/crash-detector.test.ts`.
- **Dependencies:** Task 11.
- **Verification:** `npm test` green; single-fire + re-arm assertions exact.
- **Complexity:** **M** — fake-timer sequence.

## Task 13 — Crash recovery manager  ·  *(action 05_08, M)*

- **Why it is needed:** AC3/DoD require auto-restart with a **hard `maxRetries`
  cap** and exponential backoff to prevent infinite loops. Today
  `restartDaemon()` is manual with no cap.
- **Expected outcome:** New file `.../lifecycle/crash-recovery-manager.ts`
  exporting `CrashRecoveryManager` (constructed with an injected `restartFn:
  () => Promise<void>`, optional `BackoffPolicy`, optional logger):
  `start(maxRetries, initialBackoffMs?)` resets the attempt counter + marks active
  (does **not** subscribe to the detector — caller wires `onCrash→recordCrash`);
  `async recordCrash(detectedPid?)` increments, returns without restart once the
  cap is exceeded, otherwise `await computeBackoffDelay(attempt)` then `await
  restartFn()` (catching failures; a failed restart consumes the attempt);
  `stop()` cancels a pending backoff timer; `getAttemptCount()`. Guards
  re-entrancy with an `inFlight` flag; never throws out of `recordCrash`.
- **Components involved:** NEW `.../lifecycle/crash-recovery-manager.ts`; depends
  on `./types.js`, `./backoff.js`.
- **Dependencies:** Tasks 2, 11.
- **Verification:** `npm run build` green; `start(3)` + four `recordCrash` calls
  invoke `restartFn` three times then stop; `getAttemptCount()===4`; `stop()`
  during a backoff cancels the restart; a rejecting `restartFn` does not throw and
  the counter still advances.
- **Complexity:** **M** — cancellable backoff + re-entrancy guard.

## Task 14 — Test: crash recovery manager  ·  *(action 05_14 part, M)*

- **Why it is needed:** Pin the hard cap and backoff sequence (DoD "crash restart
  loop prevention") — the core safety property.
- **Expected outcome:** New file
  `.../lifecycle/__tests__/crash-recovery-manager.test.ts` (fake timers + counting
  `restartFn`, `vi.advanceTimersByTimeAsync`): `start(3)` + four `recordCrash` →
  `restartFn` called three times, fourth a no-op, `getAttemptCount()===4`;
  `stop()` during a backoff cancels; rejecting `restartFn` does not throw +
  counter advances; re-entrancy (second `recordCrash` mid-backoff) does not start
  a second parallel `restartFn`; with `jitter:false` the wait before attempt N
  matches `computeBackoffDelay(N)`. `vi.useRealTimers()` in `afterEach`.
- **Components involved:** NEW `.../lifecycle/__tests__/crash-recovery-manager.test.ts`.
- **Dependencies:** Task 13.
- **Verification:** `npm test` green; cap is a hard stop regardless of further
  `recordCrash` calls until `start` resets.
- **Complexity:** **M** — fake-timer backoff + cap assertions.

## Task 15 — Expose lifecycle public API (barrel)  ·  *(action 05_11, S)*

- **Why it is needed:** Until the lifecycle symbols are re-exported from the
  package barrel, the daemon/supervisor in `@aer/cli` cannot import them. Design 04
  established the commented-block convention; this adds the matching lifecycle
  block.
- **Expected outcome:** EDIT `packages/runtime/src/index.ts` — append a
  `// Lifecycle exports` block after the "Persistence — Health Check exports"
  block, re-exporting (with `.js` specifiers, value vs `export type` split):
  `LifecycleState`, `DEFAULT_BACKOFF_POLICY`, `LifecycleStateMachine`,
  `computeBackoffDelay`, `shouldRetry`, `CleanupCoordinator`,
  `createIpcSocketCleanup`, `GracefulShutdownHandler`, `exitCodeFor`,
  `WatchdogMonitor`, `CrashDetector`, `createDefaultPidReader`,
  `createDefaultIsAlive`, `CrashRecoveryManager`; and the types `ShutdownReason`,
  `ShutdownContext`, `BackoffPolicy`, `RestartDecision`. No internal helpers.
- **Components involved:** EDIT `packages/runtime/src/index.ts`.
- **Dependencies:** Tasks 1, 2, 3, 4, 6, 9, 11, 13 (all modules must exist).
- **Verification:** `npm run build` green; scratch
  `import { LifecycleStateMachine, GracefulShutdownHandler,
  CrashRecoveryManager, DEFAULT_BACKOFF_POLICY } from "@aer/runtime-lib"` works;
  existing exports still resolve.
- **Complexity:** **S** — barrel plumbing only.

## Task 16 — Wire daemon shutdown onto the lifecycle modules  ·  *(action 05_09, M)*

- **Why it is needed:** Closes AC1/AC2/AC5/AC7. Replace the hand-rolled,
  no-timeout `shutdown()` so SIGINT/SIGTERM/uncaught/unhandled flow through the
  handler, `runtime.stop()` actually runs, and the IPC `.sock` is unlinked.
- **Expected outcome:** EDIT `packages/cli/src/daemon-entry.ts` — import the
  lifecycle symbols from `@aer/runtime-lib`; construct the FSM + coordinator +
  handler (timeout from `AER_SHUTDOWN_TIMEOUT_MS`, default 10000); register
  resources in teardown order ("ipc-accept" = `ipcServer.close()` +
  `createIpcSocketCleanup(getIpcSocketPath())`, "heartbeat", "runtime" =
  `await runtimeInstance.stop()`, "snapshot-final" = write then `removeSnapshot()`
  (keep the clean-shutdown-removes-snapshot policy), "pid" = `removePidFile()`,
  "health-server"); replace `shutdown()` + the duplicate handlers (`L130-131` and
  `L215-216`) with one `shutdownHandler.initialize(timeoutMs)`; after
  `await trigger(reason)` resolves call `process.exit(exitCodeFor(reason))`; route
  the fatal `main().catch` (`L224-241`) through `trigger("fatal", error)`;
  transition FSM to `Running` after `runtime.start()` succeeds. Preserve
  heartbeat + health server behavior; do not touch CLI commands.
- **Components involved:** EDIT `packages/cli/src/daemon-entry.ts`. Depends on
  `@aer/runtime-lib` symbols from Task 15.
- **Dependencies:** Tasks 6, 4, 15 (and Task 3 for the FSM).
- **Verification:** `npm run build` green; manual: start → SIGTERM → clean exit
  within timeout, PID removed, `.sock` removed, `runtime.stop()` logged; an
  uncaught exception runs cleanup + exits non-zero with an error snapshot; a
  hanging cleanup still exits at `AER_SHUTDOWN_TIMEOUT_MS`.
- **Complexity:** **M** — multi-section edit to a live file; preserve policies.
  *(qwen3.6 should keep the diff surgical: replace the named regions only.)*

## Task 17 — Wire supervisor auto-restart onto crash recovery  ·  *(action 05_10, M)*

- **Why it is needed:** Closes AC3. Turns the fire-and-forget spawn into a
  supervised process that detects crashes and restarts with backoff + a hard cap.
- **Expected outcome:** EDIT `packages/cli/src/daemon.ts` — import `CrashDetector`,
  `CrashRecoveryManager`, `LifecycleState`, `LifecycleStateMachine` from
  `@aer/runtime-lib`; in `startDaemon`, after a successful spawn, construct the FSM
  (at `Starting`) + a `CrashDetector` (default readers) + a `CrashRecoveryManager`
  whose injected `restartFn` re-spawns a fresh daemon; wire
  `detector.onCrash(pid => recovery.recordCrash(pid))`;
  `recovery.start(AER_MAX_RETRIES=5, AER_INITIAL_BACKOFF_MS=1000)`;
  `detector.start(AER_CRASH_POLL_MS=2000)`. Attach `daemonProcess.on("exit")` /
  `.on("error")` routing immediate failures to `recovery.recordCrash()`. Update
  `stopDaemon()` to call `recovery.stop()` + `detector.stop()` **before** the
  signal (so a deliberate stop is not re-spawned). Keep `restartDaemon()` (manual)
  and `isRunning()` unchanged. Document that auto-restart needs the supervisor to
  stay alive (no `unref` on the poll timer).
- **Components involved:** EDIT `packages/cli/src/daemon.ts`. Depends on
  `@aer/runtime-lib` symbols from Task 15.
- **Dependencies:** Tasks 11, 13, 15.
- **Verification:** `npm run build` green; manual: `aer start` (supervisor alive)
  → `kill -9 <pid>` → detector fires, backoff elapses, a new daemon appears within
  `maxRetries`; a forced crash loop stops retrying after the cap; `aer stop` exits
  and is **not** re-spawned.
- **Complexity:** **M** — supervisor loop + deliberate-stop-vs-crash distinction.
  *(qwen3.6: rely on the recovery manager's cap — do not add a second ad-hoc
  counter.)*

---

## Optional follow-ups (non-blocking, post-DoD)

- **`shutdownExecuted` declaration order:** in the current `daemon-entry.ts` the
  idempotency flag is declared with `let` *after* the `shutdown` function that
  reads it. Task 16 replaces this region; ensure the replacement does not
  reintroduce the temporal-dead-zone fragility.
- **Redundant PID write:** `startDaemon` writes the child PID (`daemon.ts:47`)
  and the child re-writes the same value in `daemon-entry.ts:149`. Harmless but
  redundant; collapse to one owner if the supervisor is expected to outlive the
  write.
- **Watchdog → restart integration:** Task 9/10 deliver the watchdog as a
  `onUnresponsive` emitter; Task 17 could optionally treat an unresponsive signal
  as a crash trigger (route it to `recovery.recordCrash()`). This is a behavior
  choice — keep it out of the DoD-critical path and add only if desired.

# Recommended Implementation Order

Ordered by dependency, with each module followed immediately by its test so
qwen3.6 verifies incrementally. Mark a task done only when its Verification
passes.

1. **Task 1** — Lifecycle types (foundation; everything imports it).
2. **Task 2** — Backoff calculator (pure; parallel-safe with Task 3).
3. **Task 3** — Lifecycle state machine (pure).
4. **Task 5** — Tests: state machine + backoff (verify Tasks 2–3 now).
5. **Task 4** — Cleanup coordinator.
6. **Task 8** — Test: cleanup coordinator (verify Task 4 now).
7. **Task 6** — Graceful shutdown handler.
8. **Task 7** — Test: graceful shutdown handler (verify Task 6 now).
9. **Task 9** — Watchdog monitor.
10. **Task 10** — Test: watchdog monitor (verify Task 9 now).
11. **Task 11** — Crash detector.
12. **Task 12** — Test: crash detector (verify Task 11 now).
13. **Task 13** — Crash recovery manager.
14. **Task 14** — Test: crash recovery manager (verify Task 13 now).
15. **Task 15** — Expose lifecycle API (barrel; needs all modules).
16. **Task 16** — Wire daemon shutdown (needs handler + coordinator + barrel).
17. **Task 17** — Wire supervisor auto-restart (needs detector + recovery + barrel).

> Tasks 1, 2, and 3 are independent of each other except that 2 and 3 both need 1,
> so after Task 1 the model may do 2 and 3 in either order. Tasks 5, 8, 7, 10, 12,
> 14 are pure verification steps tightly coupled to their module — never skip them.
> The two integrations (16, 17) must come **after** Task 15 (barrel).

# Acceptance Criteria

Each criterion maps to Design 05 and is phrased to be measurable. All are
unsatisfied today because the implementation has not begun.

- [ ] **AC1 — Signal + exception handling:** Daemon handles SIGINT, SIGTERM, and
  unhandled exceptions with graceful shutdown *(Task 6 + 16)*.
- [ ] **AC2 — Shutdown timeout:** Graceful shutdown completes or fails within a
  configurable timeout *(Task 6 + 16)*.
- [ ] **AC3 — Auto-restart with cap:** Crashed daemon automatically restarts, with
  a max retry limit preventing infinite loops *(Tasks 11, 13, 17)*.
- [ ] **AC4 — Watchdog:** Watchdog detects an unresponsive Runtime and triggers
  restart or alert *(Tasks 9, 10)*.
- [ ] **AC5 — Resource cleanup:** All resources (IPC listeners, PID file, temp
  files) are cleaned up on exit — including the IPC `.sock` *(Tasks 4, 16)*.
- [ ] **AC6 — Shutdown logs:** Shutdown logs are written before the process
  terminates *(Task 6 + 16)*.
- [ ] **AC7 — In-flight operations:** In-flight operations are either completed or
  safely aborted during shutdown *(Task 16 — `runtime.stop()` finally runs)*.

# Definition of Done

- [ ] Signal handlers registered for SIGINT, SIGTERM, **and** `uncaughtException`
      / `unhandledRejection` *(Task 6/16)*.
- [ ] Graceful shutdown sequence implemented: stop accepting new work → drain
      in-flight work → cleanup resources → exit *(Tasks 4, 6, 16)*.
- [ ] Crash detection via PID/process check triggers automatic restart with
      configurable `maxRetries` and backoff *(Tasks 11, 13, 17)*.
- [ ] Watchdog module can detect a hung process and act on it *(Tasks 9, 10)*.
- [ ] Clean exit leaves no orphaned files, listeners, or child processes —
      including the IPC `.sock` *(Tasks 4, 16)*.
- [ ] Unit tests cover: graceful shutdown, crash restart loop prevention, watchdog
      timeout, resource cleanup *(Tasks 5, 7, 8, 10, 12, 14)*.
- [ ] Manual test validated: start daemon → SIGTERM → clean exit → `kill -9` →
      auto-restart → max-retry cap *(Tasks 16, 17)*.
- [ ] `npm run build` and `npm test` green across both workspaces, including the
      new lifecycle suite.

# Risks

Architectural risks only.

- **Auto-restart requires a long-lived supervisor.** Today the CLI `start` command
  returns immediately after spawning detached + `unref()`. Crash polling (Task 17)
  only works while the supervisor process stays alive. This is a behavior change:
  either the `start` command must host the supervisor loop or a separate
  `supervise` flow is needed — Task 17 flags it but does not redesign the CLI
  command surface. Without resolving this, auto-restart silently does nothing once
  the spawning process exits.
- **`uncaughtException` handling exits by design.** Once cleanup runs, the handler
  exits (via the caller) rather than attempting to continue on a corrupted state.
  This is intentional and correct for a daemon, but it is non-default Node behavior
  and must be understood by anyone extending the daemon.
- **`process.kill(pid, 0)` liveness is best-effort cross-platform** (see Design 04
  risks): on Windows it does not signal in the POSIX sense, and PID reuse can make
  a recycled PID appear alive. The crash detector (Task 11) inherits this from the
  reused `isPidAlive` primitive.
- **Watchdog probe vs `performHealthCheck()` divergence:** The watchdog's injected
  probe (Task 9) is a separate health path from the Runtime's internal
  `performHealthCheck()`. If they probe different subsystems, "unresponsive"
  signals may not align with the Runtime's own health picture. The probe must be
  chosen deliberately when the daemon wires it.
- **Snapshot asymmetry on exit:** A graceful stop removes the snapshot (later
  `status` = "unknown"); a fatal path leaves a `state:"error"` snapshot for
  post-mortem. Task 16 must preserve this; consumers must understand the
  asymmetry.
- **Deadline force-exit is hard to test safely.** The shutdown handler's timeout
  calls an exit path that, if it were a direct `process.exit`, would kill the test
  runner. Task 6/7 coordinate an injectable `onExit` seam to keep this testable.
- **Deliberate-stop-vs-crash must be distinguished.** If `stopDaemon` does not
  stop the detector/recovery before signaling, an `aer stop` immediately
  re-spawns the daemon (Task 17 constraint).

# Out of Scope

- Rewriting or altering the Design 05 document or the `05_0x` action plans.
- Re-running or updating the Task 01/02/03/04 validation reports.
- IPC-layer internals (concurrency, transport, event push) — owned by Design 02 /
  `02_ipc_remaining_work.md`.
- Persistent-state concerns — owned by Design 04 (`04_validation_findings.md`).
- Redesigning the CLI command surface (a separate `supervise` flow, daemonizing
  the supervisor) — Task 17 only *wires* auto-restart and flags the behavior
  change.
- Authentication, authorization, or encryption of any channel.
- Performance, load, or stress testing.
- Any source-code implementation. This is a validation/gap-analysis and task-split
  document for a separate implementing model.
