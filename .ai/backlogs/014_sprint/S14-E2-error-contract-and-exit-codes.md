# S14-E2 — Error Contract & Exit-Code Hardening

> Sprint 14 | Priority: P0 | Critical path: yes | Plan: `S14-overview.md`

## Goal

Improve and standardize CLI error message quality, exit codes, and help text to provide clear, deterministic feedback for all valid workflow paths.

## Why this matters

Good error handling provides operators confidence that problems can be easily understood and diagnosed. Current issues include confusing error messages, improper TTL help text, and lack of standardized error formatting.

## Scope

- Fix CLI `--ttl` help text to show "default 60s, cap 3600s"
- Standardize error formatting with runtime constants  
- Ensure consistent exit codes across all commands
- Eliminate `[object Object]` leakage in error paths

## Out of scope

- Modifying core workflow behavior patterns or approvals
- Changing TTL constants (they are defined at the runtime level)
- Adding new product features beyond error quality improvements

## Acceptance criteria

- CLI `--ttl` help text shows correct "default 60s, cap 3600s"
- All commands use standardized `process.exit(1)` with clear output  
- No test cases show `[object Object]` in CLI output 
- CLI returns appropriate exit codes (0 for success, 1 for validation failures)
- All existing tests pass without modification

## Proposed tasks

### S14-E2.1 — Fix CLI TTL help text

Update `cli/src/index.ts` line 574 to show "default 60s, cap 3600s" instead of "capped at 300"  

### S14-E2.2 — Standardize error formatting

Replace the repeated `error instanceof Error ? error.message : String(error)` pattern with a consistent helper that:
- Extracts message from either an Error or a plain `{ code, message }` object  
- Uses runtime constants for consistent formatting and output
- Preserves `process.exitCode = 1` and finally { client.disconnect(); } behavior

### S14-E2.3 — Verify command error responses

Test that:
- No command path can print `[object Object]` for an IPCError-shaped rejection  
- Failure still exits non-zero and disconnects cleanly
- Error messages are consistent and deterministic

## Risks / Assumptions

- Error handling code paths will not introduce new issues or regressions
- The error formatting will remain consistent between different test scenarios

## Dependencies

- E1 for reliable testing framework to validate behavior 
- Runtime error formatting standards must be established

## Test strategy / Validation approach

- CLI command responses are tested by executing commands and verifying output patterns
- Exit codes are verified through process status checks  
- No `[object Object]` strings appear in captured stdout/stderr
- The TTL help text shows correct values after command execution
- All existing tests should pass without modification  

## Evidence from the repo

| Claim | Location |
|---|---|
| CLI `--ttl` default is documented incorrectly | `packages/cli/src/index.ts:574` (currently says "capped at 300") |
| Error handling patterns need standardization | `packages/cli/src/index.ts:560` (error handling pattern needs improvement) |
