# 03_DEVELOPMENT_LIFECYCLE.md

Version: 1.0

Status:

Draft

---

# Purpose

This document defines the operational lifecycle that every engineering task
must follow.

The objective is ensuring that software evolves through disciplined,
repeatable engineering rather than isolated coding sessions.

Every task should follow this lifecycle.

No shortcuts.

---

# The Engineering Loop

Every engineering activity follows the same lifecycle.

Observe

↓

Understand

↓

Research

↓

Design

↓

Experiment

↓

Implement

↓

Verify

↓

Review

↓

Document

↓

Commit

↓

Update Project Memory

↓

Continue

The loop never ends until the mission is complete.

---

# Phase 1

Observe

Do not begin coding.

First understand the current repository.

Questions:

What exists?

What is missing?

What is incomplete?

What is duplicated?

What is obsolete?

What is blocked?

Output:

Current understanding.

---

# Phase 2

Understand

Determine:

Problem

Constraints

Dependencies

Risks

Existing implementation

Architectural impact

Do not guess.

Read the code.

Read documentation.

Read ADRs.

Read previous experiments.

Output:

Problem definition.

---

# Phase 3

Research

Research before implementation.

Possible activities:

Read SDK documentation

Read API documentation

Inspect source code

Review similar implementations

Study architecture

Compare alternatives

Research should answer:

Can this already be solved?

Can existing code be reused?

Is there a standard approach?

Output:

Research notes.

---

# Phase 4

Design

Create a solution before writing code.

Design should define:

Responsibilities

Interfaces

Dependencies

Extension points

Failure scenarios

Testing strategy

Logging strategy

Design first.

Implementation second.

---

# Phase 5

Experiment

When uncertainty exists:

Do not modify production code.

Instead create:

Prototype

Spike

Experiment

Sandbox

Experiments should answer one question only.

Examples:

Can two agents share memory?

Can providers run concurrently?

Can scheduler support cancellation?

Can Ollama execute two models simultaneously?

Each experiment should end with:

Conclusion

Evidence

Recommendation

---

# Phase 6

Implementation

Only after previous phases.

Implementation rules:

Small changes

Single responsibility

Readable code

Minimal complexity

No dead code

No duplicated logic

Prefer composition over inheritance.

Always.

---

# Phase 7

Verification

Implementation is incomplete until verified.

Verification includes:

Compile

Lint

Static analysis

Unit tests

Integration tests

Manual validation

Logging validation

Output:

Evidence.

Not confidence.

---

# Phase 8

Self Review

Before committing:

Read your own code.

Questions:

Can this be simplified?

Can names improve?

Can duplication disappear?

Can interfaces shrink?

Can tests improve?

Can documentation improve?

Review before commit.

Always.

---

# Phase 9

Documentation

Documentation is updated immediately.

Never postpone documentation.

Update:

Architecture

ADR

Project State

TODO

Research

Logs

Examples

Repository knowledge should continuously improve.

---

# Phase 10

Commit

A commit represents one logical engineering change.

Never combine unrelated work.

Commit messages should explain:

Why

not only

What.

Good examples:

feat(runtime):

Introduce scheduler abstraction.

test(provider):

Add fake provider implementation.

refactor(memory):

Separate workspace state.

---

# Phase 11

Project Memory

Update:

PROJECT_STATE.md

STATUS.md

TODO.md

Research

ADR

Development Log

The repository must remember everything important.

---

# Phase 12

Continue

After committing:

Never ask:

"What should I do?"

Instead determine:

Highest priority unfinished work.

Continue automatically.

---

# Task Prioritisation

When multiple tasks exist:

Priority:

Critical bug

↓

Broken tests

↓

Architecture

↓

Missing documentation

↓

Missing experiments

↓

New features

↓

Refactoring

↓

Performance

↓

Nice-to-have ideas

---

# Interruptions

If interrupted:

Save state.

Update PROJECT_STATE.md

Create recovery notes.

Commit.

Continue later.

No work should depend on chat memory.

---

# Blocked Tasks

When blocked:

Document the blocker.

Create experiment.

Continue another task.

Return later.

Never stop because one task is blocked.

---

# Recovery

A new engineering session should require only:

PROJECT_STATE.md

TODO.md

STATUS.md

ADR

Mission

Everything else should be discoverable.

---

# Anti Patterns

Never:

Code first.

Guess.

Hide failures.

Delete experiments.

Ignore tests.

Ignore documentation.

Ignore architecture.

Skip commits.

Depend on chat memory.

---

# Completion

A task is complete only if:

Implementation exists.

Tests pass.

Documentation updated.

ADR updated (if required).

Logs updated.

Project memory updated.

Repository healthier than before.

Otherwise,

the task remains incomplete.

---

# Final Rule

Engineering is continuous improvement.

Every iteration should leave the project in a better state.

Always.