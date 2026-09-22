# Task 03: Correct the repository structure section

> Epic: [01_documentation-alignment.md](../01_documentation-alignment/01_documentation-alignment.md) — US-01: README reflects the real project
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** Update the `## Repository structure` section of `README.md` (lines 19–25) to list only directories that exist per Task 01, adding `.daemon/` and the daemon package with one-line descriptions, and removing or correcting any entries that do not exist. Keep one entry per directory in the same `- `path/` — description` style.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 19–25)
- **Verification:** Each path listed in `## Repository structure` resolves on disk (`Test-Path .\packages\runtime`, `Test-Path .\packages\cli`, `Test-Path .\.daemon` all return `True`), and no listed path returns `False`.
