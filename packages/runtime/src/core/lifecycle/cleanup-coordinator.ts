/**
 * Cleanup Coordinator — ordered, best-effort resource teardown.
 *
 * Holds a registry of named cleanup functions and runs them sequentially
 * on shutdown. Every cleanup is awaited in registration order; failures
 * are recorded but never re-thrown so that one broken cleanup cannot
 * block the remaining resources or prevent process exit.
 *
 * This replaces the scattered ad-hoc cleanup blocks in daemon-entry.ts
 * with a single, ordered, resilient sequence and provides the canonical
 * IPC-socket-unlink factory to close the orphan-resource gap.
 *
 * @module core/lifecycle/cleanup-coordinator
 */

import fs from "node:fs/promises";
import { ShutdownContext } from "./types.js";

// ============================================================================
 // Types
// ============================================================================

/** Internal entry stored in the ordered registry. */
interface ResourceEntry {
  name: string;
  cleanup: () => Promise<void> | void;
}

/** Failure record emitted when a single cleanup throws or rejects. */
export interface CleanupFailure {
  name: string;
  error: unknown;
}

// ============================================================================
 // Public Classes
// ============================================================================

/**
 * Coordinates sequential, best-effort cleanup of registered resources.
 *
 * Usage:
 *   const coord = new CleanupCoordinator();
 *   coord.registerResource("pid-file", pidManager.release.bind(pidManager));
 *   coord.registerResource("ipc-socket", createIpcSocketCleanup("/tmp/aer.sock"));
 *   // ... register more ...
 *   await coord.execute({ reason: "sigint", state, triggeredAt: new Date().toISOString() });
 *   const failures = coord.getFailures();
 */
export class CleanupCoordinator {
  private resources: ResourceEntry[] = [];
  private failures: CleanupFailure[] = [];

  /**
   * Register (or replace) a named cleanup function.
   *
   * If a resource with the same `name` already exists, its cleanup
   * function is replaced — this prevents double teardown of the same
   * underlying resource (e.g., PID file being cleaned up twice).
   *
   * @param name    - Unique identifier for this resource.
   * @param cleanup - Synchronous or asynchronous teardown function.
   */
  public registerResource(
    name: string,
    cleanup: () => Promise<void> | void,
  ): void {
    const existingIndex = this.resources.findIndex((r) => r.name === name);
    if (existingIndex >= 0) {
      this.resources[existingIndex] = { name, cleanup };
    } else {
      this.resources.push({ name, cleanup });
    }
  }

  /**
   * Execute all registered cleanups sequentially in registration order.
   *
   * This method **never throws**. If a cleanup function throws synchronously
   * or rejects asynchronously the error is recorded and the next cleanup
   * will still run.
   *
   * @param ctx - Shutdown context (reason, state, timestamp). Provided for
   *              caller observability; individual cleanups may ignore it.
   * @returns A promise that always resolves (never rejects).
   */
  public async execute(_ctx: ShutdownContext): Promise<void> {
    // Reset failures from a prior run so `execute` is re-entrant.
    this.failures = [];

    for (const entry of this.resources) {
      try {
        // Wrap in Promise to handle both sync throws and async rejections uniformly.
        await Promise.resolve(entry.cleanup());
      } catch (error: unknown) {
        this.failures.push({ name: entry.name, error });
      }
    }

    // Snapshot the resource list so re-running doesn't double-clean.
    this.resources = [];
  }

  /**
   * Return the failures recorded during the last `execute()` call.
   *
   * Returns an empty array if no cleanups failed or if `execute` has
   * not yet been called.
   */
  public getFailures(): ReadonlyArray<CleanupFailure> {
    return Object.freeze(this.failures);
  }
}

// ============================================================================
 // Factory Helpers
// ============================================================================

/**
 * Create a cleanup function that removes the IPC socket file from disk,
 * silently ignoring "file not found" (`ENOENT`) errors.
 *
 * This closes the orphan-resource gap: `IpcTransport.close()` (ipc-transport.ts)
 * destroys the server but never unlinks the `.sock` file on Unix. Registering
 * the returned function with `CleanupCoordinator.registerResource()` ensures
 * the socket path is cleaned up during shutdown.
 *
 * @param socketPath - The filesystem path of the IPC socket (e.g., `/tmp/aer-daemon.sock`).
 * @returns An async cleanup function safe for `registerResource`.
 */
export function createIpcSocketCleanup(socketPath: string): () => Promise<void> {
  return async (): Promise<void> => {
    try {
      await fs.unlink(socketPath);
    } catch (error: unknown) {
      const err = error as { code?: string };
      // Silently ignore "file not found" — the socket may already be gone.
      if (err?.code !== "ENOENT") {
        throw error;
      }
    }
  };
}
