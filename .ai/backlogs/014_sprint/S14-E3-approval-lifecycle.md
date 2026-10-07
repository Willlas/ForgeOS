# S14-E3 — Approval-Lifecycle Enforcement

> Sprint 14 | Priority: P0 | Critical path: yes | Plan: `S14-overview.md`

## Goal

Prove — with deterministic, non-hanging tests at **both** the runtime and CLI layers — that the `grant → preview → approve → apply` lifecycle enforces its safety invariants: single-use `approvalId` (consume only after a successful apply), session binding, rootPath binding, TTL clamp + default + expiry, and diffHash binding. The headline regression is that a reused `approvalId` is rejected with a stable, human-readable error and never leaks `[object Object]`.

## Why this matters

Sprint 13 shipped the lifecycle but **zero tests touch `approveAuthorizedWorkspace` / `applyAuthorizedWorkspace`** (grep-verified across `packages/**`). The invariants that make the flow safe — a single-use `approvalId` bound to session, rootPath and diffHash, a clamped TTL, and consume-on-success — are currently unpinned. A regression (e.g. the `pendingWorkspaceApprovals.delete` moving before `applyBatch`, or a dropped session check) would silently allow replay, cross-session, or cross-root writes. The CLI additionally has a known `[object Object]` leak surface on these failure paths (covered by E2). E3 turns these invariants into permanent regression coverage.

## Scope

- New runtime unit suite covering the full lifecycle: single-use, consume-on-success, session binding, rootPath binding, TTL clamp/default, expiry, diffHash binding.
- New CLI process-level suite (built on the E1 harness) covering the happy path, the duplicate-`approvalId` regression, read-only misuse, malformed args, and daemon-down.
- A read-only grant misuse matrix at both layers (a `read-only` grant cannot preview/approve/apply).

## Out of scope

- Changing any lifecycle behavior, the approval record shape, the IPC protocol, or the TTL constants (E2 exports them; E3 only pins existing behavior).
- Provider/daemon reachability matrix (E4) and the smoke command (E5) — E3 reuses, does not build, those.
- Changing the CLI `--ttl` default (60s) — that is E2.

## Dependencies

- **E3.1** (runtime): none — uses the existing runtime package only.
- **E3.2** (CLI): **E1** (harness: `aer`, `assertNoObjectLeak`, daemon up/down, temp workspace). Failure-path rows also assume **E2** is landed (stderr + exit-1 contract, no `[object Object]`) — land E2 before E3.2 per the critical path E1 → E2 → E3.
- **E3.3** (read-only misuse): builds on E3.1 (runtime guard) and E3.2 (CLI harness).

## Risks / Assumptions

- **Singleton grant manager:** `createRuntime()` binds the module singleton `getSessionGrantManager()` (`runtime.ts:196`); the suite injects grants through that same public registry and calls `resetSessionGrantManager()` between tests for isolation. Assume `resetSessionGrantManager()` reliably creates a fresh singleton (already relied on by `session-grant-manager.test.ts`).
- **Real time for expiry:** the one time-dependent assertion (approval expiry) waits ~1.1s on a `1s` TTL — well inside the E1.2 30s budget and consistent with the existing `setTimeout`-based expiry test in `session-grant-manager.test.ts`. No fake timers required.
- **Daemon hygiene (E3.2/E3.3):** spawn tests share one daemon slot; the E1 harness owns `ensureDaemonUp/Down` and the harness never kills a live pid file.
- **Windows path case:** grants resolve `rootPath` case-insensitively (`session-grant-manager.ts:83-85`, `173`); tests use a single `mkdtemp` temp root per case and reuse the exact string.

## Acceptance criteria

- A new `packages/runtime/src/__tests__/approval-lifecycle.test.ts` is green and pins all seven invariants (single-use, consume-on-success, session, rootPath, TTL clamp, TTL default, expiry) plus diffHash binding.
- A new `packages/cli/src/__tests__/workspace-approval-cli.test.ts` is green: happy path → `applied: true`; duplicate `approvalId` → exit 1 + `"Unknown or already-consumed approvalId"` + `assertNoObjectLeak`.
- A `read-only` grant is rejected by `preview`/`approve` at the runtime layer (apply-tool guard) and by `workspace:preview`/`workspace:apply` at the CLI layer.
- Every lifecycle error message a test pins appears verbatim in the source (no drift): the guards at `runtime.ts:534,537,540,544` and `runtime.ts:549`.
- `npm run build` clean; `npm test` green (existing 409 tests still pass).

## Proposed tasks

### S14-E3.1 — Runtime approval-lifecycle suite (M)

New file `packages/runtime/src/__tests__/approval-lifecycle.test.ts`. No daemon — `createRuntime()` (`runtime.ts:1029`) + the public grant registry. Register a valid read-write apply grant per case:

```ts
import { describe, expect, it, afterEach, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "../core/runtime.js";
import { getSessionGrantManager, resetSessionGrantManager } from "../session-grant-manager.js";

const sessionA = "session_alpha";
const sessionB = "session_beta";
const temporaryRoots: string[] = [];

async function tempRoot(prefix: string): Promise<string> {
  const rootPath = await mkdtemp(join(tmpdir(), `aer-approval-${prefix}-`));
  temporaryRoots.push(rootPath);
  return rootPath;
}

afterEach(() => resetSessionGrantManager());
afterAll(async () => {
  for (const root of temporaryRoots) await rm(root, { recursive: true, force: true }).catch(() => {});
  temporaryRoots.length = 0;
});

// Register a read-write grant that carries the apply tool + auto-generated approval token.
function grantApply(rootPath: string, sessionId = sessionA) {
  getSessionGrantManager().registerGrant(sessionId, {
    rootPath, mode: "read-write", tools: ["apply", "read"], approvalRequired: true,
  });
}
```

Isolation mirrors `workspace-tools.test.ts` (temp roots cleaned in `afterAll`) and `session-grant-manager.test.ts` (`resetSessionGrantManager()` between cases). Pin each invariant with a precise error-string or millisecond-exact assertion:

- **Single-use (headline):** `preview → approve → apply` (success, `applied === true`) → apply again with the same `approvalId` → throws `"Unknown or already-consumed approvalId"` (`runtime.ts:534`).
- **Consume-on-success:** a *failed* apply (a change-set whose diffHash does not match) must NOT consume the id → the same `approvalId` still applies on a corrected retry. Proves the delete at `runtime.ts:571` runs only after `applyBatch` succeeds.
- **Session binding:** approve as session A, apply as session B → `"Approval belongs to a different session"` (`runtime.ts:537`).
- **rootPath binding:** approve for root A, apply to root B → `"Approval rootPath does not match the requested rootPath"` (`runtime.ts:540`).
- **TTL clamp:** approve with `expiresInSeconds: 999999` → `Date.parse(expiresAt) - Date.parse(createdAt) === 3_600_000` ms (`runtime.ts:504`, cap `runtime.ts:172`).
- **TTL default:** approve with no `expiresInSeconds` → delta `=== 300_000` ms (`runtime.ts:505`, default `runtime.ts:171`); a negative/non-finite value also falls back to 300s.
- **Expiry:** approve with `expiresInSeconds: 1`, wait ~1.1s, apply → `"Approval has expired"` (`runtime.ts:544`).
- **diffHash binding:** approve for previewed change-set A, then apply a change-set that hashes to B → `"Approval diffHash does not match the requested change set"` (`workspace-tools.ts:436`); the exact previewed set applies cleanly.

**Verify:** `npm test` green; each `it` asserts a stable error string or a millisecond-exact TTL delta. No daemon, no network, no fake timers (one ~1.1s real wait for the expiry row).

### S14-E3.2 — CLI approval-lifecycle suite (M)  _depends on E1 (+ E2 for failure rows)_

New file `packages/cli/src/__tests__/workspace-approval-cli.test.ts`. Uses the E1 harness (`aer`, `assertNoObjectLeak`, `ensureDaemonUp`, `ensureDaemonDown`, `makeTempWorkspace`). Drive the real `grant → preview → approve → apply` path over the daemon and pin exit code + stream + no-`[object Object]` on every row:

- **CRITICAL — cross-invocation session (E1 Subtask 1A-2):** grants/approvals are keyed by the IPC `sessionId` (`session-grant-manager.ts:126`, `ipc-server.ts:349-373`) and each CLI process derives a fresh one (`ipc-client.ts:38-40`) — so the `grant → preview → approve → apply` chain spanning **five separate `aer()` invocations** only works if every call shares one session. Get one id via `newTestSession()` and pass `env: { AER_SESSION_ID: session }` to **every** call in the sequence. Never share one id between two concurrent invocations (the daemon rejects the second socket with `SessionInUse`, `ipc-server.ts:368`).
- **Setup (not an E3 assertion):** `ensureDaemonDown()` → `ensureDaemonUp()` before the grant. A live daemon is a prerequisite here; the daemon-down **assertion** row (exit 1 + `"Daemon is not running. Start it first."`, `index.ts:561,601`) belongs to **S14-E4.3** per the S14 overview map — do not duplicate it in E3.
- **Happy path (exit 0):** `workspace:grant <root> -m read-write -t apply,read --yes` → `workspace:preview <root> -f README.md -c hello` (stdout JSON at `index.ts:544`, diffHash hint at `index.ts:545`) → `workspace:approve <root> <diffHash> --yes` (stdout JSON at `index.ts:581`, approvalId hint at `index.ts:583`) → `workspace:apply <root> <approvalId> -f README.md -c hello --yes` → exit 0 and stdout JSON `applied === true` (`index.ts:615`). Capture `diffHash` / `approvalId` from the **stdout** JSON (audit-safe), not the stderr hint.
- **Duplicate `approvalId` (headline regression):** run the apply step twice with the same `approvalId` → second call exits 1, stderr contains `"Unknown or already-consumed approvalId"` (E2's `describeFailure` formatting, pinned by E2.4), and `assertNoObjectLeak(result)` passes. (Rejection string is the one already captured in `cli-error-propagation.test.ts:6-8`.)
- **token stripping:** the `workspace:approve` response printed to stdout (`index.ts:581`) is the audit-safe `WorkspaceApproveResponsePayload` (`ipc-protocol.ts:364`) and never contains `approvalToken`.

**Verify:** `npm test` green; the duplicate-id row asserts exit 1 + the exact stderr substring + `assertNoObjectLeak`.

### S14-E3.3 — Read-only grant misuse (S)  _builds on E3.1 + E3.2_

- **Runtime (E3.1-style unit):** a `read-only` grant (tools `read`,`list`) → `previewAuthorizedWorkspace` and `approveAuthorizedWorkspace` both throw `"Workspace tool 'apply' is not granted for this session"` (`runtime.ts:470,496`); the `apply` path throws `"Read-only grants cannot apply changes"` (`workspace-tools.ts:426-427`); registering a `read-only` grant *with* `apply` is itself rejected at `session-grant-manager.ts:148-150`.
- **CLI (E3.2-style process):** `workspace:grant <root> -m read-only -t read,list --yes` (shared `AER_SESSION_ID`) then `workspace:preview <root> -f notes.txt -c "x"` → exit 1, stderr carries the apply-not-granted rejection (routed through E2's `describeFailure`), `assertNoObjectLeak`.
- **DISCREPANCY (stale 014 README §1 matrix):** the matrix row and `backlog.md` E3.3 cite `Preview requires a read-write grant` (`workspace-tools.ts:395-398`). That string exists but is **unreachable on the CLI path**: the `apply`-not-granted guard (`runtime.ts:469-470`) throws *before* `WorkspaceTools.preview()` runs, and a read-only grant can never carry `apply` (rejected at `session-grant-manager.ts:148-150`). The message the CLI actually emits is `Workspace tool 'apply' is not granted for this session` — confirmed by the Sprint 12 validated run (`01_capture-validated-cli-workflow.md:32`). Pin **that** string; the `read-write` one is defense-in-depth only. Flag the README matrix row for correction in **E6.2**.
- **OUT OF SCOPE for E3:** malformed-args rows (mismatched `--file`/`--content`, `--ttl 0`, missing `<diffHash>`) belong to **S14-E5.1** per the S14 overview map (`E5.1 malformed`) — do not duplicate here.

**Verify:** `npm test` green; the CLI row asserts exit 1 + the exact `apply-not-granted` substring + `assertNoObjectLeak`.

## Suggested implementation order

E3.1 first (no deps; pins the semantic core and gives the CLI rows their expected error strings). Then E3.2 (needs E1; failure rows need E2). E3.3 last (reuses both harnesses). This matches the plan's "E3.1 ∥ E3.2 → E3.3", with E3.3 scoped to read-only grant misuse (daemon-down rows live in E4.3; malformed-args rows live in E5.1).

## Test strategy / Validation approach

- Runtime suite is process-free and deterministic (one ~1.1s real wait for expiry).
- CLI suite is process-level via the E1 harness; no live Ollama needed (daemon only).
- Regression gate: `npm run build` + `npm test` green (existing 409 tests), and every pinned error string is greppable in the source to prevent drift.
- Cross-check with E2: the failure rows assert the same exit-1 + stderr contract E2 standardizes — if E2 lands later, re-run these rows.

## Evidence from the repo

| Claim | Location |
|---|---|
| `previewAuthorizedWorkspace` — apply-tool guard | `packages/runtime/src/core/runtime.ts:467-470` |
| `approveAuthorizedWorkspace` — TTL clamp (min with cap, else default) | `runtime.ts:502-505` (constants `171-172`) |
| `approveAuthorizedWorkspace` — store + audit-safe response | `runtime.ts:511-519` |
| `applyAuthorizedWorkspace` — single-use guard | `runtime.ts:532-534` ("Unknown or already-consumed approvalId") |
| `applyAuthorizedWorkspace` — session binding | `runtime.ts:536-537` |
| `applyAuthorizedWorkspace` — rootPath binding | `runtime.ts:539-540` |
| `applyAuthorizedWorkspace` — expiry check | `runtime.ts:542-544` |
| `applyAuthorizedWorkspace` — apply-tool re-check | `runtime.ts:547-549` |
| `applyAuthorizedWorkspace` — delegate to `applyBatch` | `runtime.ts:563-568` |
| `applyAuthorizedWorkspace` — consume-on-success | `runtime.ts:570-571` |
| `pendingWorkspaceApprovals` map (single-use store) | `runtime.ts:169` |
| TTL constants: default 300s, cap 3600s | `runtime.ts:171-172` |
| Runtime binds singleton grant manager | `runtime.ts:196` (`getSessionGrantManager`) |
| `createRuntime` factory / public exports | `runtime.ts:1029`; `packages/runtime/src/index.ts:187,150` |
| diffHash binding (apply-side) | `packages/runtime/src/workspace-tools.ts:435-436` |
| read-only `applyBatch` guard | `workspace-tools.ts:426-428` |
| preview-time per-file hash guard | `workspace-tools.ts:642-644` |
| apply-time per-file hash guard + rollback | `workspace-tools.ts:458-461`, `470-475` (`restoreOriginals:658`) |
| read-only registration rejection | `packages/runtime/src/session-grant-manager.ts:148-150` |
| read-write apply requires `approvalRequired` | `session-grant-manager.ts:151-152` |
| `WorkspaceApproveResponsePayload` (audit-safe) | `packages/runtime/src/ipc-protocol.ts:364` |
| CLI `workspace:preview` (stdout JSON + diffHash hint) | `packages/cli/src/index.ts:530-551` (stdout `544`, hint `545`) |
| CLI `workspace:approve` (TTL option, approvalId hint) | `index.ts:553-589` (TTL `558`, stdout `581`, hint `583`) |
| CLI `workspace:apply` (changes + apply response) | `index.ts:591-621` (build `608`, call `609-613`, stdout `615`) |
| CLI `--ttl` help "capped at 300" (wrong), default 60 | `index.ts:558` (E2.3 fixes; E3.1 pins the runtime clamp) |
| file/content pair-count validation (owned by **S14-E5.1**) | `index.ts:512-515` |
| daemon-down guard (owned by **S14-E4.3**) | `index.ts:561,601` |
| duplicate-id rejection already captured in Sprint 12 | `packages/cli/src/__tests__/cli-error-propagation.test.ts:6-8` |
| no test currently references the approval record | grep `approveAuthorizedWorkspace\|applyAuthorizedWorkspace` across `packages/**` → no test hits |
| runtime test idioms (temp-root cleanup, `setTimeout` expiry) | `workspace-tools.test.ts`, `session-grant-manager.test.ts` |
| E1 harness E3.2/3.3 consume | `packages/cli/src/__tests__/helpers/cli-harness.ts` (S14-E1.1) |

## Notes for implementation

- Keep E3.1 process-free and isolated: `resetSessionGrantManager()` in `afterEach`, temp roots cleaned in `afterAll`.
- In E3.2, capture `diffHash` / `approvalId` from the **stdout** JSON (audit-safe) rather than parsing the stderr hint, so the tests don't depend on hint wording.
- Pin error strings verbatim; add a grep step in review to confirm each string still exists in source (prevents the E2 message-routing change from silently breaking E3).
- Do not change the approval record shape, the TTL constants, or the CLI `--ttl` default — those are E2's or out-of-scope.
- The only time-dependent test is the expiry row (~1.1s wait); keep everything else wall-time-free.

