# Action 04_07 — Test suite for persistent state store

## Objective
Add the test coverage Design 04 DoD explicitly requires: "Unit tests cover PID
lifecycle, race conditions, and crash scenarios." Today there are zero tests for
PID/daemon/state/persist/health, and `packages/cli/` has no tests at all.

## Backlog reference
- **Severity:** High (DoD-required — without this, Design 04 cannot be declared
  complete).

## Why it matters
Design 04 introduces crash-recovery and concurrency-sensitive behavior (atomic
writes, stale detection, PID recycling). Without tests these cannot be verified
or protected against regression. Design 05 (Process Lifecycle Management) is
downstream and depends on persisted state for restart decisions — it needs this
behavior to be reliable.

## Prerequisites
- **04_01, 04_02, 04_04, 04_06** complete — tests assert the final wired
  behavior, so write them last.

## Steps
1. Create test files mirroring the project's vitest convention (co-located
   `__tests__/` dirs, `*.test.ts`, `import { describe, it, expect } from "vitest"`):
   - `packages/runtime/src/persistence/__tests__/pid-manager.test.ts`
   - `packages/runtime/src/persistence/__tests__/state-store.test.ts`
   - `packages/runtime/src/persistence/__tests__/health-check.test.ts`
2. **PID manager tests** (`pid-manager.test.ts`) — use a temp dir per test
   (`os.tmpdir()` + unique subdir) so tests are isolated and parallel-safe:
   - write → read round-trip returns the same pid.
   - `isPidAlive` returns true for the current process, false for a bogus pid.
   - `isStale` / `cleanupStale`: write a dead pid → `isStale === true`,
     `cleanupStale()` removes the file and returns true.
   - cleanup on a healthy pid → returns false, file untouched.
   - missing PID file → `readPidFile` returns -1, no throw.
3. **State-store tests** (`state-store.test.ts`):
   - write snapshot → read returns deep-equal object.
   - atomic write: simulate a crash by creating only the `.tmp` file →
     `readSnapshot()` returns null and does not throw.
   - corrupt final file (write garbage) → `readSnapshot()` returns null, no throw.
   - `removeSnapshot` is idempotent.
4. **Health-check tests** (`health-check.test.ts`), pointing all modules at the
   same temp dir:
   - no PID file, no snapshot → `status: "unknown"`.
   - live pid in PID file → `status: "up"`.
   - dead pid in PID file → `status: "down"`, `stalePidFile: true`.
   - snapshot present + dead pid → result includes the snapshot.
   - `checkHealth` never throws even if files are missing/corrupt.
5. If feasible, add one integration-style test for the daemon lifecycle write
   path (04_06) — but keep it hermetic (no real daemon spawn; exercise the
   state-store + snapshot helper directly).

## Files
- **NEW** `packages/runtime/src/persistence/__tests__/pid-manager.test.ts`
- **NEW** `packages/runtime/src/persistence/__tests__/state-store.test.ts`
- **NEW** `packages/runtime/src/persistence/__tests__/health-check.test.ts`

## Constraints
- **Every test must use an isolated temp directory** — never touch the real
  `<repo>/.daemon/` path. Clean up in `afterEach` / `afterAll`.
- Tests must be parallel-safe (no shared files, no fixed ports).
- Do not test the live HTTP/IPC endpoints here — those belong to Design 02's
  scope. Focus on the persistence/health modules.
- Follow the existing test style in `packages/runtime/src/core/__tests__/`.

## Verification
- `npm test` discovers and runs the new test files.
- All new tests pass; total test count rises above the Design 03 baseline (303).
- `npm run build` still green (tests are excluded from the build via tsconfig).
- Coverage for the `persistence/` directory is meaningful (the new tests execute
  every branch of `checkHealth`, including the corrupt-file path).
