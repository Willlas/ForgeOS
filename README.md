# Aer Runtime

Aer is a modular runtime for autonomous engineering workflows, coordinating multiple agents and workers around a shared workspace with provider-backed execution.

It is a TypeScript monorepo: `packages/runtime` contains the runtime core (agent/worker coordination, scheduler, dispatcher, provider layer, workflow engine), and `packages/cli` provides the `aer` CLI plus the `aer-daemon` process it communicates with over IPC.

The grant → preview → approve → apply flow for workspace operations is the validated core path, covered end-to-end by the test suite.

## Current status

- **Status: pre-MVP** — the project is under active development and not yet at a minimum viable product
- Branch: `sprint12`
- Current focus: Sprint 12 — documentation alignment, product framing, and MVP definition
- Validated path (only verified workflow): grant → preview → approve → apply CLI flow

## Project goals

- Provide a provider-independent autonomous runtime
- Coordinate multiple agents and workers around engineering tasks
- Offer a CLI to interact with daemon-backed runtime workflows
- Keep the repository healthy, testable, and resumable by sprint

## Repository structure

- `packages/runtime/` — runtime engine, grants, workflow execution, session logic
- `packages/cli/` — command-line interface (`aer`), daemon process (`aer-daemon`) and IPC client
- `packages/.daemon/` — daemon runtime state (pid and state files)
- `.daemon/` — root-level daemon runtime state (pid file)
- `.ai/` — agent documentation and sprint backlogs
- `docs/` — roadmap, RFCs, ADRs and project records
- `templates/` — document templates (ADR, task, feature, experiment, research, commit)
- `tests/` — root-level verification scripts (DoD and health-check)
- `prototype/` — UI prototypes and examples
- `experiments/` — exploratory work and test fixtures
- `dist/` — build output
- `logs/` — runtime logs
- `.tmp/` — temporary scratch files
- `.vscode/` — VS Code editor configuration
- `.zcode/` — ZCode editor configuration

## Next milestone

Sprint 12 is focused on documenting what is already real, what is experimental, and what remains as the next product milestone.
