# 01 — Discover Runtime Bootstrap

## Objective
Locate and inspect the files involved in bootstrapping the Aer Runtime to understand where and how it is instantiated.

## Files to Inspect (One at a time)

1. `package.json` — Identify entry points, bin definitions, and dependencies related to CLI/Runtime.
2. CLI entrypoint — Locate the main CLI boot file (e.g., `src/cli/index.ts` or similar).
3. Runtime entrypoint — Locate the Runtime initialization module.
4. Runtime creation/bootstrap — Find where the Runtime is created.
5. Runtime lifecycle hooks — Look for start/stop/lifecycle methods.

## Questions to Answer

- Where is the Runtime instantiated?
- Who owns the Runtime instance (CLI process or separate)?
- Does the Runtime survive after the CLI process terminates?

## Evidence Required

- File path(s) where instantiation occurs.
- Relevant class names and method signatures.
- Code snippets showing bootstrapping logic.

## Output Format

```markdown
### Findings — Phase 1
- Runtime instantiated in: [file:path]
- Owner: [CLI | Unknown | Other]
- Survives CLI exit: [Yes | No | Unknown]
- Evidence: [list files + line references]
```

---

## Inspected Files

| # | File | Lines Read | Purpose |
|---|------|------------|---------|
| 1 | `package.json` | 1–53 | Entry points, bin definitions, dependencies |
| 2 | `src/cli/index.ts` | 1–305 | CLI boot file, Runtime import and usage |
| 3 | `src/index.ts` | 1–156 | Runtime public API exports |
| 4 | `src/core/runtime.ts` | 1–616 | Runtime class definition, lifecycle, factory |

---

### Findings — Phase 1

- **Runtime instantiated in:** `src/cli/index.ts:33` (via `createRuntime(...)`)
- **Owner:** CLI (the CLI process owns the Runtime instance as a module-level variable `globalRuntime`)
- **Survives CLI exit:** No (the Runtime lives only within the CLI Node.js process; when the process exits, the Runtime dies)

### Evidence

#### `package.json`
- Line 2: Package name `@aer/runtime` — the runtime is bundled as the same package as the CLI
- Line 5: `"type": "module"` — ESM-only project
- Lines 8–10: Bin definition maps `aer` command to `./dist/cli/index.js` — CLI is the entry point
- Line 6: Main export is `./dist/index.js` — same package exposes Runtime as a library too

#### `src/cli/index.ts`
- Line 9: `import { createRuntime, Runtime } from '../index.js'` — CLI imports Runtime factory from the library surface
- Line 19: `let globalRuntime: Runtime | null = null` — single process-level variable owns the instance
- Lines 33–37: `createRuntime({...})` called inside `start` command action — Runtime is created on-demand when user runs `aer start`
- Line 39: `await runtime.start()` — lifecycle method called immediately after creation
- Line 40: `globalRuntime = runtime` — assigned to CLI-owned variable
- Lines 118–126: `SIGINT` handler calls `globalRuntime.stop()` then `process.exit(0)` — explicit shutdown on process termination
- Lines 98–106: REPL `exit`/`quit` commands call `globalRuntime.stop()` then `process.exit(0)`
- Lines 133–151: `stop` command requires `globalRuntime` to exist — no IPC or external service

#### `src/index.ts`
- Line 14: `export { Runtime, RuntimeState, createRuntime, createDefaultConfig } from "./core/runtime.js"` — factory + class exported as library API
- Lines 21–151: All subsystems (EventBus, Workspace, Knowledge, Metrics, Logging, Scheduler) are co-exported — single-package monolith

#### `src/core/runtime.ts`
- Line 128: `class Runtime` — the Runtime is a plain TypeScript class, not a daemon or service
- Line 151: `constructor(config?)` — takes optional config, no network/server binding
- Lines 171–211: `async start()` — initializes subsystems in-process (logging → eventbus → workspace → knowledge → metrics)
- Lines 216–256: `async stop()` — graceful shutdown of all subsystems in reverse order
- Lines 261–281: `async pause()` / Lines 286–300: `async resume()` — pause/resume via subscription management
- Line 614: `function createRuntime(config?)` — factory function, creates a fresh instance each call
- No network servers, no IPC, no daemon fork/spawn detected in any inspected file

### Conclusion (Phase 1)

The Runtime is an **in-process library** bundled within the same package as the CLI. The CLI owns and instantiates the Runtime. There is no evidence of a persistent service, daemon process, or inter-process communication. The Runtime lifecycle is entirely tied to the Node.js process that created it.
