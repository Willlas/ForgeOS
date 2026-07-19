/**
 * Cancellation Token - Support for task and workflow cancellation.
 *
 * Provides cooperative cancellation propagation across the execution pipeline.
 * Clients signal cancellation; the token notifies all waiting/computing tasks.
 *
 * @module runtime/cancellation
 */

// ============================================================================
// Cancellation Token
// ============================================================================

export interface CancellationTokenSource {
  /** The token associated with this source. */
  readonly token: CancellationToken;

  /** Signals cancellation to all listeners. */
  cancel(): void;

  /** Cancels after a delay (in milliseconds). Returns the timeout ID. */
  cancelAfter(delayMs: number): number;

  /** Disposes resources. */
  dispose(): void;
}

/**
 * Cooperative cancellation token.
 *
 * Usage:
 *   const source = new CancellationTokenSource();
 *   task.execute(source.token);
 *   if (error) { source.cancel(); }
 */
export class CancellationToken {
  private _cancelled = false;
  private readonly _listeners = new Array<() => void>();
  private _disposed = false;
  private _timeoutId?: number;

  public get isCancellationRequested(): boolean {
    return this._cancelled;
  }

  public get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Registers a listener that fires when cancellation is requested.
   * Returns a disposal function.
   */
  public onCancellationRequested(listener: () => void): () => void {
    if (this._cancelled) {
      // Fire immediately if already cancelled
      try {
        listener();
      } catch (_) {
        // Ignore listener errors
      }
      return () => {};
    }
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx >= 0) {
        this._listeners.splice(idx, 1);
      }
    };
  }

  /** Signals cancellation. */
  public cancel(): void {
    if (this._cancelled) return;
    this._cancelled = true;

    for (const listener of this._listeners) {
      try {
        listener();
      } catch (_) {
        // Ignore listener errors
      }
    }
    this._listeners.length = 0;
  }

  /** Schedules cancellation after a delay. Returns Node timeout ID. */
  public cancelAfter(delayMs: number): number {
    if (this._disposed) throw new Error("Token is disposed");
    const id = globalThis.setTimeout(() => this.cancel(), delayMs) as unknown as number;
    return id;
  }

  /** Disposes all resources. */
  public dispose(): void {
    if (this._timeoutId != null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = undefined;
    }
    this._cancelled = false;
    this._listeners.length = 0;
    this._disposed = true;
  }
}

/**
 * Creates a new cancellation token source.
 */
export function createCancellationToken(): CancellationTokenSource {
  return new CancellationTokenSourceImpl();
}

// ============================================================================
// Internal Implementation
// ============================================================================

class CancellationTokenSourceImpl implements CancellationTokenSource {
  private _token: CancellationToken;

  constructor() {
    this._token = new CancellationToken();
  }

  get token(): CancellationToken {
    return this._token;
  }

  cancel(): void {
    this._token.cancel();
  }

  cancelAfter(delayMs: number): number {
    return this._token.cancelAfter(delayMs);
  }

  dispose(): void {
    this._token.dispose();
  }
}