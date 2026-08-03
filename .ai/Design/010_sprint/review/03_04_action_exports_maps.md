# Action 03_04 — Add `exports` maps to both packages

## Objective
Give both packages a modern entry-point contract via the `exports` field, as
required by Design §"Components to Create" ("packages/runtime/package.json …
exports … packages/cli/package.json …"). Today both expose only legacy
`main` / `types`.

## Backlog reference
- **Severity:** Medium
- **Blocks Design 04?** No

## Why it matters
Without an `exports` map, deep imports like
`@aer/runtime-lib/dist/core/eventbus.js` are technically reachable (because
`files` ships `dist`) but **uncontracted** — consumers can silently depend on
internal paths that may shift. A declared `exports` map makes the public entry
explicit and lets you forbid deep imports.

## Prerequisites
- **03_03** recommended first (so the contracted entry actually contains the
  intended public API), but not strictly required to add the map.

## Steps

### 1. `packages/runtime/package.json`
Add an `exports` field (place it near `main`/`types`):
```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```
- Keep existing `main` and `types` fields for back-compat with consumers that do
  not read `exports`.
- The package is `"type": "module"` and ships only ESM, so a single `"import"`
  condition is sufficient (no `"require"` condition needed).

### 2. `packages/cli/package.json`
Add an `exports` field:
```jsonc
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```
- The CLI is primarily a binary; `bin` already maps `aer` and `aer-daemon`. The
  `"."` export covers any programmatic import of the CLI library entry.

### 3. Deep-import policy (decision)
Decide whether to **forbid** or **allow** deep imports and apply consistently:
- Recommended: forbid by not adding any `"./dist/*"` or `"./core/*"` subpath
  entries. With an `exports` map present, Node will reject unlisted deep paths,
  which is the desired behavior (forces consumers through the barrel).
- If a deep import is genuinely needed by an internal consumer, add an explicit
  subpath entry for it and document why.

## Files
- `packages/runtime/package.json`
- `packages/cli/package.json`

## Constraints
- Every `exports` subpath **must** include both a `"types"` and an `"import"`
  (or `"default"`) condition, or TypeScript / Node resolution will break.
- Do **not** remove `main` / `types` (back-compat for non-`exports`-aware tools).
- Do **not** add subpath entries for internal modules unless explicitly justified.

## Verification
- `npm run build` (both workspaces) completes green.
- A consumer import `import { Runtime } from "@aer/runtime-lib"` resolves in `tsc`
  (types condition) and at runtime (import condition).
- `node -e "import('@aer/runtime-lib/dist/core/eventbus.js')"` is rejected by
  Node's resolver (confirms deep imports are now forbidden, as intended) — only
  assert this if you chose the "forbid" policy in step 3.
