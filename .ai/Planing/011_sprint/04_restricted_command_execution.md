# Plan 04 - Restricted Command Execution

## Why
Project review requires controlled build/test commands after inspection.

## Work
Use execFile argument arrays, command allowlists, confined cwd, filtered environment, timeout, cancellation and bounded output.

## Depends On
01-02.

## Verification
Allow/deny, timeout, cancellation, exit code and Windows process tests.

## DoD
No shell concatenation or unrestricted executable execution remains.
