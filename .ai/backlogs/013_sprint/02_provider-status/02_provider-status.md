# Epic 2 — Provider status

> Atomized tasks: [02_provider-status-tasks.md](02_provider-status-tasks.md)

## Objective

Surface the Ollama provider state in `aer status` so an operator can see whether the local inference backend at `http://localhost:11434` is reachable, in addition to the existing daemon and runtime state.

## Background (grounded in the repo)

- The `status` command (`packages/cli/src/index.ts:98-120`) currently prints `Daemon running` and `Runtime state` only.
- The daemon does **not** expose a provider-status IPC command, so this is a CLI-side reachability probe of `http://localhost:11434`, not a daemon change.
- The Ollama provider is **experimental** (README `## MVP boundary`); the provider line is a reachability signal, not a validated product feature.
- The provider default base URL is `http://localhost:11434` (see `packages/runtime/src/providers/ollama-provider.ts:160`).

## User stories

### US-03: `aer status` reports provider state
**As a runtime operator**
**I want** `aer status` to report whether the Ollama provider is reachable
**so that** I can tell whether local inference is available before running an inference command.

**Acceptance criteria:**
- With the daemon running, `aer status` prints the existing `Daemon running: Yes` and `Runtime state: <state>` lines **plus** a new Ollama provider line (e.g. `Ollama provider: reachable (http://localhost:11434)` / `Ollama provider: unreachable (http://localhost:11434)`).
- The reachability check uses a bounded timeout so a down or slow Ollama cannot hang the CLI.
- When the daemon is not running, `aer status` still exits cleanly (prints `Daemon running: No`, no crash, no unhandled rejection).
- Both reachable and unreachable cases produce a deterministic line.

### US-04: The provider-state line is regression-protected
**As a runtime maintainer**
**I want** a test that asserts the provider-state line for both states
**so that** the line is not accidentally removed and does not depend on a live Ollama.

**Acceptance criteria:**
- A test in `packages/cli/src/__tests__/` asserts the provider line (with `localhost:11434`) for both the reachable and unreachable branches, using a mocked reachability probe (no live Ollama dependency).
- `npm test` passes.

## Tasks

- [ ] Add a bounded Ollama reachability probe and a provider-state line to `aer status` (`packages/cli/src/index.ts`).
- [ ] Add a test for the provider-state line in both states (`packages/cli/src/__tests__/`).
- [ ] Verify `npm run build` and `npm test` are green with no regressions.

## Out of scope

- Adding a provider-status IPC command to the daemon.
- Implementing additional provider backends (OpenAI, Anthropic) — interface types only.
- Treating the Ollama provider as a validated product feature.
