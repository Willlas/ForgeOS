# Plan 03 - Workspace Read Tools

## Why
Enable the first useful project-manager workflow: inspect an authorized project.

## Work
Implement list, read and search with root confinement, size/result limits and generated-file exclusions.

## Depends On
01-02.

## Verification
Use a fixture and a CLI smoke test against DCExtractorX README or equivalent.

## DoD
Read-only inspection works through IPC without direct Runtime access from CLI.
