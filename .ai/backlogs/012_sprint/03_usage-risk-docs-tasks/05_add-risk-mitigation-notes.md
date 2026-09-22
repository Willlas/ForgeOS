# Task 05: Add mitigation notes for each risk

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-08: Known gaps and risks are visible
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Add a **Mitigation / next step** column to the register created in Task 04. Each note must be something a maintainer can act on or monitor now — e.g. "run an end-to-end multi-agent workflow and record the result before promoting it out of experimental", "keep new backends behind `IProvider` so they stay additive", "state the local-Ollama prerequisite wherever provider health is documented". Where no mitigation exists yet, write "none yet — tracked as future work" instead of inventing one. Do not promise dates, versions, or unapproved scope.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\PROJECT_STATE.md` — `## Known Risks` register table
- **Verification:** Every row in the register has a mitigation or an explicit "none yet" note; each note is concrete, consistent with the Active Engineering Decisions in the same file (provider-independence, incremental refactors), and free of dates, version numbers, or commitments not already in the roadmap.
