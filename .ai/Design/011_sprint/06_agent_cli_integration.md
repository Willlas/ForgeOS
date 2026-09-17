# 06 - Agent and CLI Integration

## Objective
Connect authorized workspace tools to `ask` and `chat` while keeping the daemon as Runtime owner.

## Components
- Runtime tool registry and executor
- Agent tool-call loop
- IPC streaming/events and cancellation
- CLI workspace, mode and approval options

## Dependencies
02-05 and Sprint 010 `ask/chat`.

## Acceptance Criteria
- Without a grant the agent cannot inspect or change a target.
- Tool calls are isolated by client/session.
- `ask` remains usable without tools.
- `chat` handles EOF, Ctrl-C, errors and streamed tool status.

## Definition of Done
A real CLI session can inspect an authorized fixture and report its findings without direct CLI access to Runtime internals.
