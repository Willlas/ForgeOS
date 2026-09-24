# Epic 1 — CLI error propagation

> Atomized tasks: [01_cli-error-propagation-tasks.md](01_cli-error-propagation-tasks.md)

## Objective

Make `aer` CLI commands report the daemon's real error message on failure, so a rejected `approvalId` (or any IPC failure) is not hidden as `[object Object]`.

## Background (grounded in the repo)

- `IpcClient.call()` rejects with a plain `{ code, message }` object — the timeout reject at `packages/cli/src/ipc-client.ts:113` and the `resp.error` reject at `:156` — not an `Error` instance.
- The CLI catch blocks in `packages/cli/src/index.ts` are **inconsistent**: `ask` (`:195`), `chat` (`:244`), and `workspace:read` (`:281`) already extract `message` from a plain object, but `workspace:list` (`:305`), `workspace:approve` (`:532`), and `workspace:apply` (`:564`) use `error instanceof Error ? error.message : String(error)`, so the plain rejection object is stringified to `[object Object]`. The `workspace:apply` path is the one observed in the README's recorded run.
- The daemon's real error for a consumed approval is `Unknown or already-consumed approvalId`, thrown at `packages/runtime/src/core/runtime.ts:534`.

## User stories

### US-01: A failed command shows the daemon's real message
**As a runtime operator**
**I want** the `aer` CLI to print the daemon's actual error message when a command fails
**so that** I can diagnose a rejected approval (or any IPC failure) without guessing.

**Acceptance criteria:**
- Reusing a consumed `approvalId` with `aer workspace:apply <root> <approvalId> <files…>` prints the daemon message `Unknown or already-consumed approvalId`, not `[object Object]`.
- The command exits with a non-zero exit code on failure.
- Success-path output and exit codes are unchanged.

### US-02: The fix is regression-protected
**As a runtime maintainer**
**I want** a test that asserts the CLI surfaces the rejection message
**so that** the `[object Object]` defect cannot silently return.

**Acceptance criteria:**
- A test in `packages/cli/src/__tests__/` simulates an `IPCError`-shaped rejection and asserts the printed message contains the daemon text and not `[object Object]`.
- `npm test` passes, including the existing `packages/cli/src/__tests__/` tests.

## Tasks

- [x] Surface the IPC rejection message in the CLI catch blocks (`packages/cli/src/index.ts`).
- [x] Add a regression test for the rejection-message path (`packages/cli/src/__tests__/`).
- [x] Verify `npm run build` and `npm test` are green with no regressions.

## Out of scope

- Changing the IPC protocol or adding a new daemon error type.
- Modifying `packages/runtime/src/core/runtime.ts` error construction (the daemon already throws a proper message).
- Any GUI or provider work.
