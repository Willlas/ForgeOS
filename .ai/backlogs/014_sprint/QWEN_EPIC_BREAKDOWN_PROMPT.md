# Qwen Epic Breakdown Prompt

You are acting as a senior product/project engineer for this repository. Your task is to convert the current Sprint 14 scope into a clean, prioritized set of epics and implementation-ready work items.

## Repository context
- Monorepo: TypeScript + Node.js
- Main packages:
  - `packages/cli`
  - `packages/runtime`
- The project is a pre-MVP runtime/CLI system with a secure workflow:
  - `grant -> preview -> approve -> apply`
- The validated operational path is the priority. The goal is not to add new product features, but to harden and validate the existing CLI workflow.

## Source material to use
Use the repo truth as your main source of reference, especially:
- `README.md`
- `.ai/backlogs/014_sprint/README.md`
- `.ai/backlogs/014_sprint/cli-validation-plan.md`
- relevant tests under `packages/cli/src/__tests__` and `packages/runtime/src/__tests__`

## Hard constraints
- Do not invent new product features.
- Stay inside the validated CLI path and the scope of validation/hardening.
- Base every epic on current evidence in the repo.
- Preserve the operational focus: robustness, deterministic exit behavior, error quality, provider status handling, and testability.
- Prefer a practical backlog format with epics and tasks that can be executed in the repository.

## Objective
Produce a high-quality epic breakdown for Sprint 14 based on the current repository state. The output must help a human or another agent continue implementation with clarity and minimal ambiguity.

## Required output format
Return the result as a structured backlog in Markdown with the following sections:

1. Executive summary
2. Epic list with priorities
3. For each epic:
   - Epic ID
   - Epic title
   - Goal
   - Why this matters
   - User/operator impact
   - Scope
   - Out of scope
   - Acceptance criteria
   - Risks / assumptions
   - Dependencies
   - Proposed tasks
4. Suggested implementation order
5. Test strategy
6. Observed repo evidence that supports the epic breakdown

## Epic themes to cover
At minimum, include epics around:
- CLI validation matrix coverage
- deterministic error handling and no `[object Object]` leakage
- provider reachability / daemon status behavior
- duplicate approval and single-use enforcement
- automation of operator smoke scenarios in Vitest
- documentation and operator-runbook clarity

## Quality bar
- Keep the language concrete and implementation-oriented.
- Use the existing repo terminology and workflow names.
- Prefer short, actionable tasks that can map to existing tests or new tests.
- Identify the highest-value first epic and explain why it should come first.
- Do not propose speculative infrastructure or unsupported platforms.

## Final instruction
Generate the epic breakdown in English, in a production-ready engineering format, aligned with the repository's actual condition and current Sprint 14 handoff state.
