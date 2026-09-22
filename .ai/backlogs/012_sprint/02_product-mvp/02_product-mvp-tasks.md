# Atomized Tasks — Epic 2: Product framing and MVP definition

> Source story: [02_product-mvp.md](02_product-mvp.md)
> Sprint: 12 (Documentation alignment, product framing, MVP definition)
> Constraint: documentation and product-definition work only — no runtime feature implementation.

## Atomized Tasks: US-04 — The product mission is explicit

### Task 1: Draft a short mission statement for Aer
- **Action:** Write a 2–4 line mission statement for Aer that explains the user/problem/value and distinguishes the runtime from the CLI and prototypes. Keep the statement factual and aligned with the repo state: modular runtime for autonomous engineering workflows, multi-agent coordination, CLI and daemon-backed execution, pre-MVP status.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\README.md` and/or `C:\Proyects\MultiAgentDev\PROJECT_STATE.md`
- **Verification:** The mission statement appears in the docs and is no longer than 4 lines; it clearly separates runtime, CLI, and prototype work.

### Task 2: Confirm the mission statement is consistent with the codebase
- **Action:** Re-read the runtime and CLI entry points and confirm that the mission statement does not claim unsupported product maturity. Remove any language implying a fully shipped product experience beyond the validated grant → preview → approve → apply path.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\README.md`, `C:\Proyects\MultiAgentDev\packages\runtime`, `C:\Proyects\MultiAgentDev\packages\cli`
- **Verification:** No sentence in the statement claims a broader product state than what is actually implemented and validated.

## Atomized Tasks: US-05 — The real MVP is defined

### Task 3: Define the MVP boundary in plain language
- **Action:** Describe the recommended MVP in 5–8 bullet points: what is in scope, what is intentionally out of scope, and what is the minimum value the project must deliver to be considered a usable pre-MVP.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\README.md` or `C:\Proyects\MultiAgentDev\PROJECT_STATE.md`
- **Verification:** The MVP statement is explicit, narrow, and clearly separated from aspirational features.

### Task 4: Align the MVP with validated runtime behavior
- **Action:** Ensure the MVP definition references only the secure workflow that is already validated in the repo: grant, preview, approve, apply. Do not list unvalidated features as prerequisites for the MVP.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\README.md`, `C:\Proyects\MultiAgentDev\PROJECT_STATE.md`, `C:\Proyects\MultiAgentDev\ROADMAP.md`
- **Verification:** Each MVP item is backed by a real implemented or validated capability, and no major missing area is described as already delivered.

### Task 5: Separate stable, experimental, and planned work
- **Action:** Create a simple maturity matrix for the major components: runtime, workflow engine, provider abstraction, CLI, daemon, VS Code extension, GUI, and prototype work. Mark each as Stable, Experimental, Planned, or Aspirational.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\PROJECT_STATE.md` and/or `C:\Proyects\MultiAgentDev\ROADMAP.md`
- **Verification:** Every major component appears in the maturity classification, and the labels reflect actual repo evidence.

## Atomized Tasks: US-06 — Stable vs experimental is clearly classified

### Task 6: Audit the core repo components for maturity
- **Action:** Review the project folders and classify the primary workstreams by maturity. Use repo evidence from `packages/runtime`, `packages/cli`, `prototype`, `experiments`, `docs`, and future roadmap items to decide what is stable, experimental, or aspirational.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\PROJECT_STATE.md`, `C:\Proyects\MultiAgentDev\ROADMAP.md`, `C:\Proyects\MultiAgentDev\prototype`, `C:\Proyects\MultiAgentDev\experiments`
- **Verification:** Each component is assigned exactly one maturity label, and the labels are consistent with the actual project state.

### Task 7: Update the relevant project docs with the final classification model
- **Action:** Insert or update the classification section in the appropriate doc(s) so new contributors can understand which areas are production-ready, exploratory, or planned.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\README.md`, `C:\Proyects\MultiAgentDev\PROJECT_STATE.md`, or `C:\Proyects\MultiAgentDev\ROADMAP.md`
- **Verification:** The classification section is visible and readable in the top-level docs, with no contradiction with the roadmap or sprint status.

### Task 8: Verify product framing against the Sprint 12 acceptance criteria
- **Action:** Review the product framing against the source epic and ensure the mission statement, MVP definition, and classification model all address the explicit acceptance criteria in `C:\Proyects\MultiAgentDev\.ai\backlogs\012_sprint\02_product-mvp\02_product-mvp.md`.
- **Target File/Location:** `C:\Proyects\MultiAgentDev\.ai\backlogs\012_sprint\02_product-mvp\02_product-mvp.md`
- **Verification:** Each acceptance criterion in the epic is visibly covered by the draft wording in the repository docs.
