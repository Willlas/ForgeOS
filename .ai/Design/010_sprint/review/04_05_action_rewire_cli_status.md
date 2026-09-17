# Action 04_05 — Rewire CLI status to persistent state

## Objective
Make the CLI `status` command read from the persistent state layer (via the
health-check module) instead of relying solely on IPC. This delivers Design 04
AC "Runtime status information is persisted and queryable without a live IPC
connection" and DoD "CLI status command works by reading persistent state."

## Backlog reference
- **Severity:** High
- **Blocks:** Nothing (this is a consumer of 04_04).

## Why it matters
Today `packages/cli/src/index.ts` L75-98 (the `status` handler) uses IPC only:
`IpcClient.call(IPCCommand.RuntimeStatus)`. When the daemon is down it prints
just "Daemon running: No" with no further information, because there is no
persisted state to read. After this action, status shows the last known state
even when the daemon is offline.

## Prerequisites
- **04_04** (health-check module) — status calls `checkHealth()`.

## Steps
1. Open `packages/cli/src/index.ts`.
2. Import `checkHealth` (and types) from `@aer/runtime-lib`.
3. Rewrite the `status` action handler to:
   - Call `checkHealth()` first (offline, always works).
   - Render based on `result.status`:
     - `"up"` — daemon alive; **then** attempt IPC to enrich with live runtime
       state (keep the existing `RuntimeStatus` call as the rich path). If IPC
       fails despite an "up" PID, surface that inconsistency.
     - `"down"` — daemon dead; show `stalePidFile` flag and the last persisted
       snapshot (`state`, `capturedAt`, `uptimeSeconds`) so the user sees the
       last known state.
     - `"unknown"` — no PID file and no snapshot; "Daemon running: No (never
       started or cleaned up)".
4. Keep the IPC path for the `"up"` case so live runtime state is still shown
   when available — persistent state is the **fallback**, not a replacement for
   live data.
5. Do not change other CLI commands (start/stop/restart/config) in this action.

## Files
- **EDIT** `packages/cli/src/index.ts` (status handler ~L75-98)

## Constraints
- `checkHealth()` must **never** make the CLI crash — wrap in try/catch and fall
  back to a clear message on any unexpected error.
- Preserve existing output formatting style for the "up + IPC" path to avoid
  surprising users.
- The status command must work with **no daemon running** (that is the whole
  point) — verify that case explicitly.

## Verification
- `npm run build` green.
- Manual / scratch:
  - Daemon down, no state file → "unknown" message, exit cleanly.
  - Daemon down, stale state file → "down" + last known state shown.
  - Daemon up → "up" + live runtime state via IPC.
- `npm test` still green.
