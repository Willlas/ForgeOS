# Sprint 14 - Epic Breakdown

## Executive Summary

This document provides a clean, prioritized breakdown of all epics for Sprint 14 based on the current repository state. The focus is on validating and hardening the existing CLI workflow with a secure operational path (`grant -> preview -> approve -> apply`) to ensure robustness, error quality, deterministic exit behavior, and testability.

## Epic List with Priorities

| Epic ID | Epic Title | Priority |
|---------|------------|----------|
| E1 | CLI Test Harness & Foundations | P0 (Critical Path) |
| E2 | Error Contract & Exit-Code Hardening | P0 (Critical Path) |
| E3 | Approval Lifecycle Enforcement | P0 (Critical Path) |
| E4 | Provider & Daemon Status Integration | P1 |
| E5 | Smoke Test Automation | P1 |
| E6 | Operator Test Plan & Documentation | P2 |

## Epic Details

### Epic E1 - CLI Test Harness & Foundations

**Goal**
Create a shared, bounded, daemon-aware test harness that allows reliable execution of process-level CLI tests with timeout bounds, daemon state management, and isolation between test invocations.

**Why this matters**
This epic provides the foundational infrastructure for all other CLI validation efforts. Without reliable test harnesses, there's no way to perform deterministic regression testing of command behaviors such as reuse detection, error handling, or daemon status validation.

**User/operator impact**
Operators can validate workflow behaviors manually, while developers benefit from a stable test foundation that enables automation of regression suites around critical paths.

**Scope**
- Create CLI harness module with timeout handling and daemon management
- Add session isolation helpers for multi-step flows
- Implement object leak detection
- Include daemon startup/shutdown utilities  
- Add temp workspace management

**Out of scope**
- Product behavior changes or feature additions
- External infrastructure dependencies
- Performance tuning for the test framework itself

**Acceptance criteria**
- `cli-harness.ts` module exists with all helpers documented
- All spawned CLI processes are bounded by timeouts
- Session isolation works correctly across multi-invocation flows
- No `[object Object]` leakage in test output
- `npm run build` and `npm test` pass with all existing tests

**Risks / assumptions**
- The daemon state management will not interfere with concurrent tests
- Session IDs are properly isolated between tests
- Test timeout bounds are sufficient to cover realistic daemon startup scenarios

**Dependencies**
- All other epics depend on this infrastructure for their validation

**Proposed tasks**
1. Create `packages/cli/src/__tests__/helpers/cli-harness.ts` module
2. Implement session isolation via `newTestSession()` helper  
3. Add object leak detection (`assertNoObjectLeak`)
4. Implement daemon management utilities (`ensureDaemonDown/Up`)
5. Add temp workspace helpers (`makeTempWorkspace/cleanupWorkspace`) 
6. Update `vitest.config.ts` with proper timeout settings

### Epic E2 - Error Contract & Exit-Code Hardening

**Goal**
Improve and standardize CLI error message quality, exit codes, and help text to provide clear, deterministic feedback for all valid workflow paths.

**Why this matters**
Good error handling provides operators confidence that problems can be easily understood and diagnosed. Current issues include confusing error messages, improper TTL help text, and lack of standardized error formatting.

**User/operator impact**
Operators using the CLI will receive more predictable, human-readable feedback when commands fail, improving diagnosis and resolution time.

**Scope**
- Fix CLI `--ttl` help text to show "default 60s, cap 3600s"
- Standardize error formatting with runtime constants  
- Ensure consistent exit codes across all commands
- Eliminate `[object Object]` leakage in error paths

**Out of scope**
- Modifying core workflow behavior patterns or approvals
- Changing TTL constants (they are defined at the runtime level)
- Adding new product features beyond error quality improvements

**Acceptance criteria**
- CLI `--ttl` help text shows correct "default 60s, cap 3600s"
- All commands use standardized `process.exit(1)` with clear output
- No test cases show `[object Object]` in CLI output 
- CLI returns appropriate exit codes (0 for success, 1 for validation failures)
- All existing tests pass without modification

**Risks / assumptions**
- Error handling code paths will not introduce new issues or regressions
- The error formatting will remain consistent between different test scenarios

**Dependencies**
- E1 for reliable testing framework to validate behavior 
- Runtime error formatting standards must be established

**Proposed tasks**
1. Fix CLI TTL help text (`cli/src/index.ts:574`)
2. Implement consistent error formatting using runtime constants  
3. Standardize exit codes (success=0, validation failure=1)
4. Add object leak prevention checks in error paths
5. Update CLI error response helpers to use new constant patterns

### Epic E3 - Approval Lifecycle Enforcement

**Goal**
Prove with deterministic, non-hanging tests that the grant → preview → approve → apply lifecycle enforces all safety invariants including single-use enforcement, session binding, TTL behavior and expiry checking.

**Why this matters**
Without testing for these invariants, there's no guarantee that safety mechanisms work correctly when reused. Current risk is that a regression would silently allow replay, cross-session, or cross-root writes to occur.

**User/operator impact**
Operators can trust that workflow commands prevent accidental or malicious bypassing of security controls, ensuring predictable and safe operation.

**Scope**
- Runtime unit tests covering all approval invariants 
- CLI process-level tests for failure scenarios
- Read-only grant misuse detection at both layers

**Out of scope**
- Changing core lifecycle behavior or approval record shape (E2 only exports constants)
- Provider/daemon reachability matrix (covered by E4)  
- Smoke command automation (covered by E5)

**Acceptance criteria**
- New runtime suite (`approval-lifecycle.test.ts`) pins all safety invariants with correct error strings
- CLI process suite (`workspace-approval-cli.test.ts`) confirms success and failure paths
- Read-only grant misuse is rejected at both runtime and CLI layers
- All error messages match source code exactly to prevent drift
- `npm run build` clean; `npm test` passes existing tests

**Risks / assumptions**
- Session managers will properly isolate between tests to prevent cross-contamination 
- Real-time expiry assertions will work within the established timeout constraints
- Cross-invocation session management works correctly with the E1 harness

**Dependencies**
- E1 for test infrastructure (daemon management, timeout handling)
- E2 for consistent error formatting/exit codes

**Proposed tasks**  
1. Create `packages/runtime/src/__tests__/approval-lifecycle.test.ts` 
2. Add CLI tests in `packages/cli/src/__tests__/workspace-approval-cli.test.ts`
3. Implement read-only grant misuse detection
4. Validate single-use approvalId enforcement 
5. Test session, rootPath, and TTL binding invariants

### Epic E4 - Provider & Daemon Status Integration

**Goal**
Implement monitoring of daemon and provider status through explicit environment variable override for Ollama base URL with comprehensive validation matrix.

**Why this matters**
Operators must be able to understand the state of system dependencies. This makes CLI workflows more robust and reduces ambiguity when operations fail due to network issues or misconfigured services.

**User/operator impact**
Operators can diagnose when services are down or unreachable, providing clear feedback instead of confusing hang states.

**Scope**
- Implement AER_OLLAMA_BASE_URL environment variable override
- Validate status matrix scenarios
- Add provider reachability output during status command

**Out of scope**  
- Modifying core Ollama integration behavior
- Adding new network monitoring features beyond what's necessary for this sprint
- Changing existing network connectivity patterns

**Acceptance criteria**
- `AER_OLLAMA_BASE_URL` environment variable allows override of default Ollama address  
- Status command provides clear "unreachable" output when host is unreachable
- CLI remains responsive even when provider is unreachable (no hangs or crashes)
- All tests pass with the new environment override implementation

**Risks / assumptions**
- Environment variables are properly set and passed to all relevant CLI components
- Ollama reachability tests correctly identify network issues vs service errors

**Dependencies**
- E1 for test infrastructure 
- E2 for consistent error handling standards

**Proposed tasks**
1. Implement environment variable override in `cli/src/index.ts` (#143)
2. Add status matrix tests covering different scenarios
3. Test environment override functionality  
4. Validate response when Ollama is unreachable
5. Ensure CLI command state remains healthy during provider unreachability

### Epic E5 - Smoke Test Automation

**Goal**
Create automated smoke tests that exercise core CLI functionality with `npm run smoke:cli` script to validate that key workflows operate correctly.

**Why this matters**
Smoke testing ensures fundamental workflows maintain basic functionality after changes, serving as an early warning system that prevents major regressions before they reach CI.

**User/operator impact**
Operators have a simple way to verify that critical CLI operations work without needing to manually validate full workflows each time.

**Scope**
- Add `smoke:cli` script to package.json 
- Create validation script that checks basic build and operational aspects
- Verify key TTL help text formatting changes
- Test OLLAMA base URL environment override

**Out of scope**
- Comprehensive test suite (focus on minimal coverage)
- Infrastructure changes beyond the smoke command implementation  

**Acceptance criteria**
- `package.json` has working `smoke:cli` script entry  
- Smoke script validates basic CLI functionality 
- The script can run without requiring complex setup
- All assertions are properly made and pass consistently

**Risks / assumptions**
- The smoke tests will not be overly complex to maintain
- Environment variables will be properly passed through npm scripts

**Dependencies**
- All other epics for actual implementation details to be tested  

**Proposed tasks**
1. Add `smoke:cli` script to package.json
2. Implement validation script to check key aspects of functionality  
3. Ensure script can be run independently from full test suite
4. Include verification of key CLI behavior and configuration settings

### Epic E6 - Operator Test Plan & Documentation

**Goal**
Create comprehensive operator documentation that covers all validated CLI behaviors and provides clear guidance for manual or automated testing.

**Why this matters**
Documentation ensures teams can understand, reproduce, and verify functionality consistently throughout the development lifecycle. It serves as a shared reference point for both internal developers and external operators.

**User/operator impact**
Operators have a clear reference for how to test and validate CLI workflows, including expected command outputs and error patterns.  

**Scope**
- Document all validated success and failure paths  
- Provide operator runbook with test scenarios
- Include command line references and help text verification

**Out of scope**
- Implementation changes beyond documentation updates
- Creating new features or workflows
- Detailed API specification beyond CLI behavior 

**Acceptance criteria**
- Complete `docs/cli-operator-test-plan.md` file documenting all validated behaviors  
- Test matrix includes operational scenarios with expected outcomes
- All documented error patterns can be reproduced in reality

**Risks / assumptions**
- Documentation remains accurate as implementations evolve  
- Operator documentation can be maintained alongside code changes

**Dependencies**
- All previous epics for complete validation information needed  

**Proposed tasks**
1. Create `docs/cli-operator-test-plan.md` document
2. Document all validated success and failure scenarios 
3. Provide command output examples and verification steps
4. Include test matrix with expected results per scenario
5. Cross-reference documentation with implementation tests

## Suggested Implementation Order

The recommended implementation order is:

1. **E1 - CLI Test Harness & Foundations (Critical Path)** - All other epics depend on this infrastructure  
2. **E2 - Error Contract/Exit Code Hardening** - Provides consistent error handling standards for all commands
3. **E3 - Approval Lifecycle Enforcement** - Covers the core security invariants that must be verified
4. **E4 - Provider & Daemon Status Integration** - Provides visibility into system dependencies  
5. **E5 - Smoke Test Automation** - Automates core workflow validation for operational assurance
6. **E6 - Operator Test Plan & Documentation** - Finalizes test coverage and operator guidance

## Test Strategy

The test strategy focuses on:
1. Deterministic, non-hanging behavior of all test cases
2. Coverage of both success paths and failure modes
3. Verification that CLI output meets specified patterns without `[object Object]` 
4. Exit code consistency across different operating states
5. Isolation between test runs to avoid cross-contamination

## Observed Repo Evidence That Supports the Epic Breakdown

| Claim | Location |
|---|---|
| CLI behavior testing requires harness module | `packages/cli/src/__tests__/workspace-grant-cli.test.ts` |
| Session-based approvalId handling exists in runtime | `session-grant-manager.ts:126`, `ipc-server.ts:349-373` |
| Runtime error handling standard exists | `packages/cli/src/index.ts:574` (line where TTL help text needs correction) |
| Approval lifecycle invariants were defined previously | `runtime.ts:502-505` and related files in approval enforcement |
| CLI command exit code contract | `packages/cli/src/index.ts:561`, `index.ts:601` for daemon-down scenarios |

This breakdown provides a practical roadmap focusing on robustness without adding new features, aligning with the project's objective to validate the existing workflow path.
