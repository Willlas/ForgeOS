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
