# 01 — Runtime Daemon Process

## Objective
Create a persistent background process for the ForgeOS Runtime so it survives CLI exit and can be shared across multiple CLI invocations.

## Why
The Runtime is currently an in-process library instantiated inside the CLI (`src/cli/index.ts:33`). When the CLI process exits, the Runtime dies with it. There is no daemon, no background service, no fork, no spawn — nothing that keeps the Runtime alive independently. This task establishes the foundation for a long-lived Runtime process.

## Components Involved
- `src/core/runtime.ts` — Runtime class definition
- `src/cli/index.ts` — CLI entry point and current Runtime owner (lines 19, 33, 39, 102, 144)
- New daemon manager module (TBD)
- Package entry points and bin configuration

## Files Likely to Change
- `src/cli/index.ts` — Remove in-process Runtime creation; connect to daemon instead
- `src/core/runtime.ts` — May need lifecycle hooks for daemon mode
- `package.json` — Bin entries or start scripts may change
- New file: Daemon process manager module
- New file: Daemon entry point

## Dependencies
- None (this is a root task)

## Risks
- Breaking existing CLI commands that rely on synchronous Runtime creation
- Windows vs Unix daemon semantics differ significantly (Windows services, `pm2`, `nodemon`, or custom background process strategies)
- Memory leaks in long-lived Runtime process if not properly isolated per-session state
- Debugging complexity increases when Runtime runs in a separate process

## Acceptance Criteria
- [ ] A dedicated process can start the ForgeOS Runtime independently of any CLI invocation
- [ ] The Runtime process survives after the CLI process exits
- [ ] The daemon can be started, stopped, and restarted explicitly
- [ ] The daemon does not block terminal interaction (runs in background)
- [ ] Starting a second CLI instance does NOT create a second Runtime

## Definition of Done
- The Runtime runs as a separate long-lived Node.js process
- CLI no longer creates the Runtime instance directly
- There is a clear programmatic way to start/stop the daemon process
- Manual testing confirms: start daemon -> open CLI -> close CLI -> daemon still running
