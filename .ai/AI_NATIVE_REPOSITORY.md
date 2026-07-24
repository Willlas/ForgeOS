# AI Native Repository Standard

Version: 1.0

---

# Purpose

ForgeOS is designed to be developed by both humans and autonomous AI agents.

Repository structure must minimize unnecessary context usage, reduce repeated file reads and make implementation predictable.

Every architectural decision should favour maintainability for both humans and AI agents.

---

# Core Principles

1. Interfaces before implementations.
2. One responsibility per file.
3. Small, cohesive modules.
4. Stable public APIs.
5. Incremental development.
6. Documentation close to the code.
7. Minimize context consumption.

---

# File Size Policy

Preferred:

- 150 - 250 lines

Recommended maximum:

- 350 lines

Hard review threshold:

- 500 lines

If a file exceeds the hard threshold and requires significant modifications, it MUST be refactored before new functionality is added.

Large files should never continue growing indefinitely.

---

# Component Structure

Every major component should follow the same layout.

Example:

runtime/

    README.md

    IWorkflowEngine.ts

    WorkflowEngine.ts

    WorkflowExecution.ts

    WorkflowState.ts

    WorkflowMetrics.ts

    tests/

Another example:

core/

    README.md

    IWorkGraph.ts

    WorkGraph.ts

    WorkGraphBuilder.ts

    WorkGraphAlgorithms.ts

    WorkGraphValidation.ts

---

# Interfaces

Every public component should expose an interface.

Example:

IWorkGraph

ITaskDispatcher

IScheduler

IProvider

IWorker

IWorkflowEngine

Interfaces should describe behaviour only.

Business logic belongs inside implementations.

---

# Responsibilities

Each file should answer one question.

Examples:

Good

WorkGraphAlgorithms.ts

Contains only:

- topological sort
- bfs
- dfs

Bad

WorkGraph.ts

Contains:

- builder
- serializer
- validation
- execution
- algorithms
- metrics

---

# Local Documentation

Every component should contain a README.md.

README should explain:

- Purpose
- Responsibilities
- Public API
- Dependencies
- Examples
- Extension points

The README must be understandable without reading implementation code.

---

# AI First Navigation

Agents should navigate repositories using this order.

1. README.md
2. Interface
3. Tests
4. Implementation

Never start from implementation unless explicitly required.

---

# Refactoring Rules

Refactoring is encouraged whenever:

- file > 400 lines
- multiple responsibilities exist
- repeated navigation loops appear
- agents repeatedly read the same file

Refactoring must preserve:

- behaviour
- tests
- public APIs

---

# Dependency Rules

Avoid:

- circular dependencies
- cross-module imports
- hidden coupling

Prefer:

Interfaces

↓

Implementations

↓

Composition

instead of

Implementation

↓

Implementation

↓

Implementation

---

# AI Context Optimization

Repository structure should reduce context usage.

Agents should never need to load an entire subsystem to modify one feature.

Small independent components are preferred over large central files.

---

# Implementation Rules

Implement only one logical change at a time.

Workflow:

Read minimum code

↓

Implement

↓

Build

↓

Run affected tests

↓

Commit

↓

Continue

Avoid large feature branches.

---

# Testing

Every extracted component should preserve existing tests.

Prefer:

Component tests

over

Large integration tests

when behaviour allows it.

---

# Commits

Commits should be:

- small
- coherent
- independently compilable

Each commit should represent one logical improvement.

---

# Repository Evolution

Whenever a component repeatedly becomes difficult to understand:

Refactor first.

Do not continue increasing complexity.

Repository quality has priority over implementation speed.

---

# Agent Rules

Agents MUST NOT:

- read the same large file repeatedly
- scan the whole repository without reason
- analyse unrelated components
- increase file size above repository standards

Agents SHOULD:

- prefer interfaces
- prefer README documentation
- implement incrementally
- minimise context usage
- extract responsibilities early

---

# Long-Term Goal

ForgeOS should become an AI-native repository where autonomous agents can understand, modify and extend the system with minimal context, predictable navigation and stable architectural contracts.