# S14-E4 — Provider & Daemon Status Integration

> Sprint 14 | Priority: P1 | Plan: `S14-overview.md`

## Goal

Implement monitoring of daemon and provider status through explicit environment variable override for Ollama base URL with comprehensive validation matrix.

## Why this matters

Operators must be able to understand the state of system dependencies. This makes CLI workflows more robust and reduces ambiguity when operations fail due to network issues or misconfigured services.

## Scope

- Implement AER_OLLAMA_BASE_URL environment variable override
- Validate status matrix scenarios
- Add provider reachability output during status command

## Out of scope

- Modifying core Ollama integration behavior  
- Adding new network monitoring features beyond what's necessary for this sprint
- Changing existing network connectivity patterns

## Acceptance criteria

- `AER_OLLAMA_BASE_URL` environment variable allows override of default Ollama address  
- Status command provides clear "unreachable" output when host is unreachable
- CLI remains responsive even when provider is unreachable (no hangs or crashes)
- All tests pass with the new environment override implementation

## Proposed tasks

### S14-E4.1 — Environment variable override implementation

Update `cli/src/index.ts` line 143 to implement AER_OLLAMA_BASE_URL:

```ts
// Extract Ollama base URL from environment or use default
const ollamaBaseUrl = process.env.AER_OLLAMA_BASE_URL || "http://localhost:11434";
```

This allows operators to override the default address for testing or non-standard installations.

### S14-E4.2 — Status command reachability

Modify `status` command behavior to include provider reachability:

- When the Ollama service responds, status command should print the full URL  
- When it does not respond (HTTP error or timeout), status should print `unreachable`
- CLI remains responsive and does not hang even when services are unreachable
- All process-level flows remain timeout-bounded via E1 harness

### S14-E4.3 — Add validation matrix tests

Create new test suite covering the following scenarios:
- Default Ollama address (should work in normal cases)
- Custom AER_OLLAMA_BASE_URL override 
- Provider unreachability scenario  
- Daemon-down state (separate from provider status)

## Risks / Assumptions

- Environment variables are properly set and passed to all relevant CLI components
- Ollama reachability tests correctly identify network issues vs service errors
- The environment variable is not exposed to sensitive contexts where it could be misused  

## Dependencies

- E1 for test infrastructure
- E2 for consistent error handling standards

## Test strategy / Validation approach

- Manual check confirms default behavior works  
- Custom URL override tested with different base addresses
- Provider unreachable state tested with mocked scenarios
- CLI response time validated under both good and bad network conditions  

## Evidence from the repo

| Claim | Location |
|---|---|
| Ollama URL default is defined | `packages/cli/src/index.ts:143` |
| Status command needs provider output enhancement | `packages/cli/src/index.ts:592-600` (status command logic) |
| Daemon state check exists | `packages/cli/src/index.ts:561,601` |
| Session-based approvalId handling exists | `session-grant-manager.ts:126`, `ipc-server.ts:349-373` |
