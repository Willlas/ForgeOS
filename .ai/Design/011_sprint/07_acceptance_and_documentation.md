# 07 - Acceptance and Documentation

## Objective
Prove the workspace-tool feature is secure, usable and documented.

## Verification
Run `npm run build`, `npm run lint`, focused tests and the full suite. Execute daemon/CLI smoke tests for read-only inspection, denied traversal, command restrictions, approval, cancellation, concurrent sessions and provider failure.

## Acceptance Criteria
- Security tests pass on Windows.
- Two clients cannot cross-read grants or results.
- Logs contain audit metadata but no secrets.
- Documentation and indexes reflect actual implementation status.

## Verification Evidence (session-scoped grant isolation)
- Unit: `packages/runtime/src/__tests__/session-grant-manager.test.ts` (9 tests) covers two-client grant isolation, expiration, revocation, approval-token exclusion from audit listings and Windows path normalization.
- Full suite: 388/388 tests pass; `npm run build` clean.
- Smoke (live daemon, `C:\Proyects\DCExtractorX` read-only):
  - Session A (`AER_SESSION_ID=smoke_client_a`) registered a read-only grant and listed it via `workspace:grants`.
  - Session B (`AER_SESSION_ID=smoke_client_b`) listed `grants: []` — A's grant is not cross-readable.
  - `workspace:read README.md` returned real content under a grant.
  - Traversal read (`..\..\..\Windows\win.ini`) was denied: "Workspace path escapes the granted root".

## Definition of Done
All acceptance evidence is recorded and no unapproved external workspace operation is possible.
