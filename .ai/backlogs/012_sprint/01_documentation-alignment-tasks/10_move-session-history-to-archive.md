# Task 10: Move outdated session history out of PROJECT_STATE

> Epic: [01_documentation-alignment.md](../01_documentation-alignment/01_documentation-alignment.md) — US-02: PROJECT_STATE matches the branch reality
> Sprint 12 · Documentation alignment · documentation-only (no runtime feature work)

- **Action:** Extract the historical session logs (lines 65–315: `# Completed During This Session - Sprint: Agent Runtime (Sprint 6)` and Sessions 001–006) into a new archive file `docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md` (create `docs/history/` if absent), preserving the content verbatim. In `PROJECT_STATE.md`, delete the extracted block and replace it with a one-line pointer: `Historical session logs: [docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md](docs/history/PROJECT_STATE-SESSIONS-ARCHIVE.md)`.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` (lines 65–315) → `c:\Proyects\MultiAgentDev\docs\history\PROJECT_STATE-SESSIONS-ARCHIVE.md`
- **Verification:** The archive file exists and its line count is at least as large as the removed block minus the pointer line; `PROJECT_STATE.md` no longer contains the strings `Session 003`, `Session 004`, or `Session 006`; the relative link in `PROJECT_STATE.md` resolves on disk.
