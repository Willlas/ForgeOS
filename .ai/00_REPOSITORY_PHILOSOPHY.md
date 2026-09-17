# Repository Philosophy

Version: 1.0

Status:

Draft

---

# Purpose

This repository is not merely a collection of source files.

It is an engineering knowledge base.

Its primary goal is preserving reasoning.

The software being developed is temporary.

The engineering knowledge is permanent.

Every commit should leave the repository in a better state than before.

---

# Repository as External Memory

LLMs forget.

Repositories do not.

Therefore:

The repository must become the long-term memory of every engineering decision.

Conversations expire.

Context windows compact.

Sessions end.

Repository history remains.

Every important discovery should become repository knowledge.

---

# Repository Before Conversation

Never assume future agents will have access to previous conversations.

Assume they will only have access to this repository.

If knowledge is important:

Write it down.

---

# Source of Truth

The following order defines authority.

1. Repository documentation

2. ADR documents

3. Project state

4. Tests

5. Source code

6. Conversation

If repository documentation contradicts the conversation,

the repository wins.

---

# Engineering Over Prompting

This repository should never depend on prompt engineering.

It should depend on engineering.

Prompts are temporary.

Architecture is permanent.

---

# Long-Term Thinking

Every implementation should answer:

Will this still make sense six months from now?

If not,

consider redesigning.

---

# Simplicity

Simple systems survive.

Complex systems fail.

Prefer:

Small interfaces.

Small modules.

Small responsibilities.

Small commits.

Simple abstractions.

---

# Replaceability

Nothing should be irreplaceable.

Providers should be replaceable.

Schedulers should be replaceable.

Models should be replaceable.

Tools should be replaceable.

Even the orchestrator should eventually be replaceable.

---

# Observable Systems

Invisible software cannot be debugged.

Every important action should generate events.

Every event should become observable.

Everything observable becomes measurable.

Everything measurable becomes improvable.

---

# Reproducibility

Every experiment should be reproducible.

Every benchmark should be reproducible.

Every bug should be reproducible.

If another engineer cannot reproduce it,

the repository is missing information.

---

# Experiments

Never experiment inside production code.

Create isolated experiments.

Document them.

Measure them.

Only then integrate successful ideas.

---

# Documentation First

Code explains HOW.

Documentation explains WHY.

Never replace one with the other.

---

# Repository Evolution

The repository should become more intelligent over time.

Knowledge accumulates.

Architecture improves.

Documentation expands.

Technical debt decreases.

The repository itself becomes an engineering assistant.

---

# Future Contributors

Always assume the next contributor knows nothing.

Documentation should eliminate unnecessary assumptions.

If onboarding requires previous conversations,

the documentation is incomplete.

---

# AI Collaboration

Future contributors may be:

Humans.

LLMs.

Autonomous agents.

Schedulers.

External tooling.

The repository should support all of them equally.

---

# Engineering Integrity

Never fake results.

Never fake benchmarks.

Never fake performance.

Never fake tests.

Unknown is preferable to incorrect.

Evidence is preferable to confidence.

---

# Final Principle

Leave the repository in a better condition than you found it.

Always.