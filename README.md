# Aer Runtime

Aer is a modular runtime for autonomous engineering workflows, multi-agent coordination, and CLI-driven workspace execution.

## Current status

- Branch: `develop`
- Current focus: documentation alignment and product definition for Sprint 12
- Runtime layers: runtime core, scheduler, dispatcher, provider abstraction, workflow engine, CLI
- Verified: grant / preview / approve / apply workflow and CLI interaction path

## Project goals

- Provide a provider-independent autonomous runtime
- Coordinate multiple agents and workers around engineering tasks
- Offer a CLI to interact with daemon-backed runtime workflows
- Keep the repository healthy, testable, and resumable by sprint

## Repository structure

- `packages/runtime/` — runtime engine, grants, workflow execution, session logic
- `packages/cli/` — command-line interface and IPC client
- `docs/` — roadmap, RFCs, ADRs and project records
- `prototype/` — UI prototypes and examples
- `experiments/` — exploratory work and test fixtures

## Next milestone

Sprint 12 is focused on documenting what is already real, what is experimental, and what remains as the next product milestone.
