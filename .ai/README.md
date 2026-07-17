# Autonomous Engineering Runtime — Engineering Handbook

## Overview

This directory contains the complete engineering handbook for the **Autonomous Engineering Runtime** project.

It is a self-contained reference that any autonomous agent or engineer can use to understand the system's architecture, conventions, and decision rationale without external context.

---

## Document Index

### Foundation (00–03)

| # | Document | Purpose |
|---|---|---|
| 00 | [Repository Philosophy](./00_REPOSITORY_PHILOSOPHY.md) | Repository as external memory; persistence model |
| 01 | [Mission](./01_MISSION.md) | Mission objectives and governance |
| 02 | [Engineering Principles](./02_ENGINEERING_PRINCIPLES.md) | Ten engineering principles governing all work |
| 03 | [Development Lifecycle](./03_DEVELOPMENT_LIFECYCLE.md) | Ten-phase lifecycle from ideation to closure |

### Architecture (04–06)

| # | Document | Purpose |
|---|---|---|
| 04 | [Architecture Philosophy](./04_ARCHITECTURE_PHILOSOPHY.md) | Architectural decisions, principles, and agent architecture |
| 05 | [Execution Model](./05_EXECUTION_MODEL.md) | Task queue, dispatcher, scheduler, concurrency model |
| 06 | [System Architecture](./06_SYSTEM_ARCHITECTURE.md) | Component structure, runtime layers, interface contracts |

### Intelligence (07–08)

| # | Document | Purpose |
|---|---|---|
| 07 | [Engineering Intelligence](./07_ENGINEERING_INTELLIGENCE.md) | Mission agent as intelligence layer; reasoning framework |
| 08 | [Knowledge System](./08_KNOWLEDGE_SYSTEM.md) | Knowledge taxonomy, lifecycle, confidence modeling |

### Components (09–10)

| # | Document | Purpose |
|---|---|---|
| 09 | [Runtime Components](./09_RUNTIME_COMPONENTS.md) | Recovery Engine, Worker Manager, Knowledge Manager, Provider Agent |
| 10 | [Work Graph](./10_WORK_GRAPH.md) | Task graph structure, node types, edges, operations |

### Standards (11–18)

| # | Document | Purpose |
|---|---|---|
| 11 | [Documentation](./11_DOCUMENTATION.md) | Documentation taxonomy; ADR, RFC, knowledge entry formats |
| 12 | [Success Criteria](./12_SUCCESS_CRITERIA.md) | Phase-gate criteria for documentation through implementation |
| 13 | [Error Recovery](./13_ERROR_RECOVERY.md) | Error taxonomy, recovery strategies, incident response |
| 14 | [Experiments](./14_EXPERIMENTS.md) | Experiment design, execution, evaluation, analysis |
| 15 | [Decision Rules](./15_DECISION_RULES.md) | Decision authority, reversibility framework, decision types |
| 16 | [Coding Standards](./16_CODING_STANDARDS.md) | TypeScript standards, interface contracts, error handling, testing |
| 17 | [Agent Protocols](./17_AGENT_PROTOCOLS.md) | Agent roles, behavior contracts, communication protocols |
| 18 | [Project Context](./18_PROJECT_CONTEXT.md) | Project overview, architecture, vocabulary, technology stack |

### Templates

| File | Purpose |
|---|---|
| [PROJECT_STATE_TEMPLATE.md](./PROJECT_STATE_TEMPLATE.md) | Template for execution session state tracking |

---

## Document Hierarchy

```
Foundation (00–03)
    ↓
Architecture (04–06) → Intelligence (07–08)
    ↓                              ↓
Components (09–10)           Standards (11–18)
    ↓                          ↓
                        Execution & Operations
```

### Dependency Chain

```
Mission (01)
  → Principles (02)
    → Lifecycle (03)
      → Architecture Philosophy (04)
        → Execution Model (05)
        → System Architecture (06)
          → Engineering Intelligence (07)
          → Knowledge System (08)
          → Runtime Components (09)
          → Work Graph (10)
            ↓
    Standards Layer (11–18) — all directions independent, cross-referenced
```

---

## Concept Vocabulary

| Concept | Single Term | Defined In |
|---|---|---|
| Overarching goal | **Mission** | 01_MISSION.md |
| Measurable step toward mission | **Objective** | 01_MISSION.md |
| Unit of work | **Task** | 10_WORK_GRAPH.md |
| What an agent can do | **Capability** | 17_AGENT_PROTOCOLS.md |
| Execution entity | **Worker** | 05_EXECUTION_MODEL.md |
| Component that routes work | **Dispatcher** | 06_SYSTEM_ARCHITECTURE.md |
| Component that manages priority queue | **Scheduler** | 06_SYSTEM_ARCHITECTURE.md |
| Validated understanding | **Knowledge** | 08_KNOWLEDGE_SYSTEM.md |
| AI model service | **Provider** | 09_RUNTIME_COMPONENTS.md |
| Asynchronous notification | **Event** | 05_EXECUTION_MODEL.md |

---

## Navigation Guide

### "I want to understand the project."

→ Start with [18_PROJECT_CONTEXT.md](./18_PROJECT_CONTEXT.md), then read [01_MISSION.md](./01_MISSION.md).

### "I need to make an architectural decision."

→ Read [04_ARCHITECTURE_PHILOSOPHY.md](./04_ARCHITECTURE_PHILOSOPHY.md) + [15_DECISION_RULES.md](./15_DECISION_RULES.md).

### "I'm implementing code. What standards apply?"

→ Read [16_CODING_STANDARDS.md](./16_CODING_STANDARDS.md).

### "I need to understand agent roles and behavior."

→ Read [17_AGENT_PROTOCOLS.md](./17_AGENT_PROTOCOLS.md).

### "I'm designing a new component."

→ Read [06_SYSTEM_ARCHITECTURE.md](./06_SYSTEM_ARCHITECTURE.md) + [09_RUNTIME_COMPONENTS.md](./09_RUNTIME_COMPONENTS.md).

### "I need to document a decision."

→ Follow the ADR format from [11_DOCUMENTATION.md](./11_DOCUMENTATION.md).

### "Something failed. What do I do?"

→ Read [13_ERROR_RECOVERY.md](./13_ERROR_RECOVERY.md).

### "I'm starting a new execution session."

→ Copy [PROJECT_STATE_TEMPLATE.md](./PROJECT_STATE_TEMPLATE.md) to `PROJECT_STATE.md`.

---

## Document Creation Policy

New documents in `.ai/`:
- MUST follow the numbering convention (`NN_NAME.md`)
- MUST be documented in this README's index
- MUST cross-reference related documents
- MUST state its purpose, responsibilities, principles, processes
- MUST use RFC-style language (SHALL/SHOULD/MAY) when defining requirements

Documents outside `.ai/`:
- ADRs go in `docs/ADR/`
- RFCs go in `docs/RFC/`
- Experiments go in `experiments/`
- Knowledge entries link to this handbook

---

## Related Directories

| Directory | Contents |
|---|---|
| `.ai/` | Engineering handbook (this directory) |
| `docs/ADR/` | Architecture Decision Records |
| `docs/RFC/` | Request for Comments (design discussions) |
| `docs/` | General documentation (backlog, research) |
| `experiments/` | Experimental evidence |
| `prototype/` | Prototype implementations |
| `src/` | Source code |
| `templates/` | Document and task templates |

---

## Status

**Phase:** Documentation Complete ✅

All 19 handbook documents created.
All cross-references verified.
Terminology unified.
AGENT_PROMPTS.md migrated to AGENT_PROTOCOLS.md (superseded).

---

> This is the engineering handbook index for the Autonomous Engineering Runtime.
> Every document here uses engineering specifications, not prompt engineering.
> Contracts over prompts. Protocols over instructions. Responsibilities over suggestions.