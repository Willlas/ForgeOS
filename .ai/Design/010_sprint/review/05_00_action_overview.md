# Design 05 — Process Lifecycle Management — Action Overview

This work package converts the Design 05 contract into a sequence of self-contained
actions for a coding model. The Design document is the authoritative contract:
`.ai/Design/010_sprint/05_process_lifecycle_management.md`.

Design 04 is **complete and validated** (PID manager, state-store, health-check
all shipped under `@aer/runtime-lib`; build green). Design 05 builds on that
foundation — it reuses the Design-04 PID liveness, snapshot, and health-check
primitives.

> Unlike Design 04 (which consolidated pre-existing, duplicated PID logic),
> Design 05 is **entirely greenfield**. None of the five lifecycle modules exist;
> there is no `lifecycle/` directory, no `uncaughtException`/`unhandledRejection`
> handling, no shutdown timeout, no supervisor auto-restart, and the IPC `.sock`
> file is never unlinked on close (an orphaned resource). The split below is sized
> small — each action touches exactly one file — so a modest coding model can
> complete each in isolation.

## Architecture decision (made)

**All new lifecycle modules live in `@aer/runtime-lib`** under
`packages/runtime/src/core/lifecycle/`:

```
packages/runtime/src/core/lifecycle/
├── types.ts                     ← LifecycleState enum, ShutdownContext, BackoffPolicy
├── lifecycle-state-machine.ts   ← FSM: valid-transition guard + listeners
├── backoff.ts                   ← pure exponential-backoff + jitter calculator
├── cleanup-coordinator.ts       ← resource registry + sequential best-effort cleanup
├── graceful-shutdown-handler.ts ← SIGINT/SIGTERM/uncaught/unhandled + timeout guard
├── watchdog-monitor.ts          ← periodic health probe → onUnresponsive
├── crash-detector.ts            ← polls PID liveness → onCrash
└── crash-recovery-manager.ts    ← restart with backoff + maxRetries cap
```

**Rationale:** Design 05 DoD requires *"External scripts can query Runtime health
without using the CLI"* (already satisfied by Design 04) and the lifecycle
modules must be importable by the daemon (`@aer/cli`) **and** testable in
isolation. Keeping them in the library package (mirroring `persistence/`) means
the daemon imports the handlers/coordinators, tests import them via relative
paths, and the public surface is re-exported from the package barrel in one
dedicated action (05_11). No lifecycle code lives in `@aer/cli` — the CLI only
*wires* it into `daemon-entry.ts` and `daemon.ts`.

## Current state (gap analysis)

| Design 05 requirement | Status |
|---|---|
| 1. LifecycleStateMachine (`starting/running/stopping/crashed/restarting`) | **DOES NOT EXIST** — only the ad-hoc `RuntimeState` enum (`runtime.ts:29-37`) exists; no FSM, no transition guard, no listeners. |
| 2. WatchdogMonitor (periodic probe → onUnresponsive) | **DOES NOT EXIST** — a *worker-level* watchdog exists (`worker-runtime.ts:252-354`) but watches individual workers, not the daemon process. |
| 3. CleanupCoordinator (resource registry) | **DOES NOT EXIST** — cleanup is scattered: `runtime.stop()` (`runtime.ts:218-258`) owns subsystems; `daemon-entry.ts:87-125` owns PID/snapshot/IPC/health-server. No registry, no `ShutdownContext`. |
| 4. GracefulShutdownHandler (signals + timeout) | **DOES NOT EXIST** — `daemon-entry.ts:130-131` registers SIGINT/SIGTERM only; **no `uncaughtException`, no `unhandledRejection`** anywhere in the repo; shutdown has **no timeout** (`healthServer.close()` can hang forever). |
| 5. CrashRecoveryManager (detect + auto-restart + backoff + maxRetries) | **DOES NOT EXIST** — `daemon.ts` is fire-and-forget after `unref()` (no `exit`/`error` listeners); `restartDaemon()` (`daemon.ts:64-67`) is manual only. PID-liveness primitives (`isPidAlive`, `isStale`, `cleanupStale`) **do exist** and are reused. |
| 6. Resource cleanup on exit (IPC socket, PID, temp files) | **PARTIAL** — PID + snapshot are removed on clean shutdown; the **IPC `.sock` file is never unlinked** (`ipc-transport.ts:64-74` only destroys the socket). |
| 7. Tests | **DO NOT EXIST** — no `runtime.test.ts`, no `daemon.test.ts`, no lifecycle tests. |

Key facts:
- Shutdown today (`daemon-entry.ts:87-131`): synchronous, idempotent via one boolean, **never calls `runtime.stop()`**, **no timeout**.
- Supervisor (`daemon.ts`): `startDaemon` spawns detached + `unref()`; **no child monitoring**; `stopDaemon` sends SIGTERM only (no escalation, no wait).
- Backoff math already exists for task dispatch (`dispatcher.ts:349`: `initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)`) — reused as a pattern.
- Reusable Design-04 surface: `pid-manager.ts` (`isPidAlive`, `isStale`, `cleanupStale`, `validatePid`), `state-store.ts`, `health-check.ts` (`checkHealth` + `stalePidFile`).

## Action dependency graph

```
 01 (types) ──┬─► 02 (state machine) ──┬─► 05 (graceful shutdown) ──┐
              │                        ├─► 06 (watchdog)            │
              │                        └─► 07 (crash detector)──┐   │
              ├─► 04 (cleanup coord) ──┘                         │   │
              └─► 03 (backoff) ──► 08 (crash recovery) ◄─────────┘   │
                                                                   ▼
                              09 (wire daemon shutdown) ◄──── 05, 04, 11
                              10 (wire supervisor restart) ◄─ 07, 08, 11
                              11 (expose lifecycle API) ◄──── 01..08 (barrel)
                              12, 13, 14 (tests) ◄──────────── 01..08
```

- **01, 03** are independent and may run in parallel (pure types / pure functions).
- **02** depends on 01. **04** depends on 01. All three (01-04) are foundation.
- **05** depends on 02 + 04. **06** depends on 02. **07** depends on 02 + 04.
- **08** depends on 03 + 07 (consumes `onCrash`, uses backoff).
- **11** (barrel) depends on all modules existing (01-08).
- **09** depends on 05 + 04 + 11. **10** depends on 07 + 08 + 11.
- **12, 13, 14** depend on the modules they cover.

## Execution order

1. **05_01** — Lifecycle types module (enum, contexts, policies) — S
2. **05_02** — Lifecycle state machine (FSM) — S *(depends on 01)*
3. **05_03** — Backoff calculator (pure) — S *(parallel with 02)*
4. **05_04** — Cleanup coordinator (resource registry + IPC socket unlink) — M *(depends on 01)*
5. **05_05** — Graceful shutdown handler (signals + timeout) — M *(depends on 02, 04)*
6. **05_06** — Watchdog monitor — M *(depends on 02)*
7. **05_07** — Crash detector — M *(depends on 02, 04)*
8. **05_08** — Crash recovery manager (backoff + maxRetries) — M *(depends on 03, 07)*
9. **05_09** — Wire daemon shutdown onto lifecycle — M *(depends on 05, 11)*
10. **05_10** — Wire supervisor restart onto crash recovery — M *(depends on 07, 08, 11)*
11. **05_11** — Expose lifecycle public API (barrel) — S *(depends on 01-08)*
12. **05_12** — Tests: state machine + backoff — M
13. **05_13** — Tests: cleanup + shutdown + watchdog — M
14. **05_14** — Tests: crash detector + crash recovery — M

## Backlog → Action mapping

| Requirement | Action | Severity |
|---|---|---|
| Lifecycle types (state enum, contexts, policies) | 05_01 | Critical |
| LifecycleStateMachine (FSM + listeners) | 05_02 | Critical |
| Exponential backoff calculator | 05_03 | High |
| CleanupCoordinator + IPC socket cleanup | 05_04 | Critical |
| GracefulShutdownHandler (signals + timeout + uncaught/unhandled) | 05_05 | Critical |
| WatchdogMonitor | 05_06 | High |
| CrashDetector (PID liveness polling) | 05_07 | High |
| CrashRecoveryManager (restart + backoff + cap) | 05_08 | Critical |
| Wire daemon shutdown | 05_09 | Critical |
| Wire supervisor auto-restart | 05_10 | Critical |
| Public API exports | 05_11 | High |
| Tests (state machine, backoff) | 05_12 | High (DoD-required) |
| Tests (cleanup, shutdown, watchdog) | 05_13 | High (DoD-required) |
| Tests (crash detection, recovery) | 05_14 | High (DoD-required) |

## Design 05 completion gate

All of the following must hold before Design 05 is declared complete:

- [ ] `npm run build` green (both workspaces).
- [ ] `npm test` green, including the new lifecycle test suite.
- [ ] `process.on("uncaughtException")` and `process.on("unhandledRejection")`
      handlers registered in the daemon.
- [ ] Graceful shutdown has a **timeout** and force-exits if cleanup overruns.
- [ ] `runtime.stop()` is actually invoked during daemon shutdown.
- [ ] The IPC `.sock` file is unlinked on shutdown (no orphaned socket).
- [ ] A crashed daemon is auto-restarted by the supervisor, with `maxRetries`
      capping the loop and exponential backoff between attempts.
- [ ] Watchdog fires `onUnresponsive` after N consecutive failed probes.
- [ ] Unit tests cover: state-machine transitions, backoff math, cleanup
      non-throw, shutdown timeout, watchdog threshold, crash detection, restart
      cap.
- [ ] Manual test passes: start → SIGTERM → clean exit (no orphans) → kill -9 →
      auto-restart → max-retry cap reached → supervisor stops retrying.
