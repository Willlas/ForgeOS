# GLM handoff prompt for Sprint 13

## Context

We are working in a TypeScript monorepo for Aer Runtime. The repository has reached a stable stage after Sprint 12, where documentation and sprint framing were reconciled and the project story is now more honest and aligned with the actual implementation.

The main branch is `develop`, and the current active branch is `sprint13`.

## Current state summary

- The project is a modular TypeScript runtime for autonomous engineering workflows.
- The runtime and CLI structure are implemented and build cleanly.
- The key validated flow is the secure workspace interaction path:
  - grant
  - preview
  - approve
  - apply
- The repository is in a pre-MVP state, not a full product-ready state.
- Important work is already implemented, but the project still needs disciplined milestone definition and execution.

## What was completed in Sprint 12

- README updated to reflect the actual maturity of the repo.
- PROJECT_STATE aligned with the current branch and status.
- ROADMAP updated to reflect the real sprint progression.
- Sprint backlog split into manageable user stories and task files.
- The project narrative became more honest about what is validated, experimental, and planned.

## What we need now

Please treat this as the handoff brief for Sprint 13.

Your task is to plan and execute the next milestone in a pragmatic, realistic way.

## Main objectives

1. Review the repository and identify the next highest-value milestone after Sprint 12.
2. Define what should be built in this sprint with a realistic scope.
3. Break the work into epics, user stories, and concrete tasks.
4. Favor a minimal but meaningful milestone over a broad product vision.
5. Keep outputs grounded in the repository’s actual implementation state.
6. Produce a clear plan with deliverables, risks, and acceptance criteria.
7. Harden the validated secure workflow by implementing end-to-end coverage for the grant → preview → approve → apply sequence.
8. Standardize CLI exit codes to make the workflow reliable and scriptable in CI/CD and automation contexts.

## Required outputs

The final result should include:

- an executive summary
- a Sprint 13 objective
- a milestone definition and scope statement
- a backlog in English
- epics, user stories, and tasks
- technical decisions and assumptions
- clear acceptance criteria
- a short list of risks and known gaps
- a recommended next implementation slice
- any documentation updates required to keep the project honest

## Recommended Sprint 13 plan

### Executive summary

Sprint 13 focuses on hardening the pre-MVP Aer Runtime by establishing robust end-to-end test coverage for the validated secure workflow and standardizing CLI exit codes. Sprint 12 successfully aligned the project narrative with its actual maturity. The next logical step is to lock in the stability of the core path, prevent regressions, and improve scriptability. This milestone ensures a reliable, observable foundation before expanding into broader product features like multi-agent coordination or additional provider backends.

### Sprint objective

To harden the validated core CLI workflow by implementing comprehensive E2E integration tests and standardizing error handling, thereby securing the pre-MVP foundation against regressions and making the CLI reliably scriptable.

### Scope

Milestone Definition: Core Flow Hardening and E2E Validation.

In Scope:
- Development of an E2E test harness for the Aer CLI.
- Automated integration tests covering the happy path and failure paths of the grant, preview, approve, and apply sequence.
- Standardization of CLI exit codes for the core commands.
- Documentation updates reflecting the new test coverage and CLI reliability.

Out of Scope:
- Multi-agent coordination validation.
- New provider backends or runtime execution engines.
- Major new product features or UI/UX overhauls.
- Refactoring of the core daemon logic beyond exit code adjustments.

### Epics

1. E2E Test Coverage for Core Workflow
2. CLI Exit Code Standardization
3. Documentation Alignment

### User stories

- As a runtime maintainer, I want an automated E2E test harness for the CLI so that I can verify the core workflow end-to-end.
- As a runtime maintainer, I want E2E tests for the happy path of the core workflow so that I can ensure grant, preview, approve, and apply work together seamlessly.
- As a runtime maintainer, I want E2E tests for the failure paths so that I can ensure the system handles rejection and invalid state transitions gracefully.
- As a DevOps engineer, I want the CLI to return standardized exit codes for the core workflow commands so that I can reliably script the runtime in CI/CD pipelines.
- As a project planner, I want the repository documentation updated to reflect the Sprint 13 hardening efforts so the project story remains accurate and honest.

### Acceptance criteria

- The grant → preview → approve → apply workflow is fully covered by automated E2E tests that pass reliably in the CI pipeline.
- A rejected workflow is tested and behaves predictably, returning a non-zero exit code.
- CLI commands return consistent, standard exit codes (0 for success, specific non-zero codes for failures).
- All new tests pass in the CI pipeline without flakiness.
- README accurately reflects how to execute the test suite.
- No existing functionality in the validated core path is broken.

### Risks

- Test environment flakiness.
- Hidden state dependencies.
- Scope creep during E2E debugging.
- Exit code breaking changes for scripts or automation.

### Recommended next implementation slice

Start with the E2E harness setup and initial happy-path tests. Once the CLI can be reliably invoked and evaluated in a TypeScript test script, proceed with the failure-path tests and exit-code standardization. This provides immediate visibility into the stability of the validated flow and sets the foundation for the rest of the sprint.

## Constraints

- Be realistic: the project is not a full MVP yet.
- Do not oversell the maturity of the runtime.
- Use the validated CLI grant flow as the core dependable workflow.
- Prefer a narrow milestone that can be completed in one sprint.
- Keep the work aligned with the existing architecture and repository structure.
- Produce implementation-ready planning artifacts, not vague product brainstorming.

## Final instruction

Create the sprint plan in a format consistent with the previous backlog work, but optimized for execution by an engineering team. The plan should be practical, grounded in reality, and ready to be used as a sprint kickoff document.
