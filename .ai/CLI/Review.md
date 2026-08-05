Objective
Determine whether the current Aer Runtime is:

A) A persistent Runtime Service (Daemon)

or

B) A library instantiated temporarily by the CLI.

Do NOT modify the repository.

Do NOT implement anything.

Do NOT commit.

Do NOT update ROADMAP.md.

Do NOT update PROJECT_STATE.md.

This is an architecture audit only.

====================================================

Rules

- Read ONE file at a time.
- Before reading a file, verify it exists.
- Use PowerShell only.
- Do NOT perform repository-wide searches.
- Read only the minimum number of files required.
- Never assume architecture.
- Every conclusion must be supported by evidence.

====================================================

Investigation Plan

Phase 1 — Discover Runtime Bootstrap

Locate and inspect:

- package.json
- CLI entrypoint
- Runtime entrypoint
- Runtime creation/bootstrap
- Runtime lifecycle

Determine:

- Where Runtime is instantiated.
- Who owns the Runtime instance.
- Whether Runtime survives CLI termination.

====================================================

Phase 2 — Runtime Lifecycle

Determine whether Runtime:

- is created inside the CLI process
- is started as an independent process
- forks another process
- spawns a child process
- starts a background service
- creates a daemon
- creates a Named Pipe
- creates a Unix/Windows Socket
- starts an HTTP server
- starts a gRPC server
- exposes IPC
- writes a PID file
- registers a Windows Service
- keeps an event loop alive after CLI exits

Provide evidence for every answer.

====================================================

Phase 3 — CLI Behaviour

Determine what happens when executing:

node dist/cli/index.js start

Does it:

- block?
- exit immediately?
- remain running?
- detach?
- keep a Runtime alive?

Then determine what happens when executing:

node dist/cli/index.js status

Explain exactly where the reported status comes from.

====================================================

Phase 4 — Runtime Ownership

Determine who owns the Runtime instance.

Possible answers:

CLI owns Runtime

Runtime owns itself

Daemon owns Runtime

Background process owns Runtime

Other (explain)

====================================================

Phase 5 — Architectural Classification

Classify the current implementation.

Choose ONLY one.

□ Embedded Library

□ In-Process Runtime

□ Background Service

□ Daemon

□ Client / Server Runtime

□ Hybrid

Explain why.

====================================================

Required Output

Architecture Summary

Runtime Type

Owner of Runtime

Lifecycle

Communication Method

Persistence

Can multiple CLI invocations communicate with the same Runtime?

YES / NO

If YES:

Explain how.

If NO:

Explain why.

Evidence

List every file inspected.

List every relevant class.

List every relevant function.

Final Verdict

The Runtime is:

□ A persistent Runtime Service

or

□ A temporary in-process Runtime instantiated by the CLI.

Support the verdict with objective evidence only.

Stop after the report.

Do not suggest improvements.

Do not implement anything.

Do not continue to another Sprint.