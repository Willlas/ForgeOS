# Task 05: Remove stale or duplicate claims from the README

> Epic: [01_documentation-alignment.md](../01_documentation-alignment/01_documentation-alignment.md) — US-01: README reflects the real project
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** Review `## Project goals` and `## Next milestone` in `README.md` (lines 12–29). Delete or reword any goal that overstates maturity (e.g. "multi-agent coordination" presented as shipped if it is only implemented, not validated), and align `## Next milestone` with the Sprint 12 exit criteria in `.ai\backlogs\012_sprint\README.md`. Keep the sections short (≤ 8 lines each).
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 12–29)
- **Verification:** `Select-String -Path README.md -Pattern "Sprint 12"` matches in `## Next milestone`, and both sections are each 8 lines or fewer.
