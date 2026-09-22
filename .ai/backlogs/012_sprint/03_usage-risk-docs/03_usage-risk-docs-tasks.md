# Atomized Tasks — Epic 3: Usage and risk documentation

> Source story: [03_usage-risk-docs.md](03_usage-risk-docs.md)
> Sprint: 12 (Documentation alignment, product framing, MVP definition)
> Constraint: documentation only — no runtime changes unless required to correct a factual error.

## Atomized Tasks: US-07 — The validated console flow is documented

### Task 1: Capture the validated CLI workflow in plain English
- **Action:** Write the exact flow that has been validated in the repo: grant → preview → approve → apply. Describe what each step does, what the user must do, and what constitutes a successful result.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `PROJECT_STATE.md`, or the backlog docs
- **Verification:** The workflow is documented in a single clear sequence and matches the runtime behavior that has been validated in code and tests.

### Task 2: Separate validated behavior from aspirational or unverified claims
- **Action:** In each docs section that mentions workflows or tooling, explicitly distinguish between what has been verified in the repo and what remains experimental or unimplemented.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `PROJECT_STATE.md`, `ROADMAP.md`
- **Verification:** Every workflow mention is marked as validated, experimental, or planned; no unverified claim is presented as proven.

### Task 3: Include a short real-world usage example
- **Action:** Add a minimal example of the validated CLI flow, based on the actual commands used in the repo and the known working pattern. Keep the example concise and realistic.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` or a dedicated usage doc
- **Verification:** The example contains the real command flow and is consistent with the repo’s tested execution path.

## Atomized Tasks: US-08 — Known gaps and risks are visible

### Task 4: Draft a risk and gap register
- **Action:** List the main known gaps: unvalidated multi-agent workflows, missing additional provider backends, provider capability detection limitations, and any known constraints around environment setup or local dependencies.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` or a dedicated risk section in the backlog docs
- **Verification:** The register includes concrete gaps and states their current status without overstating certainty.

### Task 5: Add mitigation notes for each risk
- **Action:** For each major risk, add a brief mitigation or monitoring note so contributors know how to handle or reduce the risk.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` or equivalent docs
- **Verification:** Each risk has a corresponding mitigation or explicit “future work” note.

### Task 6: Check docs for overclaiming
- **Action:** Review the top-level docs for language that suggests the project is more mature than it is. Remove or soften any claim that implies completion of unvalidated capabilities.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `PROJECT_STATE.md`, `ROADMAP.md`
- **Verification:** The docs consistently present the project as pre-MVP and keep claims aligned with verified evidence.

### Task 7: Verify the usage/risk documentation against the acceptance criteria
- **Action:** Review the text against the acceptance criteria in [03_usage-risk-docs.md](03_usage-risk-docs.md) and confirm that the commands are accurate, the risks are explicit, and the examples are honest.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\.ai\backlogs\012_sprint\03_usage-risk-docs.md`
- **Verification:** Every acceptance criterion in the epic is visibly satisfied in the docs.
