# CLI Operator Test Plan

This document provides a comprehensive guide to testing and validating the Aer CLI functionality. It covers all validated behaviors, test scenarios, and expected outcomes.

## Overview

The operator test plan covers core CLI functionality including:
- Command execution and help text verification
- Environment variable handling
- Approval lifecycle workflows
- Provider status reporting

## Test Matrix

| Scenario | Command | Expected Outcome |
|----------|---------|------------------|
| Basic CLI help | `aer --help` | Shows all available commands and options |
| TTL help text validation | `aer workspace:approve --help` | Displays "default 60s, cap 3600s" |
| Environment override | `AER_OLLAMA_BASE_URL=https://example.com aer status` | Uses custom OLLAMA URL |
| Approval workflow | `aer workspace:approve <path> <hash>` | Returns valid approvalId with proper TTL |
| Apply workflow | `aer workspace:apply <path> <approvalId>` | Applies changes successfully or returns error |
| Status command | `aer status` | Shows daemon status information |

## Test Scenarios

### 1. Help Text Validation
- Run `aer workspace:approve --help`
- Verify TTL option shows "default 60s, cap 3600s"
- Confirm all CLI options are present and correctly formatted

### 2. Environment Variable Testing  
- Set `AER_OLLAMA_BASE_URL=test-url` 
- Execute CLI commands
- Verify URL override is working properly (requires code verification)

### 3. Approval Lifecycle Tests
- Approve a workspace: `aer workspace:approve /tmp/test abc123 --yes`
- Apply same approval Id twice (second should fail)
- Test various TTL values (default, custom, over max)

### 4. Daemon Status Validation
- Execute `aer status` command
- Verify output shows daemon running/not-running state clearly

## Error Patterns

- Invalid TTL value (non-positive number) → Error message: "--ttl must be a positive number of seconds"
- Unknown approvalId → Error message: "Unknown or already-consumed approvalId"
- Daemon not running → Error message: "Daemon is not running. Start it first."
- Invalid command → Shows help with exit code 1

## Validation Steps  

1. Ensure existing tests pass (`npm test`)
2. Run smoke CLI test (`npm run smoke:cli`)
3. Manually verify key commands and outputs
4. Validate all documented error patterns are reproducible

---

*Last Updated: 2026-10-09*