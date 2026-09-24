# GLM handoff prompt for Sprint 14

## Context

We are continuing from Sprint 13, where the project reached a stable CLI reliability milestone on the `develop` branch. The validated path is now the daemon-backed workspace flow: grant → preview → approve → apply.

The purpose of Sprint 14 is not to add new product capability. Instead, it is to strengthen operational confidence by validating the CLI as a real operator surface, documenting its failure and recovery paths, and preparing a deeper test plan that GLM can enrich.

## Current state summary

- The project is on the `develop` branch after merging Sprint 13.
- The core CLI flow is validated and tested.
- The known-risk defects from Sprint 13 are closed and the repo is internally consistent.
- The CLI remains pre-MVP and the provider remains experimental.
- The main opportunity now is operational validation, reproducible tests, and clearer human-facing CLI expectations.

## Sprint 14 objective

Create a robust CLI validation and operator workflow plan for the repo’s already-validated flow. This should cover:
- normal success paths,
- failure and rejection paths,
- explicit exit-code expectations,
- confirmation prompts and scriptability,
- daemon and provider-state edge cases,
- realistic user/operator commands to run in a clean environment.

## Outputs expected from GLM

GLM should enrich this handoff by helping to:
1. refine the CLI validation matrix,
2. propose higher-value regression scenarios,
3. identify hidden operator pitfalls,
4. suggest more realistic acceptance criteria,
5. generate a richer test plan for human CLI interaction and automation.

## Recommended themes for enrichment

### 1) Human CLI interaction
- What commands should an operator run to validate the happy path?
- Which prompts and confirmation flows should be covered manually?
- What should stdout/stderr look like in success and failure cases?

### 2) Scripted / automation-friendly CLI use
- Which commands are safe with `--yes`?
- Which flows should not be automated without guardrails?
- What exit codes and message conventions should be enforced?

### 3) Failure mode coverage
- daemon not running
- invalid grant state
- reused approvalId
- approval mismatch or expired approval
- local Ollama unavailable
- invalid workspace path or malformed arguments

### 4) Operator confidence checks
- a minimal test matrix for real humans using the CLI
- a reproducible smoke suite for weekly validation
- regression checks that prevent `[object Object]` output from returning

## Constraints

- Keep scope to validation, hardening, and evidence collection.
- Do not add new product capabilities without explicit approval.
- Do not broaden the project to additional provider backends.
- Keep all suggestions grounded in the verified repository state.
- The main concern is operator trust and testability, not feature expansion.

## Suggested starting questions for GLM

- What other CLI failure modes should we validate beyond the already-fixed approvalId and provider-state cases?
- What would an operator-focused smoke suite look like in a real workstation environment?
- Which flows are worth turning into explicit regression tests first?
- What commands and expected outputs should we document for non-technical users?
- What checks should be added to catch hidden regressions before a release candidate?

## Deliverable structure for Sprint 14

- CLI validation matrix
- operator test plan
- command-by-command checklist
- expected outputs and exit codes
- edge-case coverage for daemon and Ollama
- recommendations for future regression automation

## Final instruction

Use the current repo state as the truth source. Do not assume future capabilities or unsupported provider behavior. Enrich the Sprint 14 plan with practical operator validation and robust CLI regression thinking, while keeping the scope honest and pre-MVP.
