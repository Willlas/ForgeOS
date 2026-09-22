# Task 07: Verify the usage and risk docs against the acceptance criteria

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-08: Known gaps and risks are visible
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Open the acceptance criteria in [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) and check each one against the repository. US-07: commands documented accurately (diff the usage section against `packages/cli/src/index.ts`), examples based on a real working flow (diff against the Task 01 `## Findings`), validated behavior clearly separated (re-run the Task 02 check). US-08: gaps listed, risks named and mitigated, dependencies explicit, register short and actionable (inspect the `## Known Risks` table). Record the results as a checklist under `## Findings` in this file, marking pass/fail with the evidence location for each item. Fix any fail in the same pass, or log it with an explicit reason — do not close this task with unexplained fails.
- **Target File/Location:** this file (`## Findings` checklist); fixes (if any) in `c:\Proyects\MultiAgentDev\README.md` and `c:\Proyects\MultiAgentDev\PROJECT_STATE.md`
- **Verification:** Every US-07 and US-08 acceptance criterion has a pass entry with a concrete evidence pointer in `## Findings`; the usage section, the example, and the risk register are mutually consistent; and no statement in the docs contradicts the recorded run, the test suite, or the maturity labels.
