# PROJECT_STATE

Last Updated: 2026-09-24
Repository Status: STABLE
Build Status: PASSING
Tests: PASSING (409/409, 29 files)
Branch: sprint13
Last Stable Commit: 788bcbe — feat(cli): surface Ollama provider state in aer status and close Sprint 13 risk register

---

# Mission

Aer is a modular, provider-independent runtime that coordinates multiple agents and workers around a shared workspace (multi-agent coordination is **experimental** — see Component Maturity Matrix), so that developers can run autonomous engineering workflows with grant-controlled, auditable operations.
The `aer` CLI and `aer-daemon` are the runtime's execution surface; `prototype/` and `experiments/` are explorations, not product.
Aer is pre-MVP: the only validated path today is the CLI grant → preview → approve → apply flow.

## Current Mission

Build a reliable autonomous engineering runtime that coordinates agents, providers, workflows, and CLI-driven operations around a secure workspace model.

Sprint 13 makes the validated grant → preview → approve → apply CLI path trustworthy for pre-MVP use by closing the Known Risks register defects that affect it (CLI error propagation, provider health / local inference) and documenting the local-Ollama prerequisite — without adding any new capability.

## Current Sprint

Sprint: **13** — CLI reliability

Status: **COMPLETED**

Canonical sprint reference: [.ai/backlogs/013_sprint/README.md](.ai/backlogs/013_sprint/README.md)

Completion Criteria:
- [x] **CLI error propagation** — failed `aer` commands print the daemon's real message (e.g. `Unknown or already-consumed approvalId`) instead of `[object Object]`; regression-tested in `packages/cli/src/__tests__/cli-error-propagation.test.ts`
- [x] **Provider state in `aer status`** — `aer status` reports the Ollama provider as reachable / unreachable at `http://localhost:11434` (bounded probe, no daemon IPC added); regression-tested in `packages/cli/src/__tests__/status-provider-state.test.ts`
- [x] **Local-Ollama prerequisite documented** — the README states the prerequisite in `## MVP boundary` (Ollama remains **experimental**); the two `Known Risks` rows are closed below

---

# MVP Boundary

Canonical definition: [`README.md` — `## MVP boundary`](README.md)

In short: MVP = the daemon-backed `aer` CLI workspace operations loop (grant → preview → approve → apply) on the modular runtime, with Ollama as the only implemented provider.
Multi-agent coordination as a validated workflow, additional provider backends, and the VS Code extension / GUI are **not** part of the MVP.

> Note: "Complete" in the Completed list below means implemented and covered by the test suite, not a validated end-to-end product path. Only the grant → preview → approve → apply CLI flow is validated.

---

# Repository Health

Compilation: ✅ Passing

Tests: ✅ Passing (409/409, 29 files)

Formatting: ✅ Clean

Known blockers: None

---

# Delivery Status

## Completed

Sprints 1–9 deliverables — implemented, compiled, and covered by the test suite (implementation tier: **experimental** under the three-label scheme; only the CLI entry below is **validated**):

- **Runtime Core** — stable; main loop and runtime primitives (Sprint 2)
- **WorkGraph** — stable; compiler issues resolved (Sprint 1)
- **Scheduler** — complete; priority-based task scheduling with EventBus and logging (Sprint 2)
- **Dispatcher** — complete; worker management, routing, retry, cancellation (Sprint 4)
- **Provider API** — complete; interface + capabilities model (Sprint 3)
- **Ollama Provider** — complete; full IProvider implementation with streaming and health checks (Sprint 3)
- **Provider Worker** — complete; IWorker bridge adapter (Sprint 3)
- **Provider Registry** — complete; auto-registration pattern (Sprint 3)
- **Agent Runtime** — complete; agent abstraction, registry, team coordination, execution coordinator (Sprint 6)
- **Multi-Agent Runtime** — complete (Sprint 7) — **experimental**: implemented and unit-tested, not a validated end-to-end workflow (see Pending)
- **Workflow Runtime** — complete (Sprint 8) — **experimental**: implemented and unit-tested, not a validated end-to-end workflow (see Pending)
- **CLI** — complete; validated grant → preview → approve → apply flow (Sprint 9)

## Component Maturity Matrix

Tier definitions:

- **Stable** — implemented, compiled, covered by the test suite; part of the validated MVP path where marked
- **Experimental** — implemented and unit-tested, but not yet a validated end-to-end product path
- **Planned** — designed or on the roadmap, not yet implemented
- **Aspirational** — not yet on an actionable sprint plan (currently no component is in this tier)

Mapping to the three-label scheme used in `README.md` and `ROADMAP.md`: **validated** = the grant → preview → approve → apply CLI flow (rows marked validated below); **experimental** = the Stable and Experimental tiers (implemented and tested, not a validated end-to-end product path); **planned** = the Planned tier.

| Component | Tier | Repo evidence |
|---|---|---|
| Runtime core (main loop, primitives, EventBus, logging, metrics) | Stable | Sprint 2; implemented, 26 core tests |
| Scheduler | Stable | Sprint 2; implemented, 36 tests |
| Dispatcher (routing, retry, cancellation, worker pools) | Stable | Sprint 4; implemented, 45 tests |
| Execution runtime (WorkerRuntime, lifecycle, recovery, heartbeat) | Stable | Sprint 5; implemented, 54 tests |
| Agent runtime (single-agent loop, tools, capability system) | Stable | Sprint 6; implemented, 58 tests |
| Multi-agent runtime (AgentTeam, coordination, shared context) | Experimental | Sprint 7; implemented and unit-tested, not a validated E2E workflow (see Pending) |
| Workflow engine (Architect → Worker → Reviewer, retries, recovery) | Experimental | Sprint 8; implemented and unit-tested, not a validated E2E workflow (see Pending) |
| Provider abstraction (`IProvider`, registry, factory, worker) | Stable | Sprint 3; implemented, 167 tests |
| Ollama provider | Stable | Implemented and tested (15 tests); the only registered provider |
| Other provider backends (OpenAI, Anthropic) | Planned | Interface types only — not implemented |
| CLI (`aer`) | Stable | Sprint 9; grant → preview → approve → apply flow validated and tested (23 CLI tests) |
| Daemon (`aer-daemon`) | Stable | Sprint 9; IPC-only operator surface, validated with the CLI flow |
| VS Code extension | Planned | Sprint 10; design-only (see `packages/cli/docs/vscode-extension-v1.0.md`) |
| GUI | Planned | Sprint 11; design-only, no implementation |
| `prototype/` and `experiments/` | Experimental | Explorations over the SDK; explicitly not product |

> The matrix is the source of truth for maturity labels; the roadmap sprint sections describe history, not current maturity.

## Workstream Maturity Audit

Audit of the primary top-level workstreams (each workstream carries exactly one label; sub-component nuance stays in the Component Maturity Matrix above):

| Workstream | Maturity | Evidence |
|---|---|---|
| `packages/runtime` | **Stable** | Sprints 2–8 deliverables; 402/402 tests; the validated MVP path runs on it (multi-agent and workflow sub-components remain Experimental per the matrix) |
| `packages/cli` | **Stable** | Sprint 9; grant → preview → approve → apply validated end-to-end; 23 CLI tests; daemon + IPC surface |
| `docs/` | **Stable** | ADRs, RFCs, BACKLOG, RESEARCH, ROADMAP maintained and reconciled in Sprint 12 |
| `templates/` | **Stable** | The backlog and task structure across `.ai/` follows these templates |
| `.ai/` (backlog) | **Stable** | Sprint/task process documentation; Sprint 12 work tracked here |
| `tests/` (root helper scripts) | **Experimental** | `dod-check.mjs`, `health-check-verify.mjs` exist but are not referenced by the build or test pipeline |
| `prototype/` | **Experimental** | Single static mockup (`login-page-2026.html`); no build wiring, not product |
| `experiments/` | **Experimental** | Single validation output file; explorations only, not product |

No workstream is currently **Aspirational** — anything not yet on an actionable sprint plan (e.g. additional provider backends, GUI implementation) is tracked as Planned in the matrix and the roadmap.

## Pending

Unvalidated work and open gaps:

- Multi-agent coordination: implemented but not yet a validated end-to-end workflow
- Additional provider backends (OpenAI, Anthropic) not yet implemented (**planned**)
- Provider capability detection is static (no model-specific overrides)
- Sprint 12 documentation alignment has been completed and closed; remaining work is tracked as the next milestone or future exploration

## Planned

Post-MVP work:

- **VS Code Extension** — design only (Sprint 10)
- **GUI** — design only (Sprint 11)

---

# Active Engineering Decisions

- Keep Runtime provider-independent.
- Runtime owns orchestration.
- VS Code extension is only a client.
- Experiments belong under /experiments.
- Small commits.
- Milestone-based development.
- Provider config defaults normalized at construction time.

---

# Technical Debt

- Provider capability detection is static (no model-specific overrides)
- Only Ollama provider registered (OpenAI, Anthropic pending)
- VSCode Extension not yet implemented

---

# Known Risks

Risk and gap register — seeded from `## Pending`, `## Technical Debt`, and the Task 01 recorded run (`.ai/backlogs/012_sprint/03_usage-risk-docs-tasks/01_capture-validated-cli-workflow.md`). Statuses use the three-label scheme (validated / experimental / planned) and match the `## Component Maturity Matrix` above.

| Area | Status | Risk or gap | Dependency | Mitigation / next step |
|---|---|---|---|---|
| CLI workspace loop (grant → preview → approve → apply) | validated | The only validated product path. The mutation chain requires an explicit read-write grant (`-m read-write -t list,read,search,apply`) — under the default read-only grant, `preview` fails with `apply not granted`; grants are session-scoped and the most recent registration wins (Task 01 real run). | `aer-daemon` running; explicit read-write grant | Follow the README `## Usage — validated CLI flow` (documents the full read-write grant for mutation flows); if `preview` fails, check whether the grant was registered in the current session (session-scoped, most-recent-wins). |
| CLI error reporting | validated | Closed (Sprint 13, Epic 1): the CLI now surfaces the daemon's real message — reusing a consumed approvalId prints `Unknown or already-consumed approvalId`, not `[object Object]` (`errorMessage` helper in `packages/cli/src/index.ts`, used by the failing commands' catch blocks). | — | None — fix landed and regression-tested (`packages/cli/src/__tests__/cli-error-propagation.test.ts`). |
| Multi-agent coordination (AgentTeam + workflow engine) | experimental | Implemented and unit-tested (Sprints 7–8) but not a validated end-to-end workflow (see Pending). | E2E validation run before any capability claim | Run one end-to-end multi-agent workflow, record the result, and promote or demote the status accordingly before claiming product capability. |
| Provider backends (OpenAI, Anthropic) | planned | Only Ollama is implemented and registered (15 tests); OpenAI/Anthropic are interface types only (see Technical Debt). | Per-backend `IProvider` implementations | Keep new backends behind `IProvider` (additive registry, `provider-registry.ts`) so the core stays provider-agnostic. |
| Provider capability detection | experimental | Capabilities are static per provider — no model-specific overrides (e.g. embeddings for `nomic-embed-text`, tool calling); asserted in `provider-registry.test.ts`. | Model-level capability override mechanism | Until model-level overrides exist, gate feature use on `provider.capabilities` (never assume embeddings/tool calling); add overrides as a small incremental change to the registry. |
| Provider health / local inference | experimental | Provider initialization and health checks require Ollama running locally at `http://localhost:11434` (`ollama-provider.ts`); the prerequisite is now documented in `README.md` (`## MVP boundary`) and the provider remains **experimental**. | A local Ollama instance with the required model | Closed as tracked (Sprint 13, Epic 2 + Epic 3): `aer status` reports the provider state (reachable / unreachable at `http://localhost:11434`) via a bounded CLI-side probe, regression-tested in `packages/cli/src/__tests__/status-provider-state.test.ts`; the README states the local-Ollama prerequisite. |
| VS Code extension / GUI | planned | Design-only (Sprints 10–11), no implementation (see Technical Debt). | Validated MVP runtime path | None yet — tracked as future work (design-only; see `packages/cli/docs/vscode-extension-v1.0.md`). |

> The previous process rules (incremental refactors, no large-file rewrites, avoid compiler cascades) remain day-to-day engineering practice; they are not product risks and are excluded from the register.

---

# Active Experiments

None

---

# Context Loading Order

Every autonomous session MUST load context in this order:

1. PROJECT_STATE.md
2. Latest commit
3. Current milestone
4. Only required documentation
5. Only required source files

Never read the whole repository.

---

Historical session logs: [docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md](docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md)

---

# Canonical Documents

Every autonomous engineering session MUST use the following loading order.

## Strategic Documents

1. ROADMAP.md

Defines the long-term project goals and milestones.

2. ARCHITECTURE.md

Defines the current high-level architecture.

---

## Operational Documents

3. PROJECT_STATE.md

Defines the current engineering state.

This document has priority over ROADMAP for day-to-day implementation.

---

## Engineering Constitution

4. /.ai/

Read ONLY the documents required for the current milestone.

The documents under /.ai/ define:

- engineering philosophy
- execution model
- coding standards
- documentation rules
- engineering protocols

Do not reload every document.

Load only what is required.

---

## RFC

5. docs/rfc/

RFCs contain implementation specifications.

Consult them only when implementing the subsystem they describe.