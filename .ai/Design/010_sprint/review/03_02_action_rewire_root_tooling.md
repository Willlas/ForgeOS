# Action 03_02 — Rewire root tooling onto `packages/`

## Objective
Stop the split-brain state where `npm run build` compiles `packages/*` but
`dev` / `test` / `lint` / `format` and the `@aer` vitest alias all resolve to the
legacy `src/` tree. After this action, the new packages are the single target for
every root script.

This also wires the package test suites into `npm test` (covers backlog #4).

## Backlog reference
- **Severity:** Critical
- **Blocks Design 04?** **Yes** — D04 modifies the CLI status command and the
  daemon entry point; those files must be the ones under test.

## Why it matters
- Root `package.json` scripts: `dev: "tsx src/index.ts"`, `lint: "eslint src/"`,
  `format: "prettier --check src/"` — all target legacy `src/`.
- Root `tsconfig.json`: `"rootDir": "./src"`, `"include": ["src/**/*.ts"]`.
- `vitest.config.ts`: `include: ["src/**/*.test.ts"]`, coverage
  `include: ["src/**/*.ts"]`, and the alias `"@aer": path.resolve(__dirname, "./src")`
  which silently redirects test imports to legacy code.

Consequence: changes to `packages/` are never exercised by tests or lint.
Design 03 DoD5 ("All tests pass with updated import paths") cannot be shown.

## Prerequisites
- **03_01** recommended first (so the runtime builds cleanly during verification),
  but not strictly required to edit the config files.

## Steps

### 1. `vitest.config.ts`
- Change `test.include` from `["src/**/*.test.ts"]` → `["packages/**/*.test.ts"]`.
- Change `coverage.include` from `["src/**/*.ts"]` → `["packages/**/*.ts"]`.
- Adjust `coverage.exclude` analogously (e.g. `"packages/**/*.test.ts"`,
  `"packages/**/*.d.ts"`, keep excluding barrel `index.ts` files if desired).
- **Delete** the `resolve.alias` block entirely (the `"@aer": ..../src"` entry).
  Package tests import via relative paths (e.g. `../agent-team.js`,
  `../../core/workgraph.js`), **not** via `@aer`, so removing the alias is safe.
  Cross-package references resolve through the npm workspace symlink.

### 2. `package.json` (root `scripts`)
- `lint`: `"eslint packages/"` ; `lint:fix`: `"eslint packages/ --fix"`.
- `format`: `"prettier --check packages/"` ; `format:fix`:
  `"prettier --write packages/"`.
- `dev`: re-point to the CLI entry, e.g. `"tsx packages/cli/src/index.ts"`.
- `clean`: clean workspace dist dirs, e.g. `"npm run clean --workspaces"` (note:
  each package already has `clean: "rm -rf dist"`).
- Keep `build: "npm run build --workspaces"`.
- Keep `test` / `test:watch` / `test:coverage` as-is (they invoke vitest, which
  step 1 now scopes to packages).

### 3. `tsconfig.json` (root) — intermediate, non-emitting
The root tsconfig should no longer compile legacy `src/`. Builds happen
per-package via `npm run build --workspaces`, so the root config is for IDE /
type-checking only.
- Change `include` → `["packages/**/*.ts"]`.
- **Remove** `outDir` and `rootDir` (the root should not emit; each package owns
  its own `outDir`).
- Optionally add `"composite": false` / leave emission settings; the goal is just
  to stop referencing `src/`.
- Note: **03_06** later upgrades this to a proper solution file with `references`.
  Keep this step simple now.

## Files
- `vitest.config.ts`
- `package.json` (root — `scripts` only)
- `tsconfig.json` (root)

## Constraints
- Do **not** delete the `@aer` alias until you have confirmed no file under
  `packages/` imports `@aer/...` (the validation confirmed they use relative
  paths; re-confirm with a grep before deleting).
- Do **not** change per-package `tsconfig.json` files in this action (that is 03_06).
- Do **not** touch `src/` (legacy retirement is 03_05).
- Preserve `npm run build --workspaces` behavior.

## Verification
- `npm test` discovers and runs tests under `packages/runtime/src/__tests__/`,
  `packages/runtime/src/core/__tests__/`, `packages/runtime/src/providers/__tests__/`.
- `npm run lint` lints `packages/`, not `src/`.
- `grep -n "src/" vitest.config.ts package.json tsconfig.json` returns no
  references to the legacy tree (the only acceptable `src` occurrences are
  intra-package like `packages/*/src`, not a bare root `src/`).
- `grep -n "@aer" vitest.config.ts` returns nothing (alias removed).
