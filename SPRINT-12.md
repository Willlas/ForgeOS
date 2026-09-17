# Sprint 12 — Documentation alignment and product definition

Status: Active

## Objective

Align the project documentation with the actual state of the repository and define the next meaningful product milestone without pretending that the project is more mature than it is.

## Why this sprint exists

The runtime, CLI, workflow, and provider layers are now materially present and validated in their core paths. The main gap is not technical feasibility: it is documentation clarity.

The repository currently contains a mix of:

- historical roadmap notes,
- an older project state that does not match the active branch,
- a root README that is too minimal for a real product,
- a set of technical docs that need to be reconciled with what is actually implemented.

## Scope

1. Reconcile the top-level project documentation.
2. Define what is stable, experimental, and planned.
3. Clarify the product mission and the MVP boundary.
4. Update the roadmap to reflect the real state of the codebase.
5. Identify the next engineering milestone after this documentation pass.

## Deliverables

- refreshed `README.md`
- refreshed `PROJECT_STATE.md`
- refreshed `ROADMAP.md`
- this sprint plan: `SPRINT-12.md`

## Definition of done

This sprint is complete when the repository answers these questions clearly:

- What is Aer?
- What is actually implemented today?
- What is still experimental or planned?
- What is the next milestone after documentation alignment?

## Proposed workstreams

### 1) Product framing

- define the real mission of the runtime
- define the target user and problem solved
- clarify the difference between runtime, daemon, CLI, and prototype UI

### 2) Implementation status truth check

- distinguish between validated runtime features and aspirational roadmap items
- note which flows have been tested end-to-end
- include the actual branch status and what is expected next

### 3) Roadmap correction

- remove contradictions between docs and reality
- keep historical context but label it correctly as historical or completed work
- move future product-level goals to the next stages after this sprint

## Recommended next milestone after Sprint 12

Once documentation is aligned, the next milestone should be a focused product sprint around:

- CLI usability and UX polish,
- workflow validation from a user perspective,
- documentation of actual usage patterns,
- establishment of a realistic MVP definition and acceptance criteria.
