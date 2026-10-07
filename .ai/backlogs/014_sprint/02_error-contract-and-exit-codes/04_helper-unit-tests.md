# S14-E2.4 — Helper Unit Tests

> Sprint 14 | Epic: [S14-E2 — Error Contract & Exit-Code Hardening](../S14-E2-error-contract-and-exit-codes.md) | Priority: P0 | Critical path: yes
> Effort: S
> Constraint: unit tests only — no daemon, no process spawn.

## Objective

Extend the existing CLI helper test file to cover `describeFailure` across the failure-input matrix, proving that for `Error`, IPC `{code, message}` objects, plain strings, and empty objects the output is always prefixed and never contains `[object Object]`.

## Implementation details

- Extend `packages/cli/src/__tests__/cli-error-propagation.test.ts` (which already imports `errorMessage` from `"../index"`):
  - Import `describeFailure` from `"../index"` alongside `errorMessage`.
  - Add a `describe` block for `describeFailure` with these cases (per the epic):
    - `{ code: 'ApprovalRejected', message: 'Unknown or already-consumed approvalId' }` → the `message` wins (the message text appears; the code does not; no `[object Object]`).
    - an `Error` instance → `error.message` wins.
    - a plain string → passes through (prefixed).
    - `{}` → output never contains `[object Object]`.
    - each result is prefixed with the supplied `prefix`.
- Keep the existing `errorMessage` tests intact; they must remain green.

## Target files / modules

- `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\cli-error-propagation.test.ts`

## Dependencies

S14-E2.1 (needs `describeFailure` to exist and be exported).

## Expected outcome

`describeFailure` unit tests green; `npm run build` clean.

## Acceptance criteria

- `describeFailure` tests cover the `{code, message}` rejection, `Error`, string, and `{}` inputs.
- No test output for any case contains `[object Object]`; each result is prefixed with the supplied `prefix`.
- The existing `errorMessage` tests remain green.
- `npm test` green (existing ~409 tests, including `cli-error-propagation.test.ts`); `npm run build` clean.

## Verification command

`npm run build && npm test` — green; or target the file: `npx vitest run packages/cli/src/__tests__/cli-error-propagation.test.ts` — `describeFailure` cases pass and no output contains `[object Object]`.

## Effort estimate

S
