# Action 03_01 — Make Runtime package self-contained (declare `dotenv`)

## Objective
Ensure `@aer/runtime-lib` installs and runs without relying on the monorepo
root's hoisted dependencies. Today `dotenv` is imported at runtime but declared
only as a root **dev**Dependency.

## Backlog reference
- **Severity:** Critical (publish-blocker)
- **Blocks Design 04?** **Yes** — Design 04 §"Components to Reuse" depends on
  `config/` for persistence path resolution; a broken config load breaks D04.

## Why it matters
`packages/runtime/src/config/index.ts:1` executes `import dotenv from "dotenv"`.
`packages/runtime/package.json` lists only `jsonschema` under `dependencies`.
`dotenv` resolves only because the root `package.json` hoists `dotenv ^17.4.2`
as a devDependency. A standalone install / `npm publish` of `@aer/runtime-lib`
will throw `Cannot find module 'dotenv'` at runtime.

## Prerequisites
None. This is independent and safe to do first.

## Steps
1. Open `packages/runtime/package.json`.
2. Add to `dependencies`:
   `"dotenv": "^17.4.2"` — match the root's version range exactly (root devDep).
   It is a **runtime** import (loaded unconditionally at module top), so it must
   be a regular dependency, **not** devDependencies.
3. From the repo root, run `npm install` to update the workspace lockfile.
4. Confirm `dotenv` is resolved under the runtime workspace, not only at root.

## Files
- `packages/runtime/package.json` (edit `dependencies`)
- `packages/runtime/src/config/index.ts` (read-only — confirms the import at line 1)

## Constraints
- Do **not** downgrade/upgrade the version arbitrarily — align with the root's
  declared `^17.4.2` to avoid duplicate copies in the dependency tree.
- Do **not** move `dotenv` to `devDependencies` — the import is unconditional.
- Do **not** alter `config/index.ts` logic.

## Verification
- `node -e "import('./dist/config/index.js').then(()=>console.log('dotenv ok'))"`
  run from `packages/runtime` prints `dotenv ok` without throwing.
- `npm ls dotenv --workspace @aer/runtime-lib` lists `dotenv` under the runtime
  workspace.
- After this change, `npm run build` (workspaces) still completes green.
