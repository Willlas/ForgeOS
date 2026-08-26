/**
 * Crash Recovery Manager — decides whether and when to restart the daemon
 * after a crash, using exponential backoff and a hard maxRetries cap.
 *
 * Consumes onCrash events (wired by 05_10) and drives an injected restartFn,
 * so the restart *mechanism* stays in @aer/cli while the *policy* lives here.
 *
 * @module core/lifecycle/crash-recovery-manager
 */

import { computeBackoffDelay, shouldRetry } from './backoff.js';
import { BackoffPolicy, DEFAULT_BACKOFF_POLICY } from './types.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Signature for an optional callback invoked when max retries are reached. */
export type OnGiveUp = (attemptCount: number) => void;

/** Minimal logger shape; any object implementing `warn` / `info` suffices. */
interface Logger {
  warn?(msg: string, ...args: unknown[]): void;
  info?(msg: string, ...args: unknown[]): void;
}

// ---------------------------------------------------------------------------
// CrashRecoveryManager
// ---------------------------------------------------------------------------

export class CrashRecoveryManager {
  private readonly restartFn: () => Promise<void>;
  private readonly policy: BackoffPolicy;
  private readonly logger?: Logger;
  private readonly onGiveUp?: OnGiveUp;

  private maxRetries = 0;
  private attemptCount = 0;
  private active = false;
  private inFlight = false;

  // Stored so stop() can cancel a pending backoff timer.
  private backoffHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    restartFn: () => Promise<void>,
    options?: {
      policy?: BackoffPolicy;
      logger?: Logger;
      onGiveUp?: OnGiveUp;
    },
  ) {
    this.restartFn = restartFn;
    this.policy = options?.policy ?? DEFAULT_BACKOFF_POLICY;
    this.logger = options?.logger;
    this.onGiveUp = options?.onGiveUp;
  }

  /**
   * Activate the manager with the given retry budget.
   * Resets the attempt counter and marks the manager as active.
   */
  start(maxRetries: number, _initialBackoffMs?: number): void {
    this.maxRetries = maxRetries;
    this.attemptCount = 0;
    this.active = true;
    this.inFlight = false;
    this.logger?.info?.('[CrashRecoveryManager] Activated with maxRetries:', maxRetries);
  }

  /**
   * Core policy: decide whether to restart after a crash.
   * Re-entrant safe — a second call while one is in-flight will bail out.
   */
  async recordCrash(_detectedPid?: number): Promise<void> {
    if (!this.active) return;

    // Guard against parallel calls (re-entrancy).
    if (this.inFlight) {
      this.logger?.warn?.('[CrashRecoveryManager] Previous recovery still in-flight, ignoring.');
      return;
    }

    this.attemptCount++;
    const attempt = this.attemptCount;

    try {
      this.inFlight = true;

      // Hard cap check.
      if (!shouldRetry(attempt, this.maxRetries)) {
        this.logger?.warn?.(
          `[CrashRecoveryManager] Max retries reached (${this.maxRetries}), giving up.`,
        );
        this.onGiveUp?.(attempt);
        return;
      }

      const delayMs = computeBackoffDelay(attempt, this.policy);
      this.logger?.info?.(
        `[CrashRecoveryManager] Scheduling restart attempt ${attempt}/${this.maxRetries} in ${delayMs}ms`,
      );

      // Wait for backoff — stored on instance so stop() can cancel it.
      await new Promise<void>((resolve) => {
        this.backoffHandle = setTimeout(() => {
          this.backoffHandle = null;
          resolve();
        }, delayMs);
      });

      if (!this.active) return; // stop() was called during backoff.

      // Execute the injected restart function.
      try {
        await this.restartFn();
        this.logger?.info?.(`[CrashRecoveryManager] Restart attempt ${attempt} succeeded.`);
      } catch (err) {
        // Failed restart consumes the attempt but does not crash the manager.
        this.logger?.warn?.(
          `[CrashRecoveryManager] Restart attempt ${attempt} failed:`,
          err,
        );
      }
    } catch (err) {
      // Never throw out of recordCrash — internal errors are swallowed.
      this.logger?.warn?.('[CrashRecoveryManager] Unexpected error:', err);
    } finally {
      this.inFlight = false;
    }
  }

  /** Deactivate and cancel any pending backoff timer. */
  stop(): void {
    this.active = false;
    if (this.backoffHandle !== null) {
      clearTimeout(this.backoffHandle);
      this.backoffHandle = null;
    }
    this.logger?.info?.('[CrashRecoveryManager] Stopped.');
  }

  /** Current attempt counter (for tests + observability). */
  getAttemptCount(): number {
    return this.attemptCount;
  }
}