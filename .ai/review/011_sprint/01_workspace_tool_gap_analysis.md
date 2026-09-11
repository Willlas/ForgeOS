# Sprint 011 - Workspace Tool Gap Analysis

## Baseline
Sprint 010 now provides `ask`, `chat`, and a basic `workspace:read` CLI path. The read-only implementation is confined by an explicit root and rejects traversal.

## Remaining Gaps
- Tool calls are not yet selected autonomously by the agent.
- Command execution and mutation tools do not exist.
- Grants are not yet represented as a complete session policy in IPC.
- Streaming tool events, approval and cancellation remain pending.
- Security coverage must expand to junctions, multiple clients and process limits.

## Evidence
- `packages/runtime/src/workspace-tools.ts`
- `packages/runtime/src/ipc-protocol.ts`
- `packages/runtime/src/ipc-server.ts`
- `packages/cli/src/index.ts`
- `packages/runtime/src/__tests__/workspace-tools.test.ts`

## Review Status
Tasks 01-05 are implemented and tested. Task 06 provides a real `review-workspace` path that gathers authorized context through IPC before calling `ask`. Full autonomous tool-call loops, streaming tool events, cancellation, multi-client isolation and broader process controls remain pending acceptance work.
