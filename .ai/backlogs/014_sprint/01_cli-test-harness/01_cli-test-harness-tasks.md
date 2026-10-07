# Atomized Tasks — Epic 1: CLI Test Harness & Foundations (S14-E1)

> Source story: [backlog.md — S14-E1](../backlog.md#s14-e1--cli-test-harness--foundations-p0-critical-path)
> Sprint: 14 (CLI validation hardening & test-plan expansion)
> Constraint: test infrastructure only — no product behavior changes; every spawn must be timeout-bounded.
> Status: ready for implementation. Critical path (unblocks E2–E6).

## Atomized Tasks: US-01 — One shared, bounded, daemon-aware harness for process-level CLI tests

### Task 1 (S14-E1.1): Create the CLI harness module
- **Subtask 1A:** Create `packages/cli/src/__tests__/helpers/cli-harness.ts` exporting `aer(args, { timeoutMs = 20_000, env = {} }) → Promise<{ code, stdout, stderr, timedOut }>` that spawns `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts ...args` from the repo root (same idiom as `packages/cli/src/__tests__/workspace-grant-cli.test.ts`); never throws on non-zero exit (exit codes are data); kills the process tree on timeout and resolves with `timedOut: true`; merges `env` into the child's environment.
- **Subtask 1A-2 (CRITICAL — cross-invocation sessions):** Grants/approvals are keyed by IPC session id (`packages/runtime/src/session-grant-manager.ts:126`, `packages/runtime/src/ipc-server.ts:349-373`), and each CLI process derives a fresh `sessionId` (`packages/cli/src/ipc-client.ts:38-40`) — so the `grant → preview → approve → apply` flow spanning five separate `aer` invocations only works when every invocation shares one session. The harness must expose a `newTestSession()` helper (returns a unique id per test) and all multi-invocation tests MUST pass `env: { AER_SESSION_ID: session }` to every call in the sequence. Never let two concurrent test invocations share a session id (daemon rejects a second socket claiming the same id with `SessionInUse`).
- **Subtask 1B:** Add `assertNoObjectLeak(result)` — fails the current test if `stdout + stderr` contains `[object Object]` or `[Symbol(`.
- **Subtask 1C:** Add `ensureDaemonDown()` — runs `aer stop` (tolerating "not running"); only touches the pid file when no daemon is alive (respect `isRunning()` semantics in `packages/cli/src/daemon.ts:168-171`); never kills a live daemon's pid file.
- **Subtask 1D:** Add `ensureDaemonUp()` — runs `aer start`, then polls `aer status` until exit 0 and `Daemon running: Yes` (10s bound, then fail with captured output).
- **Subtask 1E:** Add `makeTempWorkspace()` / `cleanupWorkspace()` — unique dir under `os.tmpdir()`, best-effort recursive delete.
- **Target File/Location:** new file `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\helpers\cli-harness.ts`; reference idioms at `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\workspace-grant-cli.test.ts` and `c:\Proyects\MultiAgentDev\packages\cli\src\daemon.ts`.
- **Verification:** compiles under `npm run build`; consumed by at least one test file (E3/E4 tests); a deliberately hung invocation with `timeoutMs: 1000` fails its test with `timedOut: true` instead of hanging the suite.

## Atomized Tasks: US-02 — Vitest timeout budget supports daemon-spawn tests

### Task 2 (S14-E1.2): Raise the vitest `testTimeout`
- **Subtask 2A:** Add `testTimeout: 30_000` to the `test` block in `vitest.config.ts` (today none is set; vitest defaults to 5s, which is below realistic daemon-spawn time).
- **Subtask 2B:** Keep the harness-level hard kill (20s) as the backstop; do not add per-test `--timeout` hacks anywhere.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\vitest.config.ts`.
- **Verification:** `npm test` green (existing ~409 tests); no test relies on >30s wall time; daemon-spawn tests no longer need individual timeout overrides.

## Final review

- [ ] `cli-harness.ts` exists and every spawn path is timeout-bounded (a hung CLI fails the test, not CI).
- [ ] `assertNoObjectLeak`, `ensureDaemonUp`, `ensureDaemonDown`, `makeTempWorkspace`, `cleanupWorkspace` are all exported and used by at least one test file.
- [ ] `vitest.config.ts` has `testTimeout: 30_000`; `npm run build` and `npm test` are green.
- [ ] No product-behavior files changed (test infrastructure only).
