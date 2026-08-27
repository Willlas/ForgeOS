# 03 - Workspace Read Tools

## Objective
Provide safe read-only inspection of an authorized project such as DCExtractorX.

## Tools
- `list`: list entries below an authorized directory
- `read`: read bounded UTF-8 content
- `search`: search bounded text content while skipping generated/binary areas

## Safety
All paths SHALL be relative to the canonical root. Symlinks/junctions resolving outside the root SHALL be rejected. Read size, traversal depth and result count SHALL be bounded.

## Dependencies
01 and 02.

## Acceptance Criteria
Read-only grants cannot write or execute. Tests cover missing files, traversal, symlinks, limits and unreadable files.

## Definition of Done
Tools are exposed through Runtime/IPC and used by a CLI smoke test against a fixture project.
