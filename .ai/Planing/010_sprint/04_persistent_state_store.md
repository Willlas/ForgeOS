# 04 — Persistent State Store

## Objective
Introduce a persistent state mechanism so the Runtime's status, health, and lifecycle information survive process boundaries and can be queried by external processes (CLI, monitors, scripts).

## Why
Currently, all Runtime state lives in an in-memory object (`globalRuntime` in `src/cli/index.ts`). The `status` command reads directly from this live object. There is no PID file, no state persistence, and no external health endpoint. Once the Runtime becomes a daemon (Task 01), the CLI cannot inspect Runtime state through direct memory access. A persistent mechanism is required for:
- Querying if the daemon is running
- Reading Runtime health/metrics without IPC round-trips for basic checks
- Enabling crash recovery and auto-restart decisions (Task 05)

## Components Involved
- `src/cli/index.ts` — Current `status` command and `globalRuntime` references
- Runtime metrics subsystem
- New state persistence module
- PID file management
- Health/status endpoint or file-based state snapshot

## Files Likely to Change
- `src/cli/index.ts` — Status command will read from persistent state instead of in-memory object
- Metrics/logging subsystems (may write to persistent store)
- New file: PID file manager module
- New file: State persistence layer (file-based or lightweight database)
- New file: Health check module
- Daemon entry point (will write/update state on lifecycle events)

## Dependencies
- Depends on Task 01 (`01_runtime_daemon_process.md`) — The daemon process must exist and have a stable PID to persist

## Risks
- File-based state introduces race conditions if multiple CLI instances read/write simultaneously
- State staleness: persisted state may lag behind real-time Runtime state
- Choosing between simple file storage vs lightweight DB (SQLite, LevelDB) adds complexity
- PID file collisions or orphaned PID files after crashes
- Cross-platform file path differences (Windows vs Unix temp directories)

## Acceptance Criteria
- [ ] A PID file is written when the daemon starts and cleaned up on graceful shutdown
- [ ] CLI can determine if the daemon is running by checking the PID file + process existence
- [ ] Runtime status information is persisted and queryable without a live IPC connection
- [ ] Health check mechanism returns accurate up/down state
- [ ] Stale PID files (from crashes) are detected and handled
- [ ] State updates are atomic to prevent corruption

## Definition of Done
- PID file exists at a known location when daemon is running
- CLI `status` command works by reading persistent state (not in-memory objects)
- External scripts can query Runtime health without using the CLI
- Orphaned PID files are cleaned up automatically on next start
- Unit tests cover PID lifecycle, race conditions, and crash scenarios
- Manual test: start daemon -> verify PID file -> kill process forcefully -> verify orphan detection -> restart daemon