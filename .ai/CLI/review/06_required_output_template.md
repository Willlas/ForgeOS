# 06 — Required Output Template (Final Report)

## Objective
Compile all findings from Phases 1–5 into a structured final architecture report.

---

## Template

```markdown
# ForgeOS Runtime Architecture Review — Final Report

## Architecture Summary

### Runtime Type
[classification from Phase 5]

### Owner of Runtime
[owner from Phase 4]

### Lifecycle
[lifecycle description from Phase 2]

### Communication Method
[IPC method identified in Phase 2/3, or "none — in-process"]

### Persistence
[does it persist after CLI exits? Yes/No + evidence]

---

## Multiple CLI Instances

### Can multiple CLI invocations communicate with the same Runtime?
[YES / NO]

#### If YES:
Explain how (shared process, socket, named pipe, HTTP endpoint, etc.).

#### If NO:
Explain why (each CLI creates its own Runtime instance, no shared state, etc.).

---

## Evidence Index

### Files Inspected
- [file path 1]
- [file path 2]
- ...

### Relevant Classes
- [class name] — [file path] — [brief description of role]
- ...

### Relevant Functions/Methods
- [function name] — [file path] — [brief description of behavior]
- ...

---

## Final Verdict

The Runtime is:

[ ] A persistent Runtime Service (Daemon)
[ ] A temporary in-process Runtime instantiated by the CLI

### Supporting Evidence
[List objective evidence supporting the verdict.]

---

## Notes

- Stop after this report.
- Do not suggest improvements.
- Do not implement anything.
- Do not continue to another Sprint.
```

## Instructions

1. Copy this template into a new file or use it inline.
2. Fill in each section using findings from the previous phase files.
3. Ensure every claim is backed by evidence (file path + line reference).
4. Review for consistency before finalizing.
