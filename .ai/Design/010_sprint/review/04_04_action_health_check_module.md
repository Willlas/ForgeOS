# Action 04_04 — Health check module

## Objective
Create the combined health-check module that Design 04 §"Public Interfaces"
requires: combines PID validation + process-existence + persisted state into an
accurate up/down/unknown result. This module does not exist today and is the key
to satisfying *"External scripts can query Runtime health without using the CLI."*

## Backlog reference
- **Severity:** Critical
- **Blocks:** 04_05 (CLI status rewire)

## Why it matters
Currently health is only available via the running daemon (HTTP `/health` is
static; IPC `health:check` returns in-memory `RuntimeHealth`). Neither works when
the daemon is **down** — exactly when an external monitor most needs to know the
state. Design 04 AC: "Health check mechanism returns accurate up/down state" and
"CLI can determine if the daemon is running by checking the PID file plus process
existence."

## Prerequisites
- **04_01** (PID manager) — for PID validation + stale detection.
- **04_02** (state-store) — for persisted-state reads when daemon is down.

## Steps
1. Create `packages/runtime/src/persistence/health-check.ts`.
2. Define a result type, e.g.:
   ```ts
   type HealthStatus = "up" | "down" | "unknown";
   interface HealthCheckResult {
     status: HealthStatus;
     pid: number | null;
     stalePidFile: boolean;          // pid file present but process dead
     snapshot: RuntimeStateSnapshot | null;  // last persisted state, if any
     reason?: string;                // human-readable explanation
   }
   ```
3. Implement `checkHealth(): HealthCheckResult` (and/or a class) that:
   - Reads the PID file (via `PidManager`).
   - If no PID file and no snapshot → `status: "unknown"` (never started, or
     cleaned up).
   - If PID file present:
     - Process alive → `status: "up"`, include the snapshot if present.
     - Process dead → `status: "down"`, `stalePidFile: true`, include the last
       snapshot (shows last known state before death).
   - Optionally enrich with the persisted snapshot regardless (last heartbeat,
     last known runtime state).
4. Do **not** require a network/IPC round-trip — this is an offline check reading
   only files + `process.kill(pid,0)`.
5. Export from `packages/runtime/src/index.ts`:
   `export { checkHealth } from "./persistence/health-check.js";` plus
   `HealthStatus`, `HealthCheckResult` types.

## Files
- **NEW** `packages/runtime/src/persistence/health-check.ts`
- **EDIT** `packages/runtime/src/index.ts` (add exports)
- **DEPENDS ON** `persistence/pid-manager.ts`, `persistence/state-store.ts`

## Constraints
- **Never throw** — a health checker that throws on missing files defeats its
  purpose. Catch and return `status: "unknown"` with a reason.
- **No I/O beyond local files** + the `process.kill(pid,0)` probe. No HTTP, no
  IPC socket connect.
- Do not import from `@aer/cli`.
- The "down vs unknown" distinction matters: `down` = we have evidence it was
  running (PID file or snapshot) but the process is gone; `unknown` = no evidence
  either way.

## Verification
- `npm run build` green.
- Scenarios (scratch or unit):
  - No PID file, no snapshot → `unknown`.
  - PID file with live pid → `up`.
  - PID file with dead pid → `down`, `stalePidFile: true`.
  - Snapshot present but no PID file → `unknown` (or `down` per your policy —
    document the choice) with the snapshot attached.
- An external script can `import { checkHealth } from "@aer/runtime-lib"` and
  print a result without spawning any process.
- `npm test` still green.
