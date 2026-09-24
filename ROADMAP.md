# Aer Roadmap

> Living roadmap for the Aer Runtime.
>
> This document describes the long-term evolution of Aer.
> PROJECT_STATE.md contains the current implementation status.
> ROADMAP.md defines where the project is going.

---

# Engineering Principles

- Every Sprint leaves the repository in a healthy state.
- Every Sprint compiles successfully.
- Every Sprint passes all tests.
- Every Sprint ends with a stable commit.
- Every Sprint updates PROJECT_STATE.md.
- Every Sprint is independently resumable.

---

# Current Progress

| Sprint | Name | Status |
|---------|------|--------|
| Sprint 1 | Repository Recovery | ✅ Complete |
| Sprint 2 | Runtime Infrastructure | ✅ Complete |
| Sprint 3 | Provider Layer | ✅ Complete |
| Sprint 4 | Dispatcher Infrastructure | ✅ Complete |
| Sprint 5 | Execution Runtime | ✅ Complete |
| Sprint 6 | Agent Runtime | ✅ Complete |
| Sprint 7 | Multi-Agent Runtime | ✅ Complete |
| Sprint 8 | Workflow Runtime | ✅ Complete |
| Sprint 9 | CLI | ✅ Complete |
| Sprint 10 | VS Code Extension | ⏳ Planned |
| Sprint 11 | GUI | ⏳ Planned |
| Sprint 12 | Documentation alignment and product definition | ✅ Complete |
| Sprint 13 | CLI reliability | ⏳ Planned |

> MVP note: "Complete" in the table above means the sprint's implementation and tests landed, not a validated end-to-end product path.
> The canonical MVP boundary is defined in `README.md` (`## MVP boundary`); the only validated product path is the CLI grant → preview → approve → apply flow (see `PROJECT_STATE.md`, Pending).
> Per-component maturity labels (Stable / Experimental / Planned / Aspirational) are defined in `PROJECT_STATE.md` (`## Component Maturity Matrix`).
> Labels used in this file: **validated** = the CLI grant → preview → approve → apply flow (the only verified product path); **experimental** = implemented and unit-tested, not a validated end-to-end product path (runtime core, multi-agent, workflow); **planned** = designed or on the roadmap, not implemented (OpenAI/Anthropic backends, VS Code extension, GUI).

---

# Sprint 13 — CLI reliability

Status: Planned

Objective:

Sprint 13 makes the validated grant → preview → approve → apply CLI path trustworthy for pre-MVP use by closing the Known Risks register defects that affect it — starting with CLI error propagation, where daemon rejections print `[object Object]` instead of the real error message — without adding any new capability.

Deliverables:

- **CLI error propagation fix** — failed commands print the daemon's real error message instead of `[object Object]` (e.g. reusing a consumed approvalId prints `Unknown or already-consumed approvalId`): propagate the `IpcClient` rejection message in `packages/cli/src/index.ts` (rejection path in `packages/cli/src/ipc-client.ts`). *(Known Risks register: "CLI error reporting")* *(Maturity: **validated** — the fix is inside the grant → preview → approve → apply loop, the only validated path; Component Maturity Matrix: CLI row validated and tested; register row "CLI error reporting" labeled validated)*
- **Provider state in `aer status`** — `aer status` output reports the Ollama provider state (reachable / unreachable at `localhost:11434`) in addition to `Daemon running` and `Runtime state` (`packages/cli/src/index.ts`, `status` command). *(Known Risks register: "Provider health / local inference")* *(Maturity: **experimental** — the Ollama provider is implemented and tested (15 tests) but not part of the validated CLI flow; Component Maturity Matrix: Ollama provider Stable tier → experimental under the three-label scheme; register row "Provider health / local inference" labeled experimental)*
- **Local-Ollama prerequisite documented** — the local-Ollama prerequisite (Ollama running at `localhost:11434` for provider initialization and health checks) is stated wherever provider health or the usage flow is described (`README.md`). *(Known Risks register: "Provider health / local inference")* *(Maturity: **experimental** — documents a prerequisite of the implemented, tested-but-not-validated Ollama provider; same Component Maturity Matrix row and register row as the previous deliverable)*

Critical path:

- **CLI error propagation fix** (Deliverable 1) — `packages/cli/src/index.ts` / `ipc-client.ts`; no dependencies; the only code item the register names as a "small, incremental change" *(Known Risks: "CLI error reporting")* — lands first.
- **Provider state in `aer status`** (Deliverable 2) — `packages/cli/src/index.ts`; lands after the error-propagation fix so the diffs in the same file stay sequential *(Known Risks: "Provider health / local inference")*.
- **Local-Ollama prerequisite documented** (Deliverable 3) — `README.md`; lands after the `aer status` change so the docs describe implemented behavior *(Known Risks: "Provider health / local inference")*.
- **Definition-of-Done closure** (not a deliverable) — update the two `PROJECT_STATE.md` Known Risks rows and cut the stable commit on the sprint branch (Exit criteria 1 and 5).

Secondary path:

- **None** — all three deliverables sit on the critical path because each backs an Exit criterion and the critical path alone must satisfy every Exit criterion, so no stretch items are scheduled for Sprint 13 (0 of 3 deliverables on the secondary path, within the 50% cap).

Out of scope:

- **Additional provider backends (OpenAI, Anthropic)** — interface types only, not implemented (README `## MVP boundary`).
- **Multi-agent coordination as a validated end-to-end workflow** — implemented and unit-tested, not yet a validated product path (README `## MVP boundary`).
- **VS Code extension and GUI** — design-only work from Sprints 10–11, not MVP components (README `## MVP boundary`).
- **No future-sprint dependency** — no Sprint 13 item may depend on a future sprint completing first: every critical-path item builds on the current repo state (build passing, 402/402 tests, `sprint13` branch).

Sprint 13 stays the next realistic engineering slice over the validated CLI flow: error propagation in the existing `aer` commands, provider state in the existing `aer status`, and documenting the existing local-Ollama prerequisite — no new product capability.

Exit criteria:

- **Build and tests green** — `npm run build` (`tsc --build`) exits 0 and `npm test` (`vitest run`) exits 0 with no failing or skipped tests, including all `packages/cli/src/__tests__` tests (Definition of Done: build passes, all tests pass).
- **Real error message surfaces** — with `aer-daemon` running, reusing a consumed approvalId makes the CLI print the daemon's real message (`Unknown or already-consumed approvalId`, as thrown in `packages/runtime/src/core/runtime.ts`) instead of `[object Object]`, and a test in `packages/cli/src/__tests__/` asserts the rejection message is surfaced. *(Deliverable: CLI error propagation fix)*
- **`aer status` reports provider state** — with `aer-daemon` running, `aer status` output contains an Ollama provider line reporting reachable or unreachable at `localhost:11434` in addition to the existing `Daemon running` and `Runtime state` lines. *(Deliverable: Provider state in `aer status`)*
- **Prerequisite documented** — the README states the local-Ollama prerequisite (Ollama running at `localhost:11434` required for provider initialization and health checks) in the section that describes the usage flow / MVP boundary. *(Deliverable: Local-Ollama prerequisite documented; Definition of Done: documentation updated)*
- **Register updated** — the `PROJECT_STATE.md` Known Risks register rows "CLI error reporting" and "Provider health / local inference" reflect the closed defects (fix landed, provider state in `aer status`), and a stable commit on the current sprint branch contains this change. *(Definition of Done: PROJECT_STATE.md updated, stable commit created)*

---

# Sprint 12 — Documentation alignment and product definition

Status: Complete

Purpose:
- reconcile the project narrative with the code that actually exists
- document the validated runtime and CLI workflow realistically
- define MVP scope, boundaries and next milestone priorities
- reduce confusion between experimental prototypes, stable runtime code and roadmap claims

Scope:
- unify README, PROJECT_STATE and ROADMAP
- document the actual runtime and CLI capabilities already verified
- clarify what is stable, what is experimental and what remains planned
- define the next execution milestone after Sprint 12

Exit criteria:
- [x] README explains the real project in one page
- [x] PROJECT_STATE matches the active branch and sprint
- [x] ROADMAP reflects current status without stale contradictions
- [x] Sprint 12 summary exists as a standalone planning document
- [x] next milestone is explicit and actionable

---

# Sprint 1 — Repository Recovery

Status

✅ Complete

Goals

- Restore repository health
- Resolve TypeScript errors
- Stabilize WorkGraph
- Recover compilation
- Recover test suite

Completed

- Repository restored
- 174 TypeScript errors fixed
- Stable WorkGraph
- Healthy baseline commit

Exit Criteria

✅ Build passing

✅ Tests passing

---

# Sprint 2 — Runtime Infrastructure

Status

✅ Complete

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end product path (see `PROJECT_STATE.md` Component Maturity Matrix)

Purpose

Build the core runtime services required by every future subsystem.

Completed

- Scheduler
- EventBus
- Logging
- Metrics
- Runtime primitives

Tests

143+ unit tests

Exit Criteria

✅ Runtime infrastructure operational

✅ Metrics integrated

✅ Logging integrated

---

# Sprint 3 — Provider Layer

Status

✅ Complete

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end product path (see `PROJECT_STATE.md` Component Maturity Matrix)

Purpose

Abstract LLM providers from the runtime.

Completed

- Provider interfaces
- Provider registry
- Provider factory
- OllamaProvider
- ProviderWorker
- Configuration normalization

Tests

167+ unit tests

Exit Criteria

✅ Provider abstraction complete

✅ Runtime independent from providers

---

# Sprint 4 — Dispatcher Infrastructure

Status

✅ Complete

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end product path (see `PROJECT_STATE.md` Component Maturity Matrix)

Purpose

Route work across available workers.

Completed

- TaskDispatcher
- Worker registration
- Worker lifecycle
- Worker pools
- Capability metadata
- Worker selection
- Retry policies
- Cancellation
- Health monitoring
- Metrics integration
- Logging integration

Tests

205+ unit tests

Exit Criteria

✅ Dispatcher operational

✅ Worker routing operational

✅ Retry policies

✅ Cancellation

---

# Sprint 5 — Execution Runtime

Status

✅ Complete

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end product path (see `PROJECT_STATE.md` Component Maturity Matrix)

Purpose

Transform the infrastructure into a complete execution runtime.

Deliverables

- ExecutionRuntime
- ExecutionContext
- WorkerRuntime
- Worker lifecycle management
- Worker heartbeat
- Worker watchdog
- Recovery
- Resume
- Runtime events
- Cancellation tokens
- Runtime state snapshots

Exit Criteria

- Multiple workers execute concurrently
- Automatic recovery
- Runtime survives worker failures
- Complete runtime tests

Completed

- WorkerRuntime implementation in src/runtime/worker-runtime.ts
- Execution framework for task execution
- Worker lifecycle management
- Heartbeat and watchdog mechanisms
- Recovery and resume capabilities
- Runtime events integration
- Cancellation token support
- State snapshot functionality

Exit Criteria

✅ Multiple workers execute concurrently
✅ Automatic recovery
✅ Runtime survives worker failures
✅ Complete runtime tests

---

# Sprint 6 — Agent Runtime

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end product path (see `PROJECT_STATE.md` Component Maturity Matrix)

Purpose

Introduce autonomous agents on top of the execution runtime.

Deliverables

- Agent abstraction
- Agent lifecycle
- Prompt management
- Conversation context
- Memory abstraction
- Tool execution
- Capability system
- Agent registry

Exit Criteria

- Multiple independent agents
- Agent lifecycle complete
- Agent tests passing

---

# Sprint 7 — Multi-Agent Runtime

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end workflow (see `PROJECT_STATE.md` Pending)

Purpose

Coordinate multiple autonomous agents.

Deliverables

- AgentTeam
- Architect Agent
- Worker Agent
- Reviewer Agent
- Shared Context
- Task decomposition
- Scheduling integration
- Agent coordination

This Sprint replaces the original proof-of-concept:

- Commit 3 (Second Agent)
- Commit 4 (AgentTeam)
- Commit 5 (Architect → Worker)

Those concepts are now implemented on top of the Aer Runtime rather than directly over the SDK.

Exit Criteria

- Multi-agent execution operational
- Shared execution context
- Team orchestration complete

All three were met by implementation and unit tests only — the multi-agent runtime remains **experimental** (see the Maturity line above; only the grant → preview → approve → apply CLI flow is **validated** — see the MVP boundary in `README.md`).

Sprint 7
│
├── 7.1 Multi-Agent Coordinator
├── 7.2 Task Router
├── 7.3 Team Scheduler
├── 7.4 Shared Execution Context
├── 7.5 Workflow Orchestrator
├── 7.6 Runtime CLI integration
└── 7.7 Documentation

---

# Sprint 8 — Workflow Runtime

Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end workflow (see `PROJECT_STATE.md` Pending)

Purpose

Implement complete engineering workflows.

Deliverables

- Architect → Worker
- Worker → Reviewer
- Reviewer → Architect
- Automatic retries
- Failure recovery
- Workflow metrics
- Workflow events
- Long-running execution

Exit Criteria

- Complete engineering workflow
- Workflow recovery
- Workflow metrics

---

# Sprint 9 — CLI

Maturity: **validated** — the grant → preview → approve → apply CLI flow is the validated product path (see `README.md` `## Usage — validated CLI flow`)

Purpose

Expose Aer through a command-line interface.

Deliverables

- Runtime management
- Agent management
- Team management
- Workflow execution
- Monitoring
- Configuration

Exit Criteria

Aer fully usable from terminal — qualifier: this refers to the validated grant → preview → approve → apply loop only; multi-agent and workflow capabilities remain **experimental** (see the MVP boundary in `README.md`).

---

# Sprint 10 — VS Code Extension

Maturity: **planned** — design only, not implemented (see `PROJECT_STATE.md` Planned)

Purpose

Provide Visual Studio Code integration.

Deliverables

- Runtime connection
- Chat interface
- Agent Explorer
- Task Explorer
- Runtime monitor
- Log viewer
- Configuration UI

Exit Criteria

VS Code becomes an Aer client.

---

# Sprint 11 — GUI

Maturity: **planned** — design only, not implemented (see `PROJECT_STATE.md` Planned)

Purpose

Create a standalone desktop application.

Deliverables

- Dashboard
- Runtime visualization
- Agent monitoring
- Metrics
- Logs
- Workflow visualization
- Experiment management

Exit Criteria

Aer fully operable without VS Code.

---

# Architectural Evolution

Maturity labels for the stack below: Multi-Agent Runtime and Workflow Runtime are **experimental**; CLI (grant → preview → approve → apply loop) is **validated**; VS Code Extension and GUI are **planned**. ✅ = implementation and tests landed, not validation (see the MVP note in `## Current Progress`).

Repository

↓

Runtime Infrastructure ✅

↓

Provider Layer ✅

↓

Dispatcher Infrastructure ✅

↓

Execution Runtime

↓

Agent Runtime

↓

Multi-Agent Runtime

↓

Workflow Runtime

↓

Clients

• CLI

• VS Code Extension

• GUI

---

# Legacy Mapping

The original roadmap has evolved into the current architecture.

| Original Plan | Current Sprint |
|---------------|----------------|
| Commit 1 - Basic Agent + Ollama | Sprint 6 |
| Commit 2 - Centralized Configuration | Sprint 3 (Completed) |
| Commit 3 - Second Agent | Sprint 7 |
| Commit 4 - AgentTeam | Sprint 7 |
| Commit 5 - Architect → Worker | Sprint 8 |
| Commit 6 - AgentTeamsRuntime | Sprint 8 |

---

# Definition of Done

A Sprint is complete only when:

- Build passes
- All tests pass
- Documentation updated
- PROJECT_STATE.md updated
- Stable commit created
- Exit criteria satisfied