## Deliverable
Create exactly ONE file: `.ai/Design/010_sprint/review/02_ipc_remaining_work.md` — no code changes, no other files touched. The document follows the structure mandated in the task (Objective, Current State, Remaining Work, Recommended Implementation Order, Acceptance Criteria, Definition of Done, Risks, Out of Scope).

## Findings source (basis of the gaps)
The IPC review placeholder is empty, so per your direction the Design 02 doc (`.ai/Design/010_sprint/02_ipc_communication_layer.md`) is the authoritative contract. I cross-checked its 6 Acceptance Criteria and 5 Definition-of-Done items against the implemented code (`src/runtime/ipc-{protocol,transport,server,client}.ts`, `daemon.ts`, `daemon-entry.ts`, `src/cli/index.ts`) to derive the gaps. Every task traces to a specific AC or DoD.

## Current State section will state
- Four IPC modules exist and are exported; daemon hosts the server, CLI is a client; newline-delimited JSON over Unix domain socket; 19-command protocol enum with error codes + per-command timeouts; "daemon not running" handled gracefully; CLI no longer references `globalRuntime` directly.
- Verified-passing ACs: #1 (basic command/response, for status+config only), #4 (errors/timeouts), #6 (graceful "daemon not running").
- Failing/partial ACs + DoD: concurrency (#2/DoD#3), full operation coverage (#3/DoD#2), serialization untested (#5/DoD#4), cross-platform transport, event push subsystem, remaining CLI wiring.

## Remaining Work — the 7 tasks (each section: Name / Why / Expected outcome / Components involved / Dependencies / Complexity)

1. **Dispatcher ↔ Runtime correctness** — Why: AC#3. `ipc-server.ts` dispatch uses optional-chaining `(x as any).method?.()` against methods that don't exist on real subsystems (`eventNames`, `getLogs`, `getInfo`, `snapshot`, `getSnapshot`), silently returning empty results. Outcome: every command dispatches to a real existing method (or an accessor added to the subsystem); `as any` hiding removed. Complexity: Medium.

2. **Multi-client concurrency** — Why: AC#2 + DoD#3. Server stores a single `this.socket` and overwrites on connect → only the last client is served. Outcome: connection pool (Set/Map), per-connection dispatch, stale-socket cleanup on disconnect; two simultaneous CLI sessions both answered. Complexity: Medium. (Blocks tasks 4, 6, 7.)

3. **Cross-platform transport** — Why: Components-to-Create "Windows named pipes or equivalent cross-platform mechanism" + Public Interface "Cross-platform compatibility (Windows + Unix)". Implementation is Unix-socket-path-only; the header comment claiming "TCP fallback" is unimplemented. Outcome: true Windows named pipe (`\\.\pipe\…`) on Windows, Unix socket elsewhere, or an implemented documented fallback; socket path resolution cross-platform. Complexity: High.

4. **Event push subsystem (daemon → CLI)** — Why: Public Interface `subscribe(eventType, handler)` + `IPCEvent` envelope + `events:subscribe` command, all currently dead (server never emits). Outcome: daemon EventBus events pushed as `IPCEvent` to subscribed connected clients; client `subscribe()` delivers them. Complexity: Medium-High. Depends on: 2.

5. **Complete CLI command wiring** — Why: DoD#2 "no direct calls remain" + Implementation Order steps 5–6. Only 2 of 19 commands wired; `workflows:*` are stubs; events/knowledge/metrics/logs/workspace/health/pause-resume have no CLI caller; lifecycle cmds bypass IPC via daemon manager. Outcome: every CLI command routes through IPC; stubs implemented; explicit documented policy for whether lifecycle commands use daemon-manager vs IPC. Complexity: Medium. Depends on: 1.

6. **Client reconnection & lifecycle robustness** — Why: Public Interface "Handles connection establishment, disconnection, and reconnection" (no reconnection logic exists today). Outcome: client auto-reconnect with backoff on transient loss; clean disconnect; pending-request cleanup. Complexity: Low-Medium. Depends on: 2.

7. **IPC test suite** — Why: DoD#4 "Unit tests cover IPC serialization, timeout, and error paths" (zero IPC tests today). Outcome: tests covering framing/serialization round-trip, timeout expiry, error paths (unknown command, invalid payload, connection refused, serialization error), multi-client concurrency, event delivery. Complexity: Medium. Depends on: 1, 2, 4, 5.

## Recommended Implementation Order
1 → (3 in parallel) → 2 → (4 and 6) → 5 → 7. (1 and 3 are independent foundations; 2 unblocks 4/6; 5 needs 1; 7 last.)

## Acceptance Criteria section
Checklist directly mirroring Design 02's 6 ACs plus the DoD items that map to these tasks (concurrency, full operation coverage, serialization correctness, cross-platform transport, graceful degradation), each phrased measurably (e.g., "N≥2 concurrent CLI sessions both receive correct responses").

## Definition of Done section
Checklist: all Design 02 DoD items satisfied; dispatcher has zero `as any` method-guess calls; transport works on Windows + Unix; events delivered end-to-end; no CLI direct Runtime access remains; IPC test suite green; sprint INDEX/review placeholder updated (note: only the new remaining-work file is created here — updating INDEX is called out as a follow-up, not done in this doc).

## Risks section (architectural only)
- Cross-platform socket-path/permission semantics differ (Windows pipe ACLs vs Unix tmpdir perms).
- Multi-client fan-out changes server threading/event-ordering model (event ordering, subscription isolation).
- Optional-chaining `as any` dispatch masks type drift between Runtime subsystem API and protocol — risk of silent regressions if subsystems evolve.
- Lifecycle-command routing policy (daemon-manager vs IPC) affects whether `restart` can race with in-flight IPC requests.
- Event push adds a new daemon→CLI direction that can backpressure/deserialize untrusted-shaped payloads.

## Out of Scope
- Rewriting the Design 02 doc; re-running the daemon (Task 01) validation; new protocol commands beyond the existing 19; auth/encryption of the IPC channel (Planning doc flags this — explicitly deferred); at-least-once/exactly-once delivery guarantees; performance/load testing; GUI/VS Code extension integration; any source-code implementation (this document is a work package for another model).

## Constraints honored
- No source code modified, no repo-wide review beyond what's needed, no Design rewrite, exactly one markdown file, no code samples in the doc, concise and actionable.