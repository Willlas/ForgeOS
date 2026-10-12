# Autonomous Engineering Runtime

The Autonomous Engineering Runtime provides a framework for creating and coordinating autonomous software engineering agents.

## Key Features

- Modular, provider-independent runtime architecture
- Multi-agent orchestration capabilities  
- Integrated workflow engine for multi-step processes
- Support for various LLM providers (Ollama, etc.)

## CLI Enhancements - Backlog Tasks Implementation

### E4.1: AER_OLLAMA_BASE_URL Environment Variable Override
The CLI now supports an `AER_OLLAMA_BASE_URL` environment variable that overrides the default Ollama base URL (`http://localhost:11434`). 

**Implementation**:
- Modified `packages/cli/src/index.ts` to read from `process.env.AER_OLLAMA_BASE_URL`
- Falls back to default `http://localhost:11434` if not set
- This enables easier integration with custom Ollama setups

### E5.1: Correct CLI TTL Help Text Formatting
The `workspace:approve` command documentation now correctly formats the TTL help text as:
```
Approval TTL in seconds (default 60s, cap 3600s)
```

**Implementation**:
- The option in `packages/cli/src/index.ts` (line ~566) has been properly formatted
- This ensures clear communication about both default and maximum TTL values

### E5.2: Smoke Tests for CLI
Added a comprehensive smoke test suite (`scripts/cli-smoke-test.js`) that validates:

1. Basic CLI command execution (`--help`, `--version`)
2. Proper formatting of TTL help text in workspace:approve
3. Environment variable override functionality 
4. Graceful handling of daemon status commands
5. Command parsing without complex setup requirements

**Test Script**: `npm run smoke:cli` or `npm run verify:smoke`

## Development Setup

```bash
# Install dependencies
npm install

# Run tests  
npm test

# Run smoke tests
npm run smoke:cli
```
