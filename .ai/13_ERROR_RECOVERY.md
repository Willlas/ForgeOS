# Error Recovery

Version: 1.0

Status: Draft

---

# Purpose

This document defines how errors are handled, classified, recovered from, and recorded in the Autonomous Engineering Runtime.

Errors will occur.
Recovery must be deterministic.
Nothing important is lost to failure.

The system continues executing through adversity.
It learns from every failure.

---

# Philosophy

## Failure Is Information

A failure tells us something about the system.

Not: "Something went wrong."

But: "This specific path failed under these specific conditions with this specific evidence."

That is actionable knowledge.

---

## Everything Is Recoverable

No task execution result is lost to failure.

Failed results become:
- Knowledge entries
- Experiment records
- ADR consequences (negative)
- Pattern anti-patterns

Every failure leaves the project smarter.

---

# Error Classification

## Criticality Levels

### Level 1: Catastrophic

System cannot continue.

Examples:
- Mission file missing or corrupted
- Core runtime unavailable
- Workspace unreadable
- Storage full

Required response:
- Halt affected subsystem
- Document failure
- Await external intervention
- Do not attempt blind recovery

---

### Level 2: Severe

Subsystem non-functional. Workaround unavailable.

Examples:
- Provider unreachable with no failover
- Scheduler blocked indefinitely
- Task graph corruption
- Tool execution environment offline

Required response:
- Notify Engineering Intelligence
- Attempt known workaround
- If unavailable, degrade gracefully
- Document the gap

---

### Level 3: Degraded

System functional but performance reduced.

Examples:
- Provider latency increased
- Queue backed up
- Partial test failures
- Documentation gaps identified

Required response:
- Monitor closely
- Attempt recovery at next opportunity
- Adjust budgets if needed

---

### Level 4: Warning

System operating within acceptable parameters. Attention recommended.

Examples:
- Minor constraint violation
- Non-critical documentation gap
- Unusual but valid input pattern

Required response:
- Log the event
- Schedule investigation if pattern repeats

---

### Level 5: Informational

Notification only. No action required.

Examples:
- Task completed successfully
- Knowledge entry created
- Graph versioned

Required response:
- None (informational)

---

# Error Categories

## Transient Errors

Temporary failures that resolve themselves.

Examples:
- Network timeout
- Provider rate limiting
- Temporary resource exhaustion
- Intermittent tool failure

Recovery:
- Retry with exponential backoff
- Maximum retries: configurable (default: 3)
- Backoff: initial × 2^attempt (capped at maximum)
- Document repetition patterns

---

## Permanent Errors

Failures that will not resolve without intervention.

Examples:
- Invalid configuration
- Missing required file
- Schema violation
- Capability mismatch

Recovery:
- Do NOT retry (will fail identically)
- Document root cause
- Fix source or update constraints
- Notify appropriate subsystem

---

## Cascading Errors

Failures that propagate through the system.

Examples:
- Provider failure → Worker timeout → Queue backup
- Task graph corruption → Scheduler deadlock
- Workspace conflict → Tool failure cascade

Recovery:
- Contain at failure origin point
- Allow dependent failures to be recorded independently
- Do not suppress downstream errors
- Document the chain of causality

---

## Resource Errors

Failures caused by resource constraints.

Examples:
- Memory exhaustion
- CPU saturation
- Disk full
- Network bandwidth exhausted
- Provider quota exceeded

Recovery:
- Release non-critical resources
- Defer non-priority work
- Adjust budgets dynamically
- Document capacity limits discovered

---

# Recovery Strategies

## Retry With Backoff

For transient failures only.

```
attempt = 0
while attempt < max_retries:
    try:
        return execute()
    except TransientError as e:
        attempt += 1
        wait(backoff(initial) * 2^attempt)
        log("Retry", attempt, e)
return fail("Exhausted retries")
```

---

## Failover

For provider/system redundancy.

When a provider fails:
- Select next available provider of same capability
- Document original failure
- Record failover event

Failover MUST NOT:
- Change task requirements
- Modify acceptance criteria
- Alter expected output

Failover MAY:
- Adjust budget
- Adjust timing expectations
- Log provider-specific patterns

---

## Degradation

When full functionality is unavailable, provide reduced functionality.

Example degradations:

Full mode:
- All providers available
- Full capability set
- Complete validation

Degraded mode:
- Reduced provider pool
- Core capabilities only
- Basic validation

Critical rule:
Degradation MUST be explicit.
Consumers MUST know when operating in degraded mode.

---

## Cancellation

For tasks that must stop immediately.

Cancellation IS NOT failure.

Cancellation requirements:
- Clean resource release
- State preservation
- Clear cancellation recording
- Dependency notification

Cancelled work MAY be retried.
Cancelled work MUST NOT corrupt state.

---

# Error Handling Contracts

## Every Component SHALL

Every runtime component SHALL:

1. Catch errors explicitly where they originate
2. Classify by criticality and category
3. Apply appropriate recovery strategy
4. Record the event with full context
5. Notify dependent subsystems
6. Continue execution if possible

---

## Every Component MUST NOT

MUST NOT:
- Silently swallow exceptions
- Suppress errors without logging
- Assume error type without inspection
- Retry permanent errors
- Cascade errors without context

---

# Error Events

## Event Schema

Every error produces an event:

```
Event: ErrorOccurred
Properties:
  - errorId: string (unique)
  - timestamp: DateTime
  - criticality: Level1-5
  - category: Transient | Permanent | Cascading | Resource
  - sourceComponent: string
  - errorMessage: string
  - rootCause: string (if known)
  - recoveryAttempted: string
  - recoveryResult: Success | Failed | Pending
  - retryCount: integer
  - context: {any relevant state}
```

---

## Error Logging

Error logs contain:
- Event bus event (machine-readable)
- Human-readable summary
- Recovery status
- Related tasks and graph nodes

Logs exist for humans.
Events exist for software.
Never confuse both.

---

# Knowledge From Errors

## Every Major Error Produces

If the error reveals a new failure mode:
- Knowledge entry created
- Anti-pattern documented (if recurring)
- ADR updated (if architectural implication)
- Experiment created (if root cause unknown)

If the error confirms known behavior:
- Related knowledge entry updated
- Confidence level adjusted

---

## Pattern Recognition

Engineering Intelligence monitors errors.

Patterns detected:
- Same component failing repeatedly
- Time-correlated failures
- Resource-correlated failures
- Provider-specific failures
- Task-type-specific failures

Pattern discovery triggers:
- Investigation tasks
- Architecture review
- Capacity planning

---

# Recovery Engine

## Purpose

The Recovery Engine restores the system to a known good state.

## Inputs

- PROJECT_STATE.md
- Work graph (last known version)
- Logs
- Error events
- Knowledge base

## Outputs

- Restored mission context
- Resumable execution state
- Identified blockers
- Recommended recovery actions

---

## Recovery Process

### Phase 1: Assessment

- Read PROJECT_STATE.md
- Read Work graph
- Scan recent errors
- Identify last known good state

### Phase 2: Validation

- Workspace integrity check
- Provider availability check
- Resource availability check
- Dependency validation

### Phase 3: Restoration

- Restore mission from state
- Resume at appropriate graph node
- Re-attempt failed tasks (if transient)
- Skip permanently blocked tasks

### Phase 4: Continuation

- Notify Engineering Intelligence of restoration
- Update work graph with current state
- Begin normal execution

---

# Timeouts

## Timeout Policy

Every time-bound operation SHALL have an explicit timeout.

Default timeouts:
- Provider call: 60 seconds (configurable per provider)
- Tool execution: 30 seconds
- Workspace operation: 15 seconds
- Graph update: 10 seconds
- Event publish: 5 seconds

Timeouts are NOT errors.
Timeouts ARE transient failures.
Timeouts trigger retry logic.

---

## Timeout Exceeded

When timeout exceeded:
- Operation cancelled cleanly
- Error event recorded
- Recovery strategy applied
- Dependent operations notified

---

# Budget Exhaustion

## Detection

When a task approaches budget limits:
- At 80%: Warning event emitted
- At 100%: Task marked as "BudgetExhausted"
- Dependent tasks evaluated (blocked or rerouted)

---

## Response

Budget exhaustion handling:
- Document remaining work needed
- Evaluate if partial completion is valuable
- Create follow-up task if remaining work is critical
- Record budget estimation accuracy

Budget overruns indicate:
- Poor estimation (improve estimation process)
- Unknown complexity (add to knowledge base)
- Scope creep (review mission alignment)

---

# State Corruption Prevention

## Immutability

Work graphs are immutable during execution.
Changes create new versions.

This prevents:
- Concurrent modification corruption
- Partial update states
- Lost updates

---

## Checkpointing

The system checkpoints at logical boundaries:
- After task completion
- After graph version changes
- After major subsystem state changes

Checkpoint content:
- PROJECT_STATE.md
- Work graph version
- Active task contexts
- Error history summary

---

# Anti-Patterns

## Silent Failure

Swallowing errors without logging or recovery.

This is the worst error behavior.
It produces no events, no logs, no knowledge.

Rule: Every failure MUST be visible.

---

## Blind Retry

Retrying permanent failures indefinitely.

Wastes resources.
Delays proper recovery.
Creates false expectations.

Rule: Distinguish transient from permanent before retrying.

---

## Error Masking

Handling an error so transparently that downstream systems lose critical context.

Degradation is acceptable.
Deception is not.

Rule: Consumers MUST know their actual capability state.

---

## State Loss

Failing and losing the ability to resume.

The system exists in a state.
Failure changes state but does not erase it.

Rule: Before any mutating operation, ensure resumption path exists.

---

# Related Documents

- `04_ARCHITECTURE_PHILOSOPHY.md` - Failure-tolerant design
- `05_EXECUTION_MODEL.md` - Cancellation and timeouts
- `06_SYSTEM_ARCHITECTURE.md` - Resource Manager, Worker Pool
- `07_ENGINEERING_INTELLIGENCE.md` - Pattern detection from errors
- `08_KNOWLEDGE_SYSTEM.md` - Anti-patterns, lessons learned
- `09_RUNTIME_COMPONENTS.md` - Recovery Engine, Worker Manager
- `10_WORK_GRAPH.md` - Node states (Blocked, Failed)
- `14_EXPERIMENTS.md` - Error investigation experiments

---

# Final Rule

Failures are engineering data.

A system that never fails is either perfect or lying.

A system that learns from every failure is resilient.

The goal is not perfection.
The goal is progressive invincibility through knowledge accumulation.