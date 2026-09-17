# Action 05_04 — Cleanup coordinator (resource registry)

## Objective
Create a `CleanupCoordinator` that holds a registry of resource-cleanup
functions and runs them sequentially on shutdown, awaiting each in turn and
**never throwing** even if one fails. This replaces the scattered ad-hoc cleanup
in `daemon-entry.ts` (PID, snapshot, IPC, health server) with one ordered,
resilient sequence — and it owns the new IPC-socket-unlink cleanup that closes
the orphan-resource gap.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 05_05 (graceful shutdown handler drives `execute()`),
  05_09 (daemon wiring registers all resources here).

## Why it matters
Design 05 §"Public Interfaces" requires a `CleanupCoordinator` with
`execute(shutdownContext)` and `registerResource(cleanupFn)`, and the DoD
requires *"All resources (IPC listeners, PID file, temp files) are cleaned up on
exit."* Today cleanup is split-brain: `Runtime.stop()` (`runtime.ts:218-258`)
owns subsystem teardown, while `daemon-entry.ts:87-125` owns PID/snapshot/IPC and
calls `process.exit(0)` directly. Worse, the IPC `.sock` file is **never
unlinked** — `ipc-transport.ts:64-74` only destroys the socket/server, leaving
the socket file on disk. The coordinator gives shutdown one place to register and
drain everything, best-effort.

## Prerequisites
- **05_01** (lifecycle types) complete — `ShutdownContext` is the `execute`
  parameter type.

## Steps
1. Create `packages/runtime/src/core/lifecycle/cleanup-coordinator.ts`.
2. Export a `CleanupCoordinator` class with:
   - `registerResource(name: string, cleanup: () => Promise<void> | void): void`
     — append `{ name, cleanup }` to an internal ordered list. Idempotent on
     `name`: re-registering the same name replaces the function (avoids double
     registration of e.g. the PID cleanup).
   - `async execute(ctx: ShutdownContext): Promise<void>` — iterate the list
     **in registration order**, `await` each cleanup, and wrap each in try/catch.
     On error, record `{ name, error }` to a results array and **continue** to
     the next resource. Never rethrow.
   - `getFailures(): ReadonlyArray<{ name: string; error: unknown }>` — return
     the recorded failures from the last `execute()` (empty if none), for
     logging by the shutdown handler.
3. Export a small factory `createIpcSocketCleanup(socketPath: string):
   () => Promise<void>` that `fs.promises.unlink`s the socket path, ignoring
   "file not found" errors. This is the canonical cleanup for the IPC socket
   orphan (`ipc-transport.ts:64-74` currently never unlinks).
4. Make `execute` resilient to a cleanup function that is not async-await-safe:
   treat a thrown synchronous value the same as a rejected promise (catch both).

## Files
- **NEW** `packages/runtime/src/core/lifecycle/cleanup-coordinator.ts`
- **DEPENDS ON** `./types.js` (`ShutdownContext`)
- **READ-ONLY** `packages/runtime/src/ipc-transport.ts` (socket path origin,
  L12-16 + close at L64-74), `packages/cli/src/daemon-entry.ts` (current ad-hoc
  cleanup to be consolidated in 05_09)

## Constraints
- `execute` must **never throw** — a failing cleanup must not prevent the next
  one or block process exit. The whole point is resilient, best-effort teardown.
- Run cleanups in **registration order** (FIFO). Callers (05_09) will register in
  the desired teardown order.
- `registerResource` is idempotent by `name` so the daemon cannot accidentally
  double-clean the PID file.
- The IPC-socket cleanup factory must tolerate a missing file (`ENOENT`) silently.
- Do not import from `@aer/cli`. Only `node:fs/promises` and the local types.

## Verification
- `npm run build` green.
- Scratch: register three cleanups where the second throws; `execute()` resolves
  (does not reject), runs the third, and `getFailures()` reports exactly one
  entry naming the second resource.
- Scratch: `createIpcSocketCleanup(path)` on a non-existent path resolves
  without throwing.
- Scratch: registering the same `name` twice keeps only the latest function.
- `npm test` still green.
