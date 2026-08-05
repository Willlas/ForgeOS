# Action 04_02 — State persistence layer module

## Objective
Create a file-based state persistence layer that writes atomic snapshots of
Runtime state (status, health summary, metrics summary) and reads them back
without requiring a live IPC connection. This module does not exist today.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 04_04 (health checker), 04_06 (daemon lifecycle)

## Why it matters
Design 04 §"Components to Create" requires a "State persistence layer" with
atomic file operations; AC requires "State updates use atomic operations to
prevent corruption" and "Runtime status information is persisted and queryable
without a live IPC connection." Today the daemon writes only the PID file — no
status/health/metrics snapshot is ever persisted.

## Prerequisites
Design 03 complete. 04_03 (snapshot helper) will feed this module, but you can
define the persistence interface against a plain serializable shape first and
wire the runtime snapshot in 04_03/04_06.

## Steps
1. Create `packages/runtime/src/persistence/state-store.ts`.
2. Define a serializable snapshot interface, e.g.:
   ```ts
   interface RuntimeStateSnapshot {
     schemaVersion: number;          // bump on shape changes
     pid: number;
     state: string;                  // RuntimeState enum value
     healthy: boolean;
     startedAt?: string;             // ISO timestamp
     capturedAt: string;             // ISO timestamp of this snapshot
     uptimeSeconds?: number;
     health?: object;                // RuntimeHealth summary (serializable subset)
     metrics?: object;               // MetricsCollector.getSummary() shape
   }
   ```
3. Implement a `StateStore` (or equivalent) module/class:
   - `getSnapshotPath(): string` — define a known location, e.g.
     `<repo>/.daemon/aer-daemon.state.json` (override env `AER_STATE_DIR` to
     mirror the `AER_DAEMON_PID_DIR` convention). Keep it next to the PID file.
   - **Atomic write:** `writeSnapshot(snapshot): void` — serialize to JSON,
     write to `<path>.tmp`, then `fs.renameSync(tmp, final)`. `rename` is atomic
     on the same filesystem. Ensure the directory exists (`mkdirSync recursive`).
   - **Read:** `readSnapshot(): RuntimeStateSnapshot | null` — return null if
     missing or unparseable (never throw on a corrupt/partial file — that is the
     whole point of atomic writes).
   - `removeSnapshot(): void` — best-effort delete (called on graceful shutdown).
   - `getLastHeartbeat(): string | null` — convenience: read `capturedAt`.
4. Handle corrupt-file recovery: if `readSnapshot` parses a non-atomic leftover
   `<path>.tmp`, ignore/delete it (a crash left it behind).
5. Export from `packages/runtime/src/index.ts`:
   `export { StateStore } from "./persistence/state-store.js";` plus the
   `RuntimeStateSnapshot` type. Follow barrel conventions.

## Files
- **NEW** `packages/runtime/src/persistence/state-store.ts`
- **EDIT** `packages/runtime/src/index.ts` (add exports)

## Constraints
- **Atomic writes are mandatory** — never write directly to the final path.
  Always tmp + rename on the same filesystem.
- `readSnapshot` must never throw on missing/corrupt files — return null so
  callers can treat "no data" gracefully.
- Keep the snapshot shape **plain JSON-serializable** (no Date objects, no
  Maps — use ISO strings and records).
- Do not import from `@aer/cli`. This module is library code.
- Decide on a `schemaVersion` from day one to support future migrations.

## Verification
- `npm run build` green.
- Scratch test: write a snapshot, read it back, assert deep-equal.
- Kill the process mid-write simulation: write only the `.tmp` file (no rename),
  then `readSnapshot()` returns null (does not throw, does not read the partial).
- `npm test` still green.
