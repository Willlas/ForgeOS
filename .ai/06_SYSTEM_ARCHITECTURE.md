# System Architecture

Version: 1.0

Status:
Draft

---

# Purpose

This document defines the complete architecture of the Autonomous Engineering Runtime.

The purpose is not to describe implementation.

The purpose is to define responsibilities.

Every subsystem exists for one reason.

Every subsystem should be independently replaceable.

---

# High Level Architecture

                    Mission
                       │
                       ▼
                 Architect Engine
                       │
                       ▼
                 Objective Planner
                       │
                       ▼
                  Task Graph Builder
                       │
                       ▼
              Capability Resolver
                       │
                       ▼
                Execution Scheduler
                       │
      ┌────────────────┴────────────────┐
      ▼                                 ▼
 Worker Pool                      Resource Manager
      │                                 │
      ▼                                 ▼
 Provider Layer                 CPU / GPU / Memory
      │
      ▼
   Model Runtime
      │
      ▼
 Tool Execution
      │
      ▼
 Workspace
      │
      ▼
 Event Bus
      │
      ▼
 Metrics / Logs / GUI / CLI

---

# Mission

The Mission never changes during execution.

Responsibilities

- Define long-term goals
- Define engineering objectives
- Define constraints
- Define success criteria

The Mission never creates tasks.

---

# Architect Engine

The Architect transforms goals into engineering work.

Input

Mission

Output

Objectives

The Architect never executes code.

The Architect never edits files.

The Architect creates engineering plans.

---

# Objective Planner

Objectives are transformed into executable work.

Example

Objective

↓

Provider Agnostic Runtime

↓

Tasks

↓

Interfaces

↓

Experiments

↓

Documentation

↓

Benchmarks

↓

Tests

The planner creates work.

Nothing more.

---

# Task Graph Builder

Tasks become a dependency graph.

Each task contains

Identifier

Description

Priority

Estimated Cost

Dependencies

Risk

Required Capabilities

Expected Deliverables

The graph is immutable during execution.

Changes create a new graph version.

---

# Capability Resolver

Every task requires capabilities.

Examples

Programming

Research

Testing

Benchmarking

Profiling

Architecture

Documentation

Review

Performance

Security

Reverse Engineering

Dependency Analysis

The resolver determines capability requirements.

It never chooses workers.

---

# Scheduler

The Scheduler allocates work.

Input

Task Graph

Worker Pool

Budgets

Resources

Output

Execution Plan

The Scheduler owns time.

Not architecture.

---

# Worker Pool

Workers execute tasks.

Workers should remain stateless.

Every Worker receives

Context

Capability

Budget

Workspace

Tools

Expected Output

Workers never choose other workers.

---

# Resource Manager

The Resource Manager owns hardware.

Responsibilities

CPU

GPU

VRAM

RAM

Disk

Network

Power Limits

Temperature

Future:

Distributed Execution

The rest of the system should never know hardware details.

---

# Provider Layer

Providers expose inference.

The Provider API hides

Ollama

OpenAI

Claude

Gemini

llama.cpp

vLLM

TensorRT-LLM

Providers expose capabilities.

Not implementations.

---

# Model Runtime

Models perform inference.

Nothing else.

The runtime should support

Hot loading

Cold loading

Concurrent execution

Streaming

Cancellation

Retry

Context compaction

---

# Tool Layer

Tools perform deterministic work.

Examples

Git

Filesystem

Shell

Compiler

Docker

HTTP

Search

Testing

Formatting

Benchmarking

Workers orchestrate tools.

Tools never orchestrate workers.

---

# Workspace

The Workspace is shared engineering memory.

Contains

Source Code

Research

Logs

Artifacts

Experiments

Documentation

Metrics

The Workspace is observable.

---

# Event Bus

Every subsystem emits events.

Events become the backbone of the system.

Example

Mission Started

↓

Objective Created

↓

Task Created

↓

Worker Assigned

↓

Provider Selected

↓

Inference Started

↓

Inference Finished

↓

Commit Created

↓

Mission Updated

Nothing important happens silently.

---

# Metrics

Every action should generate measurable information.

Execution Time

Tokens

Latency

Failures

Retries

Provider Usage

GPU Usage

CPU Usage

Worker Utilization

Queue Length

Throughput

Engineering Velocity

Knowledge Growth

---

# Logs

Logs exist for humans.

Events exist for software.

Never confuse both.

---

# GUI

The GUI never contains engineering logic.

The GUI visualizes

Workers

Events

Mission

Metrics

Progress

Logs

---

# CLI

The CLI exposes automation.

The CLI should be scriptable.

Everything possible in the GUI

should also be possible from the CLI.

---

# Design Principles

Every subsystem should satisfy

Replaceable

Observable

Testable

Documented

Independent

Deterministic whenever possible

---

# Final Principle

The architecture exists to maximize engineering throughput while minimizing cognitive complexity.
