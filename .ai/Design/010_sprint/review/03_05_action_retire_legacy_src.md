# Action 03_05 — Retire legacy `src/` and orphaned debug scripts

## Objective
Remove the duplicated pre-split source tree so there is a single source of truth.
The legacy root `src/` (≈55 files) is byte-identical or near-identical to
`packages/runtime/src/` and `packages/cli/src/`, and is still wired into root
config (until 03_02 rewires it).

## Backlog reference
- **Severity:** High
- **Blocks Design 04?** **Yes** (by transitivity) — D04 §"Components to Modify"
  references `src/cli/index.ts` and the daemon entry point by legacy paths. With
  two trees present, D04 risks editing the wrong copy.

## Why it matters
Duplication will diverge. Today the entire runtime + CLI implementation exists in
both `src/` and `packages/`. Leaving it means two sources of truth and a latent
landmine for any future edit.

The following are duplicated (validation finding):
- `src/core/*.ts`, `src/core/types/*.ts`, `src/config/*.ts`, `src/providers/*.ts`
  ↔ `packages/runtime/src/...` — byte-identical.
- `src/runtime/*.ts` ↔ `packages/runtime/src/...` and `packages/cli/src/...` —
  byte-identical or import-rewrite only.
- `src/cli/index.ts` ↔ `packages/cli/src/index.ts` — near-identical.

Plus three orphaned root scripts import the legacy tree:
`debug_exact_test.ts`, `debug_graph.ts`, `debug_graph_simple.ts` →
`./src/runtime/workflow-engine.js`.

## Prerequisites
- **03_01, 03_02, 03_03, 03_04 must be complete and green** before deletion.
  Specifically `npm run build` and `npm test` must pass against `packages/` only.
- Confirm nothing outside `src/` and the debug scripts still imports the legacy
  tree (after 03_02, root config no longer points at `src/`).

## Steps
1. Run `npm run build && npm test && npm run lint` and confirm all green.
2. Grep for any remaining references to the legacy tree:
   `grep -rn "from ['\"]\.\./src\|from ['\"]\./src\|src/runtime\|src/core\|src/cli" .`
   (excluding `node_modules`, `dist`, `.git`). Expected: only the debug scripts.
3. Delete the entire root-level `src/` directory.
4. Delete `debug_exact_test.ts`, `debug_graph.ts`, `debug_graph_simple.ts` at the
   repo root.
5. Re-run the grep from step 2; confirm it returns nothing.
6. Re-run `npm run build && npm test && npm run lint`; confirm still green.

## Files
- Root `src/` directory (delete)
- `debug_exact_test.ts`, `debug_graph.ts`, `debug_graph_simple.ts` (delete)

## Constraints
- **Destructive action** — perform only after the prerequisite actions are green.
  The legacy content remains recoverable via git history if needed.
- Do **not** delete anything under `packages/`.
- Do **not** delete `dist/` folders inside the packages (they are build output).
- If any non-deleted file is found to import the legacy tree in step 2, **stop**
  and resolve that reference before deleting `src/`.

## Verification
- The root `src/` directory no longer exists.
- `debug_*.ts` files no longer exist at the repo root.
- `grep -rn "src/runtime\|src/core\|src/cli\|\.\./src" .` (excl
  `node_modules`/`dist`/`.git`) returns empty.
- `npm run build && npm test && npm run lint` all green with only `packages/`
  present.
