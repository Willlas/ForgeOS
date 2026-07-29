# 04 — Runtime Ownership Analysis

## Objective
Determine who owns the ForgeOS Runtime instance and how ownership is maintained.

## Possible Ownership Models

Evaluate which of the following applies:

- [ ] **CLI owns Runtime** — The CLI process creates and holds the Runtime; when CLI exits, Runtime dies.
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

```markdown
### Findings — Phase 4
- Owner: [CLI | Runtime | Daemon | Background | Other]
- Creator: [file:path + class/method]
- Stopped by: [file:path + class/method]
- Can outlive CLI: [Yes/No]
- Evidence: [list all relevant files + line references]
```
