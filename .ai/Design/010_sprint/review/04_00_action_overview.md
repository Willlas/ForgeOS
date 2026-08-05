# Design 04 — Persistent State Store — Action Overview

This work package converts the Design 04 contract into a sequence of self-contained
actions for a coding model. The Design document is the authoritative contract:
`.ai/design/010_sprint/04_persistent_state_store.md`.

Design 03 is **complete and validated** (build green, 303 tests passing, clean
package boundary). Design 04 builds on that foundation.

> Unlike Design 03 (which was a remediation of an existing implementation), Design
> 04 is **largely greenfield** — only the PID file logic exists today, and it is
> fragmented/duplicated. The state persistence and health-check modules do not
> exist at all.

## Architecture decision (made)

**All three new modules live in `@aer/runtime-lib`** under
`packages/runtime/src/persistence/`:

```
packages/runtime/src/persistence/
├── pid-manager.ts        ← consolidated PID file logic (de-duplicated)
├── state-store.ts        ← atomic snapshot read/write
└── health-check.ts       ← combines PID + process-existence + persisted state
```

**Rationale:** Design 04 DoD requires *"External scripts can query Runtime health
without using the CLI."* Therefore the health-check module must be importable from
a library package, not trapped in `@aer/cli`. The daemon (which lives in
`@aer/cli`) imports the *writer* from `@aer/runtime-lib`; the CLI imports the
*reader*; external scripts import the health-checker directly. This also resolves
the current PID-logic duplication between `daemon.ts` and `daemon-entry.ts` by
extracting it into one shared module.

## Current state (gap analysis)

| Design 04 requirement | Status |
|---|---|
| 1. PID file manager module | **PARTIAL** — logic exists inline & duplicated in `cli/src/daemon.ts` + `cli/src/daemon-entry.ts`. No consolidated module; no stale/age detection; no orphan handling beyond live `process.kill(pid,0)`. |
| 2. State persistence layer (atomic snapshots) | **DOES NOT EXIST** — fully greenfield. Data sources ready: `Runtime.getState()`, `Runtime.getHealth()`, `MetricsCollector.getSummary()`. |
| 3. Health check module (PID + process + state) | **DOES NOT EXIST** — only static HTTP `/health` and IPC `health:check` exist, both require the running daemon. |
| 4. CLI status reads persistent state | **DOES NOT EXIST** — status uses IPC only (`cli/src/index.ts` L75-98); no offline fallback. |
| 5. Daemon writes persistent state on lifecycle | **DOES NOT EXIST** — `daemon-entry.ts` only writes/removes the PID file. |
| 6. Runtime Metrics exposure | **EXISTS** — `MetricsCollector.getSummary()` ready; no new runtime code strictly required. |
| 7. Tests | **DO NOT EXIST** — zero tests for pid/daemon/state/persist/health; `packages/cli/` has no tests at all. |

Key facts:
- PID path default: `<repo>/.daemon/aer-daemon.pid`; override env `AER_DAEMON_PID_DIR`.
- Health HTTP port: `AER_HEALTH_PORT` (default 3099).
- The HTTP `/health` endpoint returns only static `{status:"ok", pid, uptime}`.

## Action dependency graph

```
 01 (PID manager module) ──────────────┐
                                       ├──► 04 (health-check module) ──┐
 02 (state-store module) ──────────────┘                                ├──► 06 (wire daemon lifecycle)
 03 (runtime snapshot helper) ──► (feeds 02 + 05)                       │
                                                                        ├──► 05 (rewire CLI status)
                                                                        │
                                                                        └──► 07 (tests)
```

- **01, 02, 03** are independent and may run in parallel.
- **04** depends on 01 + 02 (health checker combines PID + persisted state).
- **05** depends on 04 (CLI status reads via the health checker).
- **06** depends on 01, 02, 03 (daemon uses PID manager + state-store + snapshot).
- **07** depends on all implemented behaviors.

## Execution order

1. **04_01** — PID file manager module (consolidate + de-duplicate) — M
2. **04_02** — State persistence layer (atomic snapshots) — M
3. **04_03** — Runtime snapshot helper — S  *(parallel with 01/02)*
4. **04_04** — Health check module (combines 01 + 02) — M
5. **04_05** — Rewire CLI status to persistent state — S
6. **04_06** — Wire daemon lifecycle events to state persistence — M
7. **04_07** — Test suite (PID, persistence, health, stale/orphan) — L

## Backlog → Action mapping

| Requirement | Action | Severity |
|---|---|---|
| PID manager module (consolidated) | 04_01 | Critical |
| State persistence layer | 04_02 | Critical |
| Runtime metrics snapshot helper | 04_03 | High |
| Health check module | 04_04 | Critical |
| CLI status → persistent state | 04_05 | High |
| Daemon lifecycle persistence | 04_06 | Critical |
| Tests (PID lifecycle, races, crash) | 04_07 | High (DoD-required) |

## Design 04 completion gate

All of the following must hold before Design 04 is declared complete:

- [ ] `npm run build` green (both workspaces).
- [ ] `npm test` green, including new persistence/health-check tests.
- [ ] PID file manager is a single module in `@aer/runtime-lib`, no longer
      duplicated between `daemon.ts` and `daemon-entry.ts`.
- [ ] State snapshots are written atomically (tmp file + rename).
- [ ] CLI `status` works when the daemon is **down** (reads persisted state).
- [ ] Stale PID file (process dead) is detected and cleaned on next start.
- [ ] An external script can `import { checkHealth } from "@aer/runtime-lib"` and
      get an up/down/unknown result without spawning the CLI.
- [ ] Manual test passes: start → PID file present → kill -9 → orphan detected →
      restart cleans up.
