# Experiments

Version: 1.0

Status: Draft

---

# Purpose

This document defines the role, structure, lifecycle, and governance of experiments in the Autonomous Engineering Runtime.

Experiments convert uncertainty into engineering knowledge.
Without experiments, decisions remain opinions.

Every significant choice SHOULD be validated by evidence.
When evidence is unavailable, experiments create it.

---

# Philosophy

## Hypothesis-Driven Engineering

Engineering decisions without experimental validation are opinions disguised as facts.

Format:
"We believe [decision] will produce [measurable outcome] because [rationale]."

If you cannot state the hypothesis, you are not doing an experiment.
You are doing guesswork.

---

## Experiments Create Knowledge

Experiments do not prove correctness.
Experiments reduce uncertainty.

Every experiment produces:
- Evidence (quantitative or qualitative)
- A conclusion (supported/rejected/inconclusive)
- Knowledge entries (if validated)
- Anti-patterns (if failure reveals new failure mode)

An experiment that ends without knowledge capture has failed.

---

## All Experiments Are Permanent

Experiments are repository artifacts.
They survive providers, sessions, and contributors.

Even failed experiments have value:
- They prevent others from repeating the same mistake
- They provide comparison baselines
- They document the engineering evolution

Never delete experiments.
Archive or classify them instead.

---

# When To Experiment

## Required Experiments

Experiments are mandatory when:

### Technology Selection

No experiment when you already know.
Experiment when choosing between unknowns.

Example:
"Compare Provider A vs Provider B on dimension X before choosing."

---

### Architecture Validation

When an architectural assumption cannot be validated through analysis alone.

Example:
"Can the scheduler handle 1000 concurrent tasks with p99 < 50ms?"

Cannot be determined through code review.
Must be measured.

---

### Performance Claims

Any performance claim requires experimental evidence.

"I think this is faster" → Not acceptable.
"This measured 23% faster under these conditions." → Acceptable.

---

### Provider Behavior

When provider limitations are unknown or unverified.

Example:
"What happens when Ollama exceeds context limit? Silent truncation? Error?"

Cannot be assumed.
Must be tested.

---

## Not Required (Analysis Only Sufficient)

When existing documentation is authoritative and current.

Example:
"TypeScript interface constraints are determined by the language specification."
No experiment needed. Read the spec.

---

# Experiment Structure

## Required Fields

### Header

- Identifier (EXP-NNNN)
- Title
- Author (agent/session identifier)
- Date created
- Status
- Related ADR(s)
- Related research

### Hypothesis

Clear, falsifiable statement.

Good: "Provider B will produce 15% fewer parsing errors than Provider A."
Bad: "Provider B should work better."

### Setup

Must be reproducible by another agent with no additional context.

Required:
- Hardware specification
- Software environment
- Dependencies
- Configuration
- Dataset (if applicable)
- Provider configuration

### Methodology

Step-by-step procedure.

Must answer:
- What exactly was tested?
- How was it tested?
- What measurements were taken?
- What was the control?
- What was the variable?

### Results

Raw data first.
Analysis second.

Include:
- All measurements (not only best/worst)
- Error rates
- Latency distributions (p50, p95, p99)
- Memory profiles
- Token consumption
- Failure modes observed

### Analysis

What do the results tell us?

Include:
- Statistical significance (if applicable)
- Confounding factors identified
- Limitations of the experiment
- Edge cases discovered

### Conclusion

Supported | Rejected | Inconclusive

If inconclusive, state what additional work is needed.

### Recommendation

Integrate → The evidence supports adoption.
Reject → The evidence opposes adoption.
Continue → Additional experimentation required.

### References

Related ADRs.
Related experiments.
Related knowledge entries.
Source documents.

---

# Experiment Types

## Comparison Experiments

Compare two or more alternatives under identical conditions.

Example:
"Provider A vs Provider B on task type X."

Requirements:
- Identical input for all alternatives
- Identifiable variables (which provider differs)
- Sufficient samples for confidence
- Both run on same hardware

---

## Capability Experiments

Determine what a system CAN do.

Example:
"What is the maximum context length before silent truncation?"

Requirements:
- Progressive intensity testing
- Clear boundary identification
- Edge case documentation

---

## Performance Experiments

Measure HOW WELL a system performs.

Example:
"What throughput can the scheduler achieve under load?"

Requirements:
- Baseline established
- Load profile defined
- Duration sufficient for stability
- Confidence intervals reported

---

## Limitation Experiments

Determine what a system CANNOT do.

Example:
"Can Provider A handle concurrent model loading?"

Requirements:
- Boundary testing
- Failure mode documentation
- Recovery behavior (if applicable)

---

## Regression Experiments

Verify that a change produced the expected improvement.

Example:
"After refactoring the scheduler, does queue latency decrease?"

Requirements:
- Pre-change baseline exists
- Identical test conditions
- Both results documented

---

# Experiment Lifecycle

## Stage 1: Proposal

Created when an uncertain decision blocks implementation.

Proposal includes:
- Question being answered
- Why analysis is insufficient
- Proposed methodology (high level)
- Estimated cost (time, tokens, resources)
- Priority

Decision gate: Engineering Intelligence approves or modifies the proposal.

---

## Stage 2: Setup

Detailed experimental configuration.

Includes:
- Exact reproducibility steps
- All configuration files
- Data generation procedures
- Environment specification

Decision gate: Methodology review (peer or automated).

---

## Stage 3: Execution

Run the experiment.

Rules:
- Record everything
- Do not stop early because results "look obvious"
- Document deviations from methodology
- Capture failure modes

---

## Stage 4: Analysis

Transform raw data into conclusions.

Process:
1. Data cleaning (document what was excluded and why)
2. Statistical analysis
3. Confounding factor identification
4. Conclusion formation

---

## Stage 5: Integration

Validate results produce actionable engineering artifacts.

Required outputs:
- Experiment report (permanent)
- Knowledge entry (if validated)
- ADR update (if architectural implication)
- Anti-pattern documentation (if failure revealed new pattern)
- Follow-up tasks (if inconclusive)

---

## Stage 6: Classification

Every completed experiment is classified:

| Status | Meaning | Action |
|---|---|---|
| Integrated | Adopted into production | Reference in ADR/knowledge |
| Validated | Evidence supports hypothesis | Archive as reference |
| Rejected | Evidence opposes hypothesis | Archive as anti-pattern reference |
| Inconclusive | Unable to determine | Create follow-up experiment |
| Obsolete | Superseded by newer experiment | Archive, do not delete |
| Deprecated | No longer relevant | Archive, do not delete |

---

# Experiment Governance

## Engineering Intelligence Role

Monitoring:
- Are critical decisions made without experimental evidence?
- Are there expired experiments (proposed but never executed)?
- Are there obsolete experiments that clutter understanding?

Periodic review:
- Experiments older than 60 days should be reviewed
- Superseded experiments should be marked
- Inconclusive experiments should get follow-up tasks

---

## Cost Control

Experiments have costs.
Engineering Intelligence evaluates:

| Estimated Cost | Approval Required |
|---|---|
| Low (< 1 min, < 1K tokens) | Autonomous |
| Medium (1-5 min, 1K-10K tokens) | Scheduler approval |
| High (> 5 min, > 10K tokens) | Engineering Intelligence review |

High-cost experiments MUST have:
- Clear hypothesis
- Maximum measured cost bounded
- Defined stop condition

---

# Experiment Templates

## Comparison Template

```markdown
# EXP-NNNN: [A] vs [B] — [Dimension]

## Hypothesis
We believe [A] will outperform [B] on [dimension] because [rationale].

## Setup
- Hardware: [...]
- Environment: [...]
- Dataset: [...]
- Configuration A: [...]
- Configuration B: [...]

## Methodology
1. [Step 1]
2. [Step 2]

## Results

### Metric: [Name]
| Run | A | B | Delta |
|-----|---|---|-------|
| 1   |   |   |       |
| 2   |   |   |       |
| 3   |   |   |       |

Average: A = X, B = Y, delta = Z%

## Analysis
[Statistical analysis]

## Conclusion
Supported | Rejected | Inconclusive

## Recommendation
Integrate A | Integrate B | More data needed

## References
- Related ADRs: [ADR-NNNN]
- Related experiments: [EXP-NNNN]
```

---

## Capability Template

```markdown
# EXP-NNNN: Capabilities of [System/Provider]

## Hypothesis
[System] can handle [capability] up to [boundary].

## Setup
- Hardware: [...]
- Environment: [...]
- Test data: [...]

## Methodology
Progressive testing:
1. [Minimum test case]
2. [Medium test case]
3. [Large test case]
4. [... continue until boundary or failure]

## Results
| Test | Input Size | Result | Notes |
|------|-----------|--------|-------|
| 1    |           |        |       |
| 2    |           |        |       |
| 3    |           |        |       |

## Boundary Identified
Maximum: [...]
Failure mode at: [...]

## Conclusion
Supported | Rejected | Inconclusive

## References
- Related ADRs: [ADR-NNNN]
```

---

## Performance Template

```markdown
# EXP-NNNN: Performance Baseline — [Component]

## Hypothesis
[Component] achieves [metric] of [target] under [conditions].

## Setup
- Hardware: [...]
- Environment: [...]
- Load profile: [...]
- Duration: [...]

## Methodology
1. [Warm-up procedure]
2. [Measurement procedure]
3. [Analysis procedure]

## Results

### Primary Metric: [Name]
- Minimum: X
- Maximum: Y
- Average: Z
- p50: X
- p95: Y
- p99: Z

### Secondary Metrics
- [Metric 2]: [...]
- [Metric 3]: [...]

## Analysis
[Interpretation of results]

## Conclusion
Meets target | Does not meet target | Inconclusive

## References
- Related ADRs: [ADR-NNNN]
```

---

# Experiment Repository

## Location

Experiments live in `experiments/`.

Directory structure:
```
experiments/
├── README.md (index of all experiments)
├── EXP-0001-title/
│   ├── hypothesis.md
│   ├── methodology.md
│   ├── results/
│   │   ├── raw-data.csv
│   │   └── analysis.md
│   └── conclusion.md
├── EXP-0002-title/
│   ...
```

---

## Experiment Index

`experiments/README.md` contains:

| ID | Title | Status | Date | Related ADR | Recommendation |
|----|-------|--------|------|-------------|----------------|
| EXP-0001 | [...] | Integrated | [...] | ADR-NNNN | Integrate |
| EXP-0002 | [...] | Rejected | [...] | ADR-NNNN | Reject |

---

# Anti-Patterns

## Confirmation Bias Experimentation

Designing experiments only to confirm pre-existing beliefs.

Bad:
"Let me find evidence that supports my choice."

Good:
"Let me design an experiment that could prove my hypothesis wrong."

Rule: Every experiment MUST include disconfirmation criteria.

---

## Invisible Experiments

Experiments that produce no repository artifacts.

If results cannot be reproduced by reading the repository, they were never experiments.

Rule: All experimental data persists in the repository.

---

## Abandoned Experiments

Experiments started but never concluded.

Red flag: More than 2 inconclusive experiments on the same question.

Action:
- Create follow-up experiment
- Or make a decision based on existing evidence
- Document why further experimentation is not valuable

---

## Cost-Unbounded Experiments

Experiments without defined cost limits.

Rule: Every high-cost experiment MUST have:
- Maximum token budget
- Maximum time budget
- Stop condition

If stop condition not met when budget exhausted:
- Report what was measured
- Draw conclusion from partial data
- Mark as inconclusive if insufficient

---

## Post-Experiment Amnesia

Experiments that complete but produce no knowledge update.

The experiment produced evidence.
Evidence became conclusion.
Conclusion SHOULD become knowledge.

If the conclusion is not captured, the experiment had limited value.

---

# Related Documents

- `07_ENGINEERING_INTELLIGENCE.md` - Experiment intelligence classification
- `08_KNOWLEDGE_SYSTEM.md` - Knowledge from experiments
- `10_WORK_GRAPH.md` - Experiment nodes in work graph
- `11_DOCUMENTATION.md` - Experimental documentation (Tier 5)
- `12_SUCCESS_CRITERIA.md` - Phase 5 experiment criteria
- `13_ERROR_RECOVERY.md` - Error investigation experiments

---

# Final Rule

An experiment without a conclusion is a debt.
A conclusion without knowledge capture is waste.
Knowledge without integration is orphaned.

Every experiment SHOULD make future engineering faster and more confident.

If it does not, the experiment was expensive curiosity.
And curiosity without engineering value is entertainment, not engineering.