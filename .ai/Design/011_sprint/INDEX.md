# Design Document Index - Sprint 011

## Objective
Enable `ask` and `chat` to work with an explicitly authorized external workspace through controlled, auditable tools.

## Execution Order

| # | Document | Focus | Depends On |
|---|---|---|---|
| 01 | `01_workspace_access_grants.md` | Grant model and deny-by-default policy | Sprint 010 |
| 02 | `02_ipc_tool_protocol.md` | Sessions, tool calls, results, approval, cancellation | 01 |
| 03 | `03_workspace_read_tools.md` | List, read, search tools | 01, 02 |
| 04 | `04_restricted_command_execution.md` | Allowlisted process execution | 01, 02 |
| 05 | `05_approved_change_application.md` | Reviewed and recoverable mutations | 01, 02, 03 |
| 06 | `06_agent_cli_integration.md` | Agent, daemon and CLI integration | 02-05 |
| 07 | `07_acceptance_and_documentation.md` | Tests, smoke validation and completion | 01-06 |
| 08 | `08_cli_explicit_authorization.md` | Remove CLI self-grant and enforce explicit authorization | 01, 06, 07 |
| 09 | `09_apply_ipc_cli_surface.md` | Expose approved mutations through IPC and CLI | 02, 05, 06 |
| 10 | `10_authenticated_sessions_multiclient_transport.md` | Bind session identity to authenticated clients and support concurrency | 02, 06, 07 |
| 11 | `11_streaming_and_cancellation.md` | Complete streamed tool events and bounded cancellation | 02, 04, 06, 07 |
| 12 | `12_process_controls_and_audit_hardening.md` | Harden Windows process controls and audit redaction | 04, 06, 07 |
| 13 | `13_final_acceptance_and_documentation.md` | Re-run acceptance evidence and close Sprint 011 | 08-12 |

## Status

| # | Status |
|---|---|
| 01-05 | Implemented and tested |
| 06 | Partially implemented and smoke-tested |
| 07 | In progress |
| 08 | Planned |
| 09 | Planned |
| 10 | Planned |
| 11 | Planned |
| 12 | Planned |
| 13 | Planned |

## Scope Boundary
No access is granted by prompt text alone. External roots, commands and mutations require explicit user/host authorization.
