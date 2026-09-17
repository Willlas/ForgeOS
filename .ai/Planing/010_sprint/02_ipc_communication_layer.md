# 02 — IPC Communication Layer

## Objective
Establish an inter-process communication (IPC) layer so the CLI can send commands to and receive responses from the independently running Runtime daemon.

## Why
Currently all communication is in-process: the CLI calls Runtime methods directly (`src/cli/index.ts` invokes `globalRuntime` methods). Once the Runtime moves to a separate daemon process (Task 01), this direct method call pattern breaks. An IPC layer is required so multiple CLI instances or sub-commands can communicate with a single shared Runtime process without spawning additional Runtimes.

## Components Involved
- Current direct method calls on `globalRuntime` in `src/cli/index.ts`
- New IPC transport module (named pipes, Unix domain sockets, or message queue)
- New RPC/command protocol definition (request/response schema)
- All CLI commands that currently interact with the Runtime
- Runtime subsystems: EventBus, Workspace, Knowledge, Metrics, Scheduler

## Files Likely to Change
- `src/cli/index.ts` — Replace direct `globalRuntime` calls with IPC messages
- All command handlers under `src/cli/` that reference Runtime state
- New file: IPC transport layer module
- New file: Command protocol / RPC schema definitions
- New file: IPC client wrapper (used by CLI to talk to daemon)
- New file: IPC server handler (runs inside daemon, dispatches to Runtime)

## Dependencies
- Depends on Task 01 (`01_runtime_daemon_process.md`) — The daemon must exist before IPC can connect to it

## Risks
- Choosing the wrong IPC mechanism for cross-platform support (Windows named pipes vs Unix sockets)
- Serialization overhead when passing complex objects (Knowledge state, EventBus events)
- Message ordering and delivery guarantees (at-least-once, exactly-once)
- Backward compatibility: existing tests assume in-process access
- Security: IPC endpoints could be accessed by unauthorized processes if not authenticated

## Acceptance Criteria
- [ ] CLI sends a command via IPC and receives a structured response from the daemon
- [ ] Multiple CLI instances can send commands to the same Runtime concurrently
- [ ] All current Runtime operations (start, stop, status, events) are available over IPC
- [ ] IPC messages include error handling and timeouts
- [ ] Complex objects (event payloads, knowledge state) serialize/deserialize correctly
- [ ] CLI gracefully handles "daemon not running" scenarios

## Definition of Done
- A bidirectional IPC channel exists between CLI process and daemon process
- Every Runtime operation reachable from the CLI works over IPC (no direct calls remain)
- Two simultaneous CLI sessions can query the same Runtime without conflict
- Unit tests cover IPC serialization, timeout, and error paths
- Manual test: start daemon -> open two CLI windows -> both interact with same Runtime
