# Action 04_01 — PID file manager module

## Objective
Extract the currently duplicated PID-file logic into a single consolidated module
in `@aer/runtime-lib`, and extend it with stale/orphan detection and PID
validation beyond the current live `process.kill(pid,0)` probe.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 04_04 (health checker), 04_06 (daemon lifecycle)

## Why it matters
PID file logic currently exists **twice**, near-identically:
- `packages/cli/src/daemon.ts` L13-40 (`getPidFilePath`, `writePidFile`,
  `readPidFile`, `removePidFile`, `isPidAlive`, `isRunning`)
- `packages/cli/src/daemon-entry.ts` L41-60 (`getPidFilePath`, `writePidFile`,
  `removePidFile`)

Two sources of truth will diverge. Design 04 also requires stale-PID detection
and orphan cleanup, neither of which exists today — only a live process probe is
used, which fails on PID recycling and cannot classify a stale file.

## Prerequisites
Design 03 complete (it is). No other action blocks this.

## Steps
1. Create `packages/runtime/src/persistence/pid-manager.ts`.
2. Implement a `PidManager` (or equivalent) class/module exporting:
   - `getPidFilePath(): string` — same path logic as today (default
     `<repo>/.daemon/aer-daemon.pid`; override via `AER_DAEMON_PID_DIR`).
     Cross-platform via `path.join` + `os` (already used).
   - `writePidFile(pid: number): void` — write the pid string atomically.
   - `readPidFile(): number` — returns pid or `-1` if missing/unreadable.
   - `removePidFile(): void` — best-effort delete.
   - `isPidAlive(pid: number): boolean` — existing `process.kill(pid,0)` probe.
   - **NEW** `isStale(): boolean` — a PID file exists but its process is dead.
   - **NEW** `validatePid(pid: number): boolean` — sanity-range check
     (e.g. `pid > 0`, optionally `pid < 2^22` ceiling for the platform).
   - **NEW** `cleanupStale(): boolean` — if stale, remove the file and return
     true; else false. (Used on next daemon start.)
3. Make all file writes **atomic** where reasonable (write to tmp, rename). For
   the PID file this is less critical than for state snapshots, but consistent
   atomic writes avoid torn reads.
4. Export the module's public surface from `packages/runtime/src/index.ts`:
   `export { PidManager } from "./persistence/pid-manager.js";` (value) plus any
   types. Use the existing barrel style (`.js` specifiers, separate value/type
   statements).
5. **Do NOT yet delete** the inline functions in `daemon.ts` / `daemon-entry.ts` —
   that rewrite happens in 04_06 (daemon lifecycle) and the CLI status rewire
   (04_05). This action only creates the canonical module.

## Files
- **NEW** `packages/runtime/src/persistence/pid-manager.ts`
- **EDIT** `packages/runtime/src/index.ts` (add exports)
- **READ-ONLY** `packages/cli/src/daemon.ts`, `packages/cli/src/daemon-entry.ts`
  (source of the logic to consolidate)

## Constraints
- Keep the existing path/env-var semantics exactly (`AER_DAEMON_PID_DIR`,
  default `<repo>/.daemon/aer-daemon.pid`) — consumers depend on them.
- The module must be importable from both `@aer/cli` and external scripts; do not
  import anything CLI-specific.
- Do not change `daemon.ts` / `daemon-entry.ts` in this action.
- Match the existing codebase style (NodeNext `.js` specifiers, ESM).

## Verification
- `npm run build` green.
- A scratch script importing `PidManager` from `@aer/runtime-lib` can write,
  read, validate, and remove a PID file in a temp dir.
- `cleanupStale()` returns true and removes the file when the pid is not alive.
- Existing `npm test` still green (no regressions — this is additive only).
