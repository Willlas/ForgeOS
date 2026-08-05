# Action 04_06 — Wire daemon lifecycle events to state persistence

## Objective
Make the daemon write/update persistent state on lifecycle events (start, stop,
health change) using the new modules — and, in the process, **de-duplicate the
PID logic** by replacing the inline functions in `daemon.ts` and `daemon-entry.ts`
with imports from the `PidManager` module. This is the action that ties everything
together.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 04_07 (tests assert the wired behavior).

## Why it matters
Design 04 §"Components to Modify": "Daemon entry point — Must write/update
persistent state on lifecycle events (start, stop, health change)." Today
`daemon-entry.ts` writes only the PID file at start and removes it on shutdown —
no status/health/metrics snapshot is ever persisted. This action also removes the
PID-logic duplication flagged in the gap analysis.

## Prerequisites
- **04_01** (PidManager), **04_02** (StateStore), **04_03** (Runtime.getSnapshot)
  all complete.

## Steps
1. Open `packages/cli/src/daemon-entry.ts`.
2. Replace the inline `getPidFilePath`/`writePidFile`/`removePidFile` with imports
   from `@aer/runtime-lib` (`PidManager`). Delete the local copies.
3. On **start** (`main()`):
   - Before writing the PID file, call `PidManager.cleanupStale()` — if a stale
     PID file exists from a prior crash, remove it (Design 04 AC: "Stale PID files
     from crashes are detected and handled automatically").
   - Write the fresh PID file.
   - Write an initial state snapshot via `StateStore.writeSnapshot(runtime.getSnapshot())`.
4. On **graceful stop** (`shutdown()`):
   - Write a final snapshot with `state: "stopped"` (or the actual final state).
   - Remove the PID file and the snapshot file (or keep the final snapshot —
     decide and document; recommend removing both on clean shutdown so a later
     `status` reports "unknown" rather than stale "stopped").
5. On **health/lifecycle change** (periodic):
   - Add a periodic timer (e.g. every N seconds) that re-writes the snapshot via
     `StateStore.writeSnapshot(runtime.getSnapshot())`. This becomes the
     "heartbeat" — the `capturedAt` timestamp lets monitors detect a hung daemon
     (snapshot age > threshold ⇒ probably hung even if the PID is alive).
6. On **fatal error** (top-level catch):
   - Best-effort: write a snapshot with `state: "error"` if possible, then remove
     the PID file.
7. Open `packages/cli/src/daemon.ts` and replace its inline PID functions with
   `PidManager` imports too (used by `startDaemon`/`stopDaemon`/`isRunning`).
   Keep the same exported CLI-side function names so `index.ts` is unaffected.

## Files
- **EDIT** `packages/cli/src/daemon-entry.ts` (lifecycle hooks + de-dup)
- **EDIT** `packages/cli/src/daemon.ts` (de-dup PID logic → PidManager)
- **DEPENDS ON** `@aer/runtime-lib` exports: `PidManager`, `StateStore`

## Constraints
- **Atomic writes** must be used for snapshots (provided by StateStore — do not
  bypass).
- The heartbeat interval must be bounded and the timer cleared on shutdown
  (avoid keeping the process alive / leaking handles).
- Preserve the existing `AER_DAEMON_PID_DIR` / `AER_HEALTH_PORT` env-var semantics.
- Do not change the daemon's IPC server wiring or the HTTP `/health` endpoint in
  this action (those are separate concerns).
- Ensure shutdown remains idempotent — calling it twice must not throw.

## Verification
- `npm run build` green.
- Manual lifecycle (the Design 04 DoD manual test):
  1. Start daemon → PID file + state snapshot file both present.
  2. `status` (with daemon up) → live state shown.
  3. Stop daemon gracefully → PID file removed; snapshot removed (per your
     decision in step 4).
  4. Start → kill -9 the daemon process → PID file remains but is stale.
  5. `status` → reports "down" with `stalePidFile: true` and last snapshot.
  6. Start again → `cleanupStale()` removes the stale file, fresh PID written.
- `npm test` still green.
