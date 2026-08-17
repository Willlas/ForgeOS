/**
 * Crash Detector — periodically checks whether a tracked daemon PID is alive
 * and emits `onCrash(detectedPid)` exactly once when a previously-alive PID dies.
 *
 * This module only handles detection; restart policy lives in a separate
 * module (crash-recovery-manager). The detector runs in the supervisor
 * process, not inside the daemon itself.
 *
 * @module core/lifecycle/crash-detector
 */

import { LifecycleState } from './types.js';
import { LifecycleStateMachine } from './lifecycle-state-machine.js';
import { readPidFile, isPidAlive } from '../../persistence/pid-manager.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Signature for functions that return the current daemon PID. */
export type PidReader = () => number;

/** Signature for functions that probe whether a PID is alive. */
export type AliveChecker = (pid: number) => boolean;

/** Default logger shape; any object implementing `warn` suffices. */
interface Logger {
  warn?(msg: string, ...args: unknown[]): void;
}

// ---------------------------------------------------------------------------
// Factory helpers so callers can one-line construct with sensible defaults
// ---------------------------------------------------------------------------

/**
 * Returns a PID reader backed by the real filesystem (readPidFile).
 */
export function createDefaultPidReader(): PidReader {
  return readPidFile;
}

/**
 * Returns an alive-checker backed by signal-0 probes (isPidAlive).
 */
export function createDefaultIsAlive(): AliveChecker {
  return isPidAlive;
}

// ---------------------------------------------------------------------------
// CrashDetector
// ---------------------------------------------------------------------------

/**
 * Polling-based crash detector.
 */
export class CrashDetector {
  private readonly stateMachine: LifecycleStateMachine;
  private readonly readPid: PidReader;
  private readonly isAlive: AliveChecker;
  private readonly logger?: Logger;

  private timer: ReturnType<typeof setInterval> | null = null;
  private lastAlivePid = -1;
  private readonly listeners: Array<(detectedPid: number) => void> = [];

  constructor(
    stateMachine: LifecycleStateMachine,
    options?: {
      readPid?: PidReader;
      isAlive?: AliveChecker;
      logger?: Logger;
    },
  ) {
    this.stateMachine = stateMachine;
    this.readPid = options?.readPid ?? createDefaultPidReader();
    this.isAlive = options?.isAlive ?? createDefaultIsAlive();
    this.logger = options?.logger;
  }

  /**
   * Start the polling loop.
   *
   * Idempotent: calling `start` again while already running will first
   * stop the existing timer and create a new one with the given interval.
   */
  start(intervalMs: number): void {
    this.stop();

    this.timer = setInterval(() => {
      this._tick();
    }, intervalMs);

    // Prevent the interval from keeping the Node process alive.
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the polling loop.
   */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Register an `onCrash` listener.
   *
   * @returns A function that removes the listener when called.
   */
  onCrash(cb: (detectedPid: number) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx !== -1) {
        this.listeners.splice(idx, 1);
      }
    };
  }

  // ------------------------------------------------------------------
  // Private
  // ------------------------------------------------------------------

  /** Single polling tick — never throws outward. */
  private _tick(): void {
    try {
      const pid = this.readPid();

      // Nothing to monitor yet.
      if (pid <= 0) {
        return;
      }

      if (this.isAlive(pid)) {
        // PID is alive — track it and bail.
        this.lastAlivePid = pid;
        return;
      }

      // PID not alive — was it previously tracked as alive?
      if (this.lastAlivePid > 0) {
        this._handleCrash(this.lastAlivePid);
        this.lastAlivePid = -1; // Clear so we only fire once per crash.
      }
    } catch (err) {
      // Swallow and log; a bad tick must not crash the supervisor.
      this.logger?.warn?.('[CrashDetector] Tick error:', err);
    }
  }

  /** Transition FSM to Crashed (best-effort) and notify listeners. */
  private _handleCrash(detectedPid: number): void {
    try {
      this.stateMachine.transition(LifecycleState.Crashed);
    } catch (err) {
      // Transition may fail if already in Crashed state; log but continue.
      this.logger?.warn?.('[CrashDetector] FSM transition error:', err);
    }

    for (const cb of this.listeners) {
      try {
        cb(detectedPid);
      } catch {
        // A bad listener must not break the others.
      }
    }
  }
}
