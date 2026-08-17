/**
 * Watchdog Monitor — daemon-level liveness probe.
 *
 * Periodically probes the Runtime/daemon health and, after N consecutive
 * failed or timed-out probes, fires `onUnresponsive`. This is the
 * daemon-level counterpart to the worker-level watchdog: it watches the
 * whole process, not individual workers.
 *
 * The health probe is **injected**, not hard-coded, so tests can simulate
 * failure without a real Runtime. The module imports only types and the
 * LifecycleStateMachine from this lifecycle package.
 *
 * @module core/lifecycle/watchdog-monitor
 */

import { LifecycleStateMachine } from './lifecycle-state-machine.js';
import { LifecycleState } from './types.js';

// ============================================================================
// Logger
// ============================================================================

/** Minimal logger interface the monitor expects. */
interface Logger {
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

// ============================================================================
// Skip-states
// ============================================================================

const SKIP_STATES = new Set([
  LifecycleState.Stopping,
  LifecycleState.Crashed,
  LifecycleState.Restarting,
]);

// ============================================================================
// WatchdogMonitor
// ============================================================================

type UnresponsiveCallback = () => void;

export class WatchdogMonitor {
  private readonly _fsm: LifecycleStateMachine;
  private readonly _probe: () => Promise<boolean>;
  private readonly _logger: Logger;

  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _consecutiveFailures = 0;
  private _failureThreshold = 3;
  private _timeoutMs = 5000;
  private _callbacks: UnresponsiveCallback[] = [];

  constructor(
    stateMachine: LifecycleStateMachine,
    probe: () => Promise<boolean>,
    logger: Logger = console,
  ) {
    this._fsm = stateMachine;
    this._probe = probe;
    this._logger = logger;
  }

  public start(
    intervalMs: number,
    timeoutMs: number,
    failureThreshold = 3,
  ): void {
    this.stop();
    this._failureThreshold = failureThreshold;
    this._timeoutMs = timeoutMs;
    this._consecutiveFailures = 0;
    this._intervalId = setInterval(() => this._tick(), intervalMs);
  }

  public stop(): void {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  public onUnresponsive(cb: UnresponsiveCallback): () => void {
    this._callbacks.push(cb);
    return () => {
      const idx = this._callbacks.indexOf(cb);
      if (idx !== -1) this._callbacks.splice(idx, 1);
    };
  }

  private _tick(): void {
    try {
      if (SKIP_STATES.has(this._fsm.getState())) return;
      this._raceProbe().then((healthy: boolean) => {
        if (healthy) {
          this._consecutiveFailures = 0;
        } else {
          this._consecutiveFailures++;
          if (this._consecutiveFailures >= this._failureThreshold) {
            this._fireUnresponsive();
            this._consecutiveFailures = 0;
          }
        }
      });
    } catch (err) {
      this._consecutiveFailures++;
      if (this._consecutiveFailures >= this._failureThreshold) {
        this._fireUnresponsive();
        this._consecutiveFailures = 0;
      }
    }
  }

  private _raceProbe(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const t = setTimeout(() => {
        if (!settled) {
          settled = true;
          this._logger.warn('[watchdog] Probe timed out after %d ms', this._timeoutMs);
          resolve(false);
        }
      }, this._timeoutMs);
		// NOTE: Do NOT unref() — the watchdog should keep the daemon alive
		// (it is a liveness monitor). Tests use vitest fake-timers instead.

      this._probe()
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(t);
            resolve(result);
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            clearTimeout(t);
            this._logger.error('[watchdog] Probe threw: %s', String(err));
            resolve(false);
          }
        });
    });
  }

  private _fireUnresponsive(): void {
    this._logger.error(
      '[watchdog] Daemon unresponsive after %d consecutive failed probes — notifying %d callback(s)',
      this._failureThreshold,
      this._callbacks.length,
    );
    for (const cb of this._callbacks) {
      try {
        cb();
      } catch {
        // A broken callback must not stop the others.
      }
    }
  }
}
