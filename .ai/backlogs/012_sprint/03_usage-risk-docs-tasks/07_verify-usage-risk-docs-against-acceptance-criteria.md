# Task 07: Verify the usage and risk docs against the acceptance criteria

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-08: Known gaps and risks are visible
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Open the acceptance criteria in [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) and check each one against the repository. US-07: commands documented accurately (diff the usage section against `packages/cli/src/index.ts`), examples based on a real working flow (diff against the Task 01 `## Findings`), validated behavior clearly separated (re-run the Task 02 check). US-08: gaps listed, risks named and mitigated, dependencies explicit, register short and actionable (inspect the `## Known Risks` table). Record the results as a checklist under `## Findings` in this file, marking pass/fail with the evidence location for each item. Fix any fail in the same pass, or log it with an explicit reason — do not close this task with unexplained fails.
- **Target File/Location:** this file (`## Findings` checklist); fixes (if any) in `c:\Proyects\MultiAgentDev\README.md` and `c:\Proyects\MultiAgentDev\PROJECT_STATE.md`
- **Verification:** Every US-07 and US-08 acceptance criterion has a pass entry with a concrete evidence pointer in `## Findings`; the usage section, the example, and the risk register are mutually consistent; and no statement in the docs contradicts the recorded run, the test suite, or the maturity labels.

## Findings

Verified 2026-09-22 against the acceptance criteria in [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md). Evidence base: `README.md`, `PROJECT_STATE.md`, `ROADMAP.md`, `packages/cli/src/index.ts` (lines 330–570), and the Task 01 recorded run (`01_capture-validated-cli-workflow.md`).

### US-07: The validated console flow is documented

- [x] **Commands documented accurately (diff usage section against `packages/cli/src/index.ts`)** — **PASS.** Every command in `README.md` `## Usage — validated CLI flow` (lines 89–173) matches its definition in `packages/cli/src/index.ts`: `workspace:grant` (`--root` positional, `-m, --mode <mode>` default `read-only`, `-t, --tools <tools>` default `list,read,search`, `--yes`), `workspace:preview` (`-f, --file <file>`, `-c, --content <content>`), `workspace:approve` (`--diffHash` positional, `--yes`), `workspace:apply` (`--approvalId` positional, `-f`/`-c` pair, `--yes`). Flag letters, argument names, defaults, and confirm prompts (e.g. `Approve applying changes to <root> (diffHash …)? (yes/no)`) all match.
- [x] **Examples based on a real working flow (diff against Task 01 `## Findings`)** — **PASS.** `README.md` lines 139–173 ("Example — the verified run, copy-pasteable") reproduce the Task 01 recorded run verbatim: session `usage-check-01`, recorded `diffHash` `6319f29f…ea352`, `approvalId` `wsa_usage-ch_1790025413941_4`, the empty-file `expectedHash` (`e3b0c442…b855`), and the expected-failure case (reused approvalId → `[object Object]` display bug), each cross-referenced to `01_capture-validated-cli-workflow.md`.
- [x] **Validated behavior clearly separated (re-run of the Task 02 check)** — **PASS.** `README.md` `## Maturity classification` (lines 43–53) defines the three-label scheme and cross-labels the Stable tier **experimental** except the CLI loop; `## MVP boundary` (lines 22–41) lists multi-agent, extra providers, and VS Code/GUI as out of scope; `PROJECT_STATE.md` `# MVP Boundary` note and `## Completed` header both disambiguate "Complete"; `ROADMAP.md` Sprint 7 exit criteria qualified as experimental (Task 06 edit, logged in `06_check-docs-for-overclaiming.md` `## Findings`). Exactly one validated path is presented.

### US-08: Known gaps and risks are visible

- [x] **Gaps listed** — **PASS.** `PROJECT_STATE.md` `## Known Risks` register (7 rows) covers: mutation-flow grant requirement, CLI error reporting, multi-agent E2E gap, missing provider backends, static capability detection, local-Ollama dependency, and VS Code/GUI design-only status — seeded from `## Pending`, `## Technical Debt`, and the Task 01 Findings, per the register's intro line.
- [x] **Risks named and mitigated** — **PASS.** Every register row carries a Mitigation/next-step cell with a concrete action (e.g. "run `aer-daemon` in a visible terminal" workaround; "gate feature use on `provider.capabilities`"; "E2E validation run before any capability claim"). No bare risk rows.
- [x] **Dependencies explicit** — **PASS.** Every register row names its dependency (`aer-daemon` running + explicit read-write grant; local Ollama instance with the required model; per-backend `IProvider` implementations; model-level override mechanism; validated MVP runtime path).
- [x] **Register short and actionable (5–8 entries)** — **PASS.** 7 rows, all traceable to code, the test suite (402/402), or the recorded run; statuses match the `## Component Maturity Matrix` in the same file.

### Consistency checks

- [x] **Usage section, example, and risk register mutually consistent** — **PASS (after fix).** The register's CLI-loop row documents the same read-write grant requirement shown in the README example; the error-reporting row matches the README step 5 expected failure and the `[object Object]` finding. **Fail found and fixed in this pass:** two register rows pointed to a "README quickstart" section that does not exist in `README.md` (no such heading; "quickstart" appears nowhere in the file). Fixed in `PROJECT_STATE.md`: the CLI-loop row now points to `README ## Usage — validated CLI flow` (which does document the full read-write grant), and the Provider-health row now states the actual gap (README names Ollama as the only provider but does not state the local-Ollama prerequisite) instead of asserting a mitigation that doesn't exist.
- [x] **No statement contradicts the recorded run, test suite, or maturity labels** — **PASS.** Test counts (402/402, 27 files) consistent across `README.md`, `PROJECT_STATE.md`, and `ROADMAP.md`; multi-agent is **experimental** everywhere; OpenAI/Anthropic **planned** everywhere; only the CLI loop is **validated**; the `[object Object]` bug is honestly reported as a known CLI display defect rather than a working behavior.

### Fixes applied in this pass

1. `PROJECT_STATE.md` `## Known Risks`, CLI-workspace-loop row — **before:** "Follow the README quickstart (documents the full read-write grant for mutation flows)" → **after:** "Follow the README `## Usage — validated CLI flow` (documents the full read-write grant for mutation flows)". Reason: the README has no quickstart section; the grant flow is documented in the usage section.
2. `PROJECT_STATE.md` `## Known Risks`, Provider-health row — **before:** "The README quickstart already states the local-Ollama prerequisite — keep it wherever provider health is documented" → **after:** "The README currently names Ollama as the only implemented provider (intro and `## MVP boundary`) but does not state the local-Ollama prerequisite — document it wherever provider health is described". Reason: the claimed quickstart statement does not exist in `README.md`; the row now records the actual gap instead of asserting a false mitigation.

No unresolved fails.
