# Task 06: Check docs for overclaiming

> Status: Complete — 2026-09-22. Full re-read of `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md`: the only unqualified capability claim found was the Sprint 7 (Multi-Agent Runtime) exit criteria in `ROADMAP.md`; it is now qualified as experimental. Every other workflow/capability mention carries a validated / experimental / planned label; no edits were required in the other two files. Details under `## Findings`.
>
> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-08: Known gaps and risks are visible
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Re-read `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md` top to bottom with a single lens: the project is pre-MVP and the only validated product path is the CLI grant → preview → approve → apply flow. Find and fix any sentence that implies more — e.g. "Aer fully usable from terminal" standing unqualified, "multi-agent coordination operational" read as a delivered capability, or "Complete" used where it means "implemented and tested" but not validated. Fix by softening the wording or adding the validated / experimental / planned qualifier from Task 02, and log every changed sentence (before → after) under a `## Findings` heading in this file. Keep the honest claims intact: build and tests passing (402/402), the runtime core implemented, and the CLI loop validated per the Task 01 findings.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `c:\Proyects\MultiAgentDev\PROJECT_STATE.md`, and `c:\Proyects\MultiAgentDev\ROADMAP.md`; change log in this file (`## Findings`)
- **Verification:** A fresh read of all three files presents exactly one validated path; every edit appears in this file's `## Findings` with before/after text; and no capability claim remains without a test, a recorded run, or an explicit experimental/planned label.

## Findings

Re-read all three files top to bottom on 2026-09-22 with the lens: pre-MVP, only validated path = CLI grant → preview → approve → apply.

### Edited

1. `ROADMAP.md` — Sprint 7 (Multi-Agent Runtime) exit criteria read as delivered capability ("operational" / "complete" with no qualifier).
   - **Before:** `- Multi-agent execution operational` / `- Shared execution context` / `- Team orchestration complete` (bare list, nothing else in that block qualified them)
   - **After:** the same three bullets, followed by: `All three were met by implementation and unit tests only — the multi-agent runtime remains **experimental** (see the Maturity line above; only the grant → preview → approve → apply CLI flow is **validated** — see the MVP boundary in `README.md`).`
   - Basis: Sprint 7 already carries the line `Maturity: **experimental** — implemented and unit-tested, not a validated end-to-end workflow (see `PROJECT_STATE.md` Pending)`; the exit-criteria list was the one spot that contradicted it on a quick read.

### Reviewed — no edit required

- `README.md` — every capability mention is already labeled: intro (multi-agent **experimental**, Ollama implemented and tested, CLI loop **validated**), `## Mission` ("pre-MVP: the only validated path…"), `## MVP boundary` (in-scope items qualified **validated** / **experimental**; multi-agent explicitly listed out of scope as "implemented and unit-tested, not yet a validated product path"), `## Maturity classification` (Stable tier cross-labeled **experimental** except the CLI loop), and the `## Usage — validated CLI flow` section (Task 01). Honest claims (402/402 tests, runtime core implemented) are intact.
- `PROJECT_STATE.md` — `# Mission` qualified with "(multi-agent coordination is **experimental** …)" and "pre-MVP: the only validated path…"; `# MVP Boundary` note explicitly disambiguates "Complete"; `## Completed` header states Sprints 1–9 are experimental-tier except the CLI loop; the `## Known Risks` register (Task 04) marks multi-agent as experimental with an "E2E validation run before any capability claim" dependency.
- `ROADMAP.md` rest of file — `## Current Progress` table carries the MVP note ("'Complete' … means the sprint's implementation and tests landed, not a validated end-to-end product path") plus the three-label legend; Sprints 2–8 each carry a `Maturity:` line (Sprints 2–6 experimental product path, 7–8 experimental workflow); Sprint 9 exit "Aer fully usable from terminal" is qualified to the validated loop only; Sprints 10–11 labeled **planned** / design-only; `# Architectural Evolution` legend clarifies ✅ = implementation, not validation.
- Residual wording: Sprint 2 (`✅ Runtime infrastructure operational`) and Sprint 4 (`✅ Dispatcher operational`, `✅ Worker routing operational`) exit criteria still use "operational". Left as-is: they are historical exit criteria of past sprints, not present-tense capability claims (unlike the Sprint 7 case), and the file-level MVP note + per-sprint Maturity lines already qualify them. Noted here so a future reader doesn't re-flag them.
