# INDEX — Sprint 010 Planning Documents

## Overview
This index maps all planning documents for Sprint 010, which addresses the architectural transformation of Aer from an in-process CLI library to a daemon-based architecture with proper process separation, IPC, and lifecycle management.

---

## Dependency Graph

```
03_cli_runtime_separation.md  (independent)
                              |
01_runtime_daemon_process.md  (root task)
          ├──┐               |
02_ipc_communication_layer.md    → Requires 01 complete
04_persistent_state_store.md     → Requires 01 complete
          └──┘               |
05_process_lifecycle_management.md → Requires 01 + 04 complete
```

---

## Execution Order

| Phase | # | File | Task | Depends On | Complexity | Status |
|-------|---|------|------|------------|------------|--------|
| 1 | 03 | `03_cli_runtime_separation.md` | Split CLI and Runtime packages | — | ★★★★☆ | Planned |
| 1 | 01 | `01_runtime_daemon_process.md` | Create daemon process for Runtime | — | ★★★★★ | Planned |
| 2 | 02 | `02_ipc_communication_layer.md` | IPC layer for CLI↔Runtime | 01 | ★★★★☆ | Planned |
| 2 | 04 | `04_persistent_state_store.md` | Persistent state (PID, health) | 01 | ★★★☆☆ | Planned |
| 3 | 05 | `05_process_lifecycle_management.md` | Daemon lifecycle, watchdog, restart | 01, 04 | ★★★★☆ | Planned |

---

## Recommended Execution Strategy

### Phase 1 — Foundation (Week 1-2)
Execute **03** and **01** in parallel if resources allow. Otherwise:
1. Start with **03** (package separation) to clean up module boundaries first
2. Then **01** (daemon process) against the cleaned Runtime package

### Phase 2 — Communication & State (Week 3-4)
Execute **02** and **04** in parallel:
1. **02** builds the IPC bridge between CLI and daemon
2. **04** adds PID files and health query endpoints

### Phase 3 — Robustness (Week 5)
Execute **05**:
1. Lifecycle management, crash recovery, watchdog on top of all previous work

---

## Complexity Assessment

| Task | Lines to Change | New Modules | Risk Level | Est. Effort |
|------|----------------|-------------|------------|-------------|
| 01 — Daemon Process | High (CLI entry point) | 2-3 new files | High | 3-4 days |
| 02 — IPC Layer | Very High (all CLI commands) | 4-5 new files | High | 4-5 days |
| 03 — Package Split | Medium (imports/exports) | 2 package.json + config | Medium | 2-3 days |
| 04 — Persistent State | Medium (status command) | 2-3 new files | Medium | 2 days |
| 05 — Lifecycle Mgmt | Medium (signal handlers) | 2-3 new files | High | 3 days |

---

## Key Review Evidence

All planning decisions are grounded in findings from `.ai/review/010_sprint/`:

| Claim | Source | Evidence |
|-------|--------|----------|
| Runtime is in-process library | `05_architectural_classification.md` | Phase 5 findings |
| CLI owns Runtime instance | `04_runtime_ownership.md` | `src/cli/index.ts:33` |
| No daemon, IPC, or persistence exists | `02_runtime_lifecycle.md` | Checklist all "No" except "Created in CLI process" |
| SIGINT handler at CLI level | `02_runtime_lifecycle.md` | `src/cli/index.ts:118-126` |
| Single monolithic package | `05_architectural_classification.md` | Deployment model: "Single package" |

---

## Status Legend
- **Planned** — Document created, not yet implemented
- **In Progress** — Implementation started
- **Done** — Implementation complete, tests passing
- **Blocked** — Waiting on dependency
