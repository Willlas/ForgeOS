# Sprint 14 Backlog — CLI Validation Hardening & Test Plan Expansion

> Status: Ready for implementation. Companion docs in this folder: `README.md` (sprint overview + validation matrix), `cli-validation-plan.md` (operator test plan draft).
> Scope rule: **hardening and test expansion only** — no new commands, providers, or workflow features.

## Executive summary

Sprint 13 made the `grant → preview → approve → apply` CLI path trustworthy, but its guarantees are pinned by only four CLI test files — two of which test helper functions, not the process-level contract. Sprint 14 closes the gap between "works when an operator runs it" and "verifiably safe to rely on":

1. A shared, timeout-bounded CLI test harness that controls daemon lifecycle (today every spawn test hand-rolls process management).
2. A deterministic error contract: every failure path exits 1, prints a human-readable stderr message, and can never print `[object Object]`.
3. Proven approval-lifecycle semantics (single-use, TTL clamp, session/root/diffHash binding) — currently **zero tests** touch `approveAuthorizedWorkspace`/`applyAuthorizedWorkspace`.
4. Provider and daemon status behavior pinned at the process level, with deterministic reachability control for CI.
5. One reproducible smoke command (`npm run smoke:cli`) encoding the four automation targets from the 014 README §4.
6. A formal operator test plan + updated repo docs.

**Critical path:** S14-E1 (harness) → S14-E2 (error contract) → S14-E3 (approval lifecycle). E4/E5 become parallelizable once E1 lands. E6 is last (docs must describe verified behavior).

## Prioritized epic list

| # | Epic | Priority | Critical path | Est. tasks | Deps |
|---|------|----------|---------------|-----------|------|
| S14-E1 | CLI test harness & foundations | P0 | Yes | 2 | — |
| S14-E2 | Error contract & exit-code hardening | P0 | Yes | 4 | — (tests land in E5) |
| S14-E3 | Approval lifecycle enforcement | P0 | Yes | 3 | E1 |
| S14-E4 | Provider & daemon status integration | P1 | No | 3 | E1 |
| S14-E5 | Smoke test automation | P1 | No | 3 | E1–E4 |
| S14-E6 | Operator test plan & docs | P2 | No | 2 | E2–E5 |

## Repo state (evidence base)

| Area | State | Evidence |
|---|---|---|
| Error propagation | `errorMessage()` helper exists and is used by `workspace:list/search/grant/grants/revoke/approve/apply`; **not** used by `start/stop/restart`, `config:list`, `ask`, `chat`, `workspace:read`, `workspace:execute`, `review-workspace` | `packages/cli/src/index.ts:35` (helper); raw `console.error('IPC error:', error)` in `config:list` catch; `console.error('Failed to start daemon:', error)` in start/stop/restart |
| IPC rejection shape | Pending IPC calls reject with a **plain object** `{code, message}` (not an `Error`) → any raw print leaks `[object Object]` | `packages/runtime/src/ipc-client.ts:23-26` |
| Exit codes | Most failures set `process.exitCode = 1`; **exceptions**: `config:list` (no exit code on failure) and `workflows:list`/`workflows:start` daemon-down (exit 0, stdout) | `packages/cli/src/index.ts:178-198`, `201-225` vs `352` |
| TTL contract | Runtime: default 300s, cap 3600s. CLI help text says "capped at 300" — **wrong** | `packages/runtime/src/core/runtime.ts:171-172` vs `packages/cli/src/index.ts:558` |
| Approval lifecycle | `approveAuthorizedWorkspace` (489-519), `applyAuthorizedWorkspace` (525-575): single-use, consume-after-success, session/rootPath/diffHash binding | `packages/runtime/src/core/runtime.ts`; **no test file references these methods** (grep-verified) |
| Status/provider | `probeOllamaReachability` (2s cap) + `formatProviderStatus` unit-tested; process-level `aer status` untested; `OLLAMA_BASE_URL` hard-coded → non-deterministic in CI | `packages/cli/src/index.ts:112-143`; `packages/cli/src/__tests__/status-provider-state.test.ts` |
| Spawn test pattern | `workspace-grant-cli.test.ts` spawns `node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts` — no shared harness, no timeout bound | `packages/cli/src/__tests__/workspace-grant-cli.test.ts` |
| Vitest | includes `packages/**/*.test.ts`; **no** `testTimeout` set (default 5s) — daemon-spawn tests need an explicit budget | `vitest.config.ts` |

---

## S14-E1 — CLI Test Harness & Foundations (P0, critical path)

**Goal:** A single, bounded-timeout, daemon-aware harness for process-level CLI tests, replacing ad-hoc `execFileSync`/spawn code and guaranteeing no `[object Object]` leaks in captured output.

**Rationale:** `workspace-grant-cli.test.ts` shows the spawn idiom but every future test (E3/E4/E5) would duplicate process management, daemon lifecycle, and output inspection. Vitest's default 5s per-test timeout is below realistic daemon-spawn time.

### Tasks

**S14-E1.1 — Create `packages/cli/src/__tests__/helpers/cli-harness.ts`**
- `aer(args, { timeoutMs = 20_000 }) → Promise<{code, stdout, stderr, timedOut}>`: spawns `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts ...args` from repo root (same idiom as `workspace-grant-cli.test.ts`); kills the process tree on timeout and resolves with `timedOut: true` (assertions then fail with combined output instead of hanging CI); never throws on non-zero exit (that is data, not failure).
- `assertNoObjectLeak(result)` — fails the test if `stdout + stderr` contains `[object Object]` or `[Symbol(`.
- `ensureDaemonDown()` — runs `aer stop` (tolerates "not running"); only removes the pid file if no daemon is alive (respect `isRunning()` semantics, `daemon.ts:168-171`); never kills a live daemon's pid file.
- `ensureDaemonUp()` — runs `aer start`, then polls `aer status` until exit 0 and `Daemon running: Yes` (10s bound).
- `makeTempWorkspace()` / `cleanupWorkspace()` — unique dir under `os.tmpdir()`, best-effort recursive delete.

**Acceptance criteria:** compiles under `npm run build`; consumed by at least one test file; every spawn is bounded — a deliberately hung invocation (1s timeout) fails the test, not the suite.
**Dependencies:** none. **Estimate:** M.

**S14-E1.2 — Vitest timeout budget** (`vitest.config.ts`)
- Add `testTimeout: 30_000` so daemon-spawn tests don't need per-test `--timeout` hacks; keep harness-level hard kill as backstop.

**Acceptance criteria:** `npm test` green (existing ~409 tests); no test relies on >30s wall time.
**Dependencies:** none (parallel with E1.1). **Estimate:** XS.

---

## S14-E2 — Error Contract & Exit-Code Hardening (P0, critical path)

**Goal:** Deterministic operator-facing failure contract: every CLI failure → exit 1 + human-readable stderr + zero `[object Object]` output.

**Gap analysis (verified in `packages/cli/src/index.ts`):**
- `ipc-client.ts:23-26` rejects pending calls with plain `{code, message}` objects → `console.error('Failed to start daemon:', error)` (start/stop/restart) and `console.error('IPC error:', error)` (`config:list`) can print `[object Object]`.
- `config:list` failure prints `Failed to retrieve configuration.` but never sets an exit code.
- `workflows:list` / `workflows:start` daemon-down prints to **stdout** and exits **0** — inconsistent with every other command (e.g. `workspace:list` at line 352 → stderr + exit 1).
- `ask`, `chat`, `workspace:read`, `workspace:execute`, `review-workspace` inline the error-extraction ternary instead of reusing the exported `errorMessage()` (line 35).

### Tasks

**S14-E2.1 — Single failure-description helper**
- Add `describeFailure(prefix: string, err: unknown): string` next to `errorMessage()`: returns `err.message` when present (covers both `Error` and IPC `{code, message}` objects), else `String(err)`, prefixed; can never yield `[object Object]`.
- Route all catch sites through it: start/stop/restart, `config:list` catch + failure branch, and the five inline ternary sites.

**Acceptance criteria:** every `console.error` call in `packages/cli/src/index.ts` takes a literal string or a `describeFailure(...)`/`errorMessage(...)` result; `npm run build` clean.
**Dependencies:** none. **Estimate:** S.

**S14-E2.2 — Exit-code contract**
- `config:list`: set `process.exitCode = 1` in both failure branches.
- `workflows:list` / `workflows:start` daemon-down: message to **stderr**, `process.exitCode = 1` (parity with `workspace:list`).

**Acceptance criteria:** spawn assertions (land in S14-E5) cover all four commands; behavior identical to the `workspace:list` daemon-down path.
**Dependencies:** S14-E2.1. **Estimate:** S.

**S14-E2.3 — TTL contract alignment**
- Runtime is the source of truth: default 300s, cap 3600s (`runtime.ts:171-172`). Export both constants from the runtime package.
- Fix the CLI `--ttl` help text (`index.ts:558`, currently "capped at 300", CLI default 60s): state default 60s and cap 3600s, values derived from the exported constants (single source of truth). Do **not** change the CLI default of 60s (behavioral change is out of scope).

**Acceptance criteria:** `aer workspace:approve --help` shows default 60s / cap 3600s; both numbers come from runtime constants; runtime unit test pins the 7200→3600 clamp (S14-E3.1).
**Dependencies:** none. **Estimate:** S.

**S14-E2.4 — Helper unit tests** (extend `packages/cli/src/__tests__/cli-error-propagation.test.ts`)
- `describeFailure` with `{code:'ApprovalRejected', message:'Unknown or already-consumed approvalId'}` → message wins; with an `Error` instance; with a string; with `{}` → output never contains `[object Object]`.

**Acceptance criteria:** green under `npm test`.
**Dependencies:** S14-E2.1. **Estimate:** S.

---

## S14-E3 — Approval Lifecycle Enforcement (P0, critical path)

**Goal:** Prove the single-use, TTL, and binding semantics of workspace approvals at the runtime level (currently untested) and at the CLI level (duplicate-`approvalId` regression — the #1 automation target in the 014 README §4).

**Rationale:** The approval record (`runtime.ts:489-575`) is what makes `apply` safe: session binding, rootPath binding, diffHash binding, TTL, and one-time consumption (consumed only after a successful apply, lines 570-571). **No test file references `approveAuthorizedWorkspace` or `applyAuthorizedWorkspace`** (grep-verified). `workspace-tools.test.ts` and `session-grant-manager.test.ts` cover grant scoping and token issuance, not the approval-record lifecycle.

### Tasks

**S14-E3.1 — Runtime approval-lifecycle suite** (new `packages/runtime/src/__tests__/approval-lifecycle.test.ts`)
In-process (no daemon, no pipes): construct the `Runtime` and call the approve/apply methods directly. Cover:
1. **TTL default & clamp** — approval without `ttl` → `expiresAt − createdAt ≈ 300s`; with `ttl: 7200` → `expiresAt − createdAt ≤ 3600s` (pins the `runtime.ts:171-172` contract used by S14-E2.3).
2. **Expiry** — expired approval → apply fails with `Approval has expired` (prefer `vi.useFakeTimers()` over wall-clock waits for CI determinism).
3. **Single-use** — apply succeeds; second apply with the same `approvalId` fails with `Unknown or already-consumed approvalId` and file content is unchanged.
4. **Session binding** — approval created in session A; apply attempted in session B → `Approval belongs to a different session`.
5. **Root binding** — apply with a different `rootPath` → `Approval rootPath does not match the requested rootPath`.
6. **diffHash binding** — apply with a mismatched hash → `Approval does not match the requested diffHash`.

**Acceptance criteria:** all six green; no network/Ollama/daemon required; deterministic (fake timers preferred).
**Dependencies:** none. **Estimate:** M.

**S14-E3.2 — CLI regression: duplicate approvalId** (new `packages/cli/src/__tests__/workspace-approval-cli.test.ts`)
Using the S14-E1 harness, against a temp workspace:
1. `ensureDaemonDown()` → `ensureDaemonUp()`.
2. `workspace:grant <root> -m read-write -t apply,read,list,search --yes` → exit 0.
3. `workspace:preview <root> -f notes.txt -c "demo"` → capture `approvalId` + `diffHash` from stdout.
4. `workspace:approve <root> <diffHash> --yes` → exit 0.
5. `workspace:apply <root> <approvalId> --yes` → exit 0; file exists with expected content.
6. `workspace:apply` again with the same `approvalId` → **exit 1**, stderr contains `Unknown or already-consumed approvalId`, `assertNoObjectLeak` passes.
7. Teardown: `ensureDaemonDown()`, `cleanupWorkspace()`.

**Acceptance criteria:** full path green; step 6 pins 014 README §4 target #1; total run < 30s.
**Dependencies:** S14-E1.1, S14-E2.1 (stable stderr). **Estimate:** M.

**S14-E3.3 — CLI regression: read-only grant misuse** (extend `workspace-approval-cli.test.ts`)
1. `workspace:grant <root> -m read-only -t read,list,search --yes`.
2. `workspace:preview <root> -f notes.txt -c "x"` → **exit 1**, stderr contains `Preview requires a read-write grant` (`workspace-tools.ts:395-398`), no object leak.

**Acceptance criteria:** green; message matches the "Read-only Grant Misuse" row in the 014 README §1 matrix.
**Dependencies:** S14-E3.2 (shared fixtures). **Estimate:** S.

---

## S14-E4 — Provider & Daemon Status Integration (P1)

**Goal:** Pin the `aer status` operator surface (daemon up/down × provider up/down) at the process level, with deterministic reachability control for CI.

**Rationale:** `probeOllamaReachability`/`formatProviderStatus` are unit-tested with a mocked `fetch` (`status-provider-state.test.ts`), but nobody exercises the real `aer status` process: daemon-down prints `Daemon running: No` + a provider line and exits 0 (`index.ts:148-172`) — exactly the matrix row "Provider Unreachable / Daemon Not Running (status)". And `OLLAMA_BASE_URL` is a hard-coded constant, so "unreachable" cannot be asserted deterministically in CI.

### Tasks

**S14-E4.1 — Deterministic probe-URL override** (`packages/cli/src/index.ts`)
- `OLLAMA_BASE_URL` → `process.env.AER_OLLAMA_BASE_URL ?? "http://localhost:11434"`. Default behavior unchanged; no new CLI option.

**Acceptance criteria:** default unchanged (unit test); with `AER_OLLAMA_BASE_URL=http://127.0.0.1:9` (closed port), `aer status` prints `Ollama provider: unreachable (http://127.0.0.1:9)` within the 2s probe cap.
**Dependencies:** none. **Estimate:** XS.

**S14-E4.2 — Status matrix process tests** (new `packages/cli/src/__tests__/status-cli-matrix.test.ts`)
Harness + temp env per case:
1. Daemon down + provider unreachable (env → closed port) → exit 0, stdout contains `Daemon running: No` and `Ollama provider: unreachable`.
2. Daemon down + provider reachable: start an ephemeral `http.createServer` on 127.0.0.1 port 0 in-test, point `AER_OLLAMA_BASE_URL` at it → stdout contains `Ollama provider: reachable`.
3. Daemon up: `ensureDaemonUp()` → `aer status` → exit 0, `Daemon running: Yes`; teardown `ensureDaemonDown()`.

**Acceptance criteria:** all three green; no real Ollama required; bounded by the 2s probe cap + harness timeouts.
**Dependencies:** S14-E1.1, S14-E4.1. **Estimate:** M.

**S14-E4.3 — Daemon-down matrix rows for workspace commands**
- With daemon down: `workspace:grant`, `workspace:preview`, `workspace:apply` each → **exit 1** + `Daemon is not running. Start it first.` (current behavior, pinned as a regression), `assertNoObjectLeak` on each.

**Acceptance criteria:** green; these rows close 014 README §4 target #2 (daemon-down behavior).
**Dependencies:** S14-E1.1. **Estimate:** S.

---

## S14-E5 — Smoke Test Automation (P1)

**Goal.** One reproducible command runs the operator smoke suite, encoding the four automation targets from the 014 README §4: duplicate `approvalId` (→ S14-E3.2), daemon-down behavior (→ S14-E4.3), malformed payload (→ below), unreachable provider (→ S14-E4.2).

### Tasks

**S14-E5.1 — Malformed payload suite** (new `packages/cli/src/__tests__/cli-malformed-input.test.ts`)
- `workspace:preview <root> -f notes.txt` (missing `-c`) → exit 1, output contains `--file and --content must appear the same number of times` (thrown at `index.ts:514`).
- `workspace:approve <root> <diffHash> -t abc` → exit 1 + `--ttl must be a positive number of seconds` (`index.ts:564`).
- `workspace:approve <root> <diffHash> -t 0` → same `--ttl` message.

**Acceptance criteria:** green; closes 014 README §4 target #3; `assertNoObjectLeak` on every case.
**Dependencies:** S14-E1.1. **Estimate:** S.

**S14-E5.2 — Serialization guard across all commands** (extend the malformed-input suite or new `cli-serialization-guard.test.ts`)
- Parameterized: for each top-level command (enumerate from `aer --help`), run `aer <cmd> --help` → exit 0 + `assertNoObjectLeak(stdout + stderr)`.

**Acceptance criteria:** green; any future `[object Object]` leak in a help/error path fails the suite.
**Dependencies:** S14-E1.1. **Estimate:** S.

**S14-E5.3 — `npm run smoke:cli` entry point** (root `package.json`)
- Add script: `vitest run packages/cli/src/__tests__/workspace-approval-cli.test.ts packages/cli/src/__tests__/status-cli-matrix.test.ts packages/cli/src/__tests__/cli-malformed-input.test.ts` (plus the daemon-down suite).

**Acceptance criteria:** `npm run smoke:cli` exits 0 on a clean machine, fails fast (bounded), requires no live Ollama.
**Dependencies:** S14-E3.2, S14-E4.2, S14-E4.3, S14-E5.1. **Estimate:** S.

---

## S14-E6 — Operator Test Plan & Docs (P2)

**Goal.** Promote the draft operator test plan (014 README §2) into a permanent, executable reference, and bring repo docs in line with the hardened contract.

### Tasks

**S14-E6.1 — Formal operator runbook** (new `docs/cli-operator-test-plan.md`)
- Happy path (grant → preview → approve → apply), failure paths (duplicate `approvalId`, read-only grant misuse, malformed args, daemon down, provider unreachable), recovery checks — each with the exact command, expected exit code, and expected stderr string, as verified by the S14-E2–E5 tests.
- Quickstart section: `npm run smoke:cli`.

**Acceptance criteria:** every expected string/exit code matches a green test (cross-referenced by task ID); no new behavior proposed.
**Dependencies:** S14-E2.2, S14-E3.2, S14-E4.2, S14-E5.3. **Estimate:** S.

**S14-E6.2 — Repo state updates**
- README: mark the Known Risks items covered by Sprint 14 as mitigated, with links to the runbook + smoke command.
- ROADMAP/STATUS line for Sprint 14 completion (follow the 013 convention).

**Acceptance criteria:** docs-only diff; links resolve.
**Dependencies:** S14-E6.1. **Estimate:** XS.


## Suggested implementation order

1. **S14-E1** (E1.1 ∥ E1.2) — the harness unblocks every test epic.
2. **S14-E2** (E2.1 → {E2.2, E2.3, E2.4}) — stabilize stderr/exit codes before tests pin them.
3. **S14-E3** (E3.1 ∥ E3.2 → E3.3) — the semantic core; the duplicate-`approvalId` regression is the sprint's headline proof.
4. **S14-E4 + S14-E5.1 + S14-E5.2 in parallel** — all build on E1/E2; then E5.3 wires the smoke script.
5. **S14-E6** — docs last, so they describe verified behavior only.

Parallelizable pairs: (E1.1, E1.2), (E2.2, E2.3, E2.4 after E2.1), (E3.1, E3.2), (E4.x, E5.1, E5.2).

## Test strategy

**Three tiers, strict separation:**
1. **Unit (no process):** helper contracts (`cli-error-propagation.test.ts`), runtime approval lifecycle (`approval-lifecycle.test.ts`), probe formatting (`status-provider-state.test.ts`).
2. **Process contract (spawned CLI, exact strings + exit codes):** approval CLI path, status matrix, daemon-down rows, malformed input, help-page leak scan.
3. **Entry point:** `npm run smoke:cli` = tier-2 subset, runnable by operators without knowing vitest.

**Determinism rules (CI-safe):**
- No live Ollama: provider reachability controlled by `AER_OLLAMA_BASE_URL` (closed port = down; ephemeral local server = up).
- No pre-started daemon: the harness owns `start`/`stop`; `ensureDaemonDown()` never kills a live daemon's pid file.
- Timeouts at three levels: harness hard kill (20s) → vitest `testTimeout` (30s) → probe cap (2s, existing).
- Every spawn assertion includes `assertNoObjectLeak`.
- Temp workspaces under `os.tmpdir()`, cleaned up in `afterAll`.

**Exit-code contract (target state; every row is test-pinned):**

| Scenario | Command | Exit | stderr (contains) |
|---|---|---|---|
| Success (any) | all | 0 | — |
| Daemon down, workspace/workflows/config | `workspace:*`, `workflows:*`, `config:list` | 1 | `Daemon is not running. Start it first.` / `Failed to retrieve configuration.` |
| `status` with daemon down | `status` | 0 | — (stdout: `Daemon running: No`) |
| Duplicate approvalId | `workspace:apply` | 1 | `Unknown or already-consumed approvalId` |
| Read-only grant misuse | `workspace:preview` | 1 | `Preview requires a read-write grant` |
| Malformed args | `preview` / `approve` | 1 | pair-count message / `--ttl must be a positive number of seconds` |
| Provider unreachable | `status` | 0 | — (stdout: `Ollama provider: unreachable …`) |

## Repository evidence (verified)

| Claim | Location |
|---|---|
| `errorMessage()` helper; used by list/search/grant/grants/revoke/approve/apply | `packages/cli/src/index.ts:35` and each command |
| Raw `console.error(error)` risk sites | `packages/cli/src/index.ts` — start/stop/restart catches, `config:list` catch |
| Plain-object IPC rejection `{code, message}` | `packages/runtime/src/ipc-client.ts:23-26` |
| Exit-1 convention vs. exceptions | `packages/cli/src/index.ts:352` (workspace:list) vs `178-198` (workflows) / `201-225` (config:list) |
| Approval record: single-use, TTL, bindings, consume-on-success | `packages/runtime/src/core/runtime.ts:489-575` (TTL constants at 171-172) |
| No tests touch the approval record | grep `approveAuthorizedWorkspace\|applyAuthorizedWorkspace` across `packages/**` → no test-file hits |
| Preview requires a read-write grant | `packages/runtime/src/tools/workspace-tools.ts:395-398` |
| Pair-count validation (preview) | `packages/cli/src/index.ts:512-515` |
| TTL arg validation (approve) | `packages/cli/src/index.ts:562-565` |
| 2s probe cap + status command | `packages/cli/src/index.ts:112-172` |
| Spawn idiom precedent | `packages/cli/src/__tests__/workspace-grant-cli.test.ts` |
| Vitest include pattern; no `testTimeout` | `vitest.config.ts` |
| Sprint 014 matrix + automation targets | `.ai/backlogs/014_sprint/README.md` §1, §4 |

