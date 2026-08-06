# Action 05_01 — Lifecycle types module

## Objective
Create the shared type definitions that every other lifecycle module imports:
the `LifecycleState` enum, the `ShutdownContext`/`ShutdownReason` types, and the
`BackoffPolicy` shape. This is pure types — no runtime logic, no I/O — so it is
the foundation every subsequent action builds on.

## Backlog reference
- **Severity:** Critical
- **Blocks:** 05_02 (state machine), 05_04 (cleanup coordinator), 05_08 (crash
  recovery), and indirectly every other action that references these types.

## Why it matters
Design 05 §"Public Interfaces" specifies daemon lifecycle states
`starting | running | stopping | crashed | restarting`, plus a `ShutdownContext`
passed to the cleanup coordinator and a backoff policy for restart. Today only the
unrelated `RuntimeState` enum exists (`packages/runtime/src/core/runtime.ts:29-37`),
which lacks `crashed`/`restarting` and has no FSM semantics. Centralizing the
types in one module prevents drift between the state machine, the shutdown
handler, and the crash-recovery manager.

## Prerequisites
None. This is the first action of Design 05 and has no dependency on any other
05_0* action. Design 04 is complete.

## Steps
1. Create `packages/runtime/src/core/lifecycle/types.ts`.
2. Export a `LifecycleState` enum (string-valued) with exactly these members:
   `Starting`, `Running`, `Stopping`, `Crashed`, `Restarting`. Use the exact
   casing already used by `RuntimeState` in `runtime.ts` for consistency.
3. Export a `ShutdownReason` string-literal union covering the triggers the
   shutdown handler will receive: `"sigint"`, `"sigterm"`, `"uncaughtException"`,
   `"unhandledRejection"`, `"explicit"`, `"timeout"`, `"fatal"`.
4. Export a `ShutdownContext` interface carrying the `reason: ShutdownReason`, an
   optional `error?: unknown` (for the uncaught/unhandled cases), the
   `LifecycleState` the process was in when shutdown began, and an ISO-string
   `triggeredAt`.
5. Export a `BackoffPolicy` interface: `initialDelayMs: number`,
   `maxDelayMs: number`, `multiplier: number` (exponential base), and
   `jitter: boolean`. Export a `DEFAULT_BACKOFF_POLICY` constant satisfying it
   (`initialDelayMs: 1000`, `maxDelayMs: 30000`, `multiplier: 2`, `jitter: true`).
6. Export a `RestartDecision` type (`{ delayMs: number; attempt: number } |
   null`) that the crash-recovery manager will return — `null` means "stop
   retrying".
7. Add no runtime functions — this file is types + the one
   `DEFAULT_BACKOFF_POLICY` constant only.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/types.ts`
- **READ-ONLY** `packages/runtime/src/core/runtime.ts` (reference the existing
  `RuntimeState` enum for casing convention)

## Constraints
- This module must **not import from any other lifecycle file** — it is the
  dependency root. Importing nothing (beyond built-ins) keeps it cycle-free.
- Keep every exported type **plain-serializable** (no class instances, no Maps);
  `ShutdownContext` may be logged or snapshotted later.
- Use string-valued enum members so serialized values are human-readable.
- Do not export runtime functions here beyond `DEFAULT_BACKOFF_POLICY` — other
  actions own behavior.

## Verification
- `npm run build` green.
- A scratch import in the runtime package can reference `LifecycleState`,
  `ShutdownContext`, `BackoffPolicy`, and `DEFAULT_BACKOFF_POLICY` without error.
- `DEFAULT_BACKOFF_POLICY` satisfies the `BackoffPolicy` interface (type-checks).
- `npm test` still green.
