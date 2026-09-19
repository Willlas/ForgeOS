# Task 01: Survey the actual repository layout

> Epic: [01_documentation-alignment.md](../01_documentation-alignment.md) — US-01: README reflects the real project
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** Run `Get-ChildItem -Path .\ -Name` and `Get-ChildItem -Path .\packages -Name` in the repo root. Compare the output against the `## Repository structure` section of `README.md`. Note every real directory that is missing from the README (e.g. `.daemon/`, `packages/.daemon`) and every README entry that does not exist on disk. Write the findings as bullet notes in this file under a `## Findings` heading.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\` (root) and `c:\Proyects\MultiAgentDev\packages\`
- **Verification:** The findings list in this file names every top-level directory and every `packages/*` entry, and matches a fresh directory listing with zero unexplained gaps.

## Findings

Surveys of `Get-ChildItem -Path .\ -Name` (root) and `Get-ChildItem -Path .\packages -Name` (packages) compared against `README.md` lines 19–25 (`## Repository structure`).

### Actual top-level directories (root)

- `.ai/` — **missing from README** — agent/backlog documentation (sprint backlogs, execution model, task files)
- `.daemon/` — **missing from README** — runtime state for the daemon at the repo root (`aer-daemon.pid`)
- `.tmp/` — **missing from README** — temporary/scratch files
- `.vscode/` — **missing from README** — editor configuration
- `.zcode/` — **missing from README** — ZCode editor configuration
- `dist/` — **missing from README** — build output
- `docs/` — listed in README ✓ — roadmap, RFCs, ADRs and project records
- `experiments/` — listed in README ✓ — exploratory work and test fixtures
- `logs/` — **missing from README** — log files
- `node_modules/` — not in README (expected — installed dependencies, not project content)
- `packages/` — listed indirectly in README via its children ✓
- `prototype/` — listed in README ✓ — UI prototypes and examples
- `templates/` — **missing from README** — templates
- `tests/` — **missing from README** — root-level tests
- (`.git/` — VCS metadata, not project content; not expected in README)

### Actual `packages/*` entries

- `packages/.daemon/` — **missing from README** — daemon runtime state (`aer-daemon.pid`, `aer-daemon.state.json`)
- `packages/cli/` — listed in README ✓ — command-line interface and IPC client
- `packages/runtime/` — listed in README ✓ — runtime engine, grants, workflow execution, session logic

### README entries that do not exist on disk

- **None.** All five entries in `## Repository structure` (`packages/runtime/`, `packages/cli/`, `docs/`, `prototype/`, `experiments/`) resolve on disk.

### Summary

- The README is stale only in the direction of omission: 9 project directories at the root (`.ai/`, `.daemon/`, `.tmp/`, `.vscode/`, `.zcode/`, `dist/`, `logs/`, `templates/`, `tests/`) and 1 package entry (`packages/.daemon/`) are absent from `## Repository structure`.
- No README entry points to a non-existent path; nothing needs to be removed, only added (see Task 03).
