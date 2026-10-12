# 01 - CLI Test Harness & Foundations

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

## Tasks

### Task 1: Create CLI harness module
New file `packages/cli/src/__tests__/helpers/cli-harness.ts`. Export an async function that:
- Spawns the CLI using tsx for TypeScript support 
- Handles timeouts properly by killing process trees
- Merges environment variables into subprocess
- Never throws on non-zero exit code (exit codes are data)

### Task 2: Add session isolation helpers
Implement `newTestSession()` helper to create unique session IDs for multi-step flows:
- All multi-invocation tests MUST pass `env: { AER_SESSION_ID: session }`
- Never let two concurrent test invocations share a session id (daemon rejects with `SessionInUse`)

### Task 3: Add object leak detection
Implement an `assertNoObjectLeak(result)` function to check for `[object Object]` in output streams.

### Task 4: Add daemon management utilities
Implement:
- `ensureDaemonDown()` - Stop any running daemon
- `ensureDaemonUp()` - Start a new daemon instance

### Task 5: Add temp workspace management  
Implement:
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
