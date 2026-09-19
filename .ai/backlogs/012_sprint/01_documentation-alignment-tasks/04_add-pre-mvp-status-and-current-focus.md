# Task 04: Add an explicit pre-MVP status and current-focus block

> Epic: [01_documentation-alignment.md](../01_documentation-alignment.md) — US-01: README reflects the real project
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** In `README.md`, replace the `## Current status` section (lines 5–10) with a section that (a) declares the project as **pre-MVP** on the first bullet, (b) states the current branch (`develop` — re-check with `git branch --show-current`), (c) names Sprint 12 (documentation alignment, product framing, MVP definition) as the active focus, and (d) lists the validated path (grant / preview / approve / apply CLI flow) as the only verified workflow.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 5–10)
- **Verification:** `Select-String -Path README.md -Pattern "pre-MVP"` returns a match in the status section; the branch name in the file equals the output of `git branch --show-current`.
