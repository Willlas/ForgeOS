# 09 - Apply IPC and CLI Surface

## Objective
Expose approved, recoverable workspace mutations through the same authorized IPC path as reads and commands.

## Problem
`apply` exists behind an approval token in the runtime, but it is not exposed as a dedicated IPC/CLI operation.

## Scope
- Add typed IPC request/result commands for preview, approval and apply.
- Bind approval tokens to session, grant and change/diff hash.
- Add CLI commands or flags for preview, explicit approval and apply.
- Keep read-only grants unable to mutate.
- Report hash conflicts, rejected approvals and rollback results with correlation metadata.

## Acceptance Criteria
- No mutation occurs without explicit approval.
- Approval from another session or for another hash is rejected.
- Expected-hash conflicts do not overwrite files.
- Failed multi-file changes are recoverable through rollback.
- IPC and CLI tests cover approve, reject, conflict and rollback on Windows.

## Definition of Done
A user can review and explicitly apply an authorized change through IPC/CLI, with audit evidence and recovery.
