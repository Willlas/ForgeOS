# Sprint 13 — CLI reliability

> Objective (from `ROADMAP.md`): close the known-risks defects in the validated CLI path and surface provider state, in a narrow, execution-ready scope grounded in the actual repository state.

## Objective

Harden the validated CLI path (grant → preview → approve → apply) by fixing the error-reporting defect that hides daemon failures as `[object Object]`, surfacing the Ollama provider state in `aer status`, and documenting the local-Ollama prerequisite. This is a small, CLI-focused, pre-MVP milestone: no new product features, no GUI, no additional provider backends.

## Current repository status

The repository is on the `develop` main branch with a working branch `sprint13` for this milestone.

### What is already stable

- Core runtime and orchestration structure are implemented and build cleanly (`npm run build`).
- CLI and daemon IPC workflow are implemented.
- The validated workflow path is grant → preview → approve → apply.
- Regression tests cover the critical grant and workspace-write flow (402/402 passing, including the CLI tests under `packages/cli/src/__tests__/`).
- The repository documentation is honest about maturity and scope (post-Sprint 12).

### What is in scope for Sprint 13 (from `ROADMAP.md`)

- Close the `Known Risks` defect: CLI error propagation printing `[object Object]` instead of the daemon's real message (e.g. `Unknown or already-consumed approvalId`).
- Add the Ollama provider state to `aer status` (reachable / unreachable at `http://localhost:11434`).
- Document the local-Ollama prerequisite (`http://localhost:11434`) in the README.

## Epics in this sprint

| Epic | Purpose | Source |
|------|---------|--------|
| [Epic 1: CLI error propagation](01_cli-error-propagation/01_cli-error-propagation.md) | Surface the daemon's real error message in `aer` commands instead of `[object Object]`, with a regression test | `ROADMAP.md` (deliverable 1) |
| [Epic 2: Provider status](02_provider-status/02_provider-status.md) | Report the Ollama provider state in `aer status` | `ROADMAP.md` (deliverable 2) |
| [Epic 3: Docs & risk closure](03_docs-risk-closure/03_docs-risk-closure.md) | Document the local-Ollama prerequisite and close the two `Known Risks` register rows | `ROADMAP.md` (deliverable 3 + Definition of Done) |

## How to navigate this backlog

1. Start with this file for the objective and constraints.
2. Open an epic file to read its objective, user stories, and acceptance criteria.
3. Open the matching `*-tasks.md` file to see the atomized tasks, file targets, and verification.

## Constraints

- Keep scope to CLI reliability and known risks; no new product features.
- Do not claim product maturity; the project is pre-MVP.
- Do not add additional provider backends (interface types only).
- Do not build the GUI or VS Code extension (design-only, from Sprints 10–11).
- Keep every task grounded in files that exist in the repository.
- The Ollama provider remains **experimental** — the provider-state line in `aer status` is a reachability signal, not a validated product feature.

## Companion handoff

See `GLM_HANDOFF.md` for the full execution brief.
