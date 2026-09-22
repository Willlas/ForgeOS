# Task 06: Check docs for overclaiming

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-08: Known gaps and risks are visible
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Re-read `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md` top to bottom with a single lens: the project is pre-MVP and the only validated product path is the CLI grant → preview → approve → apply flow. Find and fix any sentence that implies more — e.g. "Aer fully usable from terminal" standing unqualified, "multi-agent coordination operational" read as a delivered capability, or "Complete" used where it means "implemented and tested" but not validated. Fix by softening the wording or adding the validated / experimental / planned qualifier from Task 02, and log every changed sentence (before → after) under a `## Findings` heading in this file. Keep the honest claims intact: build and tests passing (402/402), the runtime core implemented, and the CLI loop validated per the Task 01 findings.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `c:\Proyects\MultiAgentDev\PROJECT_STATE.md`, and `c:\Proyects\MultiAgentDev\ROADMAP.md`; change log in this file (`## Findings`)
- **Verification:** A fresh read of all three files presents exactly one validated path; every edit appears in this file's `## Findings` with before/after text; and no capability claim remains without a test, a recorded run, or an explicit experimental/planned label.
