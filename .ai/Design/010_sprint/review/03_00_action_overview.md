# Design 03 — Remediation Action Overview

This work package converts the Design 03 validation findings into a sequence of
self-contained actions for a coding model (qwen3.6). The Design document is the
authoritative contract: `.ai/design/010_sprint/03_cli_runtime_separation.md`.

Design 03's **architecture is correct** — package boundary, one-way dependency
direction (CLI → Runtime), and clean package-name indirection are all sound.
What remains is **migration completion and verification**, not redesign.

> Do NOT change Runtime or CLI logic. Only manifests, config, exports, and
> tsconfig hierarchy are in scope. No subsystem behavior is modified.

## Validation baseline

- Acceptance Criteria: 4 PASS / 1 PARTIAL / 1 FAIL (AC6)
- Definition of Done: 3 PASS / 2 PARTIAL / 1 FAIL (DoD5)
- Runtime package is **not standalone-publishable** (undeclared `dotenv`)
- Test/lint/dev still target the **legacy** `src/` tree, not `packages/`
- Legacy `src/` is fully duplicated and still present

## Action dependency graph

```
 01 (dotenv) ─────────────┐
                          ├──► 05 (retire legacy src) ──► 06 (project refs)
 02 (rewire tooling) ─────┤
 03 (public API) ─────────┤
 04 (exports maps) ───────┘                           07 (hygiene)  [independent]
```

- 01, 02, 03, 04 are independent of each other and may run in parallel.
- 05 (delete legacy `src/`) is **destructive** — execute only after 01–04 are green.
- 06 hardens the build graph; benefits from 05 being done.
- 07 is independent and can run any time.

## Execution order

1. **03_01** — Make Runtime self-contained (declare `dotenv`) — S, Critical
2. **03_02** — Rewire root tooling onto `packages/` — M, Critical
3. **03_03** — Complete Runtime public API — M, High
4. **03_04** — Add `exports` maps — S, Medium
5. **03_05** — Retire legacy `src/` + debug scripts — M, High  *(after 01–04 green)*
6. **03_06** — TypeScript project references — M, Medium
7. **03_07** — Dependency hygiene (version pin, `require` in ESM, naming) — S, Low

## Backlog → Action mapping

| Backlog # | Title | Severity | Action | Blocks Design 04? |
|-----------|-------|----------|--------|-------------------|
| 1 | Root tooling targets legacy `src/` | Critical | 03_02 | **Yes** |
| 2 | `dotenv` undeclared in Runtime | Critical | 03_01 | **Yes** |
| 3 | Legacy `src/` duplicated | High | 03_05 | **Yes** |
| 4 | Package tests not wired into `npm test` | High | 03_02 | Yes |
| 5 | Public API narrower than Design | High | 03_03 | **Yes** |
| 6 | No `exports` maps | Medium | 03_04 | No |
| 7 | No project references | Medium | 03_06 | No |
| 8 | Runtime version pinned exactly in CLI | Medium | 03_07 | No |
| 9 | `require()` in ESM source | Medium | 03_07 | No |
| 10 | Orphaned debug scripts | Low | 03_05 | No |
| 11 | Naming: `@aer/cli` vs "ForgeOS" | Low | 03_07 | No |

**Design 04 (Persistent State Store)** is blocked by actions 01, 02, 03 (and 05 by
transitivity). Design 04 modifies the daemon entry point, CLI status command, and
Runtime metrics surface — all currently ambiguous, unverified, or under-exported.

## Design 03 completion gate (Definition of Done)

All of the following must hold before Design 03 is declared complete:

- [ ] `npm run build` builds both packages green (no diagnostics).
- [ ] `npm test` runs the **package** test suites and is green (not `src/`).
- [ ] `npm run lint` targets `packages/`, not `src/`.
- [ ] `grep -rn "runtime/src\|\.\./src\|\.\./\.\./runtime" packages/` returns empty.
- [ ] The `@aer → ./src` vitest alias no longer exists.
- [ ] Legacy root `src/` and root-level `debug_*.ts` no longer exist.
- [ ] A clean install of `@aer/runtime-lib` resolves `dotenv` without the root hoist.
- [ ] Every subsystem named in Design §"Public Interfaces" is importable from
      `@aer/runtime-lib` (EventBus, Workspace, Knowledge, Metrics, Scheduler,
      Logging, config types, provider interfaces).
- [ ] Both `package.json` files declare an `exports` map.
