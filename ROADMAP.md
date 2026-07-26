# ForgeOS Roadmap

> Living roadmap for the ForgeOS Runtime.
>
> This document describes the long-term evolution of ForgeOS.
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
| Sprint 5 | Execution Runtime | 🟡 Next |
| Sprint 6 | Agent Runtime | ⏳ Planned |
| Sprint 7 | Multi-Agent Runtime | ⏳ Planned |
| Sprint 8 | Workflow Runtime | ⏳ Planned |
| Sprint 9 | CLI | ⏳ Planned |
| Sprint 10 | VS Code Extension | ⏳ Planned |
| Sprint 11 | GUI | ⏳ Planned |

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

Those concepts are now implemented on top of the ForgeOS Runtime rather than directly over the SDK.

Exit Criteria

- Multi-agent execution operational
- Shared execution context
- Team orchestration complete

---

# Sprint 8 — Workflow Runtime

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

Purpose

Expose ForgeOS through a command-line interface.

Deliverables

- Runtime management
- Agent management
- Team management
- Workflow execution
- Monitoring
- Configuration

Exit Criteria

ForgeOS fully usable from terminal.

---

# Sprint 10 — VS Code Extension

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

VS Code becomes a ForgeOS client.

---

# Sprint 11 — GUI

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

ForgeOS fully operable without VS Code.

---

# Architectural Evolution

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