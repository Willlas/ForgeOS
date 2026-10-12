# 03 - Read-only Grant Misuse

## Goal

Validate that read-only grants are properly rejected at both runtime and CLI layers when attempts are made to use them for preview, approve, or apply operations.

## Why this matters

A regression in grant validation would allow read-only grants to perform operations they shouldn't be able to, compromising system security by enabling unauthorized changes. This is a critical safety check that must be enforced at both the runtime and CLI layers.

## Scope

- Runtime unit tests for read-only grant validation
- CLI process tests for read-only grant rejection
- Ensure no bypass mechanisms exist for read-only grants

## Out of scope

- Modifying core workflow behavior or approval record shape
- Provider/daemon reachability matrix (E4) and the smoke command (E5)
- Changing CLI `--ttl` default (60s) — that is E2

## Acceptance criteria

- A `read-only` grant is rejected by `preview`/`approve` at the runtime layer (apply-tool guard) 
- A `read-only` grant is rejected by `workspace:preview`/`workspace:apply` at the CLI layer
- No test case shows `[object Object]` in output streams
- Tests pass with all existing code unchanged

## Tasks

### Task 1: Runtime read-only grant validation
- Create unit tests in a new runtime test file
- Verify that `previewAuthorizedWorkspace` and `approveAuthorizedWorkspace` both throw `"Workspace tool 'apply' is not granted for this session"` (`runtime.ts:470,496`)
- Verify that `apply` path throws `"Read-only grants cannot apply changes"` (`workspace-tools.ts:426-427`)
- Verify that registering a `read-only` grant *with* `apply` is itself rejected at `session-grant-manager.ts:148-150`

### Task 2: CLI read-only grant rejection
- Create process-level tests using E1 harness  
- Execute `workspace:grant <root> -m read-only -t read,list --yes`
- Execute `workspace:preview <root> -f notes.txt -c "x"`
- Verify exit 1 with exact error message about apply not being granted
- Ensure `assertNoObjectLeak` passes

### Task 3: Regression prevention  
- Confirm that the CLI actually emits `"Workspace tool 'apply' is not granted for this session"` (not the stale README matrix row)
- Flag the outdated matrix row for correction in E6.2

## Risks / Assumptions

- Session managers will properly isolate between tests to prevent cross-contamination
- The exact error strings from the runtime match what CLI tests expect to see
- Read-only grant validation works consistently across both layers (runtime and CLI)

## Dependencies

- E3.1 (runtime): uses existing runtime package only  
- E3.2 (CLI): E1 harness + E2 for consistent error messages

## Test strategy / Validation approach

- Runtime tests are isolated unit tests with proper cleanup
- CLI tests use E1 harness for process isolation and timeout handling  
- Both layers verify the exact same error strings
- No `[object Object]` leakage in test output streams
- All existing tests continue to pass
