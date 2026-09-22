# Task 02: Separate validated behavior from aspirational or unverified claims

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-07: The validated console flow is documented
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Walk `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md` and tag every workflow or capability mention with exactly one label: **validated** (the grant → preview → approve → apply CLI flow), **experimental** (multi-agent coordination and the workflow engine — implemented and unit-tested, not a validated end-to-end workflow), or **planned** (OpenAI/Anthropic backends, VS Code extension, GUI). Where a section could be misread as a delivery claim (e.g. the Sprint 9 exit "Aer fully usable from terminal"), add a one-line qualifier pointing to the MVP boundary in `README.md`. Labeling only — do not add, remove, or re-order capabilities.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `c:\Proyects\MultiAgentDev\PROJECT_STATE.md`, and `c:\Proyects\MultiAgentDev\ROADMAP.md` (workflow and capability mentions)
- **Verification:** Re-read all three files: every workflow or capability mention carries a validated / experimental / planned label, the Task 01 usage section is the only place the grant loop is described as a working product path, and no experimental or planned item is presented as proven.
