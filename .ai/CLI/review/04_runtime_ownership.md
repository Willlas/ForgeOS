# 04 — Runtime Ownership Analysis

## Objective
Determine who owns the ForgeOS Runtime instance and how ownership is maintained.

## Possible Ownership Models

Evaluate which of the following applies:

- [x] **CLI owns Runtime** — The CLI process creates and holds the Runtime; when CLI exits, Runtime dies.
- [ ] **Runtime owns itself** — The Runtime instantiates itself independently of the CLI.
- [ ] **Daemon owns Runtime** — A daemon process is responsible for the Runtime lifecycle.
- [ ] **Background process owns Runtime** — A separate background process manages the Runtime.
- [ ] **Other** — Describe the ownership model discovered.

## Files to Inspect (One at a time)

- CLI entry point (`src/cli/index.ts` or similar).
- Runtime class/module definitions in `src/runtime/`.
- Any factory patterns, singleton patterns, or service locators.
- Process management code (spawn, fork, exec usage).
- Dependency injection or module registration.

## Questions to Answer

1. Who creates the Runtime instance? (CLI | Runtime itself | External process)
2. Who is responsible for starting the Runtime?
3. Who is responsible for stopping the Runtime?
4. Can the Runtime outlive the CLI that created it?
5. Is there a single owner, or multiple owners?

## Evidence Required

- File path(s) showing ownership logic.
- Class/method names responsible for creation and destruction.
- Code excerpts demonstrating the ownership relationship.

## Output Format

### Findings — Phase 4
- Owner: CLI
- Creator: src/cli/index.ts:33 (createRuntime function)
- Stopped by: src/cli/index.ts:102, 144 (stop method called on globalRuntime)
- Can outlive CLI: No
- Evidence: The Runtime is created in src/cli/index.ts at line 33 via createRuntime() and assigned to a global variable. The CLI process owns this instance and is responsible for starting (line 39) and stopping (lines 102, 144) the Runtime. There is no evidence of the Runtime outliving the CLI process as it's entirely in-process.