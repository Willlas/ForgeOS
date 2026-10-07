# S14-E1.2 — Vitest Timeout Budget

> Sprint 14 | Epic: [S14-E1 — CLI Validation Matrix & Test Foundations](../S14-E1-cli-validation-matrix.md) | Priority: P0 | Critical path: yes
> Effort: XS
> Constraint: test infrastructure only — no product behavior changes.

## Objective

Give daemon-spawn tests an explicit vitest timeout budget so they no longer need per-test `--timeout` hacks — vitest's default 5s per-test timeout is shorter than realistic daemon-spawn time, so unbounded spawn tests risk hanging CI instead of failing fast.

## Implementation details

- Add `testTimeout: 30_000` to the `test` block in `vitest.config.ts` (today none is set; vitest defaults to 5s, below realistic daemon-spawn time).
- Keep the harness-level hard kill (20s, S14-E1.1) as the backstop; do not add per-test `--timeout` hacks anywhere.

## Target file / location

- `c:\Proyects\MultiAgentDev\vitest.config.ts`

## Dependencies

None — independent of S14-E1.1 (can run in parallel); land together.

## Acceptance criteria

- `vitest.config.ts` has `testTimeout: 30_000` in the `test` block.
- `npm test` green with the existing ~409 tests.
- No test relies on >30s wall time; daemon-spawn tests no longer need individual timeout overrides.
- `npm run build` and `npm test` are green; no product-behavior files changed (test infrastructure only).

## Verification command

`npm test` — green (existing ~409 tests); no test relies on >30s wall time.

## Effort

XS
