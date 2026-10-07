# S14-E2 — Error Contract & Exit-Code Hardening

> Sprint 14 | Priority: P0 | Critical path: yes | Plan: `S14-overview.md`

## Goal

Deterministic operator-facing failure contract for the `aer` CLI: every failure path → exit code 1 + human-readable message on stderr + zero `[object Object]` output, with a single shared failure-description helper and an exit-code convention identical across daemon-down, IPC-rejection, and validation-failure paths.

## Why this matters

IPC rejections arrive at the CLI as plain `{code, message}` objects (not `Error`), so any catch site that stringifies the raw value leaks `[object Object]` to the operator — verified leak sites exist in `aer start`/`stop` (`index.ts:75,89`). Additionally, `config:list` fails with a stdout message and **no exit code**, and `workflows:list`/`workflows:start` daemon-down print to stdout and exit 0 — inconsistent with every other command (e.g. `workspace:list` → stderr + exit 1). Until the contract is stabilized, E3/E4/E5 tests would pin inconsistent behavior.

## Scope

- New `describeFailure(prefix, err)` helper next to `errorMessage()` in `packages/cli/src/index.ts`; route all catch sites through it.
- Exit-code fixes: `config:list` (both failure branches), `workflows:list`/`workflows:start` daemon-down (stderr + exit 1).
- TTL contract consistency: export the runtime TTL constants (default 300s, cap 3600s) and fix the CLI `--ttl` help text.
- Helper unit tests extending `cli-error-propagation.test.ts`.

## Out of scope

- Changing the IPC protocol or the daemon's error types.
- Changing the CLI `--ttl` default (60s) — help text only.
- Behavior changes to `ask`/`chat`/`workspace:read`/`workspace:execute` output (message routing only).

## Dependencies

None (E2.2 and E2.4 depend on E2.1; E2.3 is independent).

## Risks / Assumptions

- **Operator scripts:** any script parsing `workflows:list`/`config:list` stdout in failure cases now sees stderr/exit 1 — acceptable; the contract prioritizes scriptable exit codes and the E6 runbook documents it.
- Assume `errorMessage()` (`index.ts:35`) is importable from tests (file header notes it stays importable for parsing).
- E2.2 is the one intentional **behavior change** this sprint (workflows/config exit codes); call it out in the commit and E6 runbook.

## Acceptance criteria

- Every `console.error` in `packages/cli/src/index.ts` takes a literal string or a `describeFailure(...)`/`errorMessage(...)` result (verified by grep/review).
- `config:list` failure (daemon-down and fetch-failed) → exit 1.
- `workflows:list`/`workflows:start` daemon-down → stderr `Daemon is not running. Start it first.` + exit 1.
- `aer workspace:approve --help` shows default 60s / cap 3600s derived from exported runtime constants.
- `describeFailure` unit tests green; `npm run build` clean.

## Proposed tasks

### S14-E2.1 — Single failure-description helper (S)

- Add `describeFailure(prefix: string, err: unknown): string` next to `errorMessage()`: returns `err.message` when present (covers `Error` and IPC `{code, message}`), else `String(err)`, always prefixed; can never yield `[object Object]`.
- Re-route all catch sites: start/stop/restart (e.g. line 75, line 89), `config:list` catch + failure branch, and the inline `instanceof Error` ternaries used by `ask`, `chat`, `workspace:read`, `workspace:execute`, `review-workspace`.

### S14-E2.2 — Exit-code contract (S)

- `config:list`: set `process.exitCode = 1` in both failure branches (daemon-down ~line 205; fetch failure ~line 217).
- `workflows:list`/`workflows:start` daemon-down (~lines 178–198): move the message to **stderr** and set `process.exitCode = 1` — parity with `workspace:list` (line 352).

### S14-E2.3 — TTL contract consistency (S)

- Runtime is the source of truth: default 300s, cap 3600s (`runtime.ts:171–172`). Export both constants from the runtime package.
- Fix the CLI `--ttl` help text (`index.ts:558`, currently "capped at 300", CLI default 60s) to state default 60s and cap 3600s, values derived from the exported constants. Do **not** change the CLI default of 60s.

### S14-E2.4 — Helper unit tests (S)

- Extend `packages/cli/src/__tests__/cli-error-propagation.test.ts`: `describeFailure` with `{code:'ApprovalRejected', message:'Unknown or already-consumed approvalId'}` → the message wins; with an `Error`; with a string; with `{}` → output never contains `[object Object]`.

## Suggested implementation order

E2.1 → {E2.2 ∥ E2.4}; E2.3 parallel with either. Land E2.2 before any E5 test pins those exit codes.

## Test strategy / Validation approach

- Unit: `describeFailure` matrix (E2.4) — no processes.
- Process: the spawn assertions live in E3/E5 (daemon-down rows, duplicate approvalId); E2 itself is verified by `npm run build` + the existing suite + manual spot-checks.
- Regression gate: `npm test` green (existing 409 tests), including `cli-error-propagation.test.ts` and `status-provider-state.test.ts`.

## Evidence from the repo

| Claim | Location |
|---|---|
| `errorMessage()` shared helper | `packages/cli/src/index.ts:35` |
| Raw-error leak sites (start/stop) | `packages/cli/src/index.ts:75, 89` |
| Plain-object IPC rejections `{code, message}` | `packages/cli/src/ipc-client.ts:59, 70, 113, 156` |
| Exit-1 convention (`workspace:list`) vs. exceptions | `index.ts:352` vs. `178–198` (workflows) / `201–225` (config:list) |
| TTL constants: default 300s, cap 3600s | `packages/runtime/src/core/runtime.ts:171–172` |
| TTL clamp in approve | `runtime.ts:503–505` |
| Inaccurate help text "capped at 300" | `index.ts:558` |
| Existing helper test file | `packages/cli/src/__tests__/cli-error-propagation.test.ts` |

## Notes for implementation

- Keep `describeFailure` pure and exported for tests.
- Do not change success-path stdout — the only stream change is moving failure output to stderr.
- The one intentional behavior change is E2.2; call it out in the commit message and the E6 runbook.
