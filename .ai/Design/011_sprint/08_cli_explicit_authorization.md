# 08 - CLI Explicit Authorization

## Objective
Restore deny-by-default at the CLI boundary by removing automatic self-grants.

## Problem
The CLI currently registers a read-only grant for the root supplied to `read`, `list` and `search`. This allows a session with no prior authorization to inspect an external workspace.

## Scope
- Remove implicit grant creation from workspace commands.
- Require an existing session grant before every workspace operation.
- Keep explicit `workspace:grant` and `workspace:revoke` flows available.
- Return a clear authorization error when no grant exists or the grant does not cover the requested tool/path.
- Preserve `ask` and `chat` behavior when no workspace tools are requested.

## Acceptance Criteria
- A fresh CLI session cannot read, list or search any external root.
- A session with an explicit grant can use only the granted tools and root.
- A second session cannot use the first session's grant.
- Tests cover no grant, wrong tool, wrong root, revoke and expiry.
- Windows CLI smoke tests prove deny-by-default.

## Definition of Done
F-01 is resolved and the CLI enforces the same authorization contract as the daemon.
