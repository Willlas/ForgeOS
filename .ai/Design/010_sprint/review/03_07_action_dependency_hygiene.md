# Action 03_07 — Dependency hygiene (version pin, `require` in ESM, naming)

## Objective
Three small, independent fixes that harden correctness and consistency. None is
blocking, but all reduce future maintenance risk.

## Backlog reference
- **Severity:** Medium (#8, #9) / Low (#11)
- **Blocks Design 04?** No

## Why it matters
- **Version pin (backlog #8):** `packages/cli/package.json` declares
  `"@aer/runtime-lib": "0.1.0"` (exact). Any runtime patch forces a coordinated
  CLI bump; consumers cannot substitute. Monorepo convention is `workspace:*`.
- **`require()` in ESM (backlog #9):** `packages/runtime/src/core/workspace.ts:507`
  uses `require("path")` in a `"type": "module"` package, while the rest of the
  file uses dynamic `await import("path")`. Latent failure in pure-ESM hosts.
- **Naming (backlog #11):** package is `@aer/cli` / bin `aer`, but source strings
  say "ForgeOS" (`program.name('forgeos')`, `forgeos-daemon.pid`, `FORGEOS_*`
  env vars). Cosmetic but confusing, especially for D04 which adds more
  PID-file/env-var identifiers.

## Prerequisites
None. Fully independent — can run at any point.

## Steps

### Fix A — Runtime version pin in CLI
1. Open `packages/cli/package.json`.
2. Change `"@aer/runtime-lib": "0.1.0"` → `"@aer/runtime-lib": "workspace:*"`.
   (At publish time, npm rewrites `workspace:*` to the concrete version.)
3. From repo root, run `npm install` to update the lockfile.
4. Verify `npm ls @aer/runtime-lib --workspace @aer/cli` resolves to the local
   workspace.

### Fix B — Replace `require()` in ESM
1. Open `packages/runtime/src/core/workspace.ts`.
2. Find line 507: `const dir = require("path").dirname(fullPath);`.
3. Normalize to match the file's existing dynamic-import style, **or** —
   preferred — add a static top-of-file import `import { dirname } from "path";`
   and replace the call with `dirname(fullPath)`. Prefer the static import; `path`
   is synchronous and always available in Node, so a dynamic import is unnecessary
   for it. Match whichever style dominates the rest of the file.
4. Re-build the runtime workspace; confirm no diagnostics and the module loads.

### Fix C — Naming consistency (ForgeOS → @aer/aer)
1. Audit usages: grep for `forgeos` / `ForgeOS` / `FORGEOS_` across `packages/cli/src/`.
2. Decide the canonical identity (recommend aligning to the package/bin name
   `aer` / `@aer`).
3. Update `program.name('forgeos')` → `aer` (or chosen name).
4. Rename env vars `FORGEOS_IPC_SOCKET`, `FORGEOS_HEALTH_PORT`,
   `FORGEOS_DAEMON_PID_DIR` → an `AER_*` (or chosen) scheme.
5. Rename the PID file `forgeos-daemon.pid` → `aer-daemon.pid`.
6. **Important:** if Design 01 (daemon) or Design 02 (IPC) tests or docs depend on
   the old env-var names, coordinate the rename with those. If any runtime code
   reads the same env vars (e.g. `packages/runtime/src/ipc-transport.ts:13`
   reads `process.env.FORGEOS_IPC_SOCKET`), update **both** sides so CLI and
   runtime agree.

## Files
- `packages/cli/package.json` (Fix A)
- `packages/runtime/src/core/workspace.ts` (Fix B)
- `packages/cli/src/index.ts`, `packages/cli/src/daemon.ts`,
  `packages/cli/src/daemon-entry.ts`, and any runtime file reading `FORGEOS_*`
  env vars (Fix C)

## Constraints
- Fix C is a **coordinated rename** across CLI and runtime — both sides of any
  shared env var must change together, or IPC/PID resolution breaks silently.
- If env-var names are part of any Design contract (01/02), do not rename without
  noting the deviation; prefer to defer Fix C if it risks destabilizing upstream
  designs.
- Do **not** change `commander` or `jsonschema` versions.

## Verification
- `npm run build && npm test` green after all three fixes.
- `grep -rn "require(" packages/runtime/src/` returns no `require("path")` (Fix B).
- `grep -rni "forgeos" packages/` returns nothing (Fix C), assuming a full rename.
- `npm ls @aer/runtime-lib --workspace @aer/cli` shows the workspace link (Fix A).
