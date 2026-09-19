# Atomized Tasks — Epic 1: Documentation alignment

> Source story: [01_documentation-alignment.md](01_documentation-alignment.md)
> Sprint: 12 (Documentation alignment, product framing, MVP definition)
> Constraint: documentation-only changes — no new runtime features.

## Atomized Tasks: US-01 — README reflects the real project

### Task 1: Survey the actual repository layout
- **Action:** Run `Get-ChildItem -Path .\ -Name` and `Get-ChildItem -Path .\packages -Name` in the repo root. Compare the output against the `## Repository structure` section of `README.md`. Note every real directory that is missing from the README (e.g. `.daemon/`, `packages/.daemon`) and every README entry that does not exist on disk. Write the findings as bullet notes at the bottom of this tasks file.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\` (root) and `c:\Proyects\MultiAgentDev\packages\`
- **Verification:** The findings list in this file names every top-level directory and every `packages/*` entry, and matches a fresh directory listing with zero unexplained gaps.

### Task 2: Rewrite the Aer overview to 2–4 factual lines
- **Action:** Replace lines 1–3 of `README.md` (`# Aer Runtime` + description line) with a heading and a 2–4 line description that states: what Aer is (modular runtime for autonomous engineering workflows, multi-agent coordination, CLI-driven execution), the TypeScript monorepo composition (runtime, daemon, CLI, provider layer, workflow engine), and that the grant / preview / approve / apply flow is the validated core path. Remove any claim not backed by code in `packages/runtime/` or `packages/cli/`.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 1–3)
- **Verification:** Re-read `README.md`; the intro contains exactly 2–4 lines describing Aer, mentions the monorepo composition, and makes no capability claim that is absent from the codebase.

### Task 3: Correct the repository structure section
- **Action:** Update the `## Repository structure` section of `README.md` (lines 19–25) to list only directories that exist per Task 1, adding `.daemon/` and the daemon package with one-line descriptions, and removing or correcting any entries that do not exist. Keep one entry per directory in the same `- `path/` — description` style.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 19–25)
- **Verification:** Each path listed in `## Repository structure` resolves on disk (`Test-Path .\packages\runtime`, `Test-Path .\packages\cli`, `Test-Path .\.daemon` all return `True`), and no listed path returns `False`.

### Task 4: Add an explicit pre-MVP status and current-focus block
- **Action:** In `README.md`, replace the `## Current status` section (lines 5–10) with a section that (a) declares the project as **pre-MVP** on the first bullet, (b) states the current branch (`sprint12` — re-check with `git branch --show-current`), (c) names Sprint 12 (documentation alignment, product framing, MVP definition) as the active focus, and (d) lists the validated path (grant / preview / approve / apply CLI flow) as the only verified workflow.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 5–10)
- **Verification:** `Select-String -Path README.md -Pattern "pre-MVP"` returns a match in the status section; the branch name in the file equals the output of `git branch --show-current`.

### Task 5: Remove stale or duplicate claims from the README
- **Action:** Review `## Project goals` and `## Next milestone` in `README.md` (lines 12–29). Delete or reword any goal that overstates maturity (e.g. "multi-agent coordination" presented as shipped if it is only implemented, not validated), and align `## Next milestone` with the Sprint 12 exit criteria in `.ai\backlogs\012_sprint\README.md`. Keep the sections short (≤ 8 lines each).
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (lines 12–29)
- **Verification:** `Select-String -Path README.md -Pattern "Sprint 12"` matches in `## Next milestone`, and both sections are each 8 lines or fewer.

### Task 6: Verify README against all US-01 acceptance criteria
- **Action:** Open `README.md` and check it line by line against the four acceptance criteria in `01_documentation-alignment.md` (2–4 line explanation; structure listed; development focus visible; pre-MVP stated). Also run a markdown check — e.g. `npx markdownlint README.md` (or the VS Code Markdown linting extension) — and fix any warnings about heading order, trailing spaces, or list formatting.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`
- **Verification:** All four US-01 acceptance criteria are visibly satisfied in the file, and `npx markdownlint README.md` (or the IDE linter) reports zero errors.

## Atomized Tasks: US-02 — PROJECT_STATE matches the branch reality

### Task 7: Validate the branch and health headers
- **Action:** Run `git branch --show-current`, `git log -1 --oneline`, `npm run build`, and `npx vitest run` in the repo root. Compare each result against the header of `PROJECT_STATE.md` (lines 1–8: `Last Updated`, `Repository Status: STABLE`, `Build Status: PASSING`, `Tests: PASSING`, `Branch: sprint12`, `Last Stable Commit`). Correct any header field that does not match the command output, and refresh `Last Updated` to today's date.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (lines 1–8)
- **Verification:** The branch and commit in `PROJECT_STATE.md` header equal the `git branch --show-current` and `git log -1` outputs; build and test command outputs are both green; `Last Updated` is today's date.

### Task 8: Fix the broken Components table
- **Action:** In `PROJECT_STATE.md` (lines 47–61), repair the Components table: every row currently has a spurious leading empty cell (`| | Runtime Core | ...`). Rewrite the table with the correct header `| Component | Status | Notes |` and rows containing exactly 3 cells each. Also reconcile the CLI row — `CLI | In Progress | Implementation started` — against the ROADMAP (`Sprint 9 | CLI | ✅ Complete`); pick the status that matches the validated grant/preview/approve/apply flow in `packages/cli/` and apply it consistently in both files.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (lines 47–61); cross-check `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 24–37)
- **Verification:** The table renders correctly (no empty first column in any row); the CLI status in `PROJECT_STATE.md` equals the Sprint 9 CLI status in `ROADMAP.md`.

### Task 9: Separate Completed, Pending, and Planned areas
- **Action:** In `PROJECT_STATE.md`, replace the unstructured `# Components` table and the free-form sprint history with three explicit sections: `## Completed` (Sprints 1–9 deliverables: runtime core, WorkGraph, scheduler, dispatcher, provider layer, agent/multi-agent/workflow runtime, CLI), `## Pending` (unvalidated work and open gaps, e.g. items in the unchecked Sprint 12 completion criteria), and `## Planned` (VS Code extension, GUI, and anything post-MVP). Move the Components table rows into these sections with their current status per row.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (lines 47–315)
- **Verification:** `Select-String -Path PROJECT_STATE.md -Pattern "^## (Completed|Pending|Planned)$"` returns exactly 3 matches, and every component previously in the table appears under exactly one of the three sections.

### Task 10: Move outdated session history out of PROJECT_STATE
- **Action:** Extract the historical session logs (lines 65–315: `# Completed During This Session - Sprint: Agent Runtime (Sprint 6)` and Sessions 001–006) into a new archive file `docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md` (create `docs/history/` if absent), preserving the content verbatim. In `PROJECT_STATE.md`, delete the extracted block and replace it with a one-line pointer: `Historical session logs: [docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md](docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md)`.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (lines 65–315) → `c:\Proyects\MultiAgentDev\docs\history\PROJECT_STATE-SESSIONS-ARCHIVE.md`
- **Verification:** The archive file exists and its line count is at least as large as the removed block minus the pointer line; `PROJECT_STATE.md` no longer contains the strings `Session 003`, `Session 004`, or `Session 006`; the relative link in `PROJECT_STATE.md` resolves on disk.

### Task 11: Align the Sprint 12 objective block
- **Action:** Rewrite the `# Current Mission` and `## Current Sprint` sections (lines 12–31) of `PROJECT_STATE.md` so the sprint objective matches `.ai\backlogs\012_sprint\README.md` verbatim in intent: documentation alignment, product framing/MVP, usage & risk docs, next-milestone prep. Keep the completion-criteria checkboxes, but sync their wording with the five workstreams in the sprint README, and add a link to `.ai\backlogs\012_sprint\README.md` as the canonical sprint reference.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (lines 12–31); reference `.ai\backlogs\012_sprint\README.md`
- **Verification:** `Select-String -Path PROJECT_STATE.md -Pattern "012_sprint"` returns a link match; the four primary workstreams from the sprint README are each represented in the completion criteria.

### Task 12: Cross-check PROJECT_STATE against README and ROADMAP
- **Action:** Run `Select-String -Path README.md,PROJECT_STATE.md,ROADMAP.md -Pattern "CLI|Sprint 12|sprint12|pre-MVP"` and review every hit side by side. Fix any remaining contradiction (branch name, CLI maturity, sprint status, test counts — e.g. `205/205` test count in old sections vs `## Repository Health` lines 37–43). Then run `npm run build` and `npx vitest run` one final time and update the `## Repository Health` numbers to the actual output.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md`, `PROJECT_STATE.md`, `ROADMAP.md`
- **Verification:** No contradicting statement remains across the three files for branch, CLI status, or Sprint 12 status; the `## Repository Health` test count equals the latest `npx vitest run` output; all four US-02 acceptance criteria are visibly satisfied.

## Atomized Tasks: US-03 — ROADMAP is consistent with delivery reality

### Task 13: Audit sprint status table against delivery reality
- **Action:** In `ROADMAP.md`, verify each row of the `# Current Progress` table (lines 22–37) against reality: Sprints 1–9 should read `✅ Complete` only if their exit criteria were met (cross-check with the per-sprint sections below the table and `PROJECT_STATE.md`), Sprints 10–11 `⏳ Planned`, Sprint 12 `🔄 Active` during execution and `✅ Complete` once the sprint is closed. Add a `**Historical**` label row-note under the table stating that Sprints 1–9 are historical records. Fix any row that misstates status.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 22–37)
- **Verification:** The table contains exactly 12 sprint rows, each with a status symbol; the historical label is present; `Select-String -Path ROADMAP.md -Pattern "Historical"` returns at least one match near the table.

### Task 14: Label historical sprint sections explicitly
- **Action:** In `ROADMAP.md`, group the Sprint 1–9 detail sections (lines 66–361) under a new `# Historical Sprints (1–9)` heading and demote their individual `# Sprint N` headings to `## Sprint N` so the document outline separates history from the active plan. Add a one-line note at the top of the group: `> These sections are historical records of completed work and must not be edited except to correct factual errors.`
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 66–361)
- **Verification:** `Select-String -Path ROADMAP.md -Pattern "^# Sprint"` returns zero matches (all sprint detail headings are now `##`); the historical note line exists directly under the new `# Historical Sprints (1–9)` heading.

### Task 15: Rewrite the Sprint 12 section with realistic scope
- **Action:** Replace the `# Sprint 12` section (lines 41–62) of `ROADMAP.md` so its Purpose, Scope, and Exit criteria mirror `.ai\backlogs\012_sprint\README.md` and the four epic files (`01_documentation-alignment.md` … `04_next-milestone.md`). Explicitly state that Sprint 12 is documentation-only (no runtime feature work) and link to the backlog index `.ai\backlogs\012_sprint\00_backlog-index.md`. Keep exit criteria as checkboxes.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 41–62); source `.ai\backlogs\012_sprint\00_backlog-index.md`
- **Verification:** `Select-String -Path ROADMAP.md -Pattern "012_sprint|documentation-only|no runtime"` returns matches in the Sprint 12 section; the section mentions all four epic files or the backlog index link.

### Task 16: Separate aspirational work from short-term scope
- **Action:** In `ROADMAP.md`, move `# Sprint 10 — VS Code Extension` and `# Sprint 11 — GUI` (lines 363–403) under a new `# Aspirational / Post-MVP` heading (demote to `## Sprint 10` / `## Sprint 11`), with an intro line stating these are not part of the near-term MVP and have no committed timeline. Keep the `# Architectural Evolution` and `# Legacy Mapping` sections, adding the same `> Historical / reference only` note used in Task 14.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md` (lines 363–462)
- **Verification:** `Select-String -Path ROADMAP.md -Pattern "^# Aspirational"` returns one match; Sprints 10 and 11 appear only under that section; the Legacy Mapping section carries the historical note.

### Task 17: Verify ROADMAP consistency and full epic review
- **Action:** (Review pass) Re-run the full US-03 acceptance checklist against `ROADMAP.md`: historical items labeled historical; current sprint reflects actual progress; Sprint 12 scope realistic; aspirational work separated. Then perform the epic-level consistency check from the story's Tasks section — read `README.md`, `PROJECT_STATE.md`, `ROADMAP.md`, and `.ai\backlogs\012_sprint\README.md` back to back in one sitting, and fix any remaining mismatch (branch, sprint numbering, CLI status, pre-MVP framing). Finish by running `git diff --stat` and confirming only documentation files changed (no `.ts` files touched).
- **Target File/Location:** `c:\Proyects\MultiAgentDev\ROADMAP.md`; cross-checks `README.md`, `PROJECT_STATE.md`, `.ai\backlogs\012_sprint\README.md`
- **Verification:** All four US-03 acceptance criteria are visibly satisfied; `git diff --stat` shows only `.md` files in the change set; `git status` is otherwise clean.
