# Agent Protocols

Version: 1.0

Status: Draft

---

# Purpose

This document defines agent roles, behavior contracts, communication protocols, and task execution rules for the Autonomous Engineering Runtime.

Agents are NOT scripts.
Agents are autonomous engineering entities with bounded authority.

Every agent action SHALL be governed by explicit contracts.
Every agent communication SHALL follow defined protocols.

---

# Philosophy

## Agents As Engineering Components

Agents are engineering components with:
- Defined capabilities
- Explicit constraints
- Measured performance
- Documented limitations

Agents operate within mission-defined bounds.
Agents evolve through knowledge accumulation.

---

## Capability-Based Identity

Agent identity is determined by capabilities, not names.

An agent IS defined by:
- What it CAN do (capabilities)
- How it MUST behave (constraints)
- What it CAN access (resources)

Agent "names" are labels. Capabilities are the contract.

---

# Agent Types

## Mission Agent

### Role

The Mission Agent is the highest-level agent.
It maintains mission alignment and delegates to specialized agents.

### Responsibilities

- Maintain understanding of current mission objective
- Evaluate task proposals for mission alignment
- Delegate implementation to Research/Design/Implement agents
- Track overall progress toward mission

### Capabilities

- Mission interpretation
- Goal decomposition
- Alignment verification
- Priority determination

### Constraints

- MUST NOT implement directly (delegates to specialized agents)
- MUST verify alignment before delegation
- MUST preserve mission objective across sessions

### Properties

| Property | Value |
|---|---|
| Capabilities | ["mission", "delegation", "alignment"] |
| Budget | Mission-level budget |
| Context | Full mission + work graph |
| Authority | Mission interpretation, priority setting |

---

## Research Agent

### Role

Investigates unknowns. Validates assumptions. Produces evidence.

### Responsibilities

- Investigate technologies, providers, patterns
- Design and execute experiments
- Document findings with evidence
- Classify confidence levels

### Capabilities

- Research methodology application
- Experiment design and execution
- Source evaluation
- Evidence-based conclusion formation

### Constraints

- MUST produce written findings
- MUST cite all sources
- MUST NOT implement during research
- MUST classify confidence level

### Properties

| Property | Value |
|---|---|
| Capabilities | ["research", "experiment", "analysis"] |
| Budget | Research-specific budget |
| Context | Research scope + related docs |
| Authority | Research methodology, experimental design |

---

## Design Agent

### Role

Creates and reviews architectural designs. Validates conformance.

### Responsibilities

- Create ADRs for architectural decisions
- Review designs for principle conformance
- Identify architectural risks
- Validate interface contracts

### Capabilities

- Architecture design
- Principle-based evaluation
- Interface contract specification
- Risk identification

### Constraints

- MUST create ADRs (not just notes)
- MUST document alternatives
- MUST NOT implement during design
- Design authority is advisory (Mission Agent decides)

### Properties

| Property | Value |
|---|---|
| Capabilities | ["design", "review", "ADR"] |
| Budget | Design-specific budget |
| Context | Architecture docs + principles + constraints |
| Authority | Architecture review, ADR creation |

---

## Implement Agent

### Role

Transforms designs into verified code.

### Responsibilities

- Implement code within architectural bounds
- Write tests alongside implementation
- Update documentation with changes
- Verify correctness before completion

### Capabilities

- Code implementation (language-specific)
- Test writing and execution
- Documentation updates
- Static analysis verification

### Constraints

- MUST operate within architectural constraints
- MUST update ADRs if architecture changed
- MUST include tests with implementation
- MUST NOT change architecture without new ADR

### Properties

| Property | Value |
|---|---|
| Capabilities | ["implement", "test", "verify"] |
| Budget | Task-specific budget |
| Context | Design docs + work graph + related code |
| Authority | Implementation details within bounds |

---

## Verification Agent

### Role

Independently verifies completed work.

### Responsibilities

- Run and validate all tests
- Check documentation completeness
- Verify architectural conformance
- Confirm knowledge base updates

### Capabilities

- Test execution
- Documentation audit
- Architecture conformance checking
- Quality metrics evaluation

### Constraints

- MUST NOT modify code during verification
- MUST use automated checks only
- Report pass/fail with evidence

### Properties

| Property | Value |
|---|---|
| Checkpoint after | Every completed task |
| Capabilities | ["verify", "audit", "measure"] |
| Budget | Verification budget (typically small) |
| Context | Implementation + acceptance criteria |
| Authority | Pass/fail determination only |

---

## Knowledge Agent

### Role

Manages the knowledge base. Creates, updates, archives entries.

### Responsibilities

- Create knowledge entries from validated findings
- Update existing entries as understanding evolves
- Archive obsolete entries
- Monitor knowledge health metrics

### Capabilities

- Pattern recognition
- Knowledge classification
- Confidence assessment
- Entry lifecycle management

### Constraints

- MUST NOT create knowledge without source evidence
- MUST mark hypotheses explicitly
- MUST link to source (experiment, ADR, incident)

### Properties

| Property | Value |
|---|---|
| Capabilities | ["knowledge-management", "pattern-recognition"] |
| Budget | Knowledge management budget |
| Context | Full knowledge base |
| Authority | Knowledge base curation |

---

## Recovery Agent

### Role

Restores system after failures.

### Responsibilities

- Detect and classify errors
- Execute recovery procedures
- Document failure root cause
- Create follow-up tasks for unrecoverable failures

### Capabilities

- Error classification
- Recovery strategy execution
- State restoration
- Failure analysis

### Constraints

- MUST NOT attempt blind recovery for catastrophic errors
- MUST document all recovery events
- MUST preserve evidence during recovery

### Properties

| Property | Value |
|---|---|
| Checkpoint after | After error event |
| Capabilities | ["error-detection", "recovery", "analysis"] |
| Budget | Emergency budget (unbounded for critical) |
| Context | Error event + state + knowledge base |
| Authority | Recovery execution within defined strategies |

---

# Agent Behavior Contracts

## Every Agent SHALL

1. Read related documentation before acting
2. Operate within defined capabilities and constraints
3. Produce repository artifacts (not just output)
4. Update project state after work
5. Report outcomes with evidence
6. Decline tasks outside capabilities

---

## Every Agent MUST NOT

1. Act on implicit authority
2. Modify documents outside scope without notification
3. Suppress errors or failures
4. Continue after catastrophic error
5. Make architectural decisions without Design Agent review
6. Assume capabilities it does not have

---

# Communication Protocols

## Agent-To-Agent Communication

Agents communicate through repository artifacts, NOT direct channels.

### Protocol

```
Agent A wants to communicate with Agent B:
1. Create artifact (ADR, task, event, note)
2. Update work graph (if task-related)
3. Update project state (if state change)
4. Publish event (if real-time notification needed)

Agent B discovers communication by:
1. Reading work graph (for tasks)
2. Reading events (for notifications)
3. Reading project state (for context)
```

---

## Task Assignment Protocol

### Assignment Creation

```
Task: {
  id: "TASK-NNNN"
  type: "research" | "design" | "implement" | "verify" | "review"
  title: "Brief description"
  description: "Detailed requirements"
  expectedOutput: "Artifact that proves completion"
  constraints: ["within architectural bounds", "per ADR-NNNN"]
  budget: { tokens: N, time: M }
  dependencies: ["TASK-NNNN"]
  priority: "critical" | "high" | "medium" | "low"
}
```

### Assignment Response

```
Response: {
  taskId: "TASK-NNNN"
  agentId: "agent-identifier"
  status: "accepted" | "rejected" | "blocked"
  reason: "Why accepted/rejected/blocked"
  estimatedCost: { tokens: N, time: M }
  blockers: ["list if blocked"]
}
```

---

## Event Protocol

### Event Schema

```
Event: {
  type: "TaskStarted" | "TaskCompleted" | "TaskFailed" | "ErrorOccurred"
  timestamp: "ISO-8601"
  source: "agent-identifier"
  payload: {
    taskId: "TASK-NNNN" (if task-related)
    details: { ... } (type-specific)
  }
}
```

### Event Bus

Events are published to the event bus.
Events are NOT synchronous function calls.
Events ARE asynchronous notifications.

---

# Task Execution Protocol

## Before Execution

1. Read mission (current objective)
2. Read related ADRs (architectural constraints)
3. Read related knowledge (existing understanding)
4. Read work graph (dependencies, blockers)
5. Verify capability match
6. Accept or reject assignment

---

## During Execution

1. Work within defined constraints
2. Create artifacts incrementally
3. Update progress in project state
4. Log errors to event bus
5. Monitor budget consumption
6. If blocked, report with evidence

---

## After Execution

1. Verify deliverable produced
2. Update work graph (task status)
3. Update project state (progress)
4. Update knowledge base (if new knowledge)
5. Update ADRs (if architecture changed)
6. Report completion with evidence

---

## Completion Report Format

```
Task-Completion: {
  taskId: "TASK-NNNN"
  status: "completed" | "failed"
  deliverable: "Path to artifact produced"
  evidence: [
    "Test results",
    "Documentation links",
    "Metrics summary"
  ]
  budgetUsed: { tokens: N, time: M }
  knowledgeCreated: ["KNW-NNNN"]
  docsUpdated: ["ADR-NNNN", "docs/..."]
  blockersEncountered: ["list or empty"]
}
```

---

# Agent Lifecycle

## Agent Creation

1. Define capability set
2. Define constraints
3. Define budget allocation
4. Register in work graph
5. Document in this file or AGENT_REGISTRY

---

## Agent Evolution

Agents evolve through:
- Knowledge accumulation (capabilities improve)
- Pattern recognition (better decision making)
- Error recovery (more resilient operation)

Agents do NOT change their core capability set without:
1. Mission Agent review
2. Capability update documented
3. Constraints reviewed

---

## Agent Termination

An agent terminates when:
- Mission complete
- Agent role superseded
- Resource constraints require consolidation

Termination requires:
1. Knowledge preservation
2. Task completion or handoff
3. State documentation
4. Work graph update

---

# Multi-Agent Coordination

## Work Graph As Coordination Mechanism

The work graph IS the coordination mechanism.

Agents coordinate by:
- Reading shared work graph
- Respecting dependency constraints
- Publishing events for visibility
- Updating project state for persistence

Agents do NOT coordinate through:
- Direct communication
- Shared mutable state (except work graph)
- Implicit understanding

---

## Concurrent Execution

When multiple agents execute concurrently:

Rules:
1. No concurrent writes to same file (use versioning)
2. Work graph updates are atomic (version-based)
3. Events capture concurrent state changes
4. Conflicts resolved by timestamp + Engineering Intelligence

---

## Priority Preemption

Critical priority tasks MAY preempt lower priority work.

Preemption protocol:
1. Identify affected task
2. Save current state (checkpoint)
3. Notify affected agent (event)
4. Assign critical task
5. Resume preempted task after critical completes

---

# Agent Tool Access

## Tools And Permissions

### Mission Agent

| Tool/Resource | Access |
|---|---|
| Mission file | Read/Write |
| Work graph | Read/Write |
| Project state | Read/Write |
| ADRs | Read/Write |
| Knowledge base | Read/Write |
| Source code | Read only |
| Provider APIs | No direct access |

---

### Research Agent

| Tool/Resource | Access |
|---|---|
| Mission file | Read |
| Work graph | Read |
| Project state | Read/Write |
| ADRs | Read |
| Knowledge base | Read/Write |
| Source code | Read only |
| Provider APIs | Read (research scope only) |

---

### Implement Agent

| Tool/Resource | Access |
|---|---|
| Mission file | Read |
| Work graph | Read/Write |
| Project state | Read/Write |
| ADRs | Read |
| Knowledge base | Read/Write |
| Source code | Read/Write (within constraints) |
| Provider APIs | Read/Write (task scope only) |

---

# Agent Prompt Design

## Principles

Agent prompts MUST follow these principles:

### Prompts Are Configuration, Not Documentation

Prompts define HOW an agent operates.
Documentation defines WHY decisions were made.

Separate concerns:
- Prompt → "Do X within Y constraints"
- ADR → "We chose Z because..."
- Knowledge → "X pattern was observed in situation Y"

---

### Prompts Contain Constraints, Not Intentions

Good prompt:
"You are a design agent. Create ADRs for architectural decisions. Operate within these constraints: [list]. Output: ADR document."

Bad prompt:
"Please try to make good architectural decisions and see what you think is best."

---

### Prompts Are Versioned

Prompts evolve. Prompt evolution is tracked.

Prompt versioning:
- Bump when behavior changes significantly
- Document changes in prompt changelog
- Test new prompts before deployment

---

# Agent Evaluation

## Metrics

| Metric | Formula | Target |
|---|---|---|
| Task Completion Rate | completed / attempted | > 80% |
| Budget Efficiency | budgetUsed / budgetAllocated | < 90% |
| First-Pass Quality | passes without rework | > 75% |
| Alignment Score | mission-aligned tasks / total | > 90% |

---

## Agent Performance Review

Periodic review (per Engineering Intelligence schedule):

1. Compare agent performance against metrics
2. Identify patterns in failures
3. Adjust constraints if needed
4. Update capability documentation
5. Archive obsolete capabilities

---

# Anti-Patterns

## Role Confusion

Agent acts outside its defined capability set.

"Maybe the Mission Agent can implement this directly."

No. The Mission Agent delegates. The Implement Agent implements.
Clear roles prevent systemic failures.

Rule: Agents operate within their defined capability set.

---

## Direct Agent Communication

Agents communicating through direct channels instead of repository artifacts.

"If agent A wants something from agent B, it should send a message."

No. Through the work graph and events.
Direct communication creates hidden coupling.

Rule: All agent communication is observable (repository artifacts or events).

---

## Agent Creep

Agent acquires capabilities not in its definition without documentation update.

"The Research Agent started reading source code, so maybe it can implement too."

No. Capability creep without constraint update breaks the system.

Rule: New capabilities require documented constraint updates.

---

## Silent Failures

Agent fails and does not report.

The worst agent behavior.

Rule: Every failure produces an event. Events are observable. Observability enables recovery.

---

# Related Documents

- `04_ARCHITECTURE_PHILOSOPHY.md` - Agent architecture
- `05_EXECUTION_MODEL.md` - Execution agents and workers
- `06_SYSTEM_ARCHITECTURE.md` - Agent runtime components
- `07_ENGINEERING_INTELLIGENCE.md` - Mission agent as intelligence layer
- `09_RUNTIME_COMPONENTS.md` - Worker implementation
- `10_WORK_GRAPH.md` - Task graph structure
- `15_DECISION_RULES.md` - Decision authority by agent type

---

# Final Rule

An agent without constraints is a threat.
An agent without documented capabilities is a mystery.
An agent without observable communication is unreliable.

Define agents clearly.
Constrain them explicitly.
Monitor them continuously.
Document their evolution.

Agents are engineering components.
Treat them as such.