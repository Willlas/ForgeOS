# Sprint 14 - Team Task Implementation Plan

## Executive Summary

This document provides a detailed implementation plan for executing Sprint 14's epics in sequential order, starting with E1 (CLI Test Harness & Foundations) and moving through to E6 (Operator Test Plan & Documentation). The plan outlines the task dependencies, team approach, timeline expectations, and implementation guidance.

## Implementation Approach

### Team Formation
- **Core Team Lead**: Assign one experienced developer to coordinate the overall sprint
- **Epic Champions**: Identify team members for each epic based on their expertise:
  - E1 (Test Harness): Full-stack developer with CLI experience
  - E2 (Error Contract/Exit Codes): Developer experienced with error handling and CLI interfaces  
  - E3 (Approval Lifecycle): Backend engineer familiar with runtime security
  - E4 (Provider/Daemon Status): Team member with system integration experience
  - E5 (Smoke Tests): Automation specialist or build engineer
  - E6 (Operator Docs): Technical documentation specialist

### Sequential Implementation Order
1. **E1 - CLI Test Harness** (Critical Path)
2. **E2 - Error Contract/Exit Codes**
3. **E3 - Approval Lifecycle** 
4. **E4 - Provider/Daemon Status Integration**
5. **E5 - Smoke Test Automation**
6. **E6 - Operator Test Plan & Documentation**

## Detailed Sprint Execution Plan

### Phase 1: E1 - CLI Test Harness & Foundations (Week 1)
**Duration:** 5 working days  
**Lead Developer:** [Assign Core Team Member]

**Key Tasks:**
1. **Day 1-2**: Create `cli-harness.ts` module with:
   - Base `aer()` function for command execution
   - Timeout handling mechanism 
   - Environment variable management
2. **Day 3**: Add session isolation helpers:
   - `newTestSession()` function for multi-step flows
   - Session ID generation and validation  
   - Test cases for cross-invocation sessions
3. **Day 4**: Implement object leak detection:
   - `assertNoObjectLeak(result)` function
   - Integration testing with existing CLI commands
4. **Day 5**: Add daemon management utilities:
   - `ensureDaemonDown()` and `ensureDaemonUp()`
   - Temporary workspace management (`makeTempWorkspace`, `cleanupWorkspace`)
   - Comprehensive test validation

**Dependencies:**
- Requires E1.1 for base process handling in all subsequent epics
- All other epics depend on this foundation

### Phase 2: E2 - Error Contract & Exit-Code Hardening (Week 2)  
**Duration:** 4 working days
**Lead Developer:** [Assign Error Handling Specialist]

**Key Tasks:**
1. **Day 1**: Fix CLI --ttl help text in `index.ts`
   - Change documentation from "capped at 300" to "default 60s, cap 3600s"
2. **Day 2**: Standardize error formatting patterns  
   - Replace error handling with consistent helper
   - Apply same pattern across all CLI commands
3. **Day 3-4**: Verify no `[object Object]` leakage
   - Test that error messages are deterministic and human-readable  
   - Validate exit code consistency (0 for success, 1 for failure)
   - Run tests to ensure E1 harness catches any remaining issues

**Dependencies:**
- Depends on E1 harness for testing execution
- Builds on E1 infrastructure for timeout-bound error testing

### Phase 3: E3 - Approval Lifecycle Enforcement (Week 3)  
**Duration:** 7 working days  
**Lead Developer:** [Assign Runtime Security Expert]

**Key Tasks:**
1. **Day 1-2**: Runtime suite creation (`approval-lifecycle.test.ts`)
   - Setup test files with proper cleanup functions
   - Configure session isolation and root management
   - Implement each of the 7 safety invariants:
     * Single-use approval ID enforcement
     * Consume-on-success validation  
     * Session binding verification
     * RootPath binding assertion
     * TTL clamp/default testing
     * Expiry time validation (~1.1s wait)
     * diffHash binding check
2. **Day 3-4**: CLI suite implementation (`workspace-approval-cli.test.ts`)
   - Create E1-based test framework for CLI integration testing  
   - Implement happy path validation (exit code 0 with applied: true)
   - Add duplicate approvalId failure scenario testing
   - Integrate `assertNoObjectLeak` and session management
3. **Day 5-7**: Read-only grant misuse testing (`E3.3`)
   - Unit tests for runtime security checks
   - Process tests for CLI validation
   - Confirm actual CLI error message alignment

**Dependencies:**
- Requires E1 harness for process execution
- Depends on E2 for consistent error handling standards  
- No external dependencies beyond E1+2 implementation

### Phase 4: E4 - Provider & Daemon Status Integration (Week 4)
**Duration:** 5 working days  
**Lead Developer:** [Assign System Integration Specialist]

**Key Tasks:**
1. **Day 1**: Implement AER_OLLAMA_BASE_URL environment variable override
   - Update `index.ts` line 143 to extract from process.env
2. **Day 2**: Add provider reachability detection  
   - Modify status command behavior for unreachable providers
3. **Day 3-4**: Add validation matrix tests
   - Test default Ollama address scenario  
   - Test custom AER_OLLAMA_BASE_URL override
   - Validate daemon-down states separately (E4.3)
4. **Day 5**: Integration and testing validation

**Dependencies:**
- Depends on E1 for reliable test environment
- Requires E2 for consistent error messages during testing

### Phase 5: E5 - Smoke Test Automation (Week 5)  
**Duration:** 3 working days
**Lead Developer:** [Assign Automation Specialist]

**Key Tasks:**
1. **Day 1**: Add npm script to package.json  
   - Create `smoke:cli` entry point
2. **Day 2-3**: Implement validation script (`cli-smoke-test.js`)
   - Basic CLI command execution testing
   - Verify TTL help text formatting  
   - Test environment variable handling
   - Validate basic workflow responses

**Dependencies:**
- Requires all previous epics to function properly
- Depends on completed E1/E2 infrastructure  

### Phase 6: E6 - Operator Test Plan & Documentation (Week 5)  
**Duration:** 3 working days  
**Lead Developer:** [Assign Tech Writing Specialist]

**Key Tasks:**
1. **Day 1**: Create comprehensive operator plan documentation
   - Document all validated success and failure scenarios  
   - Provide command examples and verification steps
2. **Day 2**: Add CLI help text verification  
   - Include specific checks for TTL formatting
   - Document command-line argument validation
3. **Day 3**: Operational workflow guidance  
   - How to run manual operator tests
   - Expected outputs and troubleshooting

**Dependencies:**
- All previous epics must be completed first to provide accurate documentation
- Depends on E2 for reliable error message documentation

## Team Collaboration Workflow

### Daily Standups (15 mins)
- What did you complete yesterday?
- What will you complete today? 
- Any blockers or impediments?

### Weekly Planning Meetings (60 mins)
- Review progress against sprint goals  
- Adjust task assignments if needed
- Discuss any technical challenges

### Code Reviews and Quality Checks
- All code changes must be reviewed by two team members
- Unit tests must be 100% functional before merging  
- Integration validation at the end of each epic phase

### Risk Management
| Risk | Mitigation |
|------|------------|
| Dependency delays | Implement parallel development where possible |
| Overly complex test scenarios | Keep tests focused on core requirements |
| Testing failures affecting subsequent epics | Create robust E1 harness as foundation |
| Team member unavailability | Cross-train teammates to handle multiple epic roles |

## Expected Timeline
- **Week 1**: E1 Implementation - Complete (5 days)
- **Week 2**: E2 Implementation - Complete (4 days)  
- **Week 3**: E3 Implementation - Complete (7 days)
- **Week 4**: E4 Implementation - Complete (5 days)
- **Week 5**: E5 + E6 Implementation - Complete (6 days)

**Total Sprint Duration:** 5 weeks

## Success Metrics
1. All epics implemented as specified in backlog.md
2. No `[object Object]` leakage in error output streams
3. All exit codes consistently follow established standards (0 = success, 1 = failure)
4. End-to-end smoke tests pass with minimal setup required
5. Operator test plan provides clear guidance and reproducible scenarios

## Communication Plan
- **Slack Channel**: #sprint-14-progress
- **GitHub Project Board**: Track task completion with status updates
- **Sprint Retrospective**: 2-day post-sprint analysis in final week
