# Execution Model

Version: 1.0

Status:
Draft

---

# Purpose

This document defines how engineering work flows through the system.

The objective is separating:

Mission

Planning

Scheduling

Execution

Resources

No layer should know unnecessary implementation details.

---

# High-Level Flow

Mission

↓

Objectives

↓

Tasks

↓

Capabilities

↓

Scheduler

↓

Workers

↓

Provider

↓

LLM

↓

Tools

↓

Result

↓

Architect

Every layer has one responsibility.

---

# Mission

The Mission defines:

Why the repository exists.

The Mission never contains implementation details.

Example:

Build a multi-agent runtime.

Not:

Create Scheduler.cs

---

# Objectives

Objectives are measurable outcomes.

Examples:

Scheduler supports priorities.

Providers are replaceable.

Runtime is provider independent.

Unit tests reach 90%.

Objectives describe destination.

Not implementation.

---

# Tasks

Objectives become Tasks.

Example:

Objective

↓

Provider abstraction

↓

Tasks

Create interface

Implement fake provider

Implement Ollama provider

Write tests

Document ADR

Tasks are small.

---

# Capabilities

Tasks require capabilities.

Not people.

Not agents.

Capabilities.

Examples:

Programming

Testing

Benchmarking

Research

Reverse Engineering

Architecture

Documentation

Performance

Security

Profiling

Dependency Analysis

Design

Planning

Logging

Observability

A task may require multiple capabilities.

---

# Scheduler

The Scheduler matches:

Required Capabilities

↓

Available Workers

The Scheduler should never know:

Prompt wording.

Repository structure.

Mission goals.

Only capabilities.

---

# Worker

A Worker is an execution unit.

Workers are disposable.

Workers should be stateless whenever possible.

Workers receive:

Task

Context

Capability

Expected Output

Workers return:

Artifacts

Logs

Metrics

Summary

Nothing else.

---

# Provider

Providers abstract LLM execution.

Workers never know:

Ollama

Claude

OpenAI

Gemini

llama.cpp

Workers ask for inference.

Providers decide how.

---

# Model

Models execute inference.

Models are replaceable.

Schedulers should not know models.

Architects should not know models.

Only Providers should.

---

# Tool Layer

Tools perform deterministic work.

Examples:

Read file

Search

Replace

Compile

Run tests

Benchmark

Git

Docker

HTTP

Shell

Workers orchestrate tools.

Tools never orchestrate workers.

---

# Result

Every Worker produces:

Primary Result

Supporting Evidence

Logs

Metrics

Modified Files

Summary

Confidence

Next Recommendations

Incomplete work should never disappear.

---

# Context Flow

Context always flows downward.

Mission

↓

Objective

↓

Task

↓

Worker

↓

Tool

Results always flow upward.

Tool

↓

Worker

↓

Scheduler

↓

Architect

↓

Mission

This prevents circular reasoning.

---

# Isolation

Workers should not communicate directly.

All communication happens through:

Scheduler

Workspace

Event Bus

Never through hidden state.

---

# Parallelism

Parallelism is decided by the Scheduler.

Workers never spawn workers directly.

Instead they request:

Need:

Testing Capability

Need:

Documentation Capability

Need:

Research Capability

Scheduler decides.

---

# Failure

Workers may fail.

Failure should return:

Reason

Evidence

Logs

Recommendation

Retry Strategy

Failure is information.

Not termination.

---

# Cancellation

Any task may be cancelled.

Cancellation should preserve:

Logs

State

Progress

Artifacts

Cancellation never loses work.

---

# Retry

Retries require strategy.

Never blindly repeat.

Retry after:

Different Context

Different Capability

Different Provider

Different Model

Smaller Task

New Research

---

# Final Principle

Execution should be entirely replaceable.

The Mission should survive even if every Worker,
Provider and Model changes.
