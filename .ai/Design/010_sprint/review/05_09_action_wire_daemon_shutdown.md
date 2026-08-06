# Action 05_09 — Wire daemon shutdown onto the lifecycle modules

## Objective
Replace the hand-rolled, no-timeout `shutdown()` in `daemon-entry.ts` with the
new lifecycle modules: construct a `LifecycleStateMachine`, a `CleanupCoordinator`
(registering heartbeat/PID/snapshot/IPC-socket/health-server as resources), and a
`GracefulShutdownHandler`, then route SIGINT/SIGTERM/uncaught/unhandled through
the handler. Ensure `runtime.stop()` is finally invoked during shutdown and the
IPC `.sock` is unlinked.

## Backlog reference
- **Severity:** Critical
- **Blocks:** Nothing (this is the daemon-side integration; the supervisor side
  is 05_10).

## Why it matters
Design 05 DoD requires *"Daemon handles SIGINT, SIGTERM, and unhandled
exceptions,"* *"Graceful shutdown completes or fails within a configurable
timeout,"* *"All resources cleaned up on exit,"* and *"In-flight operations
either completed or safely aborted."* Today `daemon-entry.ts:87-131` is
synchronous, idempotent via one boolean, has **no timeout**, **never calls
`runtime.stop()`**, never unlinks the IPC socket, and registers only
SIGINT/SIGTERM. This action routes every exit through the resilient, timeout-
bounded handler built in 05_05.

## Prerequisites
- **05_05** (graceful shutdown handler), **05_04** (cleanup coordinator + IPC
  socket cleanup factory), **05_02** (state machine) complete.
- **05_11** (barrel exports) complete so the modules import cleanly from
  `@aer/runtime-lib`.

## Steps
1. Open `packages/cli/src/daemon-entry.ts`.
2. Import `LifecycleStateMachine`, `CleanupCoordinator`,
   `createIpcSocketCleanup`, `GracefulShutdownHandler`, and `getIpcSocketPath`
   from `@aer/runtime-lib`.
3. Construct the FSM (`new LifecycleStateMachine(LifecycleState.Starting)`), a
   `CleanupCoordinator`, and a `GracefulShutdownHandler` with a timeout read
   from `AER_SHUTDOWN_TIMEOUT_MS` (default `10000`).
4. Register resources on the coordinator **in teardown order** (first registered
   runs first):
   - "ipc-accept" — `ipcServer.close()` plus `createIpcSocketCleanup(getIpcSocketPath())`
     (stop accepting, then unlink the socket).
   - "heartbeat" — clear the heartbeat interval.
   - "runtime" — `await runtimeInstance.stop()` (this is the fix for the
     missing subsystem teardown).
   - "snapshot-final" — write the final snapshot, then `removeSnapshot()` (keep
     the existing clean-shutdown-removes-snapshot policy, L113-116).
   - "pid" — `removePidFile()`.
   - "health-server" — close the HTTP server if present.
5. Replace the module-scope `shutdown()` function and the duplicate SIGINT/SIGTERM
   handlers inside the keep-alive promise (L130-131 and L215-216) with a single
   call: `shutdownHandler.initialize(timeoutMs)` once `main()` has set everything
   up. Remove the now-redundant `gracefulShutdown` closure.
6. After `await shutdownHandler.trigger(reason)` resolves, call
   `process.exit(exitCodeFor(reason))`. Keep the fatal `main().catch(...)` path
   (L224-241) but route its final exit through the same handler via
   `trigger("fatal", error)`.
7. Transition the FSM to `Running` after `runtime.start()` succeeds (L168), so
   the lifecycle reflects reality.

## Files
- **EDIT** `packages/cli/src/daemon-entry.ts` (replace `shutdown()` L87-131,
  the duplicate handlers L215-216, and the fatal catch L224-241)
- **DEPENDS ON** `@aer/runtime-lib`: `LifecycleStateMachine`,
  `CleanupCoordinator`, `createIpcSocketCleanup`, `GracefulShutdownHandler`,
  `getIpcSocketPath`, `exitCodeFor`, `LifecycleState`
- **READ-ONLY** `packages/runtime/src/core/runtime.ts` (`stop()` L218-258),
  `packages/runtime/src/ipc-transport.ts` (socket path L12-16)

## Constraints
- **Preserve the clean-shutdown-removes-snapshot policy** (L113-116): a graceful
  stop removes the snapshot so a later `aer status` reports "unknown", not stale
  "stopped". The fatal path still leaves a `state:"error"` snapshot.
- `runtime.stop()` must actually run during shutdown — today it does not.
- The IPC `.sock` must be unlinked on shutdown (via `createIpcSocketCleanup`).
- Remove the **duplicate** signal registration (there are two pairs today); one
  `initialize()` call is the single source.
- Do not regress the heartbeat (keep `AER_STATE_HEARTBEAT_MS` behavior) or the
  health HTTP server.
- The shutdown timeout must be configurable via `AER_SHUTDOWN_TIMEOUT_MS` with a
  sane default.
- Do not change the CLI `status`/`start`/`stop`/`restart` commands here.

## Verification
- `npm run build` green.
- Manual: start the daemon → SIGTERM → verify clean exit within the timeout, the
  PID file removed, the `.sock` file removed, and `runtime.stop()` logged.
- Manual: start → send an uncaught exception from a scratch script → verify the
  handler runs cleanup and exits non-zero with an error snapshot written.
- Manual: make cleanup hang (e.g. a resource that never resolves) → verify the
  process still exits at `AER_SHUTDOWN_TIMEOUT_MS`.
- `npm test` still green.
