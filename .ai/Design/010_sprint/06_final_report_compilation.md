# Objective

Compile all findings from Phases 1–5 of the Aer Runtime Architecture Review into a structured final architecture report following the template defined in `.ai/CLI/review/06_required_output_template.md`. The report must synthesize evidence-backed conclusions about Runtime type, ownership, lifecycle, communication method, persistence model, multi-instance behavior, and architectural classification.

# Existing Architecture

- Phase 1 (01_discover_bootstrap.md): Analyzes Runtime instantiation, ownership, and bootstrap flow
- Phase 2 (02_runtime_lifecycle.md): Documents lifecycle with evidence-backed checklist
- Phase 3 (03_cli_behaviour.md): Traces and documents CLI command behavior
- Phase 4 (04_runtime_ownership.md): Determines and evidences the ownership model
- Phase 5 (05_architectural_classification.md): Classifies architecture as In-Process Library
- Final report: Not yet created
- Output template exists at `.ai/CLI/review/06_required_output_template.md`

# Components to Reuse

- Output template from `.ai/CLI/review/06_required_output_template.md` — defines the required structure and sections
- Phase 1–5 finding documents (`.ai/review/010_sprint/01_discover_bootstrap.md` through `05_architectural_classification.md`) — source of all evidence and conclusions

# Components to Create

1. **Final Architecture Report Document** — Single Markdown file at `.ai/CLI/review/final_report.md` containing all template sections populated with findings from Phases 1–5

# Components to Modify

- No existing components are modified by this task
- Only a new report document is created

# Public Interfaces

No software interfaces are created. This is a documentation-only task producing a Markdown report. The report exposes:

1. **Runtime Type Section** — Classification of the Runtime (from Phase 5)
2. **Owner of Runtime Section** — Ownership model with evidence (from Phase 4)
3. **Lifecycle Section** — Lifecycle analysis with evidence (from Phase 2)
4. **Communication Method Section** — IPC/communication patterns (from Phases 2/3)
5. **Persistence Section** — State persistence model (from Phases 1/2)
6. **Multiple CLI Instances Section** — Multi-instance behavior (from Phases 4/5)
7. **Evidence Index Section** — Files, classes, functions cataloged across all phases
8. **Final Verdict Section** — Conclusive classification supported by objective evidence (from Phase 5)

# File Responsibilities

1. **`.ai/CLI/review/final_report.md`** — Contains the complete final architecture report with all template sections filled using findings from Phases 1–5

# Dependencies

- `.ai/review/010_sprint/01_discover_bootstrap.md` — Bootstrap and instantiation findings (hard dependency)
- `.ai/review/010_sprint/02_runtime_lifecycle.md` — Lifecycle findings (hard dependency)
- `.ai/review/010_sprint/03_cli_behaviour.md` — CLI behavior findings (hard dependency)
- `.ai/review/010_sprint/04_runtime_ownership.md` — Ownership findings (hard dependency)
- `.ai/review/010_sprint/05_architectural_classification.md` — Classification findings (hard dependency)
- `.ai/CLI/review/06_required_output_template.md` — Template structure (hard dependency)
- No dependency on Tasks 01–05 in this sprint (this is a documentation compilation task)

# Implementation Order

1. Read and parse all Phase 1–5 finding documents to extract evidence-backed conclusions
2. Map extracted findings to corresponding template sections:
   - Runtime Type → Phase 5
   - Owner of Runtime → Phase 4
   - Lifecycle → Phase 2
   - Communication Method → Phases 2/3
   - Persistence → Phases 1/2
   - Multiple CLI Instances → Phases 4/5
   - Evidence Index → All phases
   - Final Verdict → Phase 5
3. Populate the template with extracted findings, ensuring every claim includes file path + line reference evidence
4. Verify internal consistency across all sections
5. Write final report to `.ai/CLI/review/final_report.md`

# Acceptance Criteria

- [ ] All template sections are filled with accurate findings from phases 1–5
- [ ] Every claim is backed by specific file path and line number references
- [ ] The report follows the exact structure defined in the Phase 6 template
- [ ] No implementation code, improvements, or suggestions are included
- [ ] The final verdict clearly states whether the Runtime is a persistent service or a temporary in-process instance with supporting evidence

# Definition of Done

- Final architecture report document exists and is complete
- All sections populated with evidence-backed findings
- Report reviewed for internal consistency
- No other files modified beyond creating the report
