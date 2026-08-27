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

## Status

| # | Status |
|---|---|
| 01-05 | Implemented and tested |
| 06 | Partially implemented and smoke-tested |
| 07 | In progress |

## Scope Boundary
No access is granted by prompt text alone. External roots, commands and mutations require explicit user/host authorization.
