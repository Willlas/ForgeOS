# Aer Runtime Architecture Review - Final Report

## Architecture Summary

### Runtime Type
The Runtime is a persistent daemon-backed Runtime Service. The CLI starts a detached daemon process, and the daemon creates and owns the Runtime instance. Evidence: `packages/cli/src/daemon.ts:42-76`; `packages/cli/src/daemon-entry.ts:174-204`.

### Owner of Runtime
The daemon process owns the Runtime instance. `daemon-entry.ts` creates the Runtime and stores the reference used for heartbeat, IPC, and shutdown. Evidence: `packages/cli/src/daemon-entry.ts:99-101`, `174-204`; `packages/runtime/src/ipc-server.ts:22-31`.

### Lifecycle
The daemon writes its PID, starts the Runtime, writes an initial snapshot, maintains a heartbeat, listens for IPC requests, and remains alive until graceful shutdown or fatal-error handling. Crash supervision and retry backoff are installed by the CLI daemon manager. Evidence: `packages/cli/src/daemon-entry.ts:174-251`, `260-295`; `packages/cli/src/daemon.ts:29-84`; `packages/runtime/src/core/lifecycle/crash-recovery-manager.ts:47-129`.

### Communication Method
The CLI communicates with the daemon through a Node `net` Unix-domain socket transport using newline-delimited JSON messages. The CLI status command sends `IPCCommand.RuntimeStatus` through `IpcClient`; the daemon dispatches the request to the Runtime. Evidence: `packages/runtime/src/ipc-transport.ts:10-26`, `28-75`; `packages/cli/src/index.ts:78-102`; `packages/runtime/src/ipc-server.ts:34-57`.

### Persistence
Yes, process and Runtime state persist outside the CLI process while the daemon runs. The PID manager writes `aer-daemon.pid`, and the state store writes atomic JSON snapshots containing PID, state, health, timestamps, and metrics. Evidence: `packages/runtime/src/persistence/pid-manager.ts:19-57`; `packages/runtime/src/persistence/state-store.ts:17-67`; `packages/cli/src/daemon-entry.ts:182-225`.

---

## Multiple CLI Instances

### Can multiple CLI invocations communicate with the same Runtime?
YES.

#### If YES:
Each CLI invocation checks the shared PID file and connects to the daemon's shared IPC socket. Runtime commands are handled by the Runtime instance held inside the daemon process. Evidence: `packages/cli/src/daemon.ts:42-47`, `packages/cli/src/index.ts:78-102`, `packages/runtime/src/ipc-transport.ts:10-26`, `packages/runtime/src/ipc-server.ts:22-57`.

---

## Evidence Index

### Files Inspected
- `packages/cli/src/index.ts`
- `packages/cli/src/daemon.ts`
- `packages/cli/src/daemon-entry.ts`
- `packages/cli/src/ipc-client.ts`
- `packages/runtime/src/ipc-server.ts`
- `packages/runtime/src/ipc-transport.ts`
- `packages/runtime/src/persistence/pid-manager.ts`
- `packages/runtime/src/persistence/state-store.ts`
- `packages/runtime/src/core/runtime.ts`
- `packages/runtime/src/core/lifecycle/crash-recovery-manager.ts`
- `packages/runtime/package.json`
- `.ai/review/010_sprint/01_discover_bootstrap.md`
- `.ai/review/010_sprint/02_runtime_lifecycle.md`
- `.ai/review/010_sprint/03_cli_behaviour.md`
- `.ai/review/010_sprint/04_runtime_ownership.md`
- `.ai/review/010_sprint/05_architectural_classification.md`

### Relevant Classes
- `Runtime` - `packages/runtime/src/core/runtime.ts:111-152` - Runtime orchestration and lifecycle.
- `IpcServer` - `packages/runtime/src/ipc-server.ts:17-31` - Daemon-side IPC request handling.
- `IpcTransport` - `packages/runtime/src/ipc-transport.ts:16-20` - Socket server and client transport.
- `CrashRecoveryManager` - `packages/runtime/src/core/lifecycle/crash-recovery-manager.ts:37-47` - Crash retry policy and restart scheduling.
- `GracefulShutdownHandler` - `packages/runtime/src/core/lifecycle/graceful-shutdown-handler.ts` - Coordinated daemon shutdown.

### Relevant Functions/Methods
- `startDaemon` - `packages/cli/src/daemon.ts:42-84` - Spawns and detaches the daemon.
- `stopDaemon` - `packages/cli/src/daemon.ts:86-111` - Stops the daemon and removes process tracking.
- `main` - `packages/cli/src/daemon-entry.ts:174-251` - Bootstraps the daemon-owned Runtime.
- `getIpcClient` - `packages/cli/src/index.ts:25-29` - Creates a CLI IPC client.
- `IpcServer.dispatchRequest` - `packages/runtime/src/ipc-server.ts:34-85` - Maps IPC commands to Runtime operations.
- `writePidFile` - `packages/runtime/src/persistence/pid-manager.ts:42-57` - Persists the daemon PID.
- `writeSnapshot` - `packages/runtime/src/persistence/state-store.ts:49-67` - Atomically persists Runtime state.

---

## Final Verdict

The Runtime is:

[ x ] A persistent Runtime Service (Daemon)
[   ] A temporary in-process Runtime instantiated by the CLI

### Supporting Evidence

- `startDaemon` uses `spawn("node", ...)` with `detached: true`, creating a process separate from the CLI: `packages/cli/src/daemon.ts:55-63`.
- The daemon entrypoint creates and starts the Runtime after writing its own PID: `packages/cli/src/daemon-entry.ts:182-204`.
- The daemon remains alive through an unresolved promise while its IPC server and heartbeat are active: `packages/cli/src/daemon-entry.ts:225-251`.
- CLI status requests use IPC rather than accessing a module-level Runtime instance: `packages/cli/src/index.ts:78-102`.
- PID and snapshot files provide state outside the CLI process: `packages/runtime/src/persistence/pid-manager.ts:42-57`; `packages/runtime/src/persistence/state-store.ts:49-67`.

---

## Notes

- The Phase 1-5 review documents under `.ai/review/010_sprint/` describe an earlier in-process implementation and conflict with the current daemon-based code.
- This report reflects the current implementation evidence inspected above.
