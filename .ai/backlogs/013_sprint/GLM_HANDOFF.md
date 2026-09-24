# GLM handoff prompt for Sprint 13

## Context

We are working in a TypeScript monorepo for Aer Runtime. The repository reached a stable stage after Sprint 12, where documentation and sprint framing were reconciled. The main branch is `develop`; the active working branch is `sprint13`.

This handoff brief aligns Sprint 13 with the `# Sprint 13` section of `ROADMAP.md` (milestone name: **CLI reliability**). The objective is to close the known-risks defects in the validated CLI path and surface provider state — a narrow, pre-MVP, CLI-focused milestone with **no new product features**.

## Current state summary

- The project is a modular TypeScript runtime for autonomous engineering workflows, implemented and building cleanly (`npm run build`).
- The validated product path is the secure workspace flow: grant → preview → approve → apply.
- The project is **pre-MVP**. Only the validated core path is described as working with confidence.
- The Ollama provider is **experimental**; additional provider backends are interface types only.
- The GUI / VS Code extension are design-only (Sprints 10–11), not MVP components.
- Tests: 402/402 passing, including the CLI tests under `packages/cli/src/__tests__/`.

## Known risks targeted this sprint (from `PROJECT_STATE.md`)

- **CLI error reporting:** a rejected `approvalId` or other IPC failure prints `[object Object]` instead of the daemon's real message (e.g. `Unknown or already-consumed approvalId`, thrown at `packages/runtime/src/core/runtime.ts:534`). Root cause: `IpcClient.call()` rejects with a plain `{ code, message }` object (`packages/cli/src/ipc-client.ts:113`, `:156`), and several `index.ts` catch blocks — `workspace:list` (`:305`), `workspace:approve` (`:532`), `workspace:apply` (`:564`) — still do `error instanceof Error ? error.message : String(error)`, stringifying that object (other blocks, e.g. `ask`/`chat`/`workspace:read` at `:195`/`:244`/`:281`, already extract `message`).
- **Provider health / local inference:** `aer status` does not surface the Ollama provider state; the local-Ollama prerequisite is not documented.

## What was completed in Sprint 12

- README, PROJECT_STATE, and ROADMAP reconciled to an honest, pre-MVP narrative.
- Sprint backlog split into epics and task files (`.ai/backlogs/012_sprint/`).

## Sprint 13 objective (per `ROADMAP.md`)

Close the known-risks defects in the validated CLI path and surface provider state, in a narrow, execution-ready scope. Deliverables:
1. Close the `Known Risks` defect — CLI error propagation prints the daemon's real message (e.g. `Unknown or already-consumed approvalId`), not `[object Object]`.
2. Add the Ollama provider state to `aer status` (reachable / unreachable at `http://localhost:11434`).
3. Document the local-Ollama prerequisite (`http://localhost:11434`) in the README.

## Epics (this backlog)

1. **Epic 1 — CLI error propagation** (`01_cli-error-propagation/`) — surface the daemon message + regression test.
2. **Epic 2 — Provider status** (`02_provider-status/`) — Ollama reachability line in `aer status` + test.
3. **Epic 3 — Docs & risk closure** (`03_docs-risk-closure/`) — README prerequisite + close the two Known Risks rows + stable commit.

## Acceptance criteria (Definition of Done, per `ROADMAP.md`)

- `npm run build` passes and `npm test` passes, including all `packages/cli/src/__tests__` tests.
- Reusing a consumed `approvalId` prints `Unknown or already-consumed approvalId`, not `[object Object]`; a test in `packages/cli/src/__tests__/` asserts this.
- `aer status` (daemon running) prints the Ollama provider state (reachable / unreachable at `http://localhost:11434`) in addition to `Daemon running` and `Runtime state`.
- The README states the local-Ollama prerequisite in the section describing provider health or the usage flow.
- `PROJECT_STATE.md` marks the two closed defects (CLI error reporting, provider health / local inference).
- A stable commit on the sprint branch contains all of the above, and the sprint branch remains resumable.

## Technical decisions and assumptions

- **Epic 1:** Prefer fixing message extraction in `packages/cli/src/index.ts` (narrow blast radius) over normalizing the rejection to an `Error` in `packages/cli/src/ipc-client.ts`. Both are valid; the former is lower-risk.
- **Epic 2:** The daemon does not expose a provider-status IPC command, so the provider line is a **CLI-side bounded reachability probe** of `http://localhost:11434`. Do not add a new IPC command (scope creep). Add a timeout so a down/slow Ollama cannot hang `aer status`.
- **Tests:** Keep provider-state tests dependent on a mocked probe, never a live Ollama, so the suite is green in CI and on machines without Ollama.
- **Honesty:** The Ollama provider remains **experimental**; the provider-state line is a reachability signal, not a validated product feature.

## Risks and known gaps

- Epic 1 root-cause ambiguity: the fix location could be `index.ts` (extraction) or `ipc-client.ts` (rejection shape). Re-verify all CLI tests if touching `ipc-client.ts`.
- Epic 2: no provider-status IPC command exists — must stay a CLI-side probe; add a bounded timeout.
- Live-environment flakiness for Epic 2 tests — mock the probe, never depend on a live Ollama.
- Scope creep: do not let the provider line read as a "validated" provider feature.

## Recommended next implementation slice

1. Epic 1 first (no dependencies): fix extraction in `packages/cli/src/index.ts`, add the regression test, verify build + tests.
2. Epic 2 second (sequential same-file change): add the bounded probe + provider line to `aer status`, add the test, verify build + tests.
3. Epic 3 last: update the README prerequisite and the two `PROJECT_STATE.md` rows, then cut the stable commit on `sprint13`.

## Constraints

- Keep scope to CLI reliability and known risks; no new product features.
- Do not claim product maturity; the project is pre-MVP.
- Do not add provider backends (interface types only) or the GUI / VS Code extension.
- Keep every task grounded in files that exist in the repository.
- Produce implementation-ready planning artifacts, not vague product brainstorming.

## Final instruction

Execute the three epics in the order above, on the `sprint13` branch, keeping `npm run build` and `npm test` green at each step. The backlog is split into epics, user stories, and atomized tasks under `.ai/backlogs/013_sprint/`. When complete, the Definition of Done above must be satisfied and the sprint branch must remain resumable.