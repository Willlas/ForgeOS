# S14-E2.1 — Single Failure-Description Helper

> Sprint 14 | Epic: [S14-E2 — Error Contract & Exit-Code Hardening](../S14-E2-error-contract-and-exit-codes.md) | Priority: P0 | Critical path: yes
> Effort: S
> Constraint: failure-output only — no success-path stdout change; the goal is zero `[object Object]` on any failure path.

## Objective

Introduce one shared, pure, exported failure-description helper, `describeFailure(prefix, err)`, in the CLI so every catch site produces a human-readable, prefixed message that can never print `[object Object]`, then re-route all CLI catch sites through it. This is the foundation that S14-E2.2 (exit codes) and S14-E2.4 (helper tests) build on.

## Implementation details

- Add `export function describeFailure(prefix: string, err: unknown): string` directly next to `errorMessage()` in `packages/cli/src/index.ts` (existing `errorMessage` is at line 35). It must:
  - return the `err.message` value when present — this covers both `Error` instances **and** the IPC `{ code, message }` plain objects that `IpcClient` rejects with (see `packages/cli/src/ipc-client.ts:59, 70, 113, 156`);
  - otherwise fall back to `String(err)`;
  - always return the value prefixed with `prefix` (exact separator is an implementation detail);
  - be pure and exported (testable); never yield `[object Object]`.
  - (Assumption: `describeFailure` may internally reuse `errorMessage(err)` for the message-extraction step; both helpers may coexist and the existing `errorMessage` tests must stay green.)
- Re-route the CLI catch sites that still leak a raw `error` value or inline the `instanceof Error` ternary. Verified sites in the current `packages/cli/src/index.ts`:
  - Daemon management raw leak sites (`console.error('...:', error)`): `start` (line 75), `stop` (line 89), `restart` (line 103).
  - `config:list`: the IPC `catch` (line 220, `console.error('IPC error:', error)`) → route through the helper. The failure branch at line 217 (`console.log('Failed to retrieve configuration.')`) is already a literal string and needs no message change (its exit code is set in S14-E2.2).
  - Inline `instanceof Error ? error.message : ... : String(error)` ternaries: `ask` (line 248), `chat` (line 297), `workspace:read` (line 334), `workspace:execute` (line 410), `review-workspace` (line 645).
- Do not change success-path stdout. Sites that already call `errorMessage(...)` (e.g. `workspace:list` line 358, `workspace:preview` line 547) are already correct and may be left as-is.

## Target files / modules

- `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts` — helper definition + all re-routed catch sites
- Reference (do not modify): `c:\Proyects\MultiAgentDev\packages\cli\src\ipc-client.ts` — plain-object rejection shape that the helper must handle

## Dependencies

None — this is the first E2 task. S14-E2.2 and S14-E2.4 depend on it.

## Expected outcome

Every `console.error` in `packages/cli/src/index.ts` takes either a literal string or a `describeFailure(...)`/`errorMessage(...)` result; the start/stop/restart and inline-ternary failure paths no longer leak `[object Object]`.

## Acceptance criteria

- `describeFailure` is pure, exported, and defined next to `errorMessage()`; no test relies on a private symbol.
- Every `console.error` in `packages/cli/src/index.ts` takes a literal string or a `describeFailure(...)`/`errorMessage(...)` result (verified by grep/review).
- No raw `console.error('...', error)` (printing the raw value) and no inline `instanceof Error` message ternary remain in the re-routed catch sites.
- The existing `errorMessage` tests in `cli-error-propagation.test.ts` still pass.
- `npm run build` is clean.

## Verification command

`npm run build` — clean. Grep gate: `Select-String -Path packages/cli/src/index.ts -Pattern 'instanceof Error'` returns only the `errorMessage` helper body (line 36), not any command catch site. (Process-level spawn assertions for these paths land in S14-E3 / S14-E5.)

## Effort estimate

S
