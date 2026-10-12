# 04 - Smoke Test Automation

## Goal

Create automated smoke tests that exercise core CLI functionality with `npm run smoke:cli` script to validate that key workflows operate correctly.

## Why this matters

Smoke testing ensures fundamental workflows maintain basic functionality after changes, serving as an early warning system that prevents major regressions before they reach CI.

## Scope

- Add `smoke:cli` script to package.json 
- Create validation script that checks basic build and operational aspects
- Verify key TTL help text formatting changes
- Test OLLAMA base URL environment override

## Out of scope

- Comprehensive test suite (focus on minimal coverage)
- Infrastructure changes beyond the smoke command implementation  

## Acceptance criteria

- `package.json` has working `smoke:cli` script entry  
- Smoke script validates basic CLI functionality 
- The script can run without requiring complex setup
- All assertions are properly made and pass consistently

## Tasks

### Task 1: Add npm smoke:cli script
Update `package.json` to include:
```json
{
  "scripts": {
    "smoke:cli": "node scripts/cli-smoke-test.js"
  }
}
```

### Task 2: Create validation script
New file `scripts/cli-smoke-test.js` that:
- Tests basic CLI command execution with timeout handling  
- Verifies TTL help text shows correct "default 60s, cap 3600s"
- Confirms AER_OLLAMA_BASE_URL environment variable can be used
- Validates that key workflows don't crash or hang

### Task 3: Test basic functionality
The smoke script should verify:
- CLI responds to command execution with expected exit codes  
- Help text displays correctly for TTL option
- Environment variable handling works as expected
- Status command responds appropriately when daemon is running  

## Risks / Assumptions

- The smoke tests will not be overly complex to maintain
- Environment variables will be properly passed through npm scripts
- The CLI will remain responsive during smoke test execution

## Dependencies

All other epics for actual implementation details to be tested  

## Test strategy / Validation approach

- Run the smoke script independently from full test suite
- Ensure it exercises core workflow paths
- Validate that script can run without complex setup
- Check assertions pass consistently across different environments  
