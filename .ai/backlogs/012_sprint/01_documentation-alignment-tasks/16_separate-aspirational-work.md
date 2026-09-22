# Task 16: Separate aspirational work from short-term scope

> Epic: [01_documentation-alignment.md](../01_documentation-alignment/01_documentation-alignment.md) — US-03: ROADMAP is consistent with delivery reality
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** In `ROADMAP.md`, move `# Sprint 10 — VS Code Extension` and `# Sprint 11 — GUI` (lines 363–403) under a new `# Aspirational / Post-MVP` heading (demote to `## Sprint 10` / `## Sprint 11`), with an intro line stating these are not part of the near-term MVP and have no committed timeline. Keep the `# Architectural Evolution` and `# Legacy Mapping` sections, adding the same `> Historical / reference only` note used in Task 14.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 363–462)
- **Verification:** `Select-String -Path ROADMAP.md -Pattern "^# Aspirational"` returns one match; Sprints 10 and 11 appear only under that section; the Legacy Mapping section carries the historical note.
