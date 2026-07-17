# Project Context

Version: 1.0

Status: Draft

---

# Purpose

This document provides contextual understanding of the Autonomous Engineering Runtime project for agents and engineers joining the repository.

It answers:
- What are we building?
- Why are we building it?
- How is it structured?
- What are the key decisions?
- What is the current state?

**This document describes the PROJECT (repository), not the current execution state.**
Execution state lives in `PROJECT_STATE.md`.

---

# Project Overview

## What We Are Building

A runtime system that enables autonomous agents to perform engineering work collaboratively.

The system coordinates:
- Multiple agent types (Mission, Research, Design, Implement, Verification, Knowledge, Recovery)
- Task scheduling with priority and capability matching
- Provider management for AI model integration
- Error recovery and state restoration
- Knowledge accumulation across sessions
- Experiment-driven decision making

It is NOT:
- A simple task runner
- A prompt orchestration framework
- A workflow automation tool
- A general-purpose scheduler

It IS:
- An engineering environment
- Architecture-constrained
- Knowledge-driven
- Evidence-based
- Failure-tolerant

---

# Mission Alignment

## Core Mission

Enable autonomous agents to complete complex engineering tasks with minimal human oversight while maintaining engineering quality through architectural discipline, knowledge accumulation, and experimental validation.

## Key Objectives

1. **Autonomy** — Agents operate independently within defined bounds
2. **Quality** — Engineering standards enforced by architecture, not hope
3. **Continuity** — Work persists across sessions and provider changes
4. **Learning** — Every failure produces knowledge
5. **Evidence** — Decisions backed by experiments, not opinions

---

# Project Architecture

## High-Level Structure

```
MultiAgentDev/
├── .ai/                        # Engineering documentation (handbook)
│   ├── 00_REPOSITORY_PHILOSOPHY.md
│   ├── 01_MISSION.md
│   ├── 02_ENGINEERING_PRINCIPLES.md
│   ├── 03_DEVELOPMENT_LIFECYCLE.md
│   ├── 04_ARCHITECTURE_PHILOSOPHY.md
│   ├── 05_EXECUTION_MODEL.md
│   ├── 06_SYSTEM_ARCHITECTURE.md
│   ├── 07_ENGINEERING_INTELLIGENCE.md
│   ├── 08_KNOWLEDGE_SYSTEM.md
│   ├── 09_RUNTIME_COMPONENTS.md
│   ├── 10_WORK_GRAPH.md
│   ├── 11_DOCUMENTATION.md
│   ├── 12_SUCCESS_CRITERIA.md
│   ├── 13_ERROR_RECOVERY.md
│   ├── 14_EXPERIMENTS.md
│   ├── 15_DECISION_RULES.md
│   ├── 16_CODING_STANDARDS.md
│   ├── 17_AGENT_PROTOCOLS.md
│   ├── 18_PROJECT_CONTEXT.md
│   └── README.md               # Handbook index
├── docs/
│   ├── ADR/                    # Architecture Decision Records
│   ├── RFC/                    # Request for Comments (design discussions)
│   ├── BACKLOG.md              # Prioritized task backlog
│   └── RESEARCH.md             # Research findings
├── experiments/                # Experimental evidence
│   ├── README.md               # Experiment index
│   └── EXP-NNNN-name/          # Individual experiments
├── prototype/                  # Prototype implementations
├── src/                        # Source code
│   ├── index.ts                # Public API entry point
│   ├── agents/                 # Agent implementations
│   │   ├── mission-agent/
│   │   ├── research-agent/
│   │   ├── design-agent/
│   │   └── implement-agent/
│   ├── runtime/                # Runtime core
│   │   ├── engine.ts
│   │   ├── scheduler.ts
│   │   ├── dispatcher.ts
│   │   ├── provider.ts
│   │   ├── event-bus.ts
│   │   └── knowledge-store.ts
│   ├── workflows/              # Workflow definitions
│   └── shared/                 # Shared utilities
├── templates/                  # Document and task templates
│   ├── adr-template.md
│   ├── experiment-template.md
│   ├── research-template.md
│   └── task-template.md
├── PROJECT_STATE.md            # Current execution state
├── ROADMAP.md                  # Project evolution plan
└── README.md                   # Entry point
```

---

# Key Components

## Runtime Core

The runtime IS the system that enables autonomous engineering.

Components:

### Scheduler

Manages task queue with priority-based ordering.

Responsibilities:
- Queue management (bounded capacity)
- Priority-based scheduling
- Dependency resolution
- Deadlock detection and prevention

Key files:
- `src/runtime/scheduler.ts`
- `docs/RFC/RFC-0002 — Scheduler.md`

---

### Dispatcher

Routes tasks to appropriate workers based on capability matching.

Responsibilities:
- Worker assignment (capability-based)
- Capability verification
- Concurrent execution coordination
- Work distribution balancing

Key files:
- `src/runtime/dispatcher.ts`
- `docs/RFC/RFC-0003 — Dispatcher.md`

---

### Provider Manager

Manages AI provider connections, failover, and capability discovery.

Responsibilities:
- Provider lifecycle management
- Capability discovery
- Failover coordination
- Rate limit monitoring

Key files:
- `src/runtime/provider.ts`

---

### Event Bus

Asynchronous event distribution system.

Responsibilities:
- Event publishing
- Event subscription management
- Event persistence
- Inter-agent communication

Key files:
- `src/runtime/event-bus.ts`

---

### Knowledge Store

Persistent knowledge base management.

Responsibilities:
- Knowledge entry CRUD operations
- Confidence tracking
- Entry lifecycle management
- Pattern recognition support

Key files:
- `src/runtime/knowledge-store.ts`

---

## Agent Layer

### Mission Agent

Highest-level coordinator. Maintains mission alignment.

### Research Agent

Evidence producer through investigation and experimentation.

### Design Agent

Architecture conformance enforcer. ADR creator.

### Implement Agent

Code producer operating within architectural bounds.

### Verification Agent

Independent quality assurance. Test execution and documentation audit.

---

# Engineering Principles Summary

The project follows these principles (from `02_ENGINEERING_PRINCIPLES.md`):

1. **Engineering Over Prompting** — Write contracts, not prompts
2. **Architecture Before Implementation** — Design bounds first
3. **Knowledge Accumulation** — Every failure makes the system smarter
4. **Evidence Over Opinion** — Experiments decide what analysis cannot
5. **Decision Quality** — Reversibility determines process depth
6. **Transparent Failure** — Nothing fails silently
7. **Recoverability** — Systems continue through adversity
8. **Observability** — State is visible, not hidden
9. **Incremental Progress** — Small verified steps over big bang releases
10. **Code As Contract** — Interfaces are binding commitments

---

# Vocabulary

## Unified Terms

| Term | Meaning | Used In |
|---|---|---|
| Mission | Overarching objective | 01_MISSION.md |
| Objective | Measurable goal toward mission | 01_MISSION.md |
| Task | Unit of work with clear boundaries | 10_WORK_GRAPH.md |
| Work Item | Synonym for Task (use "Task" consistently) | Throughout |
| Capability | What an agent can do | 17_AGENT_PROTOCOLS.md |
| Worker | Execution entity (agent or process) | 05_EXECUTION_MODEL.md |
| Dispatcher | Component that routes work | 06_SYSTEM_ARCHITECTURE.md |
| Scheduler | Component that manages priority queue | 06_SYSTEM_ARCHITECTURE.md |
| Knowledge | Validated, persistent engineering understanding | 08_KNOWLEDGE_SYSTEM.md |
| Provider | AI model service (Ollama, OpenRouter, etc.) | 09_RUNTIME_COMPONENTS.md |
| Event | Asynchronous notification of state change | 05_EXECUTION_MODEL.md |

## Terms To Avoid

| Term | Why | Use Instead |
|---|---|---|
| "Workflow" | Implies fixed sequence | "Work graph" (directed, not necessarily linear) |
| "Agent prompt" | Confuses configuration with documentation | "Agent constraints" or "Agent configuration" |
| "AI brain" | Anthropomorphic, misleading | "Engineering Intelligence" |
| "Learning" (for agents) | Implies human-like learning | "Knowledge accumulation" |

---

# Key Architecture Decisions

## RFCs

| RFC | Title | Status |
|---|---|---|
| RFC-0001 | Runtime Core | Draft |
| RFC-0002 | Scheduler | Draft |
| RFC-0003 | Dispatcher | Draft |

RFCs are design discussions awaiting ADR conversion.

## Document Hierarchy

```
Mission (01) → Principles (02) → Lifecycle (03) → Architecture (04-06)
                                                    ↓
                                            Execution (05)
                                            Intelligence (07)
                                            Knowledge (08)
                                            Components (09)
                                            Graph (10)
                                              ↓
                                    Documentation (11-18)
                                    Templates (PROJECT_STATE_TEMPLATE.md)
```

---

# Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Language | TypeScript | Type safety, ecosystem alignment |
| Runtime | Node.js | Current environment availability |
| Testing | Vitest (to be added) | Fast, modern, TypeScript-native |
| Configuration | JSON/YAML | Standard formats, agent-readable |
| Storage | File-based (repository) | Persistence through version control |

---

# Current Project Phase

## Phase 0: Documentation Complete ✅

Engineering handbook created. All foundational documents in place.

## Phase 1: Runtime Implementation (Planned)

Target components:
1. Event Bus (foundation)
2. Scheduler (queue management)
3. Dispatcher (work routing)
4. Provider Manager (AI integration)
5. Knowledge Store (persistent knowledge)
6. Recovery Engine (error handling)
7. Worker Pool (execution)
8. Mission Agent (coordination)

## Phase 2: Integration Testing

- Component integration verification
- Performance benchmarking
- Error injection testing
- Multi-agent scenario validation

## Phase 3: Autonomous Operations

- Full mission execution
- Knowledge base population
- Experiment program
- Continuous improvement cycle

---

# Contributing

## For Agents

When contributing to this project:

1. Read `.ai/README.md` (engineering handbook index)
2. Read related RFCs and ADRs
3. Follow coding standards (`16_CODING_STANDARDS.md`)
4. Create ADRs for architectural decisions
5. Update knowledge base with findings
6. Verify against success criteria (`12_SUCCESS_CRITERIA.md`)

## For Humans

Same as agents, plus:
- Review ADRs before implementation
- Approve architectural decisions
- Validate experiment results
- Participate in design reviews

---

# Related Documents

- `00_REPOSITORY_PHILOSOPHY.md` - Foundation
- `01_MISSION.md` - Mission objectives
- `04_ARCHITECTURE_PHILOSOPHY.md` - Architectural decisions
- `06_SYSTEM_ARCHITECTURE.md` - System structure
- `11_DOCUMENTATION.md` - Documentation standards
- `18_PROJECT_CONTEXT.md` - This document

---

# Final Note

This project is an engineering effort, not a prompt engineering exercise.

The system we build must work through architecture, contracts, and protocols.
Not through clever prompts or hope.

Build systems that work even when the prompts fail.

Because they will.