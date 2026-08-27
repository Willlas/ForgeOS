# Plan 01 - Workspace Access Grants

## Why
Define the permission boundary before any external workspace operation exists.

## Work
Implement canonical root validation, read-only/read-write modes, allowed tools, expiry, limits and per-session ownership.

## Depends On
Sprint 010 daemon and IPC.

## Verification
Unit tests for missing grants, invalid roots, expiry, traversal and grant isolation.

## DoD
A request without a valid grant is denied by default.
