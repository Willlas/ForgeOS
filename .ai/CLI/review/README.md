# ForgeOS Runtime Architecture Review

This folder contains broken-down investigation tasks for auditing whether the ForgeOS Runtime is a persistent service (daemon) or a temporary in-process library.

## Task Files

| File | Phase | Focus |
|------|-------|-------|
| `00_rules_and_constraints.md` | Global | Rules that apply to all phases |
| `01_discover_bootstrap.md` | Phase 1 | Locate and inspect Runtime bootstrap |
| `02_runtime_lifecycle.md` | Phase 2 | Determine how Runtime lives/dies |
| `03_cli_behaviour.md` | Phase 3 | Analyze CLI command behavior |
| `04_runtime_ownership.md` | Phase 4 | Determine who owns the Runtime |
| `05_architectural_classification.md` | Phase 5 | Classify the architecture |
| `06_required_output_template.md` | Final | Template for the final report |

## Global Constraints

- Do NOT modify the repository. EXCEPT .MD FILES IN THIS FOLDER
- Do NOT implement anything.
- Do NOT commit.
- Do NOT update ROADMAP.md or PROJECT_STATE.md.
- This is an architecture audit only.

## Execution Order

Complete tasks sequentially from 00 to 06. Each task depends on findings from the previous one.
