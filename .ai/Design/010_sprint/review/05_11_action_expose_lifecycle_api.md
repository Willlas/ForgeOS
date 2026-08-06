# Action 05_11 — Expose lifecycle public API (barrel)

## Objective
Add a single "Lifecycle exports" block to the runtime package barrel
(`packages/runtime/src/index.ts`) re-exporting every public symbol from the new
`core/lifecycle/` modules (05_01–05_08), so the daemon and supervisor in
`@aer/cli` can import them from `@aer/runtime-lib` and external scripts/tests can
reach them too. This is a small, isolated edit kept separate so a modest coding
model isn't juggling barrel plumbing inside a module action.

## Backlog reference
- **Severity:** High
- **Blocks:** 05_09 and 05_10 (both import lifecycle symbols from
  `@aer/runtime-lib`).

## Why it matters
Design 04 established the convention that library modules are re-exported from
`packages/runtime/src/index.ts` in commented blocks (e.g. "Persistence — Health
Check exports" at L372-374) so consumers import from the package root with `.js`
specifiers. The lifecycle modules are unreachable from `@aer/runtime-lib` until
this block exists. Keeping it in its own action means 05_09/05_10 have a stable
import surface to target.

## Prerequisites
- **05_01 through 05_08** complete — the symbols must exist before re-exporting
  them.

## Steps
1. Open `packages/runtime/src/index.ts`.
2. Add a new commented block after the existing "Persistence — Health Check
   exports" block (near L374), titled `// Lifecycle exports`.
3. Re-export, with `.js` specifiers, the public surface of each module:
   - From `./core/lifecycle/types.js`: `LifecycleState` (enum),
     `ShutdownReason`, `ShutdownContext`, `BackoffPolicy`, `RestartDecision`
     (types via `export type`), and `DEFAULT_BACKOFF_POLICY`.
   - From `./core/lifecycle/lifecycle-state-machine.js`: `LifecycleStateMachine`.
   - From `./core/lifecycle/backoff.js`: `computeBackoffDelay`, `shouldRetry`.
   - From `./core/lifecycle/cleanup-coordinator.js`: `CleanupCoordinator`,
     `createIpcSocketCleanup`.
   - From `./core/lifecycle/graceful-shutdown-handler.js`:
     `GracefulShutdownHandler`, `exitCodeFor`.
   - From `./core/lifecycle/watchdog-monitor.js`: `WatchdogMonitor`.
   - From `./core/lifecycle/crash-detector.js`: `CrashDetector`,
     `createDefaultPidReader`, `createDefaultIsAlive`.
   - From `./core/lifecycle/crash-recovery-manager.js`: `CrashRecoveryManager`.
4. Mirror the existing block style exactly: one `export { ... } from "...";` per
   line, types grouped under an `export type { ... }` line where the symbol is a
   type-only export.

## Files
- **EDIT** `packages/runtime/src/index.ts` (add the "Lifecycle exports" block)

## Constraints
- Use **`.js` specifiers** in every re-export (the package compiles to ESM and
  the rest of the barrel uses `.js`).
- Distinguish value exports from type exports — enums and constants and classes
  are values; interfaces and unions are types (use `export type`).
- Do **not** re-export internal helpers (e.g. the FSM's transition map) — only
  the public API listed above.
- Do not reorder or modify the existing blocks.
- Place the new block at the end of the file to keep the diff minimal and the
  existing sections undisturbed.

## Verification
- `npm run build` green.
- A scratch script can `import { LifecycleStateMachine, GracefulShutdownHandler,
  CrashRecoveryManager, DEFAULT_BACKOFF_POLICY } from "@aer/runtime-lib"` without
  error.
- The existing `persistence` and `core` exports still resolve (no regression).
- `npm test` still green.
