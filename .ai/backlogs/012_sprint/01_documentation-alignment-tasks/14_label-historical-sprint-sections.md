# Task 14: Label historical sprint sections explicitly

> Epic: [01_documentation-alignment.md](../01_documentation-alignment/01_documentation-alignment.md) — US-03: ROADMAP is consistent with delivery reality
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** In `ROADMAP.md`, group the Sprint 1–9 detail sections (lines 66–361) under a new `# Historical Sprints (1–9)` heading and demote their individual `# Sprint N` headings to `## Sprint N` so the document outline separates history from the active plan. Add a one-line note at the top of the group: `> These sections are historical records of completed work and must not be edited except to correct factual errors.`
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 66–361)
- **Verification:** `Select-String -Path ROADMAP.md -Pattern "^# Sprint"` returns zero matches (all sprint detail headings are now `##`); the historical note line exists directly under the new `# Historical Sprints (1–9)` heading.
