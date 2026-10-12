# S14-E1 — CLI Test Harness & Foundations

> Sprint 14 | Priority: P0 | Critical path: yes | Plan: `S14-overview.md`

## Goal

Create a shared, bounded, daemon-aware test harness that allows reliable execution of process-level CLI tests with timeout bounds, daemon state management, and isolation between test invocations.

## Why this matters

This epic provides the foundational infrastructure for all other CLI validation efforts. Without reliable test harnesses, there's no way to perform deterministic regression testing of command behaviors such as reuse detection, error handling, or daemon status validation.

## Scope

- Create CLI harness module with timeout handling and daemon management
- Add session isolation helpers for multi-step flows  
- Implement object leak detection
- Include daemon startup/shutdown utilities
- Add temp workspace management

## Out of scope

- Product behavior changes or feature additions
- External infrastructure dependencies
- Performance tuning for the test framework itself

## Acceptance criteria

- `cli-harness.ts` module exists with all helpers documented
- All spawned CLI processes are bounded by timeouts  
- Session isolation works correctly across multi-invocation flows
- No `[object Object]` leakage in test output
- `npm run build` and `npm test` pass with all existing tests

## Proposed tasks

### S14-E1.1 — Create CLI harness module

New file `packages/cli/src/__tests__/helpers/cli-harness.ts`. Export an async function that:

```ts
import { execFile } from "node:child_process";

export async function aer(args: string[], { timeoutMs = 20_000, env = {} }: { timeoutMs?: number; env?: Record<string, string> } = {}) {
  const result = await new Promise((resolve, reject) => {
    const child = execFile(
      "node", 
      [
        "node_modules/tsx/dist/cli.js",
        "packages/cli/src/index.ts",
        ...args
      ],
      {
        timeout: timeoutMs,
        env: { ...process.env, ...env },
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ error, stdout, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      }
    );
  });

  return result;
}
```

- Never throws on non-zero exit code (exit codes are data)
- Kills process tree on timeout and resolves with `timedOut: true`
- Merges `env` into subprocess environment

### S14-E1.2 — Add session isolation helpers

Implement `newTestSession()` helper that creates unique session IDs for multi-step flows.

### S14-E1.3 — Add object leak detection

Implement an `assertNoObjectLeak(result)` function to ensure no `[object Object]` appears in output streams.

### S14-E1.4 — Add daemon management utilities

Implement `ensureDaemonDown()` and `ensureDaemonUp()` helpers:
- `ensureDaemonDown()` - Stop any running daemon
- `ensureDaemonUp()` - Start a new daemon instance  

### S14-E1.5 — Add temp workspace management

Implement workspace helpers:
- `makeTempWorkspace()` - Create temporary directories for tests  
- `cleanupWorkspace()` - Remove temporary directories after tests

## Risks / Assumptions

- The daemon state management will not interfere with concurrent tests
- Session IDs are properly isolated between tests  
- Test timeout bounds are sufficient to cover realistic daemon startup scenarios

## Dependencies

All other epics depend on this infrastructure for their validation.

## Test strategy / Validation approach

- Module compilation and export validation (no broken imports)
- Process execution with proper timeouts  
- Session ID isolation testing across process boundaries
- No `[object Object]` leakage in test output streams
- `npm run build` clean; `npm test` all existing tests pass

## Evidence from the repo

| Claim | Location |
|---|---|
| CLI process execution patterns exist | `packages/cli/src/__tests__/workspace-grant-cli.test.ts` |
| Process timeout handling is needed | `packages/cli/src/__tests__/helpers/cli-harness.ts` (reference) |
