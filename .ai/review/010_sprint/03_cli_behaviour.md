# 03 — CLI Behaviour Analysis

## Objective
Determine what happens when executing specific CLI commands and trace where the reported status originates.

## Test Command 1: `node dist/cli/index.js start`

### Questions to Answer
When this command is executed, does it:
- [x] Block (keep the terminal occupied)?
- [x] Exit immediately?
- [x] Remain running in the foreground?
- [ ] Detach and run in the background?
- [x] Keep a Runtime alive after the command returns?

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

### Findings — Phase 3
#### `start` command
- Behavior: blocks (evidence: src/cli/index.ts lines 33-43, 45-116)
- Runtime kept alive: No (evidence: src/cli/index.ts lines 39, 40, 118-126)
- Evidence: The start command creates a runtime instance, starts it, and then enters an interactive REPL that blocks the terminal until exit. The CLI process itself is responsible for managing the Runtime lifecycle.

#### `status` command
- Status source: in-memory (evidence: src/cli/index.ts lines 156-179)
- Communication method: direct call (evidence: src/cli/index.ts lines 156-179)
- Evidence: The status command directly accesses the globalRuntime instance that's stored in memory by the CLI process, retrieving health information from the Runtime object.
