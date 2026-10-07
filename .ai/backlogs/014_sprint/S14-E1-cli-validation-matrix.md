# S14-E1 — CLI Validation Matrix & Test Foundations

> Sprint 14 | Priority: P0 | Critical path: yes | Plan: `S14-overview.md`

## Goal

Turn the Sprint 14 CLI validation matrix (`.ai/backlogs/014_sprint/README.md` §1) into a runnable foundation: a shared, timeout-capped, daemon-aware harness for process-level CLI tests plus an explicit vitest timeout budget — so every matrix row (happy path, daemon down, reused `approvalId`, read-only grant misuse, provider unreachable, malformed args) can be pinned by deterministic, non-hanging tests.

## Why this matters

The validated `grant → preview → approve → apply` path is currently guarded by only four CLI test files — two of which test helper functions, not the process-level contract. The one spawn-based precedent (`workspace-grant-cli.test.ts`) hand-rolls process management, and every later matrix row (E3, E4, E5) would otherwise duplicate daemon lifecycle, output capture, and cleanup. Vitest's default 5s per-test timeout is shorter than realistic daemon-spawn time, so unbounded spawn tests risk hanging CI instead of failing fast.

## Scope

- New shared test helper `packages/cli/src/__tests__/helpers/cli-harness.ts`.
- Explicit `testTimeout` in `vitest.config.ts`.
- At least one consuming test file proving the harness works end-to-end.

## Out of scope

- Changing CLI behavior, commands, flags, exit codes, or messages (that's E2).
- The approval-lifecycle, status-matrix, and malformed-input suites (E3, E4, E5) — they consume this epic.
- CI pipeline work, docker, cross-platform e2e infrastructure.

## Dependencies

None — this epic unblocks E3, E4, and E5.

## Risks / Assumptions

- **Daemon state hygiene:** spawn tests share one machine daemon slot. Assume `aer start`/`aer stop` + pid-file semantics are reliable; the harness must never kill a live daemon's pid file (respect `isRunning()` in `packages/cli/src/daemon.ts`).
- **Windows process tree:** killing a hung CLI process must take down tsx child processes; the harness resolves with `timedOut: true` rather than throwing.
- **Spawn cost:** each CLI invocation pays a Node+tsx cold start; assume suites stay under ~30s wall time with the E1.2 budget.
- **Stable spawn idiom:** assume `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts` from the repo root remains the invocation path used by `workspace-grant-cli.test.ts`.

## Acceptance criteria

- `cli-harness.ts` compiles under `npm run build` (or is excluded cleanly) and is consumed by ≥ 1 test file.
- Every spawn in the harness is time-capped: a deliberately hung invocation (1s timeout) fails the test with combined output, never hangs the suite.
- `npm test` stays green with the existing ~409 tests.
- `assertNoObjectLeak` is a one-argument primitive every E3–E5 test can call.

## Proposed tasks

### S14-E1.1 — CLI test harness (M)

New file `packages/cli/src/__tests__/helpers/cli-harness.ts` providing:

- `aer(args, { timeoutMs = 20000, env?, cwd? }): Promise<{ code, stdout, stderr, timedOut }>` — spawns `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts ...args` from the repo root (same idiom as `workspace-grant-cli.test.ts`); kills the process tree on timeout and resolves with `timedOut: true` (assertions then fail with combined output instead of hanging CI); never throws on non-zero exit (that's data, not failure).
- `assertNoObjectLeak(result)` — fails the test if `stdout + stderr` contains `[object Object]` or `[Symbol(`.
- `ensureDaemonDown()` — runs `aer stop` (tolerates "not running"); only removes the pid file if no daemon is alive.
- `ensureDaemonUp()` — runs `aer start`, then polls `aer status` until exit 0 and `Daemon running: Yes` (10s cap).
- `makeTempWorkspace()` / `cleanupWorkspace()` — unique dir under `os.tmpdir()`, best-effort recursive delete.

**Verify:** build clean; one test (e.g. `aer status` daemon-down) runs green; 1s-timeout hang simulation fails fast.

### S14-E1.2 — Vitest timeout budget (XS)

- Add `testTimeout: 30000` to `vitest.config.ts` so daemon-spawn tests don't need per-test `--timeout` hacks; keep the harness hard-kill as a backstop.

**Verify:** `npm test` green; no test relies on >30s wall time.

## Suggested implementation order

E1.1 ∥ E1.2 (independent); land together.

## Test strategy / Validation approach

- Self-test the harness: (a) happy spawn → `code === 0`; (b) 1s-timeout hang → resolves with `timedOut: true`; (c) `assertNoObjectLeak` on a fixture string containing `[object Object]` fails.
- No live Ollama required for any E1 test (daemon only).
- Gate: `npm run build` + `npm test` green before any E3/E4/E5 task starts.

## Evidence from the repo

| Claim | Location |
|---|---|
| Spawn idiom precedent (tsx `cli.mjs` from repo root) | `packages/cli/src/__tests__/workspace-grant-cli.test.ts` |
| Only 4 CLI test files; 2 test helpers | `packages/cli/src/__tests__/` (cli-error-propagation, review-status, status-provider-state, workspace-grant-cli) |
| Vitest: `include: packages/**/*.test.ts`, no `testTimeout` set | `vitest.config.ts` |
| Matrix to be materialized | `.ai/backlogs/014_sprint/README.md` §1 |
| Daemon lifecycle/pid-file semantics the harness must respect | `packages/cli/src/daemon.ts` (`isRunning()`) |
| Sprint 13 baseline: build green, 409/409 tests (29 files) | `.ai/backlogs/013_sprint/README.md` |

## Notes for implementation

- Keep the harness test-only; do not export it from the CLI package's public API.
- All temp workspaces under `os.tmpdir()`, cleaned in `afterAll` even on failure.
- Prefer resolving-with-flag over throwing for timeouts so assertions can print the captured partial output.
