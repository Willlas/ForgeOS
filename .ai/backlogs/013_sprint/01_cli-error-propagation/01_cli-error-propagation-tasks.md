# Atomized Tasks — Epic 1: CLI error propagation

> Source story: [01_cli-error-propagation.md](01_cli-error-propagation.md)
> Sprint: 13 (CLI reliability)
> Constraint: close the known-risks defect on the validated CLI path with a small, incremental change; no new product features.

## Atomized Tasks: US-01 — A failed command shows the daemon's real message

### Task 1: Identify the real rejection shape and every call site
- **Subtask 1A:** Confirm the exact rejection object produced by `IpcClient.call()` in `packages/cli/src/ipc-client.ts` (both reject paths: timeout and `resp.error`).
- **Subtask 1B:** Map the `index.ts` catch blocks that still stringify plain objects instead of extracting `message`.
- **Subtask 1C:** Record which commands share the root cause (`workspace:list`, `workspace:approve`, `workspace:apply`, and any other workspace operations using `String(error)`).
- **Target File/Location:** `c:\Proyects\MultiAgentDev\packages\cli\src\ipc-client.ts`, `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts`, and `c:\Proyects\MultiAgentDev\packages\runtime\src\core\runtime.ts`.
- **Verification:** The root cause is clear: the rejected object is a plain `{ code, message }`, and the CLI must extract `message`, not stringify the object.

### Task 2: Add a single message-extraction helper
- **Subtask 2A:** Create one helper that extracts `message` from either an `Error` or a plain `{ code, message }` object.
- **Subtask 2B:** Replace the repeated `error instanceof Error ? error.message : String(error)` pattern across the relevant catch blocks in `index.ts`.
- **Subtask 2C:** Preserve `process.exitCode = 1` and `finally { client.disconnect(); }` behavior for all command failures.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts`.
- **Verification:** No command path can print `[object Object]` for an `IPCError`-shaped rejection; failure still exits non-zero and disconnects cleanly.

### Task 3: Verify the daemon message and the real failing path
- **Subtask 3A:** Confirm the daemon-side failure text is `Unknown or already-consumed approvalId` from `packages/runtime/src/core/runtime.ts`.
- **Subtask 3B:** Confirm the CLI fix is tested against that exact message, not a guessed string.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\packages\runtime\src\core\runtime.ts` and the CLI error-handling code.
- **Verification:** The message used in tests matches the actual daemon failure string, and the CLI reports it verbatim.

## Atomized Tasks: US-02 — The fix is regression-protected

### Task 4: Add the regression test for the message path
- **Subtask 4A:** Add a new test file under `packages/cli/src/__tests__/` for the CLI error-propagation defect.
- **Subtask 4B:** Simulate an `IPCError`-shaped rejection object containing the real daemon error text and assert the CLI output contains that message and does not contain `[object Object]`.
- **Subtask 4C:** If necessary, export or share the message-extraction helper so the test can exercise it directly.
- **Target File/Location:** new file `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\cli-error-propagation.test.ts` and `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts`.
- **Verification:** The test passes under `vitest` and the existing CLI test files remain green.

### Task 5: Verify build and full CLI suite are green
- **Subtask 5A:** Run the repo build (`npm run build`).
- **Subtask 5B:** Run the test suite (`npm test`).
- **Subtask 5C:** Check that no new TypeScript errors appear in `packages/cli` or `packages/runtime`.
- **Target File/Location:** repository root.
- **Verification:** `npm run build` exits 0; `npm test` exits 0; no failing or skipped tests in the CLI suite.

## Final review

- [x] The root cause is confirmed and mapped to the real reject shape.
- [x] The CLI prints the daemon's real error message instead of `[object Object]`.
- [x] The regression test is present in `packages/cli/src/__tests__/`.
- [x] `npm run build` and `npm test` are green.
