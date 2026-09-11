# 10 - Authenticated Sessions and Multi-Client Transport

## Objective
Make session isolation authoritative and support concurrent IPC clients safely.

## Problem
Session isolation currently works when clients self-assert different `sessionId` values, but the identity is not authenticated and the transport is single-connection.

## Scope
- Establish session identity during connection setup or from a daemon-issued credential.
- Ignore or reject client-supplied session identifiers that do not match authenticated identity.
- Support multiple simultaneous clients without cross-talk between requests, grants or results.
- Preserve correlation IDs and per-session audit metadata.
- Define disconnect cleanup and stale-session behavior.

## Acceptance Criteria
- A client cannot impersonate another session.
- Concurrent clients receive only their own grants, results and events.
- Disconnects cannot leave unusable or leaked authorization state.
- Tests cover concurrent reads, malformed identity, reconnect and result routing.
- Windows IPC smoke tests pass.

## Definition of Done
Session isolation is enforced by the transport/daemon boundary, not by client convention.
