# Plan 05 - Approved Change Application

## Why
The agent must not silently modify a client project.

## Work
Add structured diffs, approval tokens, expected hashes, snapshots, atomic writes and rollback.

## Depends On
01-03.

## Verification
Test approval denial, hash conflict, successful apply and recovery after partial failure.

## DoD
Every mutation is explicit, auditable and recoverable.
