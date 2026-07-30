# 02 — IPC Communication Layer Design

## Objective

Establish an inter-process communication (IPC) layer so the CLI can send commands to and receive responses from the independently running Runtime daemon. All current direct method calls on the Runtime object must be replaced with IPC message exchanges.

## Existing Architecture

- `src/cli/index.ts` invokes Runtime methods directly via `globalRuntime` reference
- All CLI command handlers call Runtime subsystems (EventBus, Workspace, Knowledge, Metrics, Scheduler) through in-process method calls
- No serialization layer exists — all data passes as native JavaScript objects within a single process
- No message protocol, no transport mechanism, no request/response pattern
- Tests assume in-process access to Runtime state

## Components to Reuse

- Daemon entry point from Task 01 (daemon process will host the IPC server)
- Daemon manager module from Task 01 (start/stop operations needed before IPC can connect)
- Runtime class and subsystems as the backend targets for IPC-dispatched commands
- CLI command handlers from `src/cli/index.ts` (logic reused, but invocation mechanism changes)

## Components to Create

- **IPC transport module** — Cross-platform bidirectional communication channel (Windows named pipes or equivalent cross-platform mechanism)
- **Command protocol / RPC schema definitions** — Request/response message format with command types, payload schemas, error codes, and correlation IDs
- **IPC client wrapper** — Used by CLI to connect to the daemon IPC endpoint and send/receive messages
- **IPC server handler** — Runs inside the daemon process, receives IPC messages, dispatches to appropriate Runtime methods, returns responses

## Components to Modify

- `src/cli/index.ts` — Replace every direct `globalRuntime` method call with an IPC message sent through the client wrapper
- All CLI command handlers under `src/cli/` that currently reference Runtime state — Route through IPC instead of direct access
- Daemon entry point — Initialize and start the IPC server handler at startup

## Public Interfaces

**IPC Transport Module:**
- Provides a bidirectional channel between two Node.js processes
- Supports sending structured messages with request IDs for response correlation
- Handles connection establishment, disconnection, and reconnection
- Cross-platform compatibility (Windows + Unix)

**Command Protocol / RPC Schema:**
- Defines message structure: command type, payload, metadata, error handling
- Maps each Runtime operation to a protocol command (start, stop, status, event queries, etc.)
- Includes timeout configuration per command type
- Serialization format for complex objects (event payloads, knowledge state)

**IPC Client Wrapper (CLI side):**
- `call(command, payload)` — Send a request and await response
- `subscribe(eventType, handler)` — Register for async events from daemon
- `disconnect()` — Close the IPC connection
- Connection status indicator

**IPC Server Handler (daemon side):**
- `listen()` — Start accepting IPC connections
- Command dispatch table mapping protocol commands to Runtime method invocations
- Response formatting with error handling
- Client disconnection cleanup

## File Responsibilities

| File / Module | Responsibility |
|---------------|----------------|
| IPC transport module | Low-level cross-platform pipe/socket creation, message framing, connection lifecycle |
| Command protocol definitions | Message schemas, command types, request/response structures, error codes |
| IPC client wrapper | CLI-side interface for sending commands and receiving responses from daemon |
| IPC server handler | Daemon-side listener that receives messages, dispatches to Runtime, returns results |
| `src/cli/index.ts` (modified) | Replace direct Runtime calls with IPC client calls |

## Dependencies

- **Upstream**: Task 01 (`01_runtime_daemon_process.md`) — The daemon process must exist before IPC can connect to it
- **Downstream**: None directly, but Tasks 04 and 05 will use IPC for state queries and lifecycle commands
- **Task 03 coordination**: Client wrapper belongs in CLI package; server handler belongs in Runtime package

## Implementation Order

1. Define the command protocol / RPC schema with all Runtime operations as protocol commands
2. Create the IPC transport module with cross-platform support
3. Implement the IPC server handler inside the daemon entry point
4. Implement the IPC client wrapper for use by CLI
5. Replace direct `globalRuntime` calls in `src/cli/index.ts` with IPC client calls (one command at a time)
6. Update all CLI command handlers to route through IPC
7. Test bidirectional communication: CLI sends command → daemon processes → response returns to CLI
8. Verify multiple CLI instances can connect simultaneously

## Acceptance Criteria

- CLI sends a command via IPC and receives a structured response from the daemon
- Multiple CLI instances can send commands to the same Runtime concurrently
- All current Runtime operations (start, stop, status, events) are available over IPC
- IPC messages include error handling and timeouts
- Complex objects (event payloads, knowledge state) serialize/deserialize correctly
- CLI gracefully handles "daemon not running" scenarios

## Definition of Done

- A bidirectional IPC channel exists between CLI process and daemon process
- Every Runtime operation reachable from the CLI works over IPC (no direct calls remain)
- Two simultaneous CLI sessions can query the same Runtime without conflict
- Unit tests cover IPC serialization, timeout, and error paths
- Manual test: start daemon → open two CLI windows → both interact with same Runtime
