# 04 - Restricted Command Execution

## Objective
Allow the agent to run explicitly approved project commands for review and validation.

## Design
Use `spawn`/`execFile` with argument arrays, never `shell: true`. Each grant defines an executable and argument allowlist, authorized cwd, filtered environment, timeout, cancellation and maximum output.

## Dependencies
01 and 02.

## Acceptance Criteria
- Unapproved executable or argument is rejected.
- Cwd cannot escape the grant root.
- Timeout kills the process tree where supported.
- Output and environment secrets are redacted and bounded.

## Definition of Done
Process tool tests cover allow, deny, timeout, cancellation, exit codes and Windows behavior.
