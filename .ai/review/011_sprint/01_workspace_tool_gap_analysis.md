# Sprint 011 - Workspace Tool Gap Analysis

## Baseline
Sprint 010 now provides `ask`, `chat`, and a basic `workspace:read` CLI path. The read-only implementation is confined by an explicit root and rejects traversal.

## Remaining Gaps
- Tool calls are not yet selected autonomously by the agent.
- Streaming tool events, approval and cancellation remain pending.
- Security coverage must expand to junctions and process limits.

## Evidence
- `packages/runtime/src/workspace-tools.ts`
- `packages/runtime/src/session-grant-manager.ts`
- `packages/runtime/src/ipc-protocol.ts`
- `packages/runtime/src/ipc-server.ts`
- `packages/cli/src/index.ts`
- `packages/runtime/src/__tests__/workspace-tools.test.ts`
- `packages/runtime/src/__tests__/session-grant-manager.test.ts`

## Review Status
Tasks 01-05 are implemented and tested. Task 06 provides a real `review-workspace` path that gathers authorized context through IPC before calling `ask`. Multi-client (session-scoped) grant isolation is implemented and smoke-tested: each CLI session carries a stable `sessionId`, grants are registered per session, and sessions cannot read each other's grants. Full autonomous tool-call loops, streaming tool events and cancellation remain pending acceptance work.
