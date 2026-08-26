# Action 05_10 — Wire supervisor auto-restart onto crash recovery

## Status

Implemented in source: the supervisor now starts a `CrashDetector` + `CrashRecoveryManager`, tracks daemon exits, and stops the recovery loop on deliberate shutdown so a manual stop does not immediately restart the child.

## Objective
Make the daemon supervisor (`daemon.ts`) monitor the spawned child and, on an
unexpected exit, drive the `CrashDetector` + `CrashRecoveryManager` to restart it
with backoff and a hard retry cap. This turns the fire-and-forget spawn into a
supervised process.

## Backlog reference
- **Severity:** Critical
- **Blocks:** Nothing (this is the supervisor-side integration; the daemon side
  is 05_09).

## Why it matters
Design 05 DoD requires *"Crashed daemon automatically restarts (with max retry
limit)"* and *"Manual test: kill -9 process → verify auto-restart → verify max
retry cap."* Today `startDaemon` (`daemon.ts:31-50`) spawns the child detached,
writes the PID, and `unref()`s — there are no `exit`/`error` listeners and no
restart policy. A crash leaves the daemon dead until a human runs `aer start`.
This action adds the supervisor loop.

## Prerequisites
- **05_07** (crash detector), **05_08** (crash recovery manager), **05_11**
  (barrel exports) complete.
- The manual `restartDaemon()` path stays working.

## Steps
1. Open `packages/cli/src/daemon.ts`.
2. Import `CrashDetector`, `CrashRecoveryManager`, and `LifecycleState` +
  `LifecycleStateMachine` from `@aer/runtime-lib`.
3. In `startDaemon`, after a successful spawn:
   - Construct a `LifecycleStateMachine` (at `Starting`) and a `CrashDetector`
     using the default `readPidFile`/`isPidAlive` readers.
   - Construct a `CrashRecoveryManager` whose injected `restartFn` is a closure
     that calls `startDaemon` again (re-spawn) — i.e. the restart mechanism is
     "spawn a fresh daemon".
   - Wire `detector.onCrash((pid) => recovery.recordCrash(pid))`.
   - `recovery.start(maxRetries, initialBackoffMs)` with defaults from env
     (`AER_MAX_RETRIES` default `5`, `AER_INITIAL_BACKOFF_MS` default `1000`).
   - `detector.start(pollIntervalMs)` with `AER_CRASH_POLL_MS` default `2000`.
   - Keep the `detached` + `unref()` spawn behavior — the **supervisor** (this
     process) must stay alive to poll; document that a long-lived supervisor
     invocation is now required for auto-restart (the CLI `start` command will
     host it; alternatively a separate `supervise` flow — keep scope to wiring
     here).
4. Attach `daemonProcess.on("exit", (code, signal))` and `.on("error")` so an
   immediate spawn failure (e.g. bad node path) is logged and routed to
   `recovery.recordCrash()` rather than silently dropped.
5. Leave `stopDaemon()` and `restartDaemon()` working: `stopDaemon` should call
   `recovery.stop()` + `detector.stop()` before sending SIGTERM, so a deliberate
   stop is not mistaken for a crash and re-spawned. `restartDaemon` keeps its
   `stop → start` semantics (manual restart bypasses the recovery manager).
6. Keep `isRunning()` unchanged.

## Files
- **EDIT** `packages/cli/src/daemon.ts` (extend `startDaemon` L31-50; update
  `stopDaemon` L52-62)
- **DEPENDS ON** `@aer/runtime-lib`: `CrashDetector`, `CrashRecoveryManager`,
  `LifecycleStateMachine`, `LifecycleState`
- **READ-ONLY** `packages/cli/src/daemon-entry.ts` (child process behavior)

## Constraints
- **Deliberate stop must not trigger auto-restart.** `stopDaemon` calls
  `recovery.stop()` + `detector.stop()` *before* sending the signal; otherwise
  killing the daemon for an `aer stop` would immediately re-spawn it.
- The retry cap (`maxRetries`) is the hard loop-prevention mechanism — rely on
  05_08's cap, do not add a second ad-hoc counter.
- The supervisor process must remain alive to poll (do not `unref` the poll
  timer). If the CLI `start` command returns immediately today, note that
  auto-restart requires the supervisor to keep running — flag this as a behavior
  change in the commit, but do not redesign the CLI command surface in this
  action.
- `restartFn` failures (spawn error) must be caught by the recovery manager, not
  crash the supervisor.
- Do not remove the manual `restartDaemon()` path.
- Do not change `isRunning()`.

## Verification
- `npm run build` green.
- Manual: `aer start` (supervisor alive) → `kill -9 <daemon-pid>` → verify the
  detector fires, the recovery manager waits its backoff, and a new daemon
  appears within `maxRetries`.
- Manual: force a crash loop (make the child exit immediately on start) → verify
  after `maxRetries` attempts the supervisor stops retrying and logs give-up.
- Manual: `aer stop` → verify the daemon exits and is **not** re-spawned
  (recovery was stopped before the signal).
- `npm test` still green.
