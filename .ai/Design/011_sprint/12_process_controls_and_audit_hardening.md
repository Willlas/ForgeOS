# 12 - Process Controls and Audit Hardening

## Objective
Close remaining defense-in-depth gaps around restricted commands, output handling and audit records.

## Scope
- Verify executable and argument allowlists cannot be bypassed by path aliases or environment changes.
- Enforce authorized cwd containment after canonicalization, including junctions and symlinks.
- Bound process lifetime, output size and process-tree termination on Windows.
- Filter inherited environment variables and redact secrets from results and logs.
- Ensure audit records include session, grant, command, correlation and outcome without sensitive values.

## Acceptance Criteria
- Shell injection, argument smuggling, cwd escape and alias bypass tests fail closed.
- Timeout and cancellation do not leave child processes running.
- Output truncation is explicit and bounded.
- Logs contain required audit metadata and no tokens, secrets or file contents beyond policy.
- Windows-specific tests pass.

## Definition of Done
Restricted execution and audit logging meet the documented security boundary under adversarial tests.
