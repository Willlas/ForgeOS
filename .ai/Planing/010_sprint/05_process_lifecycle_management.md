# 05 — Process Lifecycle Management

## Objective
Implement a complete lifecycle management system for the Runtime daemon including graceful shutdown, crash recovery, auto-restart, and watchdog monitoring.

## Why
Process shutdown is currently handled by a SIGINT handler in the CLI (`src/cli/index.ts:118-126`). There is no graceful daemon lifecycle, no watchdog process, no auto-restart mechanism, and no proper foreground/background process management. As the Runtime transitions to a long-lived daemon (Task 01), it needs robust lifecycle guarantees:
- Graceful shutdown that completes in-flight operations before exiting
- Crash detection and automatic restart
- Proper cleanup of resources (IPC listeners, file handles, PID files)
- Watchdog to detect hung or unresponsive Runtimes

## Components Involved
- Current SIGINT handler in `src/cli/index.ts` (lines 118-126)
- Runtime stop/shutdown methods (`src/cli/index.ts:102, 144`)
- Daemon process manager (Task 01)
- PID file management (Task 04)
- New watchdog/monitor module
- Resource cleanup routines

## Files Likely to Change
- `src/cli/index.ts` — SIGINT handler logic will move to daemon lifecycle manager
- Runtime class shutdown hooks (`src/core/runtime.ts`)
- Daemon entry point — Add graceful signal handling, restart logic
- New file: Watchdog/monitor module
- New file: Lifecycle state machine (states: starting, running, stopping, crashed, restarting)
- New file: Cleanup coordinator (IPC, PID file, temp files, open handles)

## Dependencies
- Depends on Task 01 (`01_runtime_daemon_process.md`) — Must have a daemon process to manage
- Depends on Task 04 (`04_persistent_state_store.md`) — Needs PID file and state for crash detection

## Risks
- Infinite restart loops if the Runtime crashes due to a persistent bug
- Graceful shutdown timeout: in-flight workflows may not complete, leading to data loss
- Watchdog false positives (slow operation vs actual hang)
- Windows signal handling differs from Unix (no SIGTERM default behavior, different process tree cleanup)
- Orphaned child processes if the daemon exits without cleaning spawned workers

## Acceptance Criteria
- [ ] Daemon handles SIGINT, SIGTERM, and unhandled exceptions with graceful shutdown
- [ ] Graceful shutdown completes or fails within a configurable timeout
- [ ] Crashed daemon automatically restarts (with max retry limit to prevent infinite loops)
- [ ] Watchdog detects unresponsive Runtime and triggers restart or alert
- [ ] All resources (IPC listeners, PID file, temp files) are cleaned up on exit
- [ ] Shutdown logs are written before the process terminates
- [ ] In-flight operations are either completed or safely aborted during shutdown

## Definition of Done
- Signal handlers registered for SIGINT, SIGTERM, and uncaught exceptions
- Graceful shutdown sequence: stop accepting new work -> drain in-flight work -> cleanup resources -> exit
- Crash detected via PID/process check triggers automatic restart (configurable max retries + backoff)
- Watchdog module can detect a hung process and act on it
- Clean exit leaves no orphaned files, listeners, or child processes
- Unit tests cover: graceful shutdown, crash restart loop prevention, watchdog timeout, resource cleanup
- Manual test: start daemon -> send SIGTERM -> verify clean exit -> kill -9 process -> verify auto-restart -> verify max retry cap
