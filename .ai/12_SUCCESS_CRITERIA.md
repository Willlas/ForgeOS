# Success Criteria

Version: 1.0

Status: Draft

---

# Purpose

This document defines what "done" means for every artifact, task, session, and phase of the Autonomous Engineering Runtime.

Success is not subjective.
Success is measurable.
Success is verifiable.

If it cannot be measured, it cannot be evaluated.

---

# Philosophy

## Done Is Binary

A task is either complete or it is not.

"Mostly done" is incomplete.
"Almost ready" is not ready.
"Probably works" is unverified.

Ambiguity is the enemy of engineering excellence.

---

# Artifact-Level Criteria

## Implementation Artifacts

Every code artifact MUST satisfy all criteria:

### Code Completeness

- [ ] Source file exists at expected location
- [ ] Type definitions exist (if TypeScript)
- [ ] Public interfaces are documented
- [ ] Error handling is explicit
- [ ] Edge cases identified and handled

### Code Quality

- [ ] No TODO comments remain without expiration date
- [ ] All public symbols have documentation
- [ ] No dead code paths
- [ ] No unreachable error handlers
- [ ] Consistent naming conventions applied

### Contracts

Every interface SHALL define:

- Input schema (type, constraints)
- Output schema (type, guarantees)
- Error types (which can be thrown/returned)
- Invariants (what is always true)
- Preconditions (what must be true before call)
- Postconditions (what is guaranteed after call)

---

## Test Artifacts

### Unit Tests

- [ ] Every public function has at least one test case
- [ ] Edge cases have dedicated tests
- [ ] Error paths are tested
- [ ] Tests are deterministic (no timing dependencies)
- [ ] Tests execute in under 5 seconds each

### Integration Tests

- [ ] All public interfaces tested end-to-end
- [ ] Cross-module boundaries tested
- [ ] Provider interactions tested
- [ ] Error recovery tested

### Benchmark Tests

- [ ] Baseline established before optimization
- [ ] Hardware configuration documented
- [ ] Results reproducible
- [ ] Statistical significance achieved (if applicable)

---

## Documentation Artifacts

### ADR Documents

- [ ] Status is current (not outdated)
- [ ] Alternatives are fairly represented
- [ ] Negative consequences are documented
- [ ] References are accurate and accessible
- [ ] Related source code paths verified

### Research Documents

- [ ] Question is clearly stated
- [ ] Sources are cited
- [ ] Findings have evidence
- [ ] Confidence level assigned
- [ ] Open questions listed

### Feature Documentation

- [ ] Purpose stated in first paragraph
- [ ] Usage examples work (if demonstrated)
- [ ] Limitations listed explicitly
- [ ] Edge cases documented

---

# Task-Level Criteria

## Task Completion Checklist

A task is complete when ALL of the following are true:

### Implementation Complete

- [ ] Code exists at expected location
- [ ] Code compiles without errors
- [ ] Type checking passes (if applicable)
- [ ] Linting passes (if configured)

### Tests Pass

- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] No regressions introduced

### Documentation Updated

- [ ] Related ADRs updated if architecture changed
- [ ] Source code documentation present
- [ ] Project state reflects completion

### Knowledge Captured

- [ ] Lessons learned documented (if applicable)
- [ ] Patterns identified and recorded
- [ ] New knowledge added to knowledge base

### Commit Made

- [ ] Commit message follows Conventional Commits
- [ ] Commit message explains WHY
- [ ] Related ADRs referenced (if applicable)
- [ ] Changes are atomic (one logical change per commit)

### State Synchronized

- [ ] PROJECT_STATE.md updated
- [ ] TODO.md updated
- [ ] STATUS.md updated

---

## What Completeness Looks Like

### Engineering Equation

```
Implementation
+ Tests Passing
+ Documentation Updated
+ Knowledge Captured
+ Commit Made
+ State Synchronized
= Done
```

Any missing element means the task is INCOMPLETE.

---

# Session-Level Criteria

## Engineering Session Completion

A session is complete when:

### Deliverables Met

- [ ] All planned deliverables produced
- [ ] Each deliverable satisfies artifact-level criteria
- [ ] No known regressions introduced

### Documentation Current

- [ ] PROJECT_STATE.md reflects reality
- [ ] Related ADRs updated
- [ ] Knowledge entries added (if new knowledge generated)

### Work Graph Updated

- [ ] Completed tasks marked as "Completed"
- [ ] New tasks created (if session revealed new work)
- [ ] Dependencies accurately represented

### Next Session Prepared

- [ ] Current state is resumable
- [ ] Blockers are documented
- [ ] Next priorities are clear
- [ ] Context is sufficient for another agent

---

# Phase-Level Criteria

## Phase 1: Observe

**Success**: Awareness of system and environment.

Criteria:
- [ ] System components identified
- [ ] Current state understood
- [ ] No assumptions made without verification

---

## Phase 2: Understand

**Success**: Context established for decision-making.

Criteria:
- [ ] Relevant documentation reviewed
- [ ] Related ADRs understood
- [ ] Existing knowledge searched
- [ ] Assumptions documented as hypotheses

---

## Phase 3: Research

**Research Success Criteria**:

- [ ] Question clearly stated
- [ ] Methodology documented
- [ ] Sources consulted and cited
- [ ] Findings evidence-based
- [ ] Confidence level assigned
- [ ] Impact on implementation assessed
- [ ] Open questions listed
- [ ] Knowledge entry created (if validated)

---

## Phase 4: Design

**Design Success Criteria**:

- [ ] ADRs created for all architectural decisions
- [ ] Alternatives considered and documented
- [ ] Negative consequences identified
- [ ] Interfaces defined with contracts
- [ ] Dependencies mapped
- [ ] Risk assessment performed

---

## Phase 5: Experiment

**Experiment Success Criteria**:

- [ ] Hypothesis stated
- [ ] Setup documented (reproducible)
- [ ] Results recorded (raw data)
- [ ] Analysis performed
- [ ] Conclusion reached (supported/rejected/inconclusive)
- [ ] Recommendation given
- [ ] Knowledge updated (if validated)

---

## Phase 6: Implementation

**Implementation Success Criteria**:

- [ ] Artifact-level criteria met for all artifacts
- [ ] Code compiles and passes type checking
- [ ] Tests added and passing
- [ ] Documentation current
- [ ] ADRs updated if architecture changed
- [ ] Knowledge updated (if new knowledge generated)

---

## Phase 7: Verification

**Verification Success Criteria**:

- [ ] All tests pass
- [ ] Linting passes
- [ ] No regressions
- [ ] Performance acceptable (within baseline for task type)

---

## Phase 8: Review

**Review Success Criteria**:

- [ ] Architecture reviewed (if architectural changes made)
- [ ] Code patterns checked
- [ ] Documentation gaps identified and filled
- [ ] Knowledge base updated
- [ ] Recommendations provided

---

## Phase 9: Documentation

**Documentation Success Criteria**:

- [ ] All planned documentation created
- [ ] Related documents cross-referenced
- [ ] No orphaned documentation
- [ ] Format consistent with standards
- [ ] Evidence provided for claims
- [ ] Status correct for each document

---

## Phase 10: Commit

**Commit Success Criteria**:

- [ ] Conventional Commits format followed
- [ ] WHY explained in commit message
- [ ] Related ADRs referenced
- [ ] Atomic changes (one logical unit per commit)
- [ ] Each commit represents a complete state

---

## Phase 11: Project Memory

**Memory Success Criteria**:

- [ ] PROJECT_STATE.md accurate and current
- [ ] TODO.md reflects current priorities
- [ ] STATUS.md reflects current progress
- [ ] Work graph updated
- [ ] Knowledge base updated

---

# System-Level Criteria

## Runtime Health Metrics

The system is healthy when:

### Execution Metrics

| Metric | Target | Measurement |
|---|---|---|
| Task Completion Rate | > 80% | Tasks completed / Tasks attempted |
| Average Recovery Time | < 5 min | Time from failure to recovery |
| Test Pass Rate | 100% | Passing tests / Total tests |
| Documentation Coverage | > 90% | Documented features / Total features |

### Knowledge Metrics

| Metric | Target | Measurement |
|---|---|---|
| Knowledge Growth | Positive | New knowledge - deprecated knowledge |
| ADR Currency | < 30 days | Days since last ADR update |
| Experiment Completeness | > 85% | Completed / Started |

### Quality Metrics

| Metric | Target | Measurement |
|---|---|---|
| Technical Debt Trend | Non-increasing | Debt items added - debt items resolved |
| Documentation Freshness | < 7 days | Days since last update to docs |
| Test Coverage Growth | Positive | New coverage - deprecated coverage |

---

## Engineering Velocity

### Definition

Engineering velocity is not speed.
Engineering velocity is validated progress per unit time.

### Measurement

```
Velocity = (Validated Deliverables) / (Engineering Time)
```

Validated means:
- Tests pass
- Documentation current
- Knowledge updated
- ADRs reflect reality

Unvalidated output is not velocity.

---

# Quality Gates

## Before Implementation Begins

- [ ] Mission alignment confirmed
- [ ] Related ADRs reviewed
- [ ] Related research reviewed
- [ ] Existing knowledge searched
- [ ] Workspace state verified
- [ ] Work graph current

---

## During Implementation

- [ ] Tests written alongside code
- [ ] Documentation updated incrementally
- [ ] No hidden assumptions
- [ ] Error handling explicit
- [ ] State synchronized regularly

---

## Before Session Ends

- [ ] All deliverables verified against criteria
- [ ] PROJECT_STATE.md updated
- [ ] Work graph updated
- [ ] Knowledge updated (if applicable)
- [ ] Next session context prepared
- [ ] Blockers documented

---

## Before System Release

- [ ] All phase-level criteria met
- [ ] All artifact-level criteria met
- [ ] All system-level metrics within targets
- [ ] Documentation complete and current
- [ ] Knowledge base comprehensive
- [ ] Tests passing (100%)
- [ ] No critical blockers

---

# Anti-Criteria

## What Completeness Is NOT

### NOT "Code Runs"

Running code without tests, documentation, or knowledge capture is incomplete.

### NOT "Tests Pass"

Passing tests with no documentation, no knowledge capture, and broken ADRs is incomplete.

### NOT "Documentation Written"

Written documentation without implementation or verification is unvalidated.

### NOT "Commit Made"

A commit that diverges from reality through stale state is anti-work.

---

## What Success Is NOT

### NOT Subjective

"It feels good" is not a criterion.

### NOT Opinions

"I think this works" is not evidence.

### NOT Partial Completion

"Almost done" means the same thing as "not done."

### NOT Unverified Results

Results without measurement are claims, not success.

---

# Success Evidence Hierarchy

## Level 5: Verified and Measurable

Metrics exist.
Results reproducible.
Evidence is quantitative.

Example:
"The scheduler handles 1000 tasks/min with p99 latency of 42ms."

---

## Level 4: Validated

Tests pass.
Documentation confirmed.
Knowledge updated.

Example:
"All integration tests pass. ADR-0005 reflects the architecture."

---

## Level 3: Evidence-Based

Evidence provided.
Sources cited.
Conclusions supported.

Example:
"Provider A performed better in benchmark B (see experiment EXP-0012)."

---

## Level 2: Claimed

Assertion without evidence.
"I think this works."

Not sufficient for success criteria.

---

## Level 1: None

No documentation.
No measurement.
No verification.

This is not engineering.

---

# Final Rule

Success is not declared.
Success is demonstrated.

Every claim of success MUST be accompanied by:
- Measurable evidence
- Working tests
- Current documentation
- Updated knowledge

Without these, the claim has no foundation.