# Documentation Standards

Version: 1.0

Status: Draft

---

# Purpose

This document defines what must be documented, when documentation must be created, how it must be structured, and what must never be documented.

Documentation is not optional.
Documentation is not post-production.
Documentation is part of the implementation contract.

Code explains HOW.
Documentation explains WHY.
Neither substitutes the other.

---

# When To Document

## Documentation Is Continuous

Every engineering session MUST produce documentation proportional to its impact.

Trivial changes require minimal documentation.
Architectural changes require comprehensive documentation.
Experiments require experimental reports.
Research requires research summaries.

## The Rule

If an engineering decision cannot be reproduced from repository content alone,
the repository is missing information.

Never assume future contributors have access to previous conversations.

---

# What To Document

## Tier 1: Mandatory Documentation

Every implementation change MUST include:

### Implementation Documentation

- Source code with inline documentation
- Interface contracts (input/output/specifications)
- Module-level docstrings explaining purpose and responsibilities

### Project State

- `PROJECT_STATE.md` updated after every session
- Current progress
- Blockers
- Completed work
- Next priorities

### Commit Messages

- Conventional Commits format
- Explain WHY, not only WHAT
- Reference related ADRs when applicable

---

## Tier 2: Feature Documentation

Every feature MUST include:

- Purpose statement
- Usage examples
- Limitations
- Known edge cases
- Related tests
- Performance characteristics (if applicable)

Location: `docs/features/` or relevant subdirectory.

---

## Tier 3: Architectural Documentation

Every architectural decision MUST include:

### ADR Document

- Title with unique identifier
- Context (why this exists)
- Decision (what was chosen)
- Consequences (trade-offs, both positive and negative)
- Alternatives considered
- Related documents
- Related source code
- Status (draft, accepted, deprecated, superseded)

Location: `docs/ADR/`

### Architecture Decision Record Format

```markdown
# ADR-NNNN: [Title]

## Status
[Draft | Accepted | Deprecated | Superseded]

## Context
What is the situation requiring this decision?

## Decision
What decision has been made?

## Consequences
### Positive
- [Benefit 1]
- [Benefit 2]

### Negative
- [Risk 1]
- [Risk 2]

## Alternatives Considered
1. [Alternative 1] - Rejected because: [...]
2. [Alternative 2] - Rejected because: [...]

## References
- Related ADRs: [ADR-NNNN]
- Related source code: [path]
- Related experiments: [experiment reference]
```

---

## Tier 4: Research Documentation

Every research activity MUST include:

### Research Summary

- Question being investigated
- Methodology used
- Sources consulted
- Findings (with evidence)
- Conclusions
- Confidence level
- Impact on implementation
- Open questions

Location: `docs/research/` or relevant subdirectory.

### Research Format

```markdown
# Research: [Title]

## Question
What are we trying to learn?

## Methodology
How did we investigate?

## Sources
1. [Source 1] - URL/Reference
2. [Source 2] - URL/Reference

## Findings
- Finding 1 (with evidence)
- Finding 2 (with evidence)

## Conclusions
What do the findings tell us?

## Confidence
[High | Medium | Low]

## Implementation Impact
Does this change any architectural decisions?

## Open Questions
What remains unknown?

## References
- Related ADRs: [ADR-NNNN]
- Related experiments: [experiment reference]
```

---

## Tier 5: Experimental Documentation

Every experiment MUST include:

### Experiment Report

- Hypothesis
- Setup (hardware, software, dependencies)
- Methodology
- Raw data/results
- Analysis
- Conclusion
- Recommendation (integrate, reject, continue)
- Reproduction instructions

Location: `experiments/`

### Experiment Format

```markdown
# Experiment EXP-NNNN: [Title]

## Hypothesis
What are we testing?

## Setup
- Hardware: [...]
- Software: [...]
- Dependencies: [...]

## Methodology
How did we test this?

## Results
[Raw data, measurements, observations]

## Analysis
What do the results tell us?

## Conclusion
Supported | Rejected | Inconclusive

## Recommendation
Integrate into production | Reject | Continue investigation

## Reproduction
Steps to reproduce:
1. [...]
2. [...]

## References
- Related ADRs: [ADR-NNNN]
- Related knowledge entries: [knowledge reference]
```

---

# Documentation Types And Their Distinct Purposes

## ADR (Architecture Decision Record)

Purpose: Records engineering decisions that affect system structure.

When to create:
- Component boundaries defined
- Interface contracts established
- Technology choices made
- Architectural patterns selected
- Replacement strategies defined

Never use for:
- Implementation details
- Temporary decisions
- Trivial choices
- Prompt wording

Example:
"Use capability-based scheduling instead of agent-type scheduling."

---

## Research Document

Purpose: Records investigation activities and their outcomes.

When to create:
- Before implementation of unknown technology
- When comparing alternatives
- When reverse engineering existing systems
- When understanding provider limitations

Never use for:
- Recording known facts
- Repeating documentation
- Subjective opinions without evidence

Example:
"Research: Ollama concurrent model loading limits."

---

## Knowledge Entry

Purpose: Stores validated engineering understanding.

When to create:
- After experiment completion
- After benchmark execution
- After production incident resolution
- After pattern identification
- After lesson learned

Never use for:
- Hypotheses (mark as hypothesis)
- Unverified observations
- Temporary notes

Example:
"Knowledge: Provider A has a 64K context limit that causes silent truncation."

---

## Project State

Purpose: Records current execution state.

Updated by: Every engineering session.

Never use for:
- Architecture decisions
- Research findings
- Engineering knowledge
- Long-term planning

Example:
"The scheduler interface is defined. Implementation pending."

---

## Logs

Purpose: Human-readable execution history.

When to create:
- Session start/end
- Major decisions
- Failed operations
- Recovery events

Never use for:
- Machine-machine communication (use Events)
- Micro-log everything (be selective)

---

# What Never To Document

## Prompt Wording

Prompts are temporary.
Architecture is permanent.

Never put prompt content in ADRs.
Never put prompt content in Knowledge entries.

If prompt content matters, it belongs as:
- Configuration
- Template file
- Tool definition

Not documentation.

---

## Implementation Details

Documentation explains WHY.
Code explains HOW.

Never document:
- Variable names (unless non-obvious)
- Control flow (code is self-explanatory)
- Algorithm implementation (code is the reference)
- Method signatures (interface is the reference)

---

## Temporary State

Never document:
- Current task assignments
- Active experiments (use project state instead)
- Session-specific observations
- Personal notes

Temporary state belongs in:
- PROJECT_STATE.md
- TODO.md
- Task properties

Not permanent documentation.

---

## Chat History

Conversations expire.
Repositories endure.

If knowledge from a conversation matters,
it MUST be written to the repository before the session ends.

Assumption: Future contributors have no access to chat history.

---

## Subjective Opinions Without Evidence

"X is better than Y" is an opinion.

"X performed 23% faster in benchmark B with dataset D" is evidence.

Document evidence.
Reference opinions only as motivation.

---

# Documentation Versioning

## Document Status Lifecycle

All long-lived documents follow:

Draft → Review → Accepted → Deprecated → Superseded

### Draft

Working document. Not yet reviewed.

### Review

Under active review. Changes expected.

### Accepted

Reviewed and approved. Authoritative source.

### Deprecated

No longer recommended. Still relevant for historical context.

### Superseded

Replaced by a newer document. Reference the replacement.

---

## Document Identifiers

ADR documents: `ADR-NNNN`
Research documents: `RES-NNNN`
Knowledge entries: `KNW-NNNN`
Experiments: `EXP-NNNN`
RFC documents: `RFC-NNNN`

Numbering is sequential and monotonic.
Numbers are never reused.

---

# Templates

## ADR Template

See "Tier 3: Architectural Documentation" above.

---

## Research Template

See "Tier 4: Research Documentation" above.

---

## Experiment Template

See "Tier 5: Experimental Documentation" above.

---

## Project State Template

Location: `PROJECT_STATE_TEMPLATE.md`

Purpose: Standardized format for recording execution state.

Required fields:
- Mission alignment
- Current objectives
- Active tasks
- Completed work
- Blockers
- Next priorities
- Metrics summary

See `PROJECT_STATE_TEMPLATE.md` for the full template.

---

# Documentation Locations

| Document Type | Location | Prefix |
|---|---|---|
| ADRs | `docs/ADR/` | `ADR-` |
| RFCs | `docs/RFC/` | `RFC-` |
| Research | `docs/research/` | `RES-` |
| Experiments | `experiments/` | `EXP-` |
| Knowledge | `.ai/08_KNOWLEDGE_SYSTEM.md` or knowledge entries | `KNW-` |
| Engineering Docs | `.ai/` | `NN_NAME.md` |
| Project State | Root | `PROJECT_STATE.md` |
| Logs | Runtime logs directory | N/A |

---

# Cross References

Every document MUST link to related documents.

## Required Links

### ADR Documents

- Related source code
- Related experiments
- Related research
- Superseding/superseded ADRs

### Research Documents

- Related ADRs
- Related experiments
- Open questions

### Knowledge Entries

- Source of truth (experiment, benchmark, incident)
- Confidence level
- Validation date

### Experiments

- Related ADRs
- Related research
- Recommendation outcome

---

# Documentation Quality Checklist

## Before Writing

- [ ] Does this decision require documentation?
- [ ] Which document type applies?
- [ ] Is this temporary state or durable knowledge?

## Before Committing Documentation

- [ ] Is the status correct?
- [ ] Are references accurate?
- [ ] Is evidence provided where claims are made?
- [ ] Can a future contributor understand this without chat history?
- [ ] Is the format consistent with existing documents?
- [ ] Are related documents cross-referenced?
- [ ] Is the identifier correct?

## Before Marking Complete

- [ ] Implementation exists
- [ ] Tests pass
- [ ] Documentation updated
- [ ] ADR updated (if required)
- [ ] Knowledge updated (if required)
- [ ] Project state updated
- [ ] Related experiments documented

---

# Best Practices

## Write For The Next Contributor

Assume:
- They know nothing
- They have no chat history
- They need to make the same decisions you made

Write so they can.

---

## Engineering Specifications Over Prompt Engineering

Write contracts, not prompts.

Example:

```
Provider SHALL expose:
- chat(messages) → Response
- generate(text) → Text
- countTokens(input) → Integer
```

Not:

```
Prompt: "Please act as a helpful assistant and respond to user queries..."
```

---

## RFC-Style Language

Use normative language:

| Term | Meaning |
|---|---|
| SHALL | Required. No deviation permitted. |
| MUST | Required. Same strength as SHALL. |
| SHOULD | Recommended. Justified deviations allowed. |
| MAY | Optional. Permitted but not required. |
| MUST NOT | Prohibited. No deviation permitted. |
| SHOULD NOT | Discouraged. Justified deviations allowed. |

---

## Keep Documentation Fresh

Documentation is incomplete if it diverges from reality.

After implementation:
- Update ADRs if architecture changed
- Update project state
- Update knowledge entries
- Archive obsolete experiments

---

# Anti-Patterns

## Documentation Dumping

Creating massive documents that cover everything superficially.

Instead:
- One topic per document
- Cross-reference liberally
- Keep focused scope

---

## Stale Documentation

Documents that diverge from implementation.

Worse than no documentation.

Prevention:
- Update documentation as part of implementation
- Never postpone documentation
- Review before commit

---

## Prompt Leakage

Putting prompt text inside ADRs or Knowledge entries.

Prompts are configuration.
Architecture is documentation.
Keep them separate.

---

## Duplicate Documentation

Same information in multiple documents with inconsistent updates.

Instead:
- One source of truth per topic
- Reference, don't duplicate
- When duplicates exist, merge them

---

## Orphaned Documentation

Documents that reference nothing and are referenced by nothing.

Every document MUST link to:
- Related documents
- Related source code
- Related experiments

Isolated documentation fails.

---

# Process Integration

## During Development Lifecycle

### Phase 1 - Observe
No documentation required.

### Phase 2 - Understand
Create: Preliminary observations notes (if needed)

### Phase 3 - Research
Create: Research document (`RES-NNNN`)

### Phase 4 - Design
Create: ADR document(s) (`ADR-NNNN`)

### Phase 5 - Experiment
Create: Experiment report (`EXP-NNNN`)

### Phase 6 - Implementation
Update: Source code documentation
Update: Related ADRs if architecture changed

### Phase 7 - Verification
No new documentation required.

### Phase 8 - Review
Update: Documentation gaps identified during review

### Phase 9 - Documentation
Create/Update: All affected documents

### Phase 10 - Commit
Include documentation changes with implementation.

### Phase 11 - Project Memory
Update: PROJECT_STATE.md
Update: TODO.md
Update: STATUS.md

---

# Related Documents

- `00_REPOSITORY_PHILOSOPHY.md` - Repository as external memory
- `01_MISSION.md` - Documentation policy
- `02_ENGINEERING_PRINCIPLES.md` - Principle 18: Document Decisions
- `03_DEVELOPMENT_LIFECYCLE.md` - Phase 9: Documentation
- `04_ARCHITECTURE_PHILOSOPHY.md` - Architecture documentation
- `07_ENGINEERING_INTELLIGENCE.md` - Documentation intelligence
- `08_KNOWLEDGE_SYSTEM.md` - Knowledge categorization and evolution
- `10_WORK_GRAPH.md` - Documentation nodes in work graph
- `14_EXPERIMENTS.md` - Experimental documentation

---

# Final Rule

Documentation without evidence is opinion.
Documentation without references is isolated.
Documentation without updates is deception.

Write it right.
Keep it current.
Link it to everything.