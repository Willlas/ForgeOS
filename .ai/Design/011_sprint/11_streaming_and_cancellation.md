# 11 - Streaming and Cancellation

## Objective
Complete streamed workspace-tool status and bounded cancellation for `ask` and `chat`.

## Problem
The design requires streaming tool events and cancellation, but the current Sprint 011 acceptance remains partial in this area.

## Scope
- Emit correlated tool-start, progress, result and error events.
- Forward events through IPC to CLI `chat` and compatible `ask` flows.
- Make cancellation idempotent across agent, IPC and process layers.
- Enforce cancellation and timeout bounds for reads, searches and commands.
- Handle EOF, Ctrl-C, provider failure and disconnect without orphaned work.

## Acceptance Criteria
- Clients receive ordered events for a tool call and never another session's events.
- Repeated cancellation is harmless and returns a terminal state.
- Running commands terminate within the documented bound where Windows supports it.
- Tests cover stream success, tool failure, cancellation, timeout, EOF and disconnect.

## Definition of Done
Interactive sessions expose reliable tool progress and cancellation with no orphaned operations.
