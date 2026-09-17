# Action 05_05 — Graceful shutdown handler (signals + timeout)

## Objective
Create a `GracefulShutdownHandler` that registers OS signal handlers
(SIGINT/SIGTERM) **plus `uncaughtException` and `unhandledRejection`**, and on
any trigger runs a configurable graceful-shutdown sequence — stop accepting work,
drain, run the cleanup coordinator — bounded by a hard timeout that force-exits
if cleanup overruns. Idempotent: a second trigger during shutdown is a no-op.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 05_09 (the daemon wires this handler in).

## Why it matters
Design 05 §"Public Interfaces" requires `GracefulShutdownHandler.initialize(timeoutMs)`
and `trigger(reason)`, and the DoD requires *"Daemon handles SIGINT, SIGTERM, and
unhandled exceptions"* and *"Graceful shutdown completes or fails within a
configurable timeout."* Today `daemon-entry.ts:130-131` registers only
SIGINT/SIGTERM, **there is no `uncaughtException`/`unhandledRejection` handler
anywhere in the repo**, and `shutdown()` (`daemon-entry.ts:87-125`) has **no
timeout** — if `healthServer.close()` never calls back, the process hangs
forever. This handler is the single, resilient path through which every exit
flows.

## Prerequisites
- **05_02** (state machine) — the handler transitions to `Stopping` (and
  `Crashed` if cleanup itself fails).
- **05_04** (cleanup coordinator) — `trigger` calls `coordinator.execute(ctx)`.

## Steps
1. Create `packages/runtime/src/core/lifecycle/graceful-shutdown-handler.ts`.
2. Export a `GracefulShutdownHandler` class constructed with a
  `CleanupCoordinator`, a `LifecycleStateMachine`, and an optional logger (default
  to `console`). Store them as fields.
3. `initialize(timeoutMs: number): void` — register four handlers on `process`:
   - `SIGINT` → `trigger("sigint")`
   - `SIGTERM` → `trigger("sigterm")`
   - `uncaughtException` → `trigger("uncaughtException", err)`
   - `unhandledRejection` → `trigger("unhandledRejection", err)`
   Keep the handler references on the instance so `dispose()` can remove them.
4. `async trigger(reason: ShutdownReason, error?: unknown): Promise<void>`:
   - Guard with an idempotency flag: if already shutting down, return immediately
     (a second Ctrl-C must not re-enter).
   - Build a `ShutdownContext` (`reason`, `error`, the FSM's current state, an
     ISO `triggeredAt`).
   - Transition the FSM to `Stopping` (wrap in try/catch — an illegal transition
     must not block cleanup).
   - Arm a hard `setTimeout(() => process.exit(exitCodeFor(reason)), timeoutMs)`
     as a deadline guard. Clear it once cleanup finishes.
   - `await coordinator.execute(ctx)`; then clear the deadline timer.
   - On any error from `execute`, log `coordinator.getFailures()` and transition
     the FSM to `Crashed`; otherwise leave it at `Stopping`.
   - Resolve so callers (or the signal path) can `await` it; do **not** call
     `process.exit` directly from `trigger` — exit is the caller's responsibility
     (05_09 wires the final exit). This keeps the handler unit-testable.
5. `dispose(): void` — remove all four `process` listeners and clear any pending
   deadline timer, so tests and re-initialization do not leak handlers.
6. Export a small pure helper `exitCodeFor(reason: ShutdownReason): number`
   returning `0` for `sigint`/`sigterm`/`explicit`/`timeout` and `1` for
   `uncaughtException`/`unhandledRejection`/`fatal`.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/graceful-shutdown-handler.ts`
- **DEPENDS ON** `./types.js`, `./lifecycle-state-machine.js`,
  `./cleanup-coordinator.js`
- **READ-ONLY** `packages/cli/src/daemon-entry.ts` (current `shutdown()` L87-131
  is the logic this replaces in 05_09)

## Constraints
- **Idempotent** — `trigger` must be safe to call many times (Ctrl-C twice, or a
  signal arriving during uncaught-exception handling). Use an instance flag.
- **Never let cleanup hang** — the deadline `setTimeout` is mandatory; on fire
  it must call `process.exit` so the process cannot wedge.
- Do **not** call `process.exit` from `trigger` itself in the success path;
  callers own the final exit so the handler stays unit-testable. The deadline
  timer is the only place this module force-exits.
- `uncaughtException` handling is intentionally non-default Node behavior — once
  we run cleanup we **do** exit (via the caller), we do not attempt to keep
  running on a corrupted state.
- Remove exactly the handlers you registered in `dispose()` (keep references);
  do not call `process.removeAllListeners`.
- Do not import from `@aer/cli`.

## Verification
- `npm run build` green.
- Scratch: construct the handler with a coordinator whose cleanup resolves after
  10 ms; call `trigger("sigterm")` with a 1000 ms timeout; it resolves, the FSM
  is `Stopping`, and no `process.exit` fired.
- Scratch: make cleanup hang forever; `trigger("sigterm")` with a 20 ms timeout
  force-exits the process (verify in a child process test, not the main test
  run).
- Scratch: call `trigger` twice rapidly; cleanup runs only once.
- Scratch: `dispose()` removes the four listeners (assert listener counts drop).
- `npm test` still green.
