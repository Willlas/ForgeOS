# 01 — Runtime Daemon Process Design

## Objective

Create a persistent background process for the ForgeOS Runtime so it survives CLI exit and can be shared across multiple CLI invocations. The Runtime transitions from an in-process library instantiated inside the CLI to a standalone long-lived Node.js process managed by a dedicated daemon entry point.

## Existing Architecture

- Single npm package (`@aer/runtime`) with all code compiled together
- `src/core/runtime.ts` defines the Runtime class
- `src/cli/index.ts` instantiates the Runtime directly at line 33 via `globalRuntime`
- CLI owns the Runtime lifecycle: creation (line 33), start (line 39), stop (line 102, 144)
- SIGINT handler in CLI (`src/cli/index.ts:118-126`) shuts down the Runtime when CLI exits
- No daemon process, no background service, no fork/spawn mechanism
- When CLI exits, Runtime dies with it — no persistence across sessions

## Components to Reuse

- `src/core/runtime.ts` — Runtime class (will run inside daemon process instead of CLI)
- Runtime subsystems: EventBus, Workspace, Knowledge, Metrics, Scheduler
- `src/config/` — Configuration modules for Runtime initialization
- `src/providers/` — Provider implementations used by Runtime
- `src/workflows/` — Workflow definitions

## Components to Create

- **Daemon entry point** — A new executable module that instantiates and manages the Runtime as a long-lived process, independent of any CLI invocation
- **Daemon manager module** — Programmatic interface to start, stop, and restart the daemon process
- **Background process strategy** — Cross-platform mechanism for running the daemon in the background (Windows-compatible approach)

## Components to Modify

- `src/cli/index.ts` — Remove in-process Runtime creation; CLI must connect to the existing daemon instead of creating a new Runtime instance
- `src/core/runtime.ts` — Add lifecycle hooks required for daemon mode (daemon-ready signaling, health reporting)
- Root `package.json` — Add bin entry or start script for the daemon process

## Public Interfaces

**Daemon Entry Point:**
- Starts the ForgeOS Runtime as an independent Node.js process
- Accepts command-line flags for daemon configuration (verbose, config path, etc.)
- Runs in background mode without blocking terminal interaction
- Exposes programmatic start/stop/restart operations

**Daemon Manager Module:**
- `start()` — Launch the daemon process if not already running
- `stop()` — Gracefully terminate the daemon process
- `restart()` — Stop and restart the daemon process
- `isRunning()` — Determine if a daemon instance is currently active

## File Responsibilities

| File / Module | Responsibility |
|---------------|----------------|
| Daemon entry point | Instantiate Runtime, initialize subsystems, keep process alive, handle signals |
| Daemon manager module | Programmatic control: start, stop, restart, status queries |
| `src/cli/index.ts` (modified) | Remove Runtime instantiation, connect to daemon instead |
| `src/core/runtime.ts` (modified) | Add daemon-mode lifecycle hooks |

## Dependencies

- **Upstream**: None (root task in the dependency graph)
- **Downstream**: Task 02 (IPC layer), Task 04 (persistent state), Task 05 (lifecycle management) all depend on the daemon process existing
- **Task 03 coordination**: Package separation boundaries must be respected; daemon belongs to Runtime package scope

## Implementation Order

1. Create the daemon entry point module as a new executable file
2. Implement the daemon manager module with start/stop/restart operations
3. Add lifecycle hooks to the Runtime class for daemon mode readiness signaling
4. Modify `src/cli/index.ts` to remove direct Runtime instantiation
5. Add bin entry or npm script for the daemon process in `package.json`
6. Implement cross-platform background process strategy
7. Verify: start daemon → open CLI → close CLI → daemon still running

## Acceptance Criteria

- A dedicated process can start the ForgeOS Runtime independently of any CLI invocation
- The Runtime process survives after the CLI process exits
- The daemon can be started, stopped, and restarted explicitly
- The daemon does not block terminal interaction (runs in background)
- Starting a second CLI instance does NOT create a second Runtime

## Definition of Done

- The Runtime runs as a separate long-lived Node.js process
- CLI no longer creates the Runtime instance directly
- There is a clear programmatic way to start/stop the daemon process
- Manual testing confirms: start daemon → open CLI → close CLI → daemon still running


## GAPS 

# IMPLEMENTATION VALIDATION REPORT
**Design:** `.ai/design/010_sprint/01_runtime_daemon_process.md`

---

## Acceptance Criteria

- **[FAIL]** A dedicated process can start the ForgeOS Runtime independently of any CLI invocation.
  `daemon-entry.ts` calls `startDaemon()` which creates a Runtime in-process. There is no mechanism to spawn/fork it as an independent process. No `child_process`, no separate binary execution path, no cross-process isolation.

- **[FAIL]** The Runtime process survives after the CLI process exits.
  `src/cli/index.ts` still creates its own Runtime directly at line 33 (`createRuntime(...)`) and starts it at line 39. The CLI owns the full Runtime lifecycle. No separate daemon is involved.

- **[FAIL]** The daemon can be started, stopped, and restarted explicitly.
  `daemon.ts` exports `startDaemon()` and `stopDaemon()`, but there is NO `restart()` function. The design explicitly requires `restart()` at line 48.

- **[FAIL]** The daemon does not block terminal interaction (runs in background).
  No background process strategy exists. `daemon-entry.ts` runs synchronously in the foreground. No cross-platform detachment mechanism (no `child_process.spawn` with detached mode, no Windows-compatible background strategy). Design line 29 calls for this — entirely missing.

- **[FAIL]** Starting a second CLI instance does NOT create a second Runtime.
  Each CLI invocation creates its own independent Runtime. No single-instance guard, no PID file, no lock file, no inter-process coordination.

---

## Definition of Done

- **[FAIL]** The Runtime runs as a separate long-lived Node.js process.
  `daemon.ts` manages a module-level `globalRuntime` variable — not a separate process. Zero inter-process boundary.

- **[FAIL]** CLI no longer creates the Runtime instance directly.
  `src/cli/index.ts` line 33: `const runtime = createRuntime({...})`. The CLI still creates and owns the Runtime directly.

- **[FAIL]** There is a clear programmatic way to start/stop the daemon process.
  `startDaemon()` and `stopDaemon()` operate on an in-process variable, not an external process. `restart()` is missing. `isDaemonRunning()` checks a local variable, not whether a daemon process is running on the system.

- **[FAIL]** Manual testing confirms: start daemon → open CLI → close CLI → daemon still running.
  Cannot be confirmed because the architecture does not support it. No daemon-to-CLI connection exists.

---

## Public Interfaces Verification

| Interface | Design Spec | Implementation | Status |
|-----------|-------------|----------------|--------|
| Daemon accepts CLI flags (verbose, config path) | Line 41 | Only `--verbose` and `--environment`; no `--config` path | Partial |
| `start()` — Launch daemon if not running | Line 46 | In-process only | Mismatch |
| `stop()` — Gracefully terminate daemon | Line 47 | In-process only | Mismatch |
| `restart()` — Stop and restart daemon | Line 48 | **Missing entirely** | Missing |
| `isRunning()` — Determine if active | Line 49 | Checks local variable, not system process | Mismatch |

---

## Architecture Deviations

1. **No separate process boundary.** Design states "Runtime transitions from an in-process library to a standalone long-lived Node.js process." Implementation keeps everything in-process.
2. **No IPC or cross-process communication.** Design requires CLI to "connect to the existing daemon instead of creating a new Runtime instance." The CLI creates its own Runtime with no socket, pipe, or IPC mechanism.
3. **`isDaemonRunning()` does not match architectural intent.** Returns true only within the same Node.js process — cannot detect a daemon from a separate CLI invocation.
4. **No singleton/lock mechanism.** No PID file, lock file, or coordination to prevent multiple Runtimes.

---

## Missing Work

1. `restart()` function in daemon manager (Design line 48).
2. Cross-platform background process strategy for launching daemon as detached process (Design line 29).
3. CLI-to-daemon connection — remove direct `createRuntime()` from CLI (Design line 33, Components to Modify).
4. Daemon-mode lifecycle hooks in `src/core/runtime.ts` — daemon-ready signaling (Design line 34).
5. Config path CLI flag for daemon entry point (Design line 41).
6. Inter-process coordination for single Runtime instance (Acceptance Criterion line 82).

---

## TODO/FIXME Check
No TODO or FIXME comments found in `daemon-entry.ts` or `daemon.ts`. **Pass.**

---

**Implementation Status:** INCOMPLETE

**Final Verdict:** IMPLEMENTATION INCOMPLETE