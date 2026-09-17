# Action 05_07 — Crash detector

## Objective
Create a `CrashDetector` that periodically checks whether the daemon process is
still alive and emits `onCrash(detectedPid)` exactly once when a previously-alive
PID dies. This is the **detection** half of crash recovery, deliberately split
from the restart policy (05_08) so each concern is independently testable.

## Backlog reference
- **Severity:** High
- **Blocks:** 05_08 (crash recovery manager consumes `onCrash`),
  05_10 (supervisor wires the detector).

## Why it matters
Design 05 §"Components to Create" requires crash detection via PID/process
checks, and the DoD requires *"Crashed daemon automatically restarts."* The
detection must happen **outside** the crashed daemon (a dead process cannot
detect its own death), so this module is driven by the supervisor process
(`daemon.ts`) which polls the PID file. Design 04 already shipped the liveness
primitives (`isPidAlive`, `readPidFile`, `checkHealth`) — this module composes
them into a polling emitter. Today no such polling exists: the supervisor is
fire-and-forget after `unref()` (`daemon.ts:40-49`).

## Prerequisites
- **05_02** (state machine) — `onCrash` transitions the FSM to `Crashed`.
- **05_01** (lifecycle types).
- Design 04 complete: `pid-manager.ts` (`readPidFile`, `isPidAlive`) and
  `health-check.ts` (`checkHealth`) are reused.

## Steps
1. Create `packages/runtime/src/core/lifecycle/crash-detector.ts`.
2. Export a `CrashDetector` class constructed with:
   - `stateMachine: LifecycleStateMachine`
   - `readPid: () => number` — injected PID reader (defaults to `readPidFile`,
     but injectable for tests).
   - `isAlive: (pid: number) => boolean` — injected liveness check (defaults to
     `isPidAlive`).
   - optional `logger`.
3. `start(intervalMs: number): void` — schedule a `setInterval(intervalMs)` that,
   on each tick:
   a. Read the PID. If `<= 0`, skip (nothing to monitor yet).
   b. Track `lastAlivePid` across ticks. If currently alive, store it and return.
   c. If currently **not** alive **and** `lastAlivePid` was set, this is a crash:
      transition the FSM to `Crashed` (best-effort try/catch), invoke every
      `onCrash` listener with `lastAlivePid`, then clear `lastAlivePid` so the
      event fires only once until a new live PID appears.
4. `onCrash(cb: (detectedPid: number) => void): () => void` — register a
   listener, return an unsubscribe function.
5. `stop(): void` — clear the interval timer. `start` is idempotent: a second
   `start` first stops the previous timer.
6. Export a `createDefaultPidReader()` and `createDefaultIsAlive()` thin wrapper
   so callers (05_10) can construct a detector with sane defaults in one line,
   while tests inject stubs.

## Files
- **NEW** `packages/runtime/src/core/lifecycle/crash-detector.ts`
- **DEPENDS ON** `./types.js`, `./lifecycle-state-machine.js`
- **READ-ONLY** `packages/runtime/src/persistence/pid-manager.ts` (`readPidFile`,
  `isPidAlive`), `packages/runtime/src/persistence/health-check.ts`

## Constraints
- Detection runs in the **supervisor** process, not the daemon. Do not spawn or
  depend on IPC — only file reads + `process.kill(pid,0)` via the injected
  `isAlive`.
- `readPid` and `isAlive` are **injected** so tests can simulate
  alive-then-dead without real processes. Defaults wrap the Design-04 functions.
- `onCrash` must fire **once per crash** — clear `lastAlivePid` after firing so a
  sustained-death does not re-emit every tick. A new live PID re-arms detection.
- Skip the tick cleanly when there is no PID (`<= 0`); do not emit `onCrash`.
- Never throw out of the interval callback — wrap the whole tick in try/catch and
  log.
- Do not import from `@aer/cli`.

## Verification
- `npm run build` green.
- Scratch (fake timers): inject a `readPid` returning a fixed PID and an `isAlive`
  that returns `true`, then `false`; after one tick alive and the next dead,
  `onCrash` fires exactly once with the PID; subsequent dead ticks do not re-fire.
- Scratch: when `readPid` returns `<= 0`, the detector never fires `onCrash`.
- Scratch: after a crash, if `isAlive` later returns `true` again (restart) and
  then `false`, `onCrash` fires a second time.
- `npm test` still green.
