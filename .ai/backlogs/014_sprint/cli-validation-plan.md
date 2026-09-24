# CLI validation and interaction plan

## Purpose

This document defines a practical validation plan for interacting with the `aer` CLI in the current repository state. It is intended to guide both local manual testing and future regression automation.

## Scope

The validated scope is the existing workspace loop:
- grant
- preview
- approve
- apply

This plan covers both the success path and the most relevant failure paths for CLI reliability, operator confidence, and regression prevention.

## Core assumptions

- The daemon must be running before CLI workspace commands are used.
- The local Ollama provider remains experimental and should be treated as a prerequisite dependency.
- The CLI should never surface raw `[object Object]` for IPC rejections.
- The operator should be able to validate behavior with command output and exit codes, not just by reading code.

## Test matrix

### 1) Happy path — valid CLI flow

Commands to run:
1. `aer start`
2. `aer status`
3. `aer workspace:grant <root> -m read-write -t list,read,search,apply --yes`
4. `aer workspace:preview <root> -f notes.txt -c "demo text"`
5. `aer workspace:approve <root> <diffHash> --yes`
6. `aer workspace:apply <root> <approvalId> -f notes.txt -c "demo text" --yes`

Expected results:
- `aer status` prints daemon and provider state
- grant succeeds with session-scoped grant output
- preview returns a diffHash
- approval returns a single-use approvalId
- apply succeeds and writes the file
- exit code is 0 for the successful path

### 2) Reused approvalId failure path

Command:
- rerun the `workspace:apply` step with the same `approvalId`

Expected result:
- exit code 1
- stderr includes: `Unknown or already-consumed approvalId`
- output must not include `[object Object]`

### 3) Daemon not running

Command:
- run a workspace command while daemon is down

Expected result:
- `Daemon is not running. Start it first.`
- exit code 1
- no hangs or unbounded wait

### 4) Read-only grant misuse

Command:
- attempt `preview` or `apply` without a read-write grant including `apply`

Expected result:
- clear failure that explains the grant requirement
- exit code 1
- reproducible operator error message

### 5) Local Ollama unavailable

Command:
- run `aer status` when Ollama is not reachable

Expected result:
- provider line prints `unreachable`
- CLI remains responsive
- no hang or crash
- status command still exits cleanly if daemon state is otherwise valid

### 6) Invalid argument or malformed payload

Examples:
- missing required arguments
- mismatched `--file` / `--content` pairs
- invalid TTL value for approval
- malformed root path

Expected result:
- clear message from CLI
- deterministic exit code 1
- no silent failure or object-stringification

## Manual operator checklist

### Initial smoke test
- start the daemon
- check status
- verify provider line is present
- run a valid grant cycle
- confirm apply writes the expected file

### Failure smoke test
- exhaust the same approvalId once
- confirm the exact message is surfaced
- verify no `[object Object]` appears in output

### Recovery check
- restart the daemon if needed
- re-register the grant
- repeat the workflow and confirm command sequences remain stable

## Exit-code expectations

- success: exit code 0
- validation failure / invalid command flow: exit code 1
- daemon not running: exit code 1
- provider unreachable: status command should still stay responsive and not crash

## Recommended automation hooks

Where possible, convert these into targeted Vitest tests:
- `workspace:apply` duplicate approvalId error message
- `aer status` provider reachability output
- daemon-down behavior
- basic invalid-argument and malformed payload checks

## Suggested next-step plan

1. Validate the full happy path manually on a scratch workspace.
2. Validate at least two failure paths: reused approvalId and daemon-down state.
3. Capture exact output strings for each step.
4. Convert the repeatable checks into a CLI-focused regression suite.
5. Keep the suite small and deterministic, not dependent on live external infrastructure.

## Acceptance bar for this sprint

A CLI validation plan is considered useful if it allows a developer or operator to:
- run the success path in a predictable sequence,
- observe failures without confusion,
- confirm the exact message format for known error patterns,
- validate the provider-state line without depending on a live Ollama instance in CI.
