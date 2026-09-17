/**
 * Finite-state machine that owns the daemon lifecycle state.
 *
 * Imports only {@link LifecycleState} from ./types and performs pure
 * synchronous transitions.  Illegal transitions throw an Error naming
 * both states so callers surface bugs instead of silently continuing.
 *
 * @module core/lifecycle/lifecycle-state-machine
 */

import { LifecycleState } from './types.js';

// ---------------------------------------------------------------------------

/**
 * Type alias for the listener callback signature.
 */
type StateChangeListener = (from: LifecycleState, to: LifecycleState) => void;

/**
 * Map describing which states are reachable from each current state.
 * Frozen at module initialisation so it cannot be mutated at runtime.
 */
const ALLOWED_TRANSITIONS: Record<LifecycleState, Set<LifecycleState>> =
  Object.freeze({
    [LifecycleState.Starting]: new Set([
      LifecycleState.Starting,
      LifecycleState.Running,
      LifecycleState.Crashed,
      LifecycleState.Stopping,
    ]),
    [LifecycleState.Running]: new Set([
      LifecycleState.Running,
      LifecycleState.Stopping,
      LifecycleState.Crashed,
      LifecycleState.Restarting,
    ]),
    [LifecycleState.Stopping]: new Set([
      LifecycleState.Stopping,
      LifecycleState.Crashed,
    ]),
    [LifecycleState.Crashed]: new Set([
      LifecycleState.Crashed,
      LifecycleState.Restarting,
      LifecycleState.Stopping,
    ]),
    [LifecycleState.Restarting]: new Set([
      LifecycleState.Restarting,
      LifecycleState.Running,
      LifecycleState.Crashed,
      LifecycleState.Stopping,
    ]),
  });

// Freeze each inner set so even the collections are immutable.
Object.values(ALLOWED_TRANSITIONS).forEach((set) => set);

/**
 * Finite-state machine guarding daemon lifecycle transitions.
 *
 * Usage:
 * ```ts
 * const fsm = new LifecycleStateMachine();
 * fsm.onStateChange((from, to) => console.log(`${from} → ${to}`));
 * fsm.transition(LifecycleState.Running);
 * ```
 */
export class LifecycleStateMachine {
  private _state: LifecycleState;
  private readonly _listeners: StateChangeListener[] = [];

  /**
   * Create a new FSM instance.
   * @param initial - The starting state (defaults to `Starting`).
   */
  constructor(initial: LifecycleState = LifecycleState.Starting) {
    this._state = initial;
  }

  /**
   * Return the current lifecycle state (read-only).
   */
  public getState(): LifecycleState {
    return this._state;
  }

  /**
   * Attempt to transition to `next`.
   *
   * @throws `Error` when the transition is not allowed, naming both
   *         the current state and the requested next state.
   */
  public transition(next: LifecycleState): void {
    const current = this._state;

    // Same-state transitions are no-ops (idempotent callers don't fire listeners).
    if (current === next) {
      return;
    }

    const allowed = ALLOWED_TRANSITIONS[current];
    if (!allowed.has(next)) {
      throw new Error(
        `Illegal lifecycle transition: ${current} → ${next}`,
      );
    }

    const from = current;
    this._state = next;
    this._notifyListeners(from, next);
  }

  /**
   * Register a listener that fires after every successful state change.
   *
   * @returns A function that removes the listener when called.
   */
  public onStateChange(
    callback: StateChangeListener,
  ): () => void {
    this._listeners.push(callback);

    return () => {
      const idx = this._listeners.indexOf(callback);
      if (idx !== -1) {
        this._listeners.splice(idx, 1);
      }
    };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Notify all registered listeners after a successful transition.
   * Each listener is wrapped in try/catch so one bad callback cannot
   * break the transition for others.
   */
  private _notifyListeners(
    from: LifecycleState,
    to: LifecycleState,
  ): void {
    for (const listener of this._listeners) {
      try {
        listener(from, to);
      } catch {
        // Swallow individual listener errors; a broken callback
        // must not prevent the state change itself.
      }
    }
  }
}
