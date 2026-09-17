# Design Document Index — Sprint 010

## Execution Order

| # | Document | Planning Source | Description |
|---|----------|-----------------|-------------|
| 01 | `01_runtime_daemon_process.md` | `01_runtime_daemon_process.md` | Transform Runtime into a long-lived daemon process |
| 02 | `02_ipc_communication_layer.md` | `02_ipc_communication_layer.md` | Implement IPC communication layer between CLI and Runtime daemon |
| 03 | `03_cli_runtime_separation.md` | `03_cli_runtime_separation.md` | Separate CLI commands from Runtime logic |
| 04 | `04_persistent_state_store.md` | `04_persistent_state_store.md` | Implement persistent state store for Runtime |
| 05 | `05_process_lifecycle_management.md` | `05_process_lifecycle_management.md` | Implement lifecycle management: graceful shutdown, crash recovery, watchdog |
| 06 | `06_final_report_compilation.md` | `06_final_report_compilation_plan.md` | Compile architecture review findings into final report |

## Dependencies

```
01_runtime_daemon_process
    │
    ├─► 02_ipc_communication_layer
    │       │
    │       ├─► 03_cli_runtime_separation
    │       │
    │       └─► 04_persistent_state_store
    │               │
    │               └─► 05_process_lifecycle_management
    │
    └─► 05_process_lifecycle_management (also depends on 01 directly)

06_final_report_compilation (independent; depends on review docs, not sprint tasks)
```

### Dependency Matrix

| Document | Depends On | Required By |
|----------|-----------|-------------|
| `01_runtime_daemon_process.md` | None | `02`, `05` |
| `02_ipc_communication_layer.md` | `01` | `03`, `04` |
| `03_cli_runtime_separation.md` | `01`, `02` | None |
| `04_persistent_state_store.md` | `01`, `02` | `05` |
| `05_process_lifecycle_management.md` | `01`, `04` | None |
| `06_final_report_compilation.md` | Review docs (Phases 1-5) | None |

## Implementation Status

| # | Document | Status |
|---|----------|--------|
| 01 | `01_runtime_daemon_process.md` | ✅ Created |
| 02 | `02_ipc_communication_layer.md` | ✅ Created |
| 03 | `03_cli_runtime_separation.md` | ✅ Created |
| 04 | `04_persistent_state_store.md` | ✅ Created |
| 05 | `05_process_lifecycle_management.md` | ✅ Created |
| 06 | `06_final_report_compilation.md` | ✅ Created |

## Estimated Complexity

| # | Document | Complexity | Rationale |
|---|----------|------------|-----------|
| 01 | `01_runtime_daemon_process.md` | High | Core architectural change: CLI to daemon process model, PID management, entry point refactoring |
| 02 | `02_ipc_communication_layer.md` | High | New communication protocol, message serialization, bidirectional channel implementation |
| 03 | `03_cli_runtime_separation.md` | Medium | Refactoring existing CLI commands to use IPC instead of direct Runtime calls |
| 04 | `04_persistent_state_store.md` | Medium | New state persistence layer with file-based storage and PID tracking |
| 05 | `05_process_lifecycle_management.md` | High | State machine, watchdog, crash recovery, signal handling, cleanup orchestration |
| 06 | `06_final_report_compilation.md` | Low | Documentation-only task: read existing review docs and compile into template |

## Document Relationships

### Sprint Implementation Chain

Documents 01–05 form the core implementation chain for Sprint 010, transforming the Runtime from an in-process library into a daemon-managed architecture:

1. **Foundation** (Task 01): Establish the daemon process
2. **Communication** (Task 02): Enable CLI ↔ Daemon communication via IPC
3. **Separation** (Task 03): Decouple CLI from Runtime direct calls
4. **Persistence** (Task 04): Add state persistence for crash recovery
5. **Lifecycle** (Task 05): Manage the full daemon lifecycle

### Independent Documentation

Document 06 is independent of the implementation chain. It compiles findings from prior architecture review phases and does not depend on any sprint task being completed first.

### Cross-References

- Tasks 02, 03, and 04 can be implemented in parallel after Task 01 is complete
- Task 05 must wait for both Task 01 and Task 04 to complete
- Task 06 can be implemented at any time as it depends only on existing review documents
