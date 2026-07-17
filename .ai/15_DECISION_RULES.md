# Decision Rules

Version: 1.0

Status: Draft

---

# Purpose

This document defines how decisions are made, by whom, under what constraints, and with what authority in the Autonomous Engineering Runtime.

Decisions ARE engineering work.
How we decide determines what we build.

Every decision MUST have:
- A decider (who)
- Constraints (within what bounds)
- Criteria (based on what)
- Reversibility classification

When decisions lack these elements, they become opinions competing with opinions.

---

# Philosophy

## Decisions Are Contracts

A decision is not a preference.
A decision is a binding commitment that shapes the system.

Once made and documented, a decision constrains all future work until superseded by another decision.

---

## Reversibility Determines Process Depth

The cost of reversing a wrong decision determines how much analysis it needs upfront.

Irreversible decisions require deep analysis.
Reversible decisions require minimal analysis plus validation.

Wrong reversible decisions beat correct unvalidated guesses every time.

---

# Decision Categories

## Architectural Decisions (Irreversible-Heavy)

Change cost: High.
Reversibility: Low.
Authority: Engineering Intelligence.

These define system structure. Changing them after implementation costs months of work.

Examples:
- Component boundaries
- Interface contracts
- Protocol choices
- Deployment topology

Process:
1. Research (if uncertainty exists)
2. ADR created with full analysis
3. Alternatives documented fairly
4. Negative consequences identified
5. Engineering Intelligence approves
6. Decision published as ADR
7. Related knowledge updated

**No implementation begins until ADR is Accepted status.**

---

## Design Decisions (Reversible)

Change cost: Medium.
Reversibility: Moderate.
Authority: Worker (within constraints).

These define HOW within architectural bounds.

Examples:
- Algorithm selection (when performance-equivalent)
- Data structure choices
- Internal API design
- Code organization

Process:
1. Architectural constraints reviewed
2. Decision documented if pattern-recurrence expected
3. Implementation
4. Tests verify correctness

**Design decisions that repeat across modules require ADR.**

---

## Implementation Decisions (Fully Reversible)

Change cost: Low.
Reversibility: High.
Authority: Implementing agent.

Examples:
- Variable naming (within convention)
- Function decomposition
- Import ordering
- Temporary variable usage

Process:
1. Coding standards reviewed
2. Decision made during implementation
3. No separate documentation required
4. Code IS the documentation

---

## Technology Decisions (Irreversible-Heavy)

Change cost: High.
Reversibility: Low.
Authority: Engineering Intelligence.

Examples:
- Programming language selection
- Framework choice
- Provider selection (primary vs fallback)
- Infrastructure platform

Process:
1. Research document created
2. Comparison experiment (if multiple viable options)
3. ADR with full cost-benefit analysis
4. Engineering Intelligence approves

---

## Operational Decisions (Transient)

Change cost: Minimal.
Reversibility: High.
Authority: Scheduler / Runtime.

Examples:
- Task execution ordering (within graph constraints)
- Retry decisions
- Budget allocation between tasks
- Provider failover selection

Process:
1. Constraints defined by higher-level decisions
2. Scheduler decides within constraints
3. Events logged for audit trail
4. No ADR required

---

# Decision Authority Matrix

| Decision Type | Cost to Reverse | Authority | Documentation |
|---|---|---|---|
| Architectural | High | Engineering Intelligence | ADR (required) |
| Design | Medium | Worker + Architecture review | Code docs + ADR (if pattern) |
| Implementation | Low | Implementing agent | Coding standards |
| Technology | High | Engineering Intelligence | ADR + Research + Experiment |
| Operational | Minimal | Scheduler | Event log |
| Mission Alignment | High | Engineering Intelligence | ADR + Mission update |

---

# Decision Process

## When Architecture Is Unknown

```
Uncertainty exists → Research → Experiment (if needed) → ADR → Knowledge → Implementation
```

This is NOT optional.
Implementing without resolving uncertainty puts the architecture at risk.

---

## When Architecture Exists

```
Architecture reviewed → Constraints understood → Decision within bounds → Implementation
```

If decision falls OUTSIDE bounds:
```
Decision outside bounds → New ADR required → Approval → Implementation
```

---

## Emergency Decisions

When waiting for approval causes data loss, security breach, or system damage:

1. Fix the immediate problem
2. Document within the same session
3. Create retroactive ADR
4. Engineering Intelligence reviews post-facto
5. If decision was wrong, reverse it

Emergency authority is real but scrutinized.

---

# Architectural Decision Constraints

## Workers Operate Within Architectural Bounds

Workers are NOT architects.
Workers implement within constraints defined by architecture.

If a worker encounters a situation where correct implementation REQUIRES violating architectural constraints:

1. Stop (do not proceed with violation)
2. Document the conflict
3. Request Architecture review
4. Wait for resolution

Workers do not override architecture.
Architecture overrides workers.

---

# Decision Criteria

## Every Architectural Decision Must Optimize, In Order

1. **Correctness** — The system must produce correct results
2. **Recoverability** — Failure must be detectable and recoverable
3. **Observability** — System state must be visible
4. **Performance** — Within acceptable bounds
5. **Cost** — Resource efficiency matters
6. **Developer experience** — Matters for sustainability

Correctness beats performance.
Recoverability beats cleverness.
Observability beats opacity.

---

## Provider Selection Criteria

When multiple providers satisfy capability requirements:

1. **Reliability** — Uptime, error rate, consistency
2. **Cost efficiency** — Token cost per useful output
3. **Speed** — Latency and throughput
4. **Feature completeness** — Capability coverage
5. **Rate limits** — Practical capacity

If providers are equivalent on all criteria:
Choose the cheapest.
Document the choice.
Monitor for changes in any criterion.

---

## Task Assignment Criteria

When assigning work to agents/workers:

1. **Capability match** — Can the agent perform this task?
2. **Context requirement** — Does the agent have necessary context?
3. **Cost efficiency** — Least expensive valid option
4. **Load balancing** — Avoid single-point overload
5. **Failure history** — Prefer agents with no recent failures on similar tasks

---

# Decision Timing

## When Decisions Must Be Made

| Phase | Required Decisions |
|---|---|
| Observe | None (information gathering) |
| Understand | Assumptions documented as hypotheses |
| Research | Research question, methodology |
| Design | All architectural decisions (as ADRs) |
| Experiment | Hypothesis, success criteria |
| Implementation | Within architectural bounds only |
| Verification | Test selection, pass criteria |
| Review | Architecture conformance |
| Documentation | What to document (per 11_DOCUMENTATION.md) |

---

## Decisions That Must Be Deferred

When critical information is unavailable:

1. Identify the missing information
2. Determine how to obtain it (research/experiment)
3. Create task for obtaining it
4. Block dependent work
5. Continue independent work

Never decide without necessary information.
Deferral IS a decision.

---

# Decision Documenting

## All Decisions MUST Be Documented At The Appropriate Level

### Architectural/Technology

- ADR document (before implementation)
- Knowledge entry (after implementation confirms decision)

### Design (recurring patterns only)

- Pattern documented in relevant document or ADR
- Or reference to existing pattern documentation

### Implementation

- Code comments explaining WHY
- Interface documentation explaining WHAT and contracts

### Operational

- Event log entries
- Project state updates

---

## Decision Document Content

Every decision document MUST contain:

- What was decided
- When (date/session)
- Who decided (authority source)
- Why (criteria used)
- Alternatives considered
- Constraints applied
- Reversibility classification
- Related decisions
- Status (current, superseded, deprecated)

Missing "why" means the decision is incomplete.

---

# Decision Lifecycle

## Status Transitions

Draft → Review → Accepted → Superseded | Deprecated

### Draft

Proposed but not yet reviewed.
Implementation MUST NOT begin on Draft architectural decisions.

### Review

Under review by appropriate authority.
Changes expected during review.

### Accepted

Reviewed and approved.
Authoritative source for this decision.

### Superseded

Replaced by newer decision.
Reference the superseding decision.
Maintain for historical context.

### Deprecated

No longer recommended.
Still relevant for understanding system evolution.

---

## Decision Expiry

Decisions degrade when:

- Underlying assumptions change
- New alternatives emerge
- Implementation reveals flaws
- Time elapsed without validation (> 60 days)

Expired decisions trigger review:
1. Is the decision still valid?
2. Update ADR status
3. If invalid, create replacement decision
4. If valid, re-affirm and date stamp

---

# Conflict Resolution

## When Decisions Conflict

If two accepted decisions conflict:

1. Identify which is newer
2. Determine intent of both
3. If conflict is real (not apparent), create resolution ADR
4. Engineering Intelligence resolves
5. Older decision marked as superseded (if appropriate)

Newer does not automatically override older.
Intent matters more than timestamp.

---

## When Implementation Conflicts With Architecture

If correct implementation REQUIRES architectural change:

1. Document the conflict
2. Determine if architecture is wrong OR understanding is wrong
3. If architecture is wrong → ADR to update architecture
4. If understanding is wrong → ADR to clarify constraints
5. Do NOT implement outside stated constraints

This protects workers from impossible situations.
Architecture and implementation MUST converge.

---

# Decision Metrics

## Track These Decision-Level Metrics

| Metric | Target | Purpose |
|---|---|---|
| Decision Currency | < 30 days old | Ensure relevance |
| ADR-to-Implementation Lag | < 5 sessions | Documentation current |
| Superseded Rate | < 20% | Decisions are thoughtful, not whimiscal |
| Review Pass Rate | > 80% | First-pass quality |

---

## Engineering Quality Indicators

Good decision patterns:
- ADRs created before implementation
- Alternatives documented fairly
- Negative consequences identified
- Knowledge updated from decisions

Bad decision patterns:
- Implementation before architectural decisions
- No alternatives considered
- "Obviously correct" claims without evidence
- Decisions made then abandoned (no trace)

---

# Anti-Patterns

## Decision By Whisper

A decision is made informally, not documented, then treated as authoritative.

Rule: If it is not written, it is not a decision.
Informal discussion is exploration, not commitment.

---

## Decision By Majority

Multiple conflicting decisions coexist because "different agents decided differently."

Rule: One source of truth per decision topic.
Conflicting decisions mean the older one needs review.

---

## Decision Drift

Implementation diverges from documented decisions without formal update.

Worse than no documentation.

Prevention: Review implementation against decisions regularly.

---

## Opinion As Decision

"I think X is better" presented as a decision.

Opinions require evidence.
Decisions require documentation.

Before deciding: Research. Before researching: Hypothesize.

---

## Unreversible Decisions Treated As Reversible

Choosing technology then assuming it can be changed later.

Platform choices, protocol choices, data format choices — these are hard to reverse.

Classify reversibility honestly.
Irreversible decisions need irreversible-level analysis.

---

## Reversible Decisions Treated As Irreversible

Over-analyzing choices that can be easily changed later.

Analysis paralysis on reversible decisions is waste.

Rule: Decision depth proportional to reversal cost.

---

# Related Documents

- `02_ENGINEERING_PRINCIPLES.md` - Principles 5, 8 (Decision quality)
- `04_ARCHITECTURE_PHILOSOPHY.md` - Architecture decision authority
- `07_ENGINEERING_INTELLIGENCE.md` - Intelligence-based decisions
- `10_WORK_GRAPH.md` - Decision nodes in work graph
- `11_DOCUMENTATION.md` - ADR documentation format
- `14_EXPERIMENTS.md` - Experiment-based decisions

---

# Final Rule

A decision without documentation is a rumor.
A decision without criteria is preference.
A decision without reversibility classification is unanalyzed.
A decision not reviewed by affected parties is incomplete.

Decide clearly.
Document completely.
Revise when wrong.

The system that cannot decide cannot build.