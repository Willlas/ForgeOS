# 03 — CLI Behaviour Analysis

## Objective
Determine what happens when executing specific CLI commands and trace where the reported status originates.

## Test Command 1: `node dist/cli/index.js start`

### Questions to Answer
When this command is executed, does it:
- [ ] Block (keep the terminal occupied)?
- [ ] Exit immediately?
- [ ] Remain running in the foreground?
- [ ] Detach and run in the background?
- [ ] Keep a Runtime alive after the command returns?

### Files to Inspect
- `src/cli/index.ts` — The CLI entry point.
- Any command handler for the `start` subcommand.
- The logic immediately invoked when `start` is called.

---

## Test Command 2: `node dist/cli/index.js status`

### Questions to Answer
- Where does the reported status come from?
- Does it query a running daemon/service?
- Does it read in-memory state (only available if CLI owns Runtime)?
- Does it read a file/pid/socket?

### Files to Inspect
- The `status` command handler.
- Any status-reporting modules.
- Communication channels used to retrieve status.

---

## Evidence Required

For each command:
- Exact code path executed (file + method).
- Whether the process blocks or exits.
- Source of status information.

## Output Format

```markdown
### Findings — Phase 3
#### `start` command
- Behavior: [blocks | exits | detaches]
- Runtime kept alive: [Yes/No]
- Evidence: [file:path + description]

#### `status` command
- Status source: [in-memory | daemon query | file | other]
- Communication method: [direct call | IPC | HTTP | socket | other]
- Evidence: [file:path + description]
```
