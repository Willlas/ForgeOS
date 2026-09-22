# Task 04: Draft a risk and gap register

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-08: Known gaps and risks are visible
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** In `PROJECT_STATE.md`, turn the existing `## Known Risks` section into a short risk and gap register table with columns **Area** | **Status** (validated / experimental / planned) | **Risk or gap** | **Dependency**. Seed it from the existing `## Pending`, `## Technical Debt`, and `## Known Risks` sections plus the Task 01 `## Findings`, covering at least: (1) the CLI grant → preview → approve → apply loop is the only validated path, and any discrepancy found by the Task 01 real run; (2) multi-agent coordination is implemented and unit-tested but not a validated end-to-end workflow; (3) only the Ollama provider is implemented (OpenAI/Anthropic are interface types only) and provider capability detection is static; (4) provider health checks depend on Ollama running locally. Keep it to the 5–8 highest-signal entries — short and actionable, no padding.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` — `## Known Risks` section
- **Verification:** The table exists with all four columns, every entry traces to code, the test suite, or a recorded run (no invented risks), statuses match the `## Component Maturity Matrix` in the same file, and the section is short enough to read in under two minutes.
