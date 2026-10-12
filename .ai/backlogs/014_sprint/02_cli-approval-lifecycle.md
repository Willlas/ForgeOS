# 02 - CLI Approval Lifecycle

## Goal

Prove — with deterministic, non-hanging tests at **both** the runtime and CLI layers — that the `grant → preview → approve → apply` lifecycle enforces its safety invariants.

## Why this matters

Sprint 13 shipped the lifecycle but **zero tests touch `approveAuthorizedWorkspace` / `applyAuthorizedWorkspace`** (grep-verified across `packages/**`). The invariants that make the flow safe — a single-use `approvalId` bound to session, rootPath and diffHash, a clamped TTL, and consume-on-success — are currently unpinned. A regression would silently allow replay, cross-session, or cross-root writes.

## Scope

- New runtime unit suite covering the full lifecycle: single-use, consume-on-success, session binding, rootPath binding, TTL clamp/default, expiry, diffHash binding.
- New CLI process-level suite (built on the E1 harness) covering the happy path, the duplicate-`approvalId` regression, read-only misuse, malformed args, and daemon-down.
- A read-only grant misuse matrix at both layers (a `read-only` grant cannot preview/approve/apply).

## Out of scope

- Changing any lifecycle behavior, the approval record shape, the IPC protocol, or the TTL constants (E2 exports them; E3 only pins existing behavior).
- Provider/daemon reachability matrix (E4) and the smoke command (E5) — E3 reuses, does not build, those.
- Changing the CLI `--ttl` default (60s) — that is E2.

## Acceptance criteria

- A new `packages/runtime/src/__tests__/approval-lifecycle.test.ts` is green and pins all seven invariants (single-use, consume-on-success, session, rootPath, TTL clamp, TTL default, expiry) plus diffHash binding.
- A new `packages/cli/src/__tests__/workspace-approval-cli.test.ts` is green: happy path → `applied: true`; duplicate `approvalId` → exit 1 + `"Unknown or already-consumed approvalId"` + `assertNoObjectLeak`.
- A `read-only` grant is rejected by `preview`/`approve` at the runtime layer (apply-tool guard) and by `workspace:preview`/`workspace:apply` at the CLI layer.
- Every lifecycle error message a test pins appears verbatim in the source (no drift): the guards at `runtime.ts:534,537,540,544` and `runtime.ts:549`.
- `npm run build` clean; `npm test` green (existing 409 tests still pass).

## Tasks

### Task 1: Runtime approval-lifecycle suite
New file `packages/runtime/src/__tests__/approval-lifecycle.test.ts`. No daemon — `createRuntime()` (`runtime.ts:1029`) + the public grant registry. Register a valid read-write apply grant per case:
- Isolation mirrors `workspace-tools.test.ts` (temp roots cleaned in `afterAll`) and `session-grant-manager.test.ts` (`resetSessionGrantManager()` between cases)
- Pin each invariant with a precise error-string or millisecond-exact assertion

### Task 2: CLI approval-lifecycle suite  
New file `packages/cli/src/__tests__/workspace-approval-cli.test.ts`. Uses the E1 harness (`aer`, `assertNoObjectLeak`, `ensureDaemonUp`, `ensureDaemonDown`, `makeTempWorkspace`). Drive the real `grant → preview → approve → apply` path over the daemon and pin exit code + stream + no-`[object Object]` on every row:
- CRITICAL — cross-invocation session: grants/approvals are keyed by the IPC `sessionId`; each CLI process derives a fresh one — so the chain spanning five separate `aer()` invocations only works if every call shares one session
- Happy path (exit 0): `workspace:grant` → `workspace:preview` → `workspace:approve` → `workspace:apply` → exit 0 and stdout JSON `applied === true`
- Duplicate `approvalId` (headline regression): run the apply step twice with the same `approvalId` → second call exits 1, stderr contains `"Unknown or already-consumed approvalId"`

### Task 3: Read-only grant misuse
- Runtime (unit): a `read-only` grant (tools `read`,`list`) → `previewAuthorizedWorkspace` and `approveAuthorizedWorkspace` both throw `"Workspace tool 'apply' is not granted for this session"` (`runtime.ts:470,496`); the `apply` path throws `"Read-only grants cannot apply changes"` (`workspace-tools.ts:426-427`)
- CLI (process): `workspace:grant` -m read-only -t read,list --yes then `workspace:preview` -f notes.txt -c "x" → exit 1, stderr carries the apply-not-granted rejection  

## Risks / Assumptions

- Singleton grant manager: `createRuntime()` binds the module singleton `getSessionGrantManager()`;
- Real time for expiry: one ~1.1s wait on a 1s TTL — well inside the E1.2 30s budget
- Daemon hygiene: spawn tests share one daemon slot; the E1 harness owns `ensureDaemonUp/Down`

## Dependencies

- E3.1 (runtime): none — uses existing runtime package only.
- E3.2 (CLI): E1 (harness: `aer`, `assertNoObjectLeak`, daemon up/down, temp workspace). Failure-path rows also assume E2 is landed.
- E3.3 (read-only misuse): builds on E3.1 (runtime guard) and E3.2 (CLI harness).

## Test strategy / Validation approach

- Runtime suite is process-free and deterministic (one ~1.1s real wait for expiry).
- CLI suite is process-level via the E1 harness; no live Ollama needed (daemon only).
- Regression gate: `npm run build` + `npm test` green.
- Cross-check with E2: the failure rows assert the same exit-1 + stderr contract E2 standardizes.
