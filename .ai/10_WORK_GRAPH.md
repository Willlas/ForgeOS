# Work Graph

Version: 1.0

Status:
Draft

---

# Purpose

The Work Graph represents the executable engineering state of the repository.

Unlike a Task List, a Work Graph models dependencies,
parallelism,
resource allocation,
risk,
knowledge generation,
and engineering value.

It is the central planning artifact of the Autonomous Engineering Runtime.

---

# Philosophy

Software engineering is not a sequence.

It is a graph.

Tasks create work.

Work creates knowledge.

Knowledge creates opportunities.

Opportunities create new tasks.

Therefore engineering is cyclic.

Not linear.

---

# High Level

Mission

↓

Objectives

↓

Tasks

↓

Work Graph

↓

Scheduler

↓

Workers

↓

Results

↓

Knowledge

↓

Engineering Intelligence

↓

New Work Graph

---

# Why A Graph?

Traditional TODO lists fail because they ignore:

Dependencies

Priority propagation

Parallel work

Knowledge generation

Blocking relationships

Reusable artifacts

Graphs naturally represent engineering.

---

# Graph Nodes

Every node represents a Work Item.

Examples

Research

Prototype

Programming

Documentation

Benchmark

Review

Testing

Architecture

Reverse Engineering

Deployment

Validation

Refactoring

Profiling

Each node is atomic.

---

# Node Properties

Every Work Item contains

Identifier

Title

Description

Capability

Priority

Estimated Cost

Estimated Tokens

Estimated Time

Dependencies

Risk

Complexity

Confidence

Expected Deliverables

Acceptance Criteria

State

Assigned Worker

Assigned Provider

Execution History

Knowledge Generated

---

# Node States

Planned

Ready

Running

Waiting

Blocked

Review

Completed

Cancelled

Failed

Archived

Nodes never disappear.

History matters.

---

# Edges

Edges represent dependencies.

Examples

Research

↓

Prototype

↓

Implementation

↓

Unit Tests

↓

Integration Tests

↓

Documentation

↓

Benchmark

↓

ADR

↓

Done

The graph determines execution order.

Not the Scheduler.

---

# Parallelism

Independent branches may execute simultaneously.

Example

Research Provider API

||

Benchmark Existing Providers

||

Review Scheduler Design

||

Prepare Documentation

All four may execute concurrently.

---

# Blocking

Nodes become blocked when dependencies fail.

Blocked nodes never disappear.

The Scheduler periodically reevaluates them.

---

# Knowledge Nodes

Some nodes produce no code.

Example

Research

↓

Knowledge

Knowledge has engineering value.

Knowledge nodes remain permanent.

---

# Validation Nodes

Every implementation should eventually create validation nodes.

Examples

Unit Test

Integration Test

Stress Test

Benchmark

Architecture Review

Without validation,

implementation remains provisional.

---

# Review Nodes

Review is independent work.

Review is never merged into implementation.

Review should produce

Observations

Risks

Recommendations

Architecture impact

---

# Refactoring Nodes

Refactoring is first-class engineering work.

Refactoring should never be hidden inside implementation.

Dedicated nodes improve traceability.

---

# Budget

Each node owns a budget.

Time

Tokens

RAM

VRAM

Priority

Retries

Deadline

Budgets are allocated by the Scheduler.

---

# Knowledge Output

Every completed node answers

What happened?

What was learned?

Should this become permanent knowledge?

Future recommendations?

Related ADR?

Related experiments?

Knowledge accumulates.

---

# Dynamic Expansion

Nodes may generate new nodes.

Example

Prototype reveals unknown provider limitation.

↓

Create Research Node

↓

Create Experiment Node

↓

Create Documentation Node

The graph evolves.

---

# Graph Versioning

Every planning cycle creates a new Work Graph version.

History should remain inspectable.

Engineering evolution becomes observable.

---

# Final Principle

The Work Graph is the executable representation of engineering.

Everything else supports it.
