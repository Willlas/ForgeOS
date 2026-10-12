# Sprint 14 - CLI Validation Hardening & Test Plan Expansion

## Overview

This sprint focuses on validating and hardening the existing CLI workflow with a secure operational path (`grant -> preview -> approve -> apply`). The goal is to ensure robustness, deterministic exit behavior, error quality, provider status handling, and testability without adding new product features.

## Epics & Tasks

### E1 - CLI Test Harness & Foundations (P0, Critical Path)
> **Status:** Ready for implementation
> **Constraint:** Test infrastructure only — no product behavior changes; every spawn must be timeout-bounded.
> **Source:** [QWEN_EPIC_BREAKDOWN_PROMPT.md](QWEN_EPIC_BREAKDOWN_PROMPT.md)

#### Tasks:
1. **Create CLI harness module** - `packages/cli/src/__tests__/helpers/cli-harness.ts`
   - Export `aer(args, { timeoutMs = 20_000, env = {} })` that spawns `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts ...args`
   - Never throws on non-zero exit (exit codes are data)
   - Kills process tree on timeout and resolves with `timedOut: true`
   - Merges `env` into child's environment
   - **Subtask 1A-2:** Cross-invocation sessions support via `newTestSession()` helper
     - All multi-invocation tests MUST pass `env: { AER_SESSION_ID: session }`
     - Never let two concurrent test invocations share a session id (daemon rejects with `SessionInUse`)
   - **Subtask 1B:** Add `assertNoObjectLeak(result)` helper
   - **Subtask 1C:** Add `ensureDaemonDown()` helper 
   - **Subtask 1D:** Add `ensureDaemonUp()` helper
   - **Subtask 1E:** Add `makeTempWorkspace()` / `cleanupWorkspace()` helpers
2. **Raise vitest testTimeout** - Update `vitest.config.ts`
   - Set `testTimeout: 30_000` 
   - Keep harness-level hard kill (20s) as backstop

#### Acceptance Criteria:
- cli-harness.ts exists and every spawn path is timeout-bounded  
- assertNoObjectLeak, ensureDaemonUp, ensureDaemonDown, makeTempWorkspace, cleanupWorkspace are all exported and used by at least one test file
- vitest.config.ts has testTimeout: 30_000; npm run build and npm test are green  
- No product-behavior files changed (test infrastructure only)

### E2 - Error Contract & Exit-Code Hardening (P0, Critical Path)  
> **Status:** Ready for implementation
> **Constraint:** Fix error messaging, help text, and exit code formatting without changing core workflow.
> **Source:** [QWEN_EPIC_BREAKDOWN_PROMPT.md](QWEN_EPIC_BREAKDOWN_PROMPT.md)

#### Tasks:
1. **Fix CLI --ttl help text** - Update cli/src/index.ts line 574
   - Show "default 60s, cap 3600s" to match runtime constants  
2. **Standardize error formatting** using runtime constants
   - Replace `error instanceof Error ? error.message : String(error)` pattern
   - Preserve process.exitCode = 1 and finally { client.disconnect(); } behavior
3. **Verify CLI message handling** with tests
   - Test that daemon's real error message surfaces instead of [object Object]
   - Ensure no command path prints [object Object]

#### Acceptance Criteria:
- CLI --ttl help text shows correct default/cap 
- Error messages are consistent across CLI paths  
- No command can print [object Object] for IPC rejection
- Exit codes remain deterministic (0 for success, 1 for failure)
- npm run build and npm test are green

### E3 - Approval Lifecycle Enforcement (P0, Critical Path)
> **Status:** Ready for implementation  
> **Constraint:** Pin safety invariants with reliable tests, not change behavior.
> **Source:** [QWEN_EPIC_BREAKDOWN_PROMPT.md](QWEN_EPIC_BREAKDOWN_PROMPT.md)

#### Tasks:
1. **Runtime approval-lifecycle suite** (S14-E3.1)
   - New file `packages/runtime/src/__tests__/approval-lifecycle.test.ts`  
   - Pin 7 safety invariants: single-use, consume-on-success, session, rootPath, TTL clamp/default, expiry, diffHash binding
   - No daemon needed - uses public grant registry and resetSessionGrantManager()
2. **CLI approval-lifecycle suite** (S14-E3.2)
   - New file `packages/cli/src/__tests__/workspace-approval-cli.test.ts`
   - Drive real grant → preview → approve → apply path over daemon  
   - Pin exit code + stream + no-[object Object] on every row
   - Cross-invocation session handling (use newTestSession() + AER_SESSION_ID env)
3. **Read-only grant misuse** (S14-E3.3)  
   - Runtime and CLI tests for read-only grant rejection
   - Verify both layers reject access appropriately

#### Acceptance Criteria:
- New runtime test file passes with proper assertion of each invariant
- New CLI test file confirms success and failure paths 
- Read-only grant handling works at both layers
- All error strings match source code exactly to prevent drift
- npm run build clean; npm test passes existing tests  

### E4 - Provider & Daemon Status Integration (P1)
> **Status:** Ready for implementation  
> **Constraint:** Add provider reachability without changing core workflow.
> **Source:** [QWEN_EPIC_BREAKDOWN_PROMPT.md](QWEN_EPIC_BREAKDOWN_PROMPT.md)

#### Tasks:
1. **Environment variable override** - Update cli/src/index.ts line 143
   - Implement AER_OLLAMA_BASE_URL environment variable handling  
2. **Add provider status tests** 
   - Test unreachability scenarios for Ollama service
   - Validate that status command handles unreachable providers gracefully

#### Acceptance Criteria:
- AER_OLLAMA_BASE_URL allows override of default Ollama address
- Status command provides clear "unreachable" output when host is unreachable  
- CLI remains responsive even when provider is unreachable (no hangs or crashes)
- All tests pass with new environment override implementation  

### E5 - Smoke Test Automation (P1)
> **Status:** Ready for implementation  
> **Constraint:** Create minimal smoke test that confirms core workflows.
> **Source:** [QWEN_EPIC_BREAKDOWN_PROMPT.md](QWEN_EPIC_BREAKDOWN_PROMPT.md)

#### Tasks:
1. **Add smoke:cli npm script**
   - Add entry to package.json
2. **Create validation script** 
   - Check key aspects of CLI functionality
   - Verify TTL help text formatting and environment override

#### Acceptance Criteria:
- package.json has working smoke:cli script entry  
- Smoke script validates basic CLI functionality
- Script runs independently from full test suite
- All assertions are properly made and pass consistently  

### E6 - Operator Test Plan & Documentation (P2)
> **Status:** Ready for implementation  
> **Constraint:** Create operator guidance without implementing new tests.
> **Source:** [QWEN_EPIC_BREAKDOWN_PROMPT.md](QWEN_EPIC_BREAKDOWN_PROMPT.md)

#### Tasks:
1. **Create cli-operator-test-plan.md** documentation
   - Document all validated behaviors and expected outputs
   - Include test matrix with scenarios and results  
   - Add command line references and help text verification

#### Acceptance Criteria:
- Complete docs/cli-operator-test-plan.md file documenting all validated behaviors
- Test matrix includes operational scenarios with expected outcomes  
- All documented error patterns can be reproduced in reality

## Suggested Implementation Order

1. E1 - CLI Test Harness & Foundations (Critical Path)
2. E2 - Error Contract/Exit Code Hardening  
3. E3 - Approval Lifecycle Enforcement (Core Safety)
4. E4 - Provider & Daemon Status Integration
5. E5 - Smoke Test Automation
6. E6 - Operator Test Plan & Documentation

### Implementation Dependencies

- **E1** is critical path - all other epics depend on this infrastructure  
- **E2** builds on E1 for consistent error handling standards
- **E3** uses E1 harness and E2 for error handling, covers core safety invariants  
- **E4** requires E1 infrastructure to test daemon states  
- **E5** depends on all previous for actual validation functionality
- **E6** finalizes documentation based on all implemented behaviors

## Test Strategy  

The test strategy focuses on deterministic behavior:
1. All CLI tests use timeout-bounded processes with E1 harness
2. Runtime tests are isolated and process-free  
3. Cross-invocation session handling via E1 module for multi-step flows 
4. Error message validation ensures no `[object Object]` leakage
5. Exit code consistency across all operations
