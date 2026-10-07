# S14-E3.2: CLI approval-lifecycle suite (spawn, end-to-end)

## Task
Create a new spawn-based CLI test suite `packages/cli/src/__tests__/workspace-approval-cli.test.ts` that drives the **`workspace:preview` → `workspace:approve` → `workspace:apply`** flow end-to-end against a real daemon and locks the user-visible contract: the `diffHash` and `approvalId` **hints** on stderr, the `diffHash`/`approvalId` **values** on stdout (JSON), and the rejection paths (duplicate `approvalId`, missing `diffHash`, daemon-down). It relies on the E1 harness (`ensureDaemonUp`/`ensureDaemonDown`) for daemon lifecycle and on the E2.1/E2.3 fixes already landed in `packages/cli/src/index.ts` (both `workspace:preview` and `workspace:apply` already use `errorMessage` at `index.ts:547,617`; the `--ttl` help text at `index.ts:558` now says `3600` — E2.3).

## Target
- **New:** `packages/cli/src/__tests__/workspace-approval-cli.test.ts`

## Acceptance criteria
1. **Happy path:** `preview` → stdout has a `diffHash` **and** stderr has `Use this diffHash with workspace:approve: <hash>`; `approve --yes` → stdout has an `approvalId` matching `/^wsa_/` and stderr has `Use this approvalId with workspace:apply: <id>`; `apply --yes` → stdout has `"applied": true` and the target file content is present on disk.
2. **Duplicate `approvalId` regression:** re-`apply` the same `approvalId` → exit `1`, stderr contains `Unknown or already-consumed approvalId` (the E2.1-fixed message) and does **not** contain `[object Object]`.
3. **Missing `diffHash`:** `approve <root> ""` → exit `1`, stderr matches `Approve requires a non-empty diffHash` (the E2.1-fixed message).
4. **Daemon-down:** with the daemon stopped, `workspace:approve <root> <hash> --yes` (and `workspace:apply`) → exit `1`, stderr contains `Daemon is not running` (`index.ts:561,601`).

## Approach
- **Daemon lifecycle (E1.1):**
  ```ts
  import { ensureDaemonUp, ensureDaemonDown } from "./harness/daemon"; // exact path to verify
  beforeAll(() => ensureDaemonUp());
  afterAll(() => ensureDaemonDown());
  ```
  Confirm the exact exported symbols/paths in `packages/cli/src/__tests__/harness/daemon.ts` (or wherever the E1 harness lives) before importing. **Do not** start/stop the daemon per test — share one slot (the E1 harness owns kill/timeout logic and never kills a live pid file).
- **Spawning (reference `workspace-grant-cli.test.ts`):**
  - Spawn `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts <command> <args...>` from the repo root.
  - **Grant once in `beforeAll`** (e.g. `workspace:grant <root> --mode read-write --tools "apply,read,list,search" --yes`) and reuse that grant across the cases so the approval flow is isolated from grant registration.
  - **Capture `diffHash` / `approvalId` from the stdout JSON** (`JSON.parse(stdout)`), not from the stderr hint — so the tests don't depend on hint wording (the hints are asserted *separately* in criterion 1).
  - Use one `mkdtemp` temp root per case; clean up in `afterAll` (`.catch(() => {})`).
  - Pass `--yes` to `approve`/`apply` to skip the confirmation prompt in automated runs.
- **Reference:** `workspace-grant-cli.test.ts` (spawn + grant), `cli-error-propagation.test.ts` (the exact `"Unknown or already-consumed approvalId"` string and the `errorMessage` import from `../index`), and the E2.1 file (what was fixed).

## Notes
- **Timeout budget:** the happy path spawns 3–4 CLI processes plus one daemon — comfortably inside the E1.2 30s budget; do not add artificial waits.
- **Audit-safety is implied** (the `approve` stdout JSON has no `approvalToken` because the daemon never sends one — `ipc-protocol.ts:364`); the suite only needs to assert the `approvalId` it *does* carry.
- **Do not** re-test the `--file`/`--content` pair-count validation — that is E5.1's `pair-count` subtask.
- **Keep the duplicate-id assertion verbatim** — `cli-error-propagation.test.ts` documents the exact daemon message and the code `6` mapping; reuse that string.
