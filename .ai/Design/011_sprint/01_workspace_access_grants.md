# 01 - Workspace Access Grants

## Objective
Define the explicit permission object that allows an agent session to access a workspace.

## Design
A grant SHALL contain a canonical absolute `rootPath`, `mode` (`read-only` or `read-write`), allowed tools, allowed commands, expiry, output limits and approval policy. Missing or invalid grants SHALL deny access.

## Components
- `WorkspaceAccessGrant`
- root canonicalization and containment validation
- per-client/per-session grant ownership

## Dependencies
Sprint 010 daemon/IPC and no implementation dependency within Sprint 011.

## Acceptance Criteria
- No grant means no workspace access.
- Relative, traversal, UNC and out-of-root paths are rejected.
- Grant mode and expiry are enforced on every operation.
- Grants cannot be shared accidentally between IPC clients.

## Definition of Done
Grant types, validation tests and audit fields exist and are documented.
