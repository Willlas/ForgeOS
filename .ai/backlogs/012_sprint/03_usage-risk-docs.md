# Epic 3 — Usage and risk documentation

> Atomized tasks: [03_usage-risk-docs-tasks.md](03_usage-risk-docs-tasks.md)

## Objective

Document the validated workflows realistically and make the project risks explicit so it is not presented as more complete than it is.

## User stories

### US-07: The validated console flow is documented
**As a developer**
**I want** the actual grant / preview / approve / apply flow documented
**so that** I can reproduce the validated workflow in a real run.

**Acceptance criteria:**
- Commands are documented accurately.
- Examples are based on a real working flow.
- Validated behavior is clearly separated from unvalidated behavior.

### US-08: Known gaps and risks are visible
**As a maintainer**
**I want** a risk and gap register
**so that** expectations are honest and visible.

**Acceptance criteria:**
- Known gaps are listed.
- Risks are named and mitigated.
- Dependencies are explicit.
- The document is short and actionable.

## Tasks

- Capture the actual validated CLI flow and write it in practical terms.
- Record major known gaps and avoid overclaiming.
- Add a short risk table to the sprint docs.
- Ensure any example is checked against the current branch behavior.
