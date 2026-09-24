# Atomized Tasks — Epic 3: Documentation & risk-register closure

> Source story: [03_docs-risk-closure.md](03_docs-risk-closure.md)
> Sprint: 13 (CLI reliability)
> Constraint: close the two named Known Risks rows and document the prerequisite; no scope expansion, no feature work.

## Atomized Tasks: US-05 — The local-Ollama prerequisite is documented

### Task 9: Document the local-Ollama prerequisite in the README
- **Action:** Add a statement that provider initialization and health checks require Ollama running locally at `http://localhost:11434`. Place it in the section that describes provider health / the usage flow / the MVP boundary. Keep the Ollama provider labeled experimental and do not imply a new capability.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (the `## MVP boundary` and/or the Ollama provider bullet / usage section).
- **Verification:** The README explicitly names the prerequisite (Ollama at `http://localhost:11434` required for provider initialization and health checks), is consistent with `## MVP boundary`, and still labels Ollama as experimental.

## Atomized Tasks: US-06 — The Known Risks register reflects the closed defects

### Task 10: Update the two PROJECT_STATE.md Known Risks rows
- **Action:** Update the "CLI error reporting" row to reflect that the CLI now surfaces the daemon's real message (Epic 1, regression-tested) and the "Provider health / local inference" row to reflect that provider state is surfaced in `aer status` and the prerequisite is documented (Epic 2). Do not alter any other rows.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (`# Known Risks` table).
- **Verification:** Both named rows reflect the Epic 1 and Epic 2 outcomes; no other row changed; the sprint/branch reference is consistent with `sprint13`.

## Definition of Done

### Task 11: Verify DoD and cut the stable commit
- **Action:** Confirm the Definition of Done from `ROADMAP.md` is met, then cut a single stable commit on the `sprint13` branch containing all three epics' changes.
- **Target File/Location:** repository root (git commit on the `sprint13` branch); verify against `c:\Proyects\MultiAgentDev\ROADMAP.md` (`# Sprint 13` Definition of Done).
- **Verification:** `npm run build` and `npm test` are green; reusing a consumed `approvalId` prints `Unknown or already-consumed approvalId` (not `[object Object]`); `aer status` (daemon running) prints an Ollama provider line with `http://localhost:11434`; the README states the prerequisite; the two `PROJECT_STATE.md` rows are updated; a stable commit on `sprint13` contains all of the above and the branch remains resumable.

## Final review

- [x] README states the local-Ollama prerequisite and keeps Ollama experimental.
- [x] Both `PROJECT_STATE.md` Known Risks rows reflect the closed defects.
- [x] DoD is met and a stable commit exists on `sprint13`.
