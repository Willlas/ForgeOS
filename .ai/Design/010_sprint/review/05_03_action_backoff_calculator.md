# Action 05_03 — Backoff calculator (pure)

## Objective
Create a pure, side-effect-free exponential-backoff calculator that the
crash-recovery manager (05_08) uses to decide the delay before each restart
attempt. Splitting the math into its own module gives a trivially testable
pure-function surface and keeps the recovery manager focused on policy.

## Backlog reference
- **Severity:** High
- **Blocks:** 05_08 (crash recovery manager — consumes `computeBackoffDelay`).

## Why it matters
Design 05 §"Public Interfaces" requires `CrashRecoveryManager` to "trigger
automatic restart with max retry limit and exponential backoff." Exponential
backoff with a cap and jitter already exists for task dispatch at
`packages/runtime/src/dispatcher.ts:349`
(`initialDelayMs * Math.pow(backoffMultiplier, attempt - 1)`), but it is inline
and dispatch-specific. Extracting a reusable, tested calculator means the
restart loop and the dispatcher can share the same proven formula.

## Prerequisites
- **05_01** (lifecycle types) complete — imports `BackoffPolicy` and
  `DEFAULT_BACKOFF_POLICY`.

## Steps
1. Create `packages/runtime/src/core/lifecycle/backoff.ts`.
2. Export a pure function:
   `computeBackoffDelay(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF_POLICY):
   number` returning the delay in milliseconds for the given 1-based attempt.
3. Compute the base delay as
   `initialDelayMs * Math.pow(multiplier, attempt - 1)`, then clamp to
   `maxDelayMs`. Mirror the `dispatcher.ts:349` formula.
4. When `policy.jitter` is true, apply **full jitter**: return a random value
   uniformly in `[0, clampedBase]` (use `Math.random()`). When false, return the
   clamped base unchanged.
5. Guard inputs defensively: if `attempt < 1` treat it as `1`; if any policy
   field is non-finite or negative, fall back to the corresponding
   `DEFAULT_BACKOFF_POLICY` field. Never throw.
6. Export a second helper
   `shouldRetry(attempt: number, maxRetries: number): boolean` returning
   `attempt <= maxRetries`, so the recovery manager can express its cap in one
   place.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/backoff.ts`
- **DEPENDS ON** `./types.js` (`BackoffPolicy`, `DEFAULT_BACKOFF_POLICY`)
- **READ-ONLY** `packages/runtime/src/dispatcher.ts` (reference formula at L349)

## Constraints
- **Pure function — no I/O, no timers, no module-level mutable state.** The
  only non-determinism is `Math.random()` for jitter, which tests can pin by
  stubbing.
- Never throw — bad inputs fall back to defaults. A backoff calculator that
  crashes would defeat the recovery manager's resilience goals.
- Always clamp to `maxDelayMs` **before** applying jitter (so jitter never
  exceeds the cap).
- `attempt` is 1-based; `attempt < 1` is normalized to `1`.
- Do not import from `@aer/cli`.

## Verification
- `npm run build` green.
- Scratch: with jitter disabled, `computeBackoffDelay(1)` === `initialDelayMs`,
  `computeBackoffDelay(2)` === `initialDelayMs * multiplier`, and the result
  never exceeds `maxDelayMs` for large attempts.
- Scratch: `shouldRetry(3, 5)` is `true`, `shouldRetry(6, 5)` is `false`.
- Scratch: a negative `attempt` does not throw and returns the attempt-1 delay.
- `npm test` still green.
