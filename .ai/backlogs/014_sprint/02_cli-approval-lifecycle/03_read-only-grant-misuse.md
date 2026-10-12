# Atomized Tasks — Epic 3: Read-only Grant Misuse (S14-E3.3)

> Source story: [S14-E3 approval lifecycle](../S14-E3-approval-lifecycle.md)
> Sprint: 14
> Priority: P0
> Dependencies: S14-E3.1 and S14-E3.2
> Scope: read-only grant misuse only

## Task 1 (S14-E3.3.1): Register a read-only grant without apply or execute tools

### Subtask 1A: Add the registration guard test
- Extend `packages/runtime/src/__tests__/session-grant-manager.test.ts` with a case that constructs a `SessionGrantManager` and calls `registerGrant()` with:
  - `mode: "read-only"`
  - `tools: ["apply"]`
- Assert that the call throws `WorkspaceAccessError` with the exact message:
  - `Read-only grants cannot include execute or apply tools`
- Do not modify the production registration behavior beyond the existing guard.

### Subtask 1B: Verify the guard location
- Confirm that the message is generated at `packages/runtime/src/session-grant-manager.ts:149`.
- Keep the test pinned to the production string so a refactor cannot silently change the behavior.

### Target files
- `packages/runtime/src/__tests__/session-grant-manager.test.ts`
- `packages/runtime/src/session-grant-manager.ts`

### Verification
- Run the targeted runtime test file.
- Confirm the registration case passes and the exact error string is asserted.

## Task 2 (S14-E3.3.2): Reject a read-only grant at the apply-time runtime boundary

### Subtask 2A: Create the direct apply-time misuse test
- Add a test to `packages/runtime/src/__tests__/workspace-tools.test.ts` or a dedicated lifecycle test file.
- Create a temporary workspace root and a `WorkspaceTools` instance with:
  - `mode: "read-only"`
  - `tools: ["read", "list"]`
- Call `applyBatch()` with a valid change payload and a valid approval object.
- Assert that the call rejects with:
  - `Read-only grants cannot apply changes`

### Subtask 2B: Keep the test independent of the CLI
- Do not depend on the daemon or on CLI process spawning.
- Use the existing temp-root cleanup pattern from the runtime test suite.
- Confirm that the rejection originates from `packages/runtime/src/workspace-tools.ts:427`.

### Target files
- `packages/runtime/src/__tests__/workspace-tools.test.ts`
- `packages/runtime/src/workspace-tools.ts`

### Verification
- Run the targeted runtime test file.
- Confirm the exact runtime error string is asserted.

## Task 3 (S14-E3.3.3): Reject read-only grants through the CLI approval flow

### Subtask 3A: Create the CLI misuse test
- Extend `packages/cli/src/__tests__/workspace-approval-cli.test.ts` with a read-only grant case.
- Use the E1 harness and a shared `AER_SESSION_ID` for the complete CLI sequence.
- Register a grant with:
  - `mode: "read-only"`
  - `tools: ["read", "list"]`
- Invoke `workspace:preview` and `workspace:apply` through the CLI.
- Assert exit code `1` for both commands.
- Assert that stderr contains the daemon-facing rejection message produced by the runtime path.
- Assert that the target file is not written.

### Subtask 3B: Pin the actual CLI-facing message
- Do not assume that the CLI has its own read-only message.
- Capture the real daemon stderr output and assert that exact text.
- The expected runtime-level message is:
  - `Workspace tool 'apply' is not granted for this session`
- The runtime registration guard must remain the source of the read-only registration rejection.

### Subtask 3C: Keep the CLI scope limited
- Cover `workspace:preview` and `workspace:apply` misuse.
- Do not duplicate daemon-down or malformed-argument tests here.
- Do not add writing behavior for a read-only grant.

### Target files
- `packages/cli/src/__tests__/workspace-approval-cli.test.ts`
- `packages/cli/src/__tests__/helpers/cli-harness.ts`
- `packages/cli/src/index.ts`

### Verification
- Run the targeted CLI approval test file.
- Confirm exit code `1`, exact rejection output, and unchanged target file.
- Run `npm test` after the focused verification.

## Final review

- [ ] Task 1 verifies the registration guard string at `session-grant-manager.ts:149`.
- [ ] Task 2 verifies the apply-time guard string at `workspace-tools.ts:427`.
- [ ] Task 3 verifies the CLI rejection path without assuming a CLI-local message.
- [ ] Runtime and CLI coverage are separated by layer.
- [ ] Malformed-argument, daemon-down, and E4/E5 behavior are not duplicated.
- [ ] The targeted tests and the full suite are run and green.
