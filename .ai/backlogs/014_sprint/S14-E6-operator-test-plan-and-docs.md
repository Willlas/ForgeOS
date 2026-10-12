# S14-E6 — Operator Test Plan & Documentation

> Sprint 14 | Priority: P2 | Plan: `S14-overview.md`

## Goal

Create comprehensive operator documentation that covers all validated CLI behaviors and provides clear guidance for manual or automated testing.

## Why this matters

Documentation ensures teams can understand, reproduce, and verify functionality consistently throughout the development lifecycle. It serves as a shared reference point for both internal developers and external operators.

## Scope

- Document all validated success and failure paths  
- Provide operator runbook with test scenarios
- Include command line references and help text verification

## Out of scope

- Implementation changes beyond documentation updates
- Creating new features or workflows
- Detailed API specification beyond CLI behavior 

## Acceptance criteria

- Complete `docs/cli-operator-test-plan.md` file documenting all validated behaviors  
- Test matrix includes operational scenarios with expected outcomes
- All documented error patterns can be reproduced in reality

## Proposed tasks

### S14-E6.1 — Create comprehensive operator test plan

New file `docs/cli-operator-test-plan.md` that:

- Documents all validated success and failure scenarios 
- Provides clear command output examples and verification steps
- Includes test matrix with expected results per scenario  
- Cross-references documentation with implementation tests

### S14-E6.2 — Add CLI help text verification

Include specific checks for:
- TTL help text formatting ("default 60s, cap 3600s") 
- Command-line argument validation
- Error message consistency

### S14-E6.3 — Operational workflow guidance

Provide guidance on:
- How to run manual operator tests 
- Expected command outputs and exit codes
- Troubleshooting common operational issues  
- Reproducing validation scenarios

## Risks / Assumptions

- Documentation remains accurate as implementations evolve  
- Operator documentation can be maintained alongside code changes

## Dependencies

All previous epics for complete validation information needed  

## Test strategy / Validation approach

- Document all validated behaviors that were implemented in previous epics
- Include specific test cases and expected outcomes
- Ensure all documented error patterns are reproducible 
- Provide operator-friendly examples with clear step-by-step instructions

## Evidence from the repo

| Claim | Location |
|---|---|
| CLI command outputs need documentation | All command implementations in `packages/cli/src/index.ts` |
| Validation matrix needs operator guidance | `Sprint_14_Epic_Breakdown.md` and `README.md` test scenarios |
| CLI help text verification needed | `packages/cli/src/index.ts:574` (TTL help text) |
