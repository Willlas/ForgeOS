# 04 — Persistent State Store Design

## Objective

Introduce a persistent state mechanism so the Runtime's status, health, and lifecycle information survive process boundaries and can be queried by external processes (CLI, monitors, scripts). This replaces direct in-memory access to Runtime state with file-based persistence that works across process isolation introduced by Task 01 (daemon) and Task 03 (package separation).

## Existing Architecture

- Single npm package (`@aer/runtime`) with all code compiled together
- `src/cli/index.ts` holds `globalRuntime` — an in-memory reference to the live Runtime instance
- CLI `status` command reads directly from the `globalRuntime` object
- No PID file, no state persistence, no external health endpoint
- When CLI exits, all Runtime state is lost (no disk representation)
- After Task 01, the Runtime runs as a separate daemon process — direct memory access is impossible
- After Task 03, CLI and Runtime live in separate packages — shared memory references are eliminated

## Components to Reuse

- `src/core/runtime.ts` — Runtime class exposes metrics and lifecycle state needed for persistence
- Runtime Metrics subsystem — Provides health/metrics data to be persisted
- `src/config/` — Configuration modules define paths and locations used by the persistence layer
- Daemon entry point (from Task 01) — Will trigger state updates on lifecycle events

## Components to Create

- **PID file manager module** — Creates, reads, validates, and cleans up PID files; detects orphaned/stale PID files from crashes
- **State persistence layer** — File-based atomic write mechanism for persisting Runtime status snapshots (state, health, metrics summary)
- **Health check module** — Provides a queryable health interface that combines PID file validation with process existence checks and persisted state readings

## Components to Modify

- `src/cli/index.ts` — Status command must read from persistent state instead of in-memory `globalRuntime` object
- Daemon entry point — Must write/update persistent state on lifecycle events (start, stop, health change)
- Runtime Metrics subsystem — Must expose data in a format consumable by the persistence layer

## Public Interfaces

**PID File Manager:**
- Creates a PID file at a known, cross-platform location when the daemon starts
- Reads the stored PID and validates whether the process is still alive
- Detects stale PID files (PID stored but process no longer exists)
- Cleans up PID files on graceful shutdown
- Handles PID collisions and concurrent access safely

**State Persistence Layer:**
- Writes atomic snapshots of Runtime state (status, health summary, metrics snapshot)
- Reads persisted state without requiring an IPC connection
- Supports basic queries: is running, current status, last heartbeat timestamp
- Uses atomic file operations to prevent corruption from crashes during write

**Health Check Module:**
- Combines PID validation with process existence and persisted state
- Returns accurate up/down/unknown state
- Queryable by CLI, external scripts, or monitoring tools
- Exposes a simple boolean health status and optional detailed status object

## File Responsibilities

| File / Module | Responsibility |
|---------------|----------------|
| PID file manager module | Create/read/validate/cleanup PID files; detect stale entries |
| State persistence layer | Atomic read/write of Runtime state snapshots to disk |
| Health check module | Combine PID + process check + persisted state into health query results |
| `src/cli/index.ts` (modified) | Replace in-memory status queries with persistent state reads |
| Daemon entry point (modified) | Trigger state persistence on lifecycle transitions |
| Runtime metrics (modified) | Expose data for consumption by persistence layer |

## Dependencies

- **Upstream**: Task 01 (`01_runtime_daemon_process.md`) — The daemon must exist with a stable PID to persist
- **Downstream**: Task 05 (`05_process_lifecycle_management.md`) — Crash recovery and auto-restart rely on persisted state for detecting failures and determining restart decisions
- **Peer**: Task 02 (`02_ipc_communication_layer.md`) — IPC may use health check data but the persistence layer operates independently as a fallback
- **Peer**: Task 03 (`03_cli_runtime_separation.md`) — Package boundaries dictate where PID manager and persistence modules belong

## Implementation Order

1. Create the PID file manager module with cross-platform path resolution
2. Implement atomic write/read operations for the state persistence layer
3. Create the health check module combining PID validation, process existence, and persisted state
4. Integrate state persistence calls into the daemon entry point lifecycle events
5. Modify `src/cli/index.ts` status command to read from persistent state
6. Handle stale PID file detection and automatic cleanup on start
7. Verify: start daemon → check PID file → kill process forcefully → verify orphan detection → restart daemon

## Acceptance Criteria

- A PID file is written when the daemon starts and cleaned up on graceful shutdown
- CLI can determine if the daemon is running by checking the PID file plus process existence
- Runtime status information is persisted and queryable without a live IPC connection
- Health check mechanism returns accurate up/down state
- Stale PID files from crashes are detected and handled automatically
- State updates use atomic operations to prevent corruption

## Definition of Done

- PID file exists at a known location when daemon is running
- CLI `status` command works by reading persistent state (not in-memory objects)
- External scripts can query Runtime health without using the CLI
- Orphaned PID files are cleaned up automatically on next start
- Unit tests cover PID lifecycle, race conditions, and crash scenarios
- Manual test: start daemon → verify PID file → kill process forcefully → verify orphan detection → restart daemon
