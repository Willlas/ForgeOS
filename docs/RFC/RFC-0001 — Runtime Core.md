# RFC-0001

Title:
Runtime Core

Status:
Draft

Author:
AI Development OS

---

## Motivation

The current ecosystem tightly couples:

- LLM
- Agent
- Scheduler
- Provider

This makes replacing any component expensive.

The Runtime Core introduces strict separation between:

Mission

Planning

Scheduling

Execution

Resources

Knowledge

---

## Goals

The Runtime Core SHALL:

- never depend on an LLM
- never depend on Ollama
- never depend on a Provider
- never depend on VSCode
- never depend on Cline

It SHALL only orchestrate engineering work.

---

## Non Goals

The Runtime Core is NOT responsible for:

Prompt generation

Tool implementation

Inference

Provider APIs

GUI

CLI

---

## Architecture

Mission

↓

Brain

↓

Architect

↓

Planner

↓

WorkGraph

↓

Scheduler

↓

Execution API

Everything below Execution API becomes replaceable.

---

## Public Interfaces

The Runtime exposes only:

Mission API

Scheduler API

Worker API

Workspace API

Knowledge API

Provider API

Everything else is internal.

---

## Lifecycle

Initialize Runtime

↓

Load Mission

↓

Load Knowledge

↓

Build Work Graph

↓

Schedule

↓

Execute

↓

Observe

↓

Repeat

---

## Acceptance Criteria

Runtime compiles without providers.

Runtime compiles without models.

Runtime compiles without GUI.

Runtime compiles without CLI.

Runtime passes unit tests.
