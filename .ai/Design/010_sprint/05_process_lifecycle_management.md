# Objective

Implement a complete lifecycle management system for the Runtime daemon including graceful shutdown, crash recovery, auto-restart, and watchdog monitoring. The system must ensure that the daemon process can start, run, stop, and recover from failures without leaving orphaned resources or corrupt state.

# Existing Architecture

- SIGINT handler exists in `src/cli/index.ts` (lines 118-126) but only handles CLI shutdown, not daemon lifecycle
- Runtime class (`src/core/runtime.ts`) exposes stop/shutdown methods but lacks structured lifecycle states
- No watchdog or monitoring mechanism exists
- No crash detection or auto-restart capability
- No resource cleanup coordinator (IPC listeners, PID files, temp files)
- Process management is implicit and unstructured

# Components to Reuse

- Runtime class (`src/core/runtime.ts`) — stop/shutdown hooks will be extended with lifecycle integration
- Daemon process manager from Task 01 — provides the daemon process to manage
- PID file management from Task 04 — provides persistence for crash detection and state tracking
- Logging infrastructure (if any exists) — shutdown logs must be written before termination

# Components to Create

1. **LifecycleStateMachine** — Finite state machine managing daemon states: starting, running, stopping, crashed, restarting
2. **WatchdogMonitor** — Periodic health checker that detects hung or unresponsive Runtime processes and triggers restart or alert
3. **CleanupCoordinator** — Orchestrates cleanup of all resources: IPC listeners, PID files, temp files, open handles, child processes
4. **GracefulShutdownHandler** — Handles SIGINT, SIGTERM, and unhandled exceptions; executes the graceful shutdown sequence with configurable timeout
5. **CrashRecoveryManager** — Detects crashes via PID/process checks, triggers automatic restart with max retry limit and exponential backoff

# Components to Modify

1. `src/cli/index.ts` — Remove current SIGINT handler logic; delegate to GracefulShutdownHandler
2. `src/core/runtime.ts` — Extend shutdown hooks to integrate with LifecycleStateMachine and CleanupCoordinator
3. Daemon entry point — Register signal handlers, wire restart logic, integrate with CrashRecoveryManager

# Public Interfaces

1. **LifecycleStateMachine**
   - `transition(nextState: LifecycleState): void` — Transition to a new state, enforcing valid transitions
   - `getState(): LifecycleState` — Return current state
   - `onStateChange(callback: (from: LifecycleState, to: LifecycleState) => void): void` — Register state change listener

2. **WatchdogMonitor**
   - `start(intervalMs: number, timeoutMs: number): void` — Begin monitoring with configurable interval and timeout
   - `stop(): void` — Stop the watchdog
   - `onUnresponsive(callback: () => void): void` — Register callback when Runtime is detected as unresponsive

3. **CleanupCoordinator**
   - `execute(shutdownContext: ShutdownContext): Promise<void>` — Run full cleanup sequence
   - `registerResource(cleanupFn: () => Promise<void>): void` — Register a resource for cleanup

4. **GracefulShutdownHandler**
   - `initialize(timeoutMs: number): void` — Configure shutdown timeout and register signal handlers
   - `trigger(reason: string): Promise<void>` — Initiate graceful shutdown sequence

5. **CrashRecoveryManager**
   - `start(maxRetries: number, initialBackoffMs: number): void` — Begin crash detection with retry policy
   - `stop(): void` — Stop crash recovery monitoring
   - `recordCrash(): void` — Record a crash event

# File Responsibilities

1. **`src/core/lifecycle/LifecycleStateMachine.ts`** — Define LifecycleState enum, valid transitions, state storage, and state change events
2. **`src/core/lifecycle/WatchdogMonitor.ts`** — Implement periodic health checks, timeout detection, and unresponsive callbacks
3. **`src/core/lifecycle/CleanupCoordinator.ts`** — Manage resource registration and sequential cleanup execution
4. **`src/core/lifecycle/GracefulShutdownHandler.ts`** — Register OS signal handlers, orchestrate stop-accept -> drain -> cleanup -> exit sequence
5. **`src/core/lifecycle/CrashRecoveryManager.ts`** — Implement PID/process monitoring, crash detection, restart logic with backoff and max retry enforcement

# Dependencies

- Task 01 (`01_runtime_daemon_process.md`) — Must have a daemon process to manage (hard dependency)
- Task 04 (`04_persistent_state_store.md`) — Needs PID file persistence and state store for crash detection (hard dependency)
- No dependency on Tasks 02, 03, or 06

# Implementation Order

1. `LifecycleStateMachine.ts` — Foundation for all lifecycle logic; other components depend on state management
2. `CleanupCoordinator.ts` — Required by GracefulShutdownHandler and CrashRecoveryManager for resource cleanup
3. `GracefulShutdownHandler.ts` — Depends on LifecycleStateMachine and CleanupCoordinator
4. `WatchdogMonitor.ts` — Depends on LifecycleStateMachine for state queries
5. `CrashRecoveryManager.ts` — Depends on all above components; integrates crash detection with restart and cleanup

# Acceptance Criteria

- [ ] Daemon handles SIGINT, SIGTERM, and unhandled exceptions with graceful shutdown
- [ ] Graceful shutdown completes or fails within a configurable timeout
- [ ] Crashed daemon automatically restarts (with max retry limit to prevent infinite loops)
- [ ] Watchdog detects unresponsive Runtime and triggers restart or alert
- [ ] All resources (IPC listeners, PID file, temp files) are cleaned up on exit
- [ ] Shutdown logs are written before the process terminates
- [ ] In-flight operations are either completed or safely aborted during shutdown

# Definition of Done

- Signal handlers registered for SIGINT, SIGTERM, and uncaught exceptions
- Graceful shutdown sequence implemented: stop accepting new work -> drain in-flight work -> cleanup resources -> exit
- Crash detection via PID/process check triggers automatic restart with configurable max retries and backoff
- Watchdog module can detect a hung process and act on it
- Clean exit leaves no orphaned files, listeners, or child processes
- Unit tests cover: graceful shutdown, crash restart loop prevention, watchdog timeout, resource cleanup
- Manual test validated: start daemon -> send SIGTERM -> verify clean exit -> kill -9 process -> verify auto-restart -> verify max retry cap
