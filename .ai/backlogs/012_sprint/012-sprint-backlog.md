Here is the complete document formatted as a Markdown file. You can copy the contents below and save them as `sprint-12-backlog.md` in your repository.

```markdown
# Sprint 12 Backlog — Aer Runtime

> **Sprint:** 12
> **Theme:** Documentation alignment, product framing, MVP definition
> **Owner:** Senior Product Owner / Technical Lead
> **Status:** Planned
> **Type:** Execution-ready backlog (Markdown)
> **Repository context:** TypeScript monorepo — runtime, daemon, CLI, provider layer, workflow engine, approval workflow, workspace grant controls

---

## 1. Objective

Align the project's documentation with what is actually implemented in the codebase, establish a clear and honest product framing for Aer, define the real MVP boundary, and prepare a focused, executable plan for the next milestone.

This sprint does **not** add new runtime features. It exists to remove the gap between what the repository can already do and what the documentation claims it does.

The sprint is considered successful if any contributor or stakeholder can read the top-level documentation and reliably understand:

- what Aer is,
- what currently works end-to-end,
- what is experimental or prototyped,
- what is planned but not yet built,
- what is aspirational and explicitly out of the MVP,
- what the next milestone is and why.

---

## 2. Context

The repository already contains a functional technical foundation, including:

- a runtime core,
- a dispatcher and provider layer,
- a workflow engine,
- a daemon component,
- a CLI surface,
- a workspace grant control model,
- an approval workflow,
- a validated functional path covering **grant → preview → approve → apply**.

The main problem is **not** technical capability. The problem is documentation drift and product framing:

- `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md` disagree with each other and with the active branch.
- The mission of Aer is not stated clearly enough for a new reader.
- The boundary between stable foundation, experimental work, and aspirational scope is blurred.
- The next real milestone is not defined.

This sprint exists to fix those issues without overstating the project's maturity.

---

## 3. Scope

### 3.1 In scope

- Review and rewrite of `README.md`, `PROJECT_STATE.md`, `ROADMAP.md`.
- A clear, short mission statement for Aer.
- An explicit MVP definition with a feature list.
- A classification of every major project area as **stable**, **experimental**, **planned**, or **aspirational**.
- Usage documentation for the validated grant / preview / approve / apply flow.
- A risk and gap register tied to the current state.
- Definition of the next milestone objective and exit criteria.
- This sprint backlog document as the canonical reference.

### 3.2 Out of scope

- New runtime features.
- New provider implementations.
- Daemon refactors or protocol changes.
- Performance tuning or benchmarking.
- Public release, packaging, or distribution work.
- Marketing, website, or external communication.
- Any work that depends on capabilities the runtime does not yet have.

---

## 4. Expected outcome

By the end of Sprint 12:

1. The top-level documentation is internally consistent and matches the active branch.
2. A reader can understand the project's purpose in under two minutes.
3. The MVP boundary is explicit and defensible.
4. The next milestone has a named objective, a focused task list, and exit criteria.
5. Risks and gaps are visible instead of implicit.
6. No document claims capabilities that are not yet implemented.

The sprint output is primarily documentation and decisions, not code. Code changes are limited to small fixes required to make documented examples actually run.

---

## 5. Definition of Done

A backlog item is "done" when:

- The documentation change is written, reviewed, and merged.
- It is consistent with the active branch and with the other top-level documents.
- It does not overstate the maturity of any component.
- It has been verified against the actual repository structure and code.
- Where it describes an executable flow, that flow has been run locally at least once during the sprint.
- It is readable by both technical contributors and non-engineering stakeholders.

The sprint is "done" when all P0 items and at least 80% of P1 items are complete, the next milestone is documented, and no P0 contradictions remain between `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md`.

---

## 6. Priorities

- **P0 — Must ship this sprint:** documentation alignment, mission, MVP boundary, status reconciliation.
- **P1 — Should ship this sprint:** usage documentation, classification of stable vs. experimental, gap register, next milestone definition.
- **P2 — Nice to have:** supporting improvements (contributor guide, examples polish, glossary).

---

## 7. Assumptions

- The active branch is the source of truth for current capability; no large unreleased work is hidden elsewhere.
- The grant / preview / approve / apply flow is reproducible locally with the documented CLI commands.
- No external stakeholder deadline forces an early close of the sprint.
- The team has access to the repository and can run the CLI locally.
- Documentation consumers include both engineers and non-engineering reviewers; both audiences must be served.
- The project is pre-MVP and should be described as such.

---

## 8. Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|-----------|------------|
| R1 | Documentation overstates current capability, creating false expectations. | High | Medium | Cross-check every claim against the active branch; classify components explicitly. |
| R2 | MVP scope is defined too broadly and pushes the next milestone out. | Medium | Medium | MVP = minimum to be usable for the validated flow, not "complete product". |
| R3 | Conflicting interpretation of what "stable" means across components. | Medium | High | Use a fixed classification table; define criteria for each tier. |
| R4 | Usage examples drift from actual CLI behavior. | High | Medium | Run every documented example locally before merge. |
| R5 | Next milestone is defined too vaguely to be actionable. | Medium | High | Require a named objective, exit criteria, and a focused task list. |
| R6 | Stakeholders interpret "documentation sprint" as a lack of progress. | Low | Medium | Frame the sprint explicitly as alignment before feature work resumes. |
| R7 | Hidden technical debt surfaces during documentation review. | Medium | Low | Capture debt in the gap register; do not try to fix it inside this sprint. |

---

## 9. Dependencies

- Access to the repository and the ability to run the CLI locally.
- A reproducible state of the active branch for the duration of the sprint.
- Agreement from the technical lead on the MVP boundary before P1 documentation work finalizes.
- No blocking production incidents during the sprint window.

---

## 10. Current state classification

This classification is the reference table for all documentation produced in this sprint. Every component must be placed in exactly one tier.

### 10.1 Implemented and validated

- Runtime core (process model, lifecycle).
- Dispatcher and provider layer for the providers currently exercised by the validated flow.
- Workflow engine for the supported path.
- CLI surface for grant, preview, approve, and apply.
- Workspace grant control model as exercised by the validated flow.
- Approval workflow along the validated path.

### 10.2 Experimental / prototyping

- Any provider implementations not yet covered by an end-to-end validation.
- Any daemon behavior not yet wired into the documented CLI flow.
- Any workflow features that exist in code but are not part of the validated path.

> Note: experimental components may be functional in isolation but are not yet considered part of the MVP contract.

### 10.3 Planned future items (post-MVP)

- Additional providers beyond the MVP set.
- Extended workflow features not required for the validated flow.
- Daemon hardening for multi-user or long-running scenarios.
- Distribution, packaging, and versioning for external consumers.
- Observability and operational tooling beyond what the validated flow requires.

### 10.4 Aspirational (not part of the MVP)

- Marketplace or plugin ecosystem narratives.
- Cross-runtime federation or multi-tenant orchestration.
- Any feature that would require capabilities the runtime does not currently have and that is not needed for the validated flow.

> Aspirational items may be referenced in `ROADMAP.md` only as "future direction" and must not appear in MVP or near-term scope.

---

## 11. Backlog

### Epic 1 — Documentation alignment

**Goal:** Make `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md` consistent with the active branch and with each other.

#### Story 1.1 — Rewrite `README.md` as an honest project overview

- **Priority:** P0
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Description:** Produce a README that explains what Aer is, how the repository is structured, what state it is in, and what the next objective is. No marketing language.
- **Acceptance criteria:**
  - Contains a 2–4 line project description written for a technical reader who has never seen the repo.
  - Lists the main repository areas (runtime, daemon, CLI, providers, workflow engine, approval workflow, workspace grants).
  - States explicitly that the project is pre-MVP.
  - Points to `PROJECT_STATE.md` for current status and `ROADMAP.md` for direction.
  - Contains no claims that cannot be reproduced on the active branch.

#### Story 1.2 — Reconcile `PROJECT_STATE.md` with the active branch

- **Priority:** P0
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Description:** Update the project status file so it reflects the real branch state, completed work, pending work, and current objective.
- **Acceptance criteria:**
  - Active branch is named correctly.
  - Completed vs. pending work is listed per component, using the Section 10 classification.
  - Obsolete or contradictory content is removed.
  - The current sprint objective is stated in one paragraph.

#### Story 1.3 — Rebuild `ROADMAP.md` to reflect real maturity

- **Priority:** P0
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Description:** Make the roadmap consistent with the actual state of the project and the next milestone.
- **Acceptance criteria:**
  - Past sprints are classified as completed, partial, or superseded.
  - Sprint 12 appears with the realistic scope described in this document.
  - The next milestone is named and has exit criteria.
  - Aspirational items are clearly separated from near-term and MVP items.

---

### Epic 2 — Product definition and MVP

**Goal:** Make the product framing clear enough that any reader can decide whether Aer is relevant to them.

#### Story 2.1 — Write the Aer mission statement

- **Priority:** P0
- **Status:** pending
- **Owner:** TBD
- **Type:** product
- **Description:** Define who the user is, what problem is being solved, and what value Aer delivers today.
- **Acceptance criteria:**
  - Mission is expressed in 2–4 lines.
  - Names the intended user (developer / operator role) without overstating reach.
  - Distinguishes runtime, daemon, CLI, and prototypes.
  - Is reusable inside `README.md` and `ROADMAP.md`.

#### Story 2.2 — Define the real MVP

- **Priority:** P1
- **Status:** pending
- **Owner:** TBD
- **Type:** product
- **Description:** Define the minimum scope required for Aer to be considered usable in its first real release.
- **Acceptance criteria:**
  - Contains an explicit list of essential features.
  - Each MVP feature is traceable to an implemented and validated component from Section 10.1.
  - Explicitly states what is excluded from the MVP.
  - Does not include aspirational items.

#### Story 2.3 — Classify every major area as stable / experimental / planned / aspirational

- **Priority:** P1
- **Status:** pending
- **Owner:** TBD
- **Type:** product
- **Description:** Produce a single classification table that places each major component in one of the four tiers defined in Section 10.
- **Acceptance criteria:**
  - Every component from the repository structure is represented.
  - Each entry has a one-line justification.
  - The table is referenced from `PROJECT_STATE.md`.

---

### Epic 3 — Functional validation and usage documentation

**Goal:** Make the validated flow reproducible by a new reader without asking the team.

#### Story 3.1 — Document the validated grant / preview / approve / apply flow

- **Priority:** P1
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Description:** Write executable usage documentation for the validated flow.
- **Acceptance criteria:**
  - Contains real CLI commands that can be copy-pasted.
  - Each step (grant, preview, approve, apply) is shown with expected behavior.
  - Boundary between validated behavior and uncovered behavior is explicit.
  - All examples have been run locally during the sprint.

#### Story 3.2 — Record gaps, risks, and dependencies

- **Priority:** P1
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Description:** Avoid presenting the project as more complete than it is.
- **Acceptance criteria:**
  - Known gaps are listed per component.
  - Risks from Section 8 are referenced or mirrored.
  - External and internal dependencies are explicit.
  - The register is linked from `PROJECT_STATE.md`.

---

### Epic 4 — Preparation for the next milestone

**Goal:** End the sprint with a clear, focused next objective that the next sprint can start from on day one.

#### Story 4.1 — Define the next milestone objective and exit criteria

- **Priority:** P1
- **Status:** pending
- **Owner:** TBD
- **Type:** planning
- **Description:** Decide what comes after the documentation alignment work and write it down.
- **Acceptance criteria:**
  - Next milestone objective is named and described in 2–4 lines.
  - A focused, prioritized task list exists for the next sprint.
  - Exit criteria are concrete and testable.
  - The milestone does not depend on aspirational scope.

#### Story 4.2 — Capture candidate work for the next sprint

- **Priority:** P2
- **Status:** pending
- **Owner:** TBD
- **Type:** planning
- **Description:** Maintain a short candidate list for the next sprint so it can start without re-discovery.
- **Acceptance criteria:**
  - 3–8 candidate items are listed.
  - Each is tied to an MVP feature or a known gap.
  - Aspirational items are excluded.

---

### Epic 5 — Supporting structure (P2)

**Goal:** Small improvements that help onboarding but are not blocking.

#### Story 5.1 — Add a short contributor orientation note

- **Priority:** P2
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Acceptance criteria:**
  - One-page note describing how to run the project locally.
  - Points to the validated flow as the smoke test.

#### Story 5.2 — Add a minimal glossary

- **Priority:** P2
- **Status:** pending
- **Owner:** TBD
- **Type:** documentation
- **Acceptance criteria:**
  - Defines runtime, daemon, dispatcher, provider, workflow, approval, workspace grant.
  - Each entry is one or two lines.

---

## 12. Next milestone

**Working title:** Sprint 13 — Stabilize the MVP contract

**Objective:** Take the MVP boundary defined in Sprint 12 and harden the runtime, CLI, and workflow behavior so the validated flow is reliable enough to be the first real release candidate.

**Exit criteria (proposed, to be finalized at the end of Sprint 12):**

- The grant / preview / approve / apply flow runs deterministically on the active branch.
- Failure modes for the validated flow are documented and handled gracefully.
- CLI output is stable enough to be relied on by users.
- MVP feature list is fully traceable to tested behavior.
- No P0 documentation contradictions remain.

> This milestone is intentionally scoped to the MVP. Aspirational capabilities are excluded.

---

## 13. Sprint closure proposal

The sprint is considered complete when:

- All P0 items in Epic 1 and Epic 2 are merged.
- `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md` contain no P0 contradictions.
- The mission, MVP, and classification table are in place.
- The validated flow is documented with examples that have been run locally.
- The next milestone is named with exit criteria.
- The risk and gap register exists and is linked from `PROJECT_STATE.md`.

Items not closed in this sprint are carried forward explicitly and tagged as such in `PROJECT_STATE.md`. They are not silently retained.

---

## 14. Execution notes

- This backlog is the canonical reference for Sprint 12. Do not duplicate it in other files.
- Historical context belongs in `PROJECT_STATE.md` and commit history, not in this sprint document.
- The four-tier classification (stable / experimental / planned / aspirational) is the single source of truth for wording across all docs produced this sprint.
- If a documentation claim cannot be verified against the active branch, it must be removed or downgraded to "planned".
- This sprint produces decisions as much as text. Decisions captured here are binding for the next sprint.
```