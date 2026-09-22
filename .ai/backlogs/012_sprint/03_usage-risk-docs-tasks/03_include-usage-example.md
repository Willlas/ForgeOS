# Task 03: Include a concrete usage example

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-07: The validated console flow is documented
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Add a short, copy-pasteable example inside the `## Usage — validated CLI flow` section created in Task 01: a numbered sequence of the exact commands from the real run recorded in [01_capture-validated-cli-workflow.md](01_capture-validated-cli-workflow.md), using a scratch workspace root as `<root>`, including the confirmation prompts and the single-use approvalId hand-off between `aer workspace:approve` and `aer workspace:apply`. Every command, argument, and flag must come from that recorded run or from `packages/cli/src/index.ts` — do not invent options. Where the run produced an unexpected detail, keep it in the example and note it inline instead of smoothing it over.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` — `## Usage — validated CLI flow` section
- **Verification:** A new reader can reproduce the example from the commands alone; each command matches both the Task 01 `## Findings` output and the definitions in `packages/cli/src/index.ts`; and the example contains no flag, option, or behavior that was not present in the verified run.
