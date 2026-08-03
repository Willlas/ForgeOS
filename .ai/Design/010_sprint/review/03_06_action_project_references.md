# Action 03_06 — Add TypeScript project references

## Objective
Enforce CLI → Runtime build order via TypeScript composite project references,
replacing the current implicit reliance on the npm workspace symlink happening to
exist before `tsc` runs.

## Backlog reference
- **Severity:** Medium
- **Blocks Design 04?** No

## Why it matters
None of the three tsconfigs (`root`, `packages/runtime`, `packages/cli`) use
`references` or `composite`. There is no `tsc --build` graph and no incremental
build. The CLI compiles against whatever `@aer/runtime-lib` declarations happen
to be in `node_modules` at build time — which can be stale.

## Prerequisites
- **03_02** complete (root config already off legacy `src/`).
- **03_05** recommended first (cleaner tree before introducing the build graph),
  but not strictly required.

## Steps

### 1. `packages/runtime/tsconfig.json`
- Add `"composite": true` to `compilerOptions`.
- `composite` requires `declaration` (already `true`) and a `tsBuildInfoFile` is
  advisable. Add `"tsBuildInfoFile": "./dist/.tsbuildinfo"` (or similar).
- Keep `rootDir: "./src"`, `outDir: "./dist"`, `include`, `exclude` as-is.

### 2. `packages/cli/tsconfig.json`
- Add `"composite": true` to `compilerOptions`.
- Add `"tsBuildInfoFile": "./dist/.tsbuildinfo"`.
- Add a `references` array referencing the runtime project:
  ```jsonc
  "references": [{ "path": "../runtime" }]
  ```

### 3. Root `tsconfig.json` — convert to a solution file
- Replace the contents with a solution-style config:
  ```jsonc
  {
    "files": [],
    "references": [
      { "path": "./packages/runtime" },
      { "path": "./packages/cli" }
    ]
  }
  ```
- This removes the root's own `include`/`outDir`/`rootDir` (root no longer emits
  directly; it orchestrates the referenced projects). If 03_02 left a root
  `compilerOptions` block for IDE support, fold the desired `compilerOptions`
  (target, module, strict flags) into each package config instead, or keep a
  shared base that packages `extends`.

### 4. Root `package.json` `build` script (optional)
- Consider switching to `"build": "tsc --build"` for a graph-aware incremental
  build that respects references and build ordering. Alternatively keep
  `npm run build --workspaces` (which invokes each package's `build` separately).
- If you adopt `tsc --build`, ensure a matching `clean` uses
  `tsc --build --clean`.

## Files
- `packages/runtime/tsconfig.json`
- `packages/cli/tsconfig.json`
- `tsconfig.json` (root)
- `package.json` (root — `build`/`clean` scripts, optional)

## Constraints
- `composite: true` forbids some configurations — verify there are no `include`
  patterns that pull in files outside `rootDir`.
- The CLI referencing runtime means **runtime must build before CLI**; the
  `references` graph enforces this — do not add a back-reference
  (runtime → cli) or you create a cycle.
- Do **not** add `paths` aliases as a substitute for references; rely on the
  workspace symlink + `references`.

## Verification
- `npx tsc --build` from the repo root builds runtime first, then cli, and
  reports a clean graph (no "project may not be referenced" or missing-reference
  diagnostics).
- Touching a runtime source and re-running `tsc --build` rebuilds runtime and
  type-checks cli (incremental).
- `npm run build` still produces `packages/runtime/dist` and `packages/cli/dist`.
