# Epic 4 — Next milestone preparation

> Atomized tasks: [04_next-milestone-tasks.md](04_next-milestone-tasks.md)

## Objective

Define the next milestone after Sprint 12 so the project has a clear forward direction.

**Milestone:** Sprint 13 — CLI reliability

**Objective (one sentence):** Sprint 13 makes the validated grant → preview → approve → apply CLI path trustworthy for pre-MVP use by closing the Known Risks register defects that affect it — starting with CLI error propagation, where daemon rejections print `[object Object]` instead of the real error message — without adding any new capability.

## User stories

### US-09: The next milestone has a concrete objective
**As a team**
**I want** the next milestone to be named and scoped
**so that** the following sprint has a clear objective.

**Acceptance criteria:**
- [x] Next milestone has a clear name.
- [x] Objective is defined in one short paragraph.
- [x] Deliverables and exit criteria are described.

### US-10: The next milestone has prioritized tasks
**As a technical lead**
**I want** the next sprint to be actionable
**so that** we can execute without re-planning from scratch.

**Acceptance criteria:**
- [x] Tasks are grouped by priority.
- [x] Critical path is visible.
- [x] Scope is narrow enough to execute within a sprint.

## Tasks

- [x] Define the next milestone in one sentence. — [04_next-milestone-tasks/01_define-the-next-milestone-in-one-sentence.md](04_next-milestone-tasks/01_define-the-next-milestone-in-one-sentence.md)
- [x] List the expected deliverables. — [04_next-milestone-tasks/02_write-the-milestone-deliverables.md](04_next-milestone-tasks/02_write-the-milestone-deliverables.md)
- [x] Write the exit criteria. — [04_next-milestone-tasks/03_define-exit-criteria.md](04_next-milestone-tasks/03_define-exit-criteria.md)
- [x] Prioritize the work into a critical path. — [04_next-milestone-tasks/04_prioritize-the-work-into-a-critical-path.md](04_next-milestone-tasks/04_prioritize-the-work-into-a-critical-path.md)
- [x] Narrow the scope to the realistic next step after documentation alignment. — [04_next-milestone-tasks/05_narrow-the-scope-to-a-realistic-sprint-sized-outcome.md](04_next-milestone-tasks/05_narrow-the-scope-to-a-realistic-sprint-sized-outcome.md)
- [x] Validate the next milestone against the current repo state. — [04_next-milestone-tasks/06_validate-the-next-milestone-against-the-current-repo-state.md](04_next-milestone-tasks/06_validate-the-next-milestone-against-the-current-repo-state.md)
- [x] Final backlog review for the next milestone. — [04_next-milestone-tasks/07_final-backlog-review-for-the-next-milestone.md](04_next-milestone-tasks/07_final-backlog-review-for-the-next-milestone.md)

### Sprint 13 prioritization (US-10)

**Critical path** (ordered — each item lands before any item that depends on it):

1. **CLI error propagation fix** — `packages/cli/src/index.ts` / `ipc-client.ts` (Deliverable 1; the only code item the register names as a "small, incremental change"; no dependencies).
2. **Provider state in `aer status`** — `packages/cli/src/index.ts` (Deliverable 2; after item 1 so same-file diffs stay sequential).
3. **Local-Ollama prerequisite documented** — `README.md` (Deliverable 3; after item 2 so the docs describe implemented behavior).
4. **Definition-of-Done closure** (not a deliverable) — update the two `PROJECT_STATE.md` Known Risks rows; stable commit on the sprint branch.

**Secondary path (stretch):**

- **None** — all three deliverables are on the critical path because each backs an Exit criterion and the critical path alone must satisfy every Exit criterion; no secondary item exists, so none is a prerequisite for any critical item (0 of 3 deliverables on the secondary path, within the 50% cap).

**Out of scope** (repeats README `## MVP boundary` exclusions):

- Additional provider backends (OpenAI, Anthropic) — interface types only, not implemented.
- Multi-agent coordination as a validated end-to-end workflow — implemented and unit-tested, not yet a validated product path.
- VS Code extension and GUI — design-only work from Sprints 10–11, not MVP components.
- No Sprint 13 item may depend on a future sprint completing first — every item builds on the current repo state (build passing, 402/402 tests, `sprint13` branch); the milestone stays the next realistic engineering slice over the validated CLI flow.
