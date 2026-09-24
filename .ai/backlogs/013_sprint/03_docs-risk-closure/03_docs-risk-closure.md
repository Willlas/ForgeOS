# Epic 3 — Documentation & risk-register closure

> Atomized tasks: [03_docs-risk-closure-tasks.md](03_docs-risk-closure-tasks.md)

## Objective

Close the loop on the two `Known Risks` register rows (CLI error reporting and provider health) and document the local-Ollama prerequisite, so the sprint's Definition of Done is satisfied with a stable commit.

## Background (grounded in the repo)

- `README.md` `## MVP boundary` and the Ollama provider bullet do not yet state the local-Ollama prerequisite.
- `PROJECT_STATE.md` `# Known Risks` has two rows to close: "CLI error reporting" and "Provider health / local inference".
- `ROADMAP.md` Definition of Done requires: build + CLI tests green, the daemon-message test, the `aer status` provider line, the README prerequisite, the two closed register rows, and a stable commit on the sprint branch.

## User stories

### US-05: The local-Ollama prerequisite is documented
**As a new user**
**I want** the README to state that Ollama must be running locally at `http://localhost:11434`
**so that** I know why provider initialization or health checks fail when it is not.

**Acceptance criteria:**
- The README explicitly names the prerequisite: Ollama running at `http://localhost:11434` is required for provider initialization and health checks.
- It is placed where provider health / the usage flow / the MVP boundary is described.
- No new capability is implied; the Ollama provider is still labeled **experimental**.

### US-06: The Known Risks register reflects the closed defects
**As a project maintainer**
**I want** `PROJECT_STATE.md` to reflect the two closed defects
**so that** the risk register stays honest and resumable.

**Acceptance criteria:**
- The "CLI error reporting" row reflects the Epic 1 fix (rejection message now surfaced, regression-tested).
- The "Provider health / local inference" row reflects that provider state is now surfaced in `aer status` and the prerequisite is documented in the README.
- No other register rows are altered.
- The "Last Updated" / sprint reference is consistent with the `sprint13` branch.

## Tasks

- [x] Document the local-Ollama prerequisite in the README.
- [x] Update the two `PROJECT_STATE.md` Known Risks rows.
- [x] Cut a stable commit on the `sprint13` branch containing all three epics.

## Out of scope

- Rewriting the README beyond the prerequisite statement.
- Closing any Known Risks row other than the two named above.
- Any product feature work.
