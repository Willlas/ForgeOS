# Objective

Convert the architectural gaps between the **Design 02 (IPC Communication Layer)** contract and its current implementation into a structured, implementation-oriented work package. Design 02 (`.ai/Design/010_sprint/02_ipc_communication_layer.md`) is the authoritative contract; the implemented code in `src/runtime/ipc-*.ts`, `daemon.ts`, `daemon-entry.ts`, and `src/cli/index.ts` is the subject under evaluation. This document defines what remains to bring the implementation to full compliance, ordered and sized for execution by a coding model.

No source code is changed by this document.

# Current State

The IPC layer was delivered in commit `d4f032f` and is functionally present but incomplete against Design 02.

**Implemented and verified compliant:**
- Four IPC modules exist and are re-exported from `src/runtime/index.ts`: `ipc-protocol.ts`, `ipc-transport.ts`, `ipc-server.ts`, `ipc-client.ts`.
- Transport: Node `net` Unix domain socket, newline-delimited JSON framing, connect/disconnect lifecycle. Socket path resolved from `AER_IPC_SOCKET` or `os.tmpdir()/aer-daemon.sock`.
- Protocol (`ipc-protocol.ts`): 19-command enum (`IPCCommand`), 9 error codes (`IPCErrorCode`), `IPCRequest`/`IPCResponse`/`IPCEvent` envelopes, `generateRequestId()` correlation, per-command timeout map (`DEFAULT_TIMEOUT` 5s, `LONG_OPERATION_TIMEOUT` 30s).
- Server (`ipc-server.ts`): `listen()`/`close()`, command→Runtime dispatch switch, try/catch response formatting.
- Client (`ipc-client.ts`): `call()`, `subscribe()`, `disconnect()`, `connected` indicator; per-request `setTimeout`; pending-map keyed by request id.
- Daemon (`daemon-entry.ts`): hosts `IpcServer`, injects Runtime, listens, plus an HTTP `/health` endpoint on `AER_HEALTH_PORT` (3099).
- CLI (`src/cli/index.ts`): no longer references `globalRuntime` directly; uses an `IpcClient`. Lifecycle commands (`start`/`stop`/`restart`) go through the daemon manager; `status` and `config:list` go through IPC.

**Design 02 Acceptance Criteria — pass status:**
| # | Criterion | Status |
|---|-----------|--------|
| AC1 | CLI sends a command and receives a structured response | Pass (for `status` + `config:get` only) |
| AC2 | Multiple CLI instances connect to the same Runtime concurrently | **Fail** — server keeps a single socket |
| AC3 | All current Runtime operations available over IPC | **Partial** — protocol defines them; several dispatch targets don't exist; only 2 wired into CLI |
| AC4 | IPC messages include error handling and timeouts | Pass |
| AC5 | Complex objects serialize/deserialize correctly | **Untested** — mechanism (JSON) present, no verification |
| AC6 | CLI gracefully handles "daemon not running" | Pass |

**Design 02 Definition of Done — gaps:** DoD#2 (no direct calls remain — only 2/19 commands wired), DoD#3 (two simultaneous sessions — fails), DoD#4 (unit tests for serialization/timeout/error — zero IPC tests), DoD#5 (manual two-window test — cannot pass until AC2 fixed).

**Cross-platform:** Design 02 requires "Windows named pipes or equivalent cross-platform mechanism" and "Cross-platform compatibility (Windows + Unix)"; implementation is Unix-socket-path only, with a header comment claiming "TCP fallback" that is not implemented.

**Event push:** `IPCEvent`, `events:subscribe`, and `subscribe(eventType, handler)` are defined but dead — the server never emits events to clients.

# Remaining Work

## Task 1 — Dispatcher ↔ Runtime correctness

- **Why it is needed:** AC3 ("All current Runtime operations available over IPC"). The server's `dispatchRequest()` reaches subsystem methods through optional-chaining casts (e.g. `(bus as any).eventNames?.()`, `(lm as any).getLogs?.()`, `(ws as any).getInfo?.()`, `(ws as any).snapshot?.()`). Several of these methods do not exist on the real subsystems (EventBus, LogManager, Workspace). Optional chaining silently yields `[]`/`{}` instead of an error, so the commands *appear* to succeed while returning empty data. This is a correctness defect hidden by `as any`.
- **Expected outcome:** Every command dispatches to a real, existing method on its target subsystem (either an existing method, or an accessor explicitly added to that subsystem for this purpose). The `as any` method-guess pattern is removed from the dispatch table. Commands that cannot be fulfilled return a structured `IPCResponse` error (`UnknownCommand` or `InternalError`) rather than empty success.
- **Components involved:** `src/runtime/ipc-server.ts` (dispatch table), `src/core/eventbus.ts`, `src/core/logging.ts`, `src/core/workspace.ts`, `src/core/metrics.ts` (verify/extend accessors).
- **Dependencies:** None. Foundation for Tasks 5 and 7.
- **Estimated complexity:** Medium.

## Task 2 — Multi-client concurrency

- **Why it is needed:** AC2 and DoD#3. The server stores a single connection (`this.socket`) and overwrites it on every new connection. Consequently only the last-connected CLI client receives responses; earlier clients hang or time out. This directly violates the concurrency acceptance criterion.
- **Expected outcome:** The server maintains a connection set (or id→socket map). Each incoming request is dispatched and answered on the originating connection. Client-disconnection removes the connection and cancels any associated work. Two or more simultaneous CLI sessions each receive their own correct responses.
- **Components involved:** `src/runtime/ipc-server.ts` (connection registry, per-connection reply path, disconnect cleanup), `src/runtime/ipc-transport.ts` (per-connection lifecycle hooks).
- **Dependencies:** None strictly, but it unblocks Tasks 4, 6, and 7.
- **Estimated complexity:** Medium.

## Task 3 — Cross-platform transport

- **Why it is needed:** Design 02 "Components to Create" requires "Windows named pipes or equivalent cross-platform mechanism," and the Public Interface requires "Cross-platform compatibility (Windows + Unix)." The current transport uses only Unix-domain-socket path addressing (`{ path }`); on Windows a filesystem `.sock` is not a true named pipe. A header comment in `ipc-transport.ts` advertises a "TCP fallback" that does not exist.
- **Expected outcome:** A single, documented cross-platform strategy. Either (a) true Windows named pipes (`\\.\pipe\…`) on Windows and Unix domain sockets elsewhere, with platform detection at listen/connect time, or (b) an explicitly implemented and documented TCP-loopback fallback. The advertised-but-missing fallback is either implemented or the comment corrected. Socket/pipe path resolution and permissions are handled per platform.
- **Components involved:** `src/runtime/ipc-transport.ts` (addressing, listen/connect, framing remains), `src/runtime/ipc-server.ts`, `src/runtime/ipc-client.ts` (path/endpoint negotiation), `daemon-entry.ts`.
- **Dependencies:** None. May proceed in parallel with Tasks 1 and 2.
- **Estimated complexity:** High.

## Task 4 — Event push subsystem (daemon → CLI)

- **Why it is needed:** Design 02 Public Interface specifies `subscribe(eventType, handler)`; the protocol defines the `IPCEvent` envelope and the `events:subscribe`/`events:unsubscribe` commands. All three are currently dead code: the server never pushes events, so `client.subscribe()` can never fire. This leaves the async-event half of the IPC contract unimplemented.
- **Expected outcome:** The daemon subscribes to its own EventBus (or equivalent event source) and forwards selected events to connected clients as `IPCEvent` messages, respecting each client's `events:subscribe` filter. The client deserializes `IPCEvent` and delivers it through `subscribe()` handlers. Unsubscribe cancels delivery to that client.
- **Components involved:** `src/runtime/ipc-server.ts` (event emission, per-client subscription registry — depends on Task 2's connection registry), `src/runtime/ipc-client.ts` (event dispatch), `src/core/eventbus.ts` (event source), `ipc-protocol.ts` (`IPCEvent` payload contract).
- **Dependencies:** Task 2 (multi-client registry needed to fan events to the right clients).
- **Estimated complexity:** Medium-High.

## Task 5 — Complete CLI command wiring

- **Why it is needed:** DoD#2 ("no direct calls remain") and Design 02 Implementation Order steps 5–6 ("Replace direct `globalRuntime` calls … one command at a time"; "Update all CLI command handlers to route through IPC"). Today only `status` and `config:list` use IPC; `workflows:list` and `workflows:start` are stubs; events, knowledge, metrics, logs, workspace, health, and pause/resume have no CLI caller; lifecycle commands bypass IPC via the daemon manager.
- **Expected outcome:** Every CLI command that needs Runtime state routes through the `IpcClient`. Stubs (`workflows:*`) are implemented over IPC. A single, documented policy decides whether lifecycle commands (`start`/`stop`/`restart`) use the daemon manager, IPC, or both — and that policy is applied consistently. No CLI code path constructs or calls the Runtime directly.
- **Components involved:** `src/cli/index.ts` and any `src/cli/` handlers, `src/runtime/ipc-client.ts`, `src/runtime/daemon.ts` (for the lifecycle-routing policy).
- **Dependencies:** Task 1 (commands must resolve to real methods before wiring).
- **Estimated complexity:** Medium.

## Task 6 — Client reconnection & lifecycle robustness

- **Why it is needed:** Design 02 Public Interface states the transport "Handles connection establishment, disconnection, and reconnection." The client implements connect/disconnect but no reconnection: a transient socket drop leaves the client in a broken state, with pending requests cleaned up on timeout but no attempt to recover.
- **Expected outcome:** On transient connection loss the client attempts reconnection with bounded backoff; on clean `disconnect()` it does not reconnect. Pending requests are cleared or retried according to a documented rule. Reconnect state is observable through the connection-status indicator.
- **Components involved:** `src/runtime/ipc-client.ts`, `src/runtime/ipc-transport.ts`.
- **Dependencies:** Task 2 (per-connection cleanup on the server side).
- **Estimated complexity:** Low-Medium.

## Task 7 — IPC test suite

- **Why it is needed:** DoD#4 ("Unit tests cover IPC serialization, timeout, and error paths"). There are currently zero IPC tests anywhere under `src/runtime/__tests__/` or `tests/`. Without tests, the dispatcher correctness (Task 1), concurrency (Task 2), and serialization (AC5) cannot be verified or protected against regression.
- **Expected outcome:** A test suite covering: transport framing and serialization round-trip (including complex event/knowledge payloads → AC5); timeout expiry path; error paths per `IPCErrorCode` (unknown command, invalid payload, connection refused, serialization error); multi-client concurrency (≥2 clients, interleaved requests); event delivery end-to-end. The suite runs green in the project's existing test runner.
- **Components involved:** New test files under `src/runtime/__tests__/` (mirroring existing test conventions), exercising `ipc-transport.ts`, `ipc-protocol.ts`, `ipc-server.ts`, `ipc-client.ts`.
- **Dependencies:** Tasks 1, 2, 4, 5 (tests assert the corrected behavior).
- **Estimated complexity:** Medium.

# Recommended Implementation Order

1. **Task 1** — Dispatcher correctness (independent foundation; required before meaningful CLI wiring or tests).
2. **Task 3** — Cross-platform transport (independent; run in parallel with Task 1).
3. **Task 2** — Multi-client concurrency (unblocks Tasks 4, 6, 7).
4. **Task 4** and **Task 6** — Event push and client reconnection (both depend only on Task 2; run in parallel).
5. **Task 5** — Complete CLI wiring (depends on Task 1; benefits from Tasks 4/6 being available).
6. **Task 7** — Test suite (depends on all corrected behaviors; written last so it asserts the final contract).

# Acceptance Criteria

Each criterion maps to Design 02 and is phrased to be measurable.

- [ ] **AC1 — Command/response:** A CLI command sent over IPC returns a structured `IPCResponse` from the daemon (currently true for 2 commands; must hold for all wired commands).
- [ ] **AC2 — Concurrency:** ≥2 simultaneous CLI sessions issuing interleaved commands each receive their own correct, complete responses with no cross-talk and no starvation.
- [ ] **AC3 — Full operation coverage:** Every Runtime operation currently reachable from the CLI is reachable over IPC, and every dispatched command resolves to a real subsystem method (no empty-success masking).
- [ ] **AC4 — Errors/timeouts:** Each `IPCErrorCode` is reachable and correctly produced; per-command timeouts fire and reject/resolve as specified.
- [ ] **AC5 — Serialization:** Complex objects (event payloads, knowledge state) round-trip through framing + JSON without loss; verified by tests.
- [ ] **AC6 — Graceful degradation:** CLI reports "daemon not running" cleanly and exits without an unhandled exception when no daemon is present.
- [ ] **Cross-platform:** The same CLI↔daemon exchange succeeds on Windows and on a Unix platform using the documented transport strategy.
- [ ] **Events:** A daemon-originated event reaches a subscribed CLI handler end-to-end.
- [ ] **Tests:** The IPC test suite exists and passes, covering serialization, timeout, and every error path.

# Definition of Done

- [ ] A bidirectional IPC channel exists between the CLI process and the daemon process (exists today; retain).
- [ ] Every Runtime operation reachable from the CLI works over IPC; no direct Runtime calls remain in `src/cli/`.
- [ ] Two simultaneous CLI sessions query the same Runtime without conflict (verified by test + manual two-window check).
- [ ] Unit tests cover IPC serialization, timeout, and error paths, and pass.
- [ ] The dispatch table contains no `as any` method-guess calls; each command maps to a verified subsystem method.
- [ ] Transport works on Windows and Unix per a single documented strategy; the stale "TCP fallback" comment is resolved (implemented or corrected).
- [ ] Daemon→CLI event delivery is functional and filtered by client subscription.
- [ ] Client reconnects on transient loss with bounded backoff and cleans up pending requests.
- [ ] The lifecycle-command routing policy (daemon manager vs IPC vs both) is documented and applied consistently.
- [ ] Sprint `INDEX.md` and the empty review placeholder are updated to reflect this work (follow-up; not part of this document).

# Risks

Architectural risks only.

- **Cross-platform address/permission semantics:** Windows named-pipe ACLs and Unix `tmpdir` socket permissions behave differently; an incorrect strategy can produce connection-refused or privilege-escalation exposure.
- **Multi-client fan-out changes the server's concurrency model:** Introducing per-connection state affects event ordering, subscription isolation, and the correctness of in-flight request bookkeeping.
- **`as any` dispatch masks type drift:** Optional-chaining casts hide a mismatch between the Runtime subsystem API and the protocol contract; subsystem evolution can silently turn a working command into an empty result.
- **Lifecycle-command routing policy:** If `start`/`stop`/`restart` use the daemon manager while ordinary commands use IPC, a `restart` can race with in-flight IPC requests and tear down the channel mid-response.
- **New daemon→CLI direction for events:** Event push introduces untrusted-shaped payloads entering the client deserializer and can backpressure a slow client; both need explicit handling.

# Out of Scope

- Rewriting or altering the Design 02 document.
- Re-running or updating the Task 01 (daemon) validation report.
- Adding protocol commands beyond the existing 19 in `IPCCommand`.
- Authentication, authorization, or encryption of the IPC channel (flagged in the Planning doc as a separate concern; explicitly deferred here).
- Delivery-guarantee semantics (at-least-once / exactly-once) for commands or events.
- Performance, load, or stress testing.
- GUI / VS Code extension integration (downstream sprint).
- Any source-code implementation. This is a work package for a separate implementing model.
