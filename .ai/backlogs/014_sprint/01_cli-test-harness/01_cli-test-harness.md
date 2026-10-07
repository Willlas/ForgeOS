# S14-E1.1 — CLI Test Harness

> Sprint 14 | Epic: [S14-E1 — CLI Validation Matrix & Test Foundations](../S14-E1-cli-validation-matrix.md) | Priority: P0 | Critical path: yes
> Effort: M
> Constraint: test infrastructure only — no product behavior changes; every spawn must be timeout-bounded.

## Objective

Create a new shared, timeout-bounded, daemon-aware test harness at `packages/cli/src/__tests__/helpers/cli-harness.ts` so every CLI validation-matrix row (happy path, daemon down, reused `approvalId`, read-only grant misuse, provider unreachable, malformed args) can be pinned by deterministic, non-hanging tests.

## Implementation details

New file `packages/cli/src/__tests__/helpers/cli-harness.ts` exporting:

- **`aer(args, { timeoutMs = 20_000, env = {}, cwd? }) → Promise<{ code, stdout, stderr, timedOut }>`** — spawns `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts ...args` from the repo root (same idiom as `packages/cli/src/__tests__/workspace-grant-cli.test.ts`); never throws on non-zero exit (exit codes are data); kills the process tree on timeout and resolves with `timedOut: true` (assertions then fail with combined output instead of hanging CI); merges `env` into the child's environment.
- **`newTestSession()`** (cross-invocation sessions) — grants/approvals are keyed by IPC session id (`packages/runtime/src/session-grant-manager.ts:126`, `packages/runtime/src/ipc-server.ts:349-373`), and each CLI process derives a fresh `sessionId` (`packages/cli/src/ipc-client.ts:38-40`), so the `grant → preview → approve → apply` flow only works when every invocation shares one session. Returns a unique id per test; multi-invocation tests MUST pass `env: { AER_SESSION_ID: session }` to every call in the sequence. Never share one id between two concurrent invocations (daemon rejects the second socket with `SessionInUse`).
- **`assertNoObjectLeak(result)`** — one-argument primitive; fails the current test if `stdout + stderr` contains `[object Object]` or `[Symbol(`.
- **`ensureDaemonDown()`** — runs `aer stop` (tolerating "not running"); only touches the pid file when no daemon is alive (respect `isRunning()` semantics in `packages/cli/src/daemon.ts:168-171`); never kills a live daemon's pid file.
- **`ensureDaemonUp()`** — runs `aer start`, then polls `aer status` until exit 0 and `Daemon running: Yes` (10s bound, then fail with captured output).
- **`makeTempWorkspace()` / `cleanupWorkspace()`** — unique dir under `os.tmpdir()`, best-effort recursive delete; cleaned in `afterAll` even on failure.

Keep the harness test-only; do not export it from the CLI package's public API. Prefer resolving-with-flag over throwing for timeouts so assertions can print captured partial output.

## Target file / location

- New: `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\helpers\cli-harness.ts`
- Reference idioms: `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\workspace-grant-cli.test.ts`, `c:\Proyects\MultiAgentDev\packages\cli\src\daemon.ts`

## Dependencies

None — this task unblocks E3, E4, and E5.

## Acceptance criteria

- `cli-harness.ts` compiles under `npm run build` (or is excluded cleanly) and is consumed by ≥ 1 test file.
- Every spawn in the harness is time-bounded: a deliberately hung invocation (`timeoutMs: 1000`) fails the test with combined output and never hangs the suite.
- `assertNoObjectLeak` is a one-argument primitive every E3–E5 test can call.
- `npm test` stays green with the existing ~409 tests.

## Verification command

`npm run build && npm test` — build clean; one test (e.g. `aer status` daemon-down) runs green; 1s-timeout hang simulation fails fast.

## Effort

M
