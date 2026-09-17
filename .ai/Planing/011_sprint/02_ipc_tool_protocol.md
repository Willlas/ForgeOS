# Plan 02 - IPC Tool Protocol

## Why
The agent and CLI need a typed channel for authorized tool requests and results.

## Work
Add session/grant identifiers, tool request/result envelopes, approval, cancellation, timeout and structured errors.

## Depends On
01.

## Verification
Round-trip serialization and wrong-session rejection tests.

## DoD
Existing lifecycle and ask commands remain compatible.
