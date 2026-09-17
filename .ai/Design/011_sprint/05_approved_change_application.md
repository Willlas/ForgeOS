# 05 - Approved Change Application

## Objective
Allow controlled source changes only after explicit approval.

## Design
Changes SHALL use structured operations or a validated diff, include expected file hashes, create a snapshot/backup, write atomically and provide rollback on failure.

## Dependencies
01, 02 and 03.

## Acceptance Criteria
- Read-only grants cannot mutate.
- Every mutation requires approval tied to the session and diff hash.
- Hash conflicts stop the operation without overwriting user changes.
- Partial failures are recoverable and auditable.

## Definition of Done
Apply, reject, conflict and rollback tests pass on Windows.
