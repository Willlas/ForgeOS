# Plan 06 - Agent and CLI Integration

## Why
Connect the tool layer to the existing ask/chat experience.

## Work
Register tools in Runtime, expose authorized capabilities to the agent, support workspace/mode/approval options and stream tool status.

## Depends On
02-05 and Sprint 010 ask/chat.

## Verification
Run a multi-turn inspection session with isolated history and grants.

## DoD
The CLI can delegate a real read-only project review through the daemon.
