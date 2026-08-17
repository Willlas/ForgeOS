/**
 * Graceful Shutdown Handler — OS signals, exceptions, and hard-timeout exit.
 *
 * Registers process-level listeners for SIGINT, SIGTERM, uncaughtException,
 * and unhandledRejection. On any trigger it runs a bounded graceful-shutdown
 * sequence: stop accepting work → drain → run the CleanupCoordinator. A hard
 * `setTimeout` deadline force-exits if cleanup overruns the configured timeout.
 *
 * Idempotent: calling `trigger()` a second time while shutdown is in progress
 * is a no-op so that double Ctrl-C or signals arriving during exception
 * handling do not re-enter the sequence.
 *
 * @module core/lifecycle/graceful-shutdown-handler
 */

import type { CleanupCoordinator } from './cleanup-coordinator.js';
import { LifecycleStateMachine } from './lifecycle-state-machine.js';
import { LifecycleState, ShutdownReason, ShutdownContext } from './types.js';

// ============================================================================
// Logger
// ============================================================================

/** Minimal logger interface the handler expects. */
interface Logger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

// ============================================================================
// exitCodeFor helper
// ============================================================================

/** Return a sensible exit code for each shutdown reason. */
export function exitCodeFor(reason: ShutdownReason): number {
  switch (reason) {
    case 'sigint':
    case 'sigterm':
    case 'explicit':
    case 'timeout':
      return 0;
    default:
      return 1;
  }
}

// ============================================================================
// GracefulShutdownHandler
// ============================================================================

export class GracefulShutdownHandler {
  private readonly _coordinator: CleanupCoordinator;
  private readonly _fsm: LifecycleStateMachine;
  private readonly _logger: Logger;

  private _isShuttingDown = false;
  private _deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private _timeoutMs = 0;

  // Keep references so dispose() can remove exactly what we added.
  private _onSigint: ((code?: string | number | null) => void) | null = null;
  private _onSigterm: ((code?: string | number | null) => void) | null = null;
  private _onUncaughtException: ((err: Error) => void) | null = null;
  private _onUnhandledRejection: ((err: unknown) => void) | null = null;

  constructor(
    coordinator: CleanupCoordinator,
    stateMachine: LifecycleStateMachine,
    logger: Logger = console,
  ) {
    this._coordinator = coordinator;
    this._fsm = stateMachine;
    this._logger = logger;
  }

  public initialize(timeoutMs: number): void {
    this._timeoutMs = timeoutMs;

    this._onSigint = (code) => this.trigger('sigint', code);
    this._onSigterm = (code) => this.trigger('sigterm', code);
    this._onUncaughtException = (err) => this.trigger('uncaughtException', err);
    this._onUnhandledRejection = (err) => this.trigger('unhandledRejection', err);

    process.on('SIGINT', this._onSigint);
    process.on('SIGTERM', this._onSigterm);
    process.on('uncaughtException', this._onUncaughtException);
    process.on('unhandledRejection', this._onUnhandledRejection);
  }

  public async trigger(reason: ShutdownReason, error?: unknown): Promise<void> {
    if (this._isShuttingDown) return;
    this._isShuttingDown = true;

    const ctx: ShutdownContext = {
      reason,
      error,
      state: this._fsm.getState(),
      triggeredAt: new Date().toISOString(),
    };

    try {
      this._fsm.transition(LifecycleState.Stopping);
    } catch (err) {
      this._logger.warn('[shutdown] FSM transition failed: %s', String(err));
    }

    this._deadlineTimer = setTimeout(() => {
      this._logger.error(
        '[shutdown] Deadline exceeded after %d ms — force exit',
        this._timeoutMs,
      );
      process.exit(exitCodeFor(reason));
    }, this._timeoutMs);

    try {
      await this._coordinator.execute(ctx);
    } finally {
      if (this._deadlineTimer !== null) {
        clearTimeout(this._deadlineTimer);
        this._deadlineTimer = null;
      }
    }

    const failures = this._coordinator.getFailures();
    if (failures.length > 0) {
      this._logger.error(
        '[shutdown] Cleanup had %d failure(s): %s',
        failures.length,
        failures.map((f) => `${f.name}: ${String(f.error)}`).join('; '),
      );
      try {
        this._fsm.transition(LifecycleState.Crashed);
      } catch { /* ignore */ }
    }
  }

  public dispose(): void {
    if (this._deadlineTimer !== null) {
      clearTimeout(this._deadlineTimer);
      this._deadlineTimer = null;
    }
    if (this._onSigint !== null) {
      process.removeListener('SIGINT', this._onSigint);
      this._onSigint = null;
    }
    if (this._onSigterm !== null) {
      process.removeListener('SIGTERM', this._onSigterm);
      this._onSigterm = null;
    }
    if (this._onUncaughtException !== null) {
      process.removeListener('uncaughtException', this._onUncaughtException);
      this._onUncaughtException = null;
    }
    if (this._onUnhandledRejection !== null) {
      process.removeListener('unhandledRejection', this._onUnhandledRejection);
      this._onUnhandledRejection = null;
    }
  }
}

