/**
 * Combined health-check module — offline PID + process-existence + persisted state.
 *
 * Returns an accurate up / down / unknown result WITHOUT requiring a running
 * daemon, an IPC connection, or an HTTP round-trip.  This is the public surface
 * that Design 04 exposes so external scripts can query runtime health directly
 * via `import { checkHealth } from "@aer/runtime-lib"`.
 *
 * Guarantees:
 *   - NEVER throws.  All I/O is wrapped in try/catch; unexpected errors return
 *     status "unknown" with a descriptive reason.
 *   - No network, no IPC.  Only local file reads + `process.kill(pid, 0)`.
 *   - Library code — does not import from @aer/cli.
 */

import {
  readPidFile,
  isPidAlive,
  validatePid,
} from "./pid-manager.js";
import { readSnapshot } from "./state-store.js";

interface HealthCheckOptions {
  pidDir?: string | undefined;
  stateDir?: string | undefined;
}

export type HealthStatus = "up" | "down" | "unknown";

export interface HealthCheckResult {
  status: HealthStatus;
  pid: number | null;
  stalePidFile: boolean;
  snapshot: ReturnType<typeof readSnapshot>;
  reason?: string;
}

/**
 * Perform an offline health check.
 *
 * Decision matrix:
 *   ┌──────────────────────────┬───────────────────────┬────────┐
 *   │ PID file                 │ Snapshot              │ Result │
 *   ├──────────────────────────┼───────────────────────┼────────┤
 *   │ missing                  │ missing               │ unknown│
 *   │ present, process alive   │ *                     │ up     │
 *   │ present, process dead    │ *                     │ down   │
 *   │ missing                  │ present               │ down   │
 *   └──────────────────────────┴───────────────────────┴────────┘
 *
 * NOTE on "snapshot but no PID file" → "down":
 *   A persisted snapshot is EVIDENCE that the daemon was running at some point.
 *   The absence of a PID file means the process is no longer tracked, so we
 *   treat this as "down" (we have proof it existed, but no living process).
 *   This keeps the load-bearing distinction: down = evidence exists, unknown =
 *   nothing on disk at all.
 */
export function checkHealth(options?: HealthCheckOptions): HealthCheckResult {
  // --- Base result used for every error path ---
  const unknownResult: HealthCheckResult = {
    status: "unknown",
    pid: null,
    stalePidFile: false,
    snapshot: null,
    reason: "Health check failed due to an unexpected error",
  };

  try {
    // 1) Read PID file (never throws — readPidFile returns -1 on failure).
    const rawPid = readPidFile(options);

    // 2) Read persisted snapshot (never throws — returns null on failure).
    const snapshot = readSnapshot(options);

    // ---- Branch A: No PID file AND no snapshot ----
    if (rawPid === -1 && !snapshot) {
      return {
        status: "unknown",
        pid: null,
        stalePidFile: false,
        snapshot: null,
        reason: "No PID file and no persisted snapshot found — daemon may never have started or was cleaned up",
      };
    }

    // ---- Branch B: PID file present ----
    if (rawPid !== -1) {
      // Validate the PID value before probing.
      if (!validatePid(rawPid)) {
        return {
          status: "unknown",
          pid: null,
          stalePidFile: false,
          snapshot: null,
          reason: `PID file contains invalid value: ${rawPid}`,
        };
      }

      const alive = isPidAlive(rawPid);

      if (alive) {
        return {
          status: "up",
          pid: rawPid,
          stalePidFile: false,
          snapshot,
          reason: `Process ${rawPid} is alive`,
        };
      }

      // Process dead → down, stale PID file.
      return {
        status: "down",
        pid: rawPid,
        stalePidFile: true,
        snapshot,
        reason: `Process ${rawPid} is not running (stale PID file)`,
      };
    }

    // ---- Branch C: Snapshot present but NO PID file ----
    // Policy: "down" — the snapshot proves the daemon was running, but without
    // a PID file we cannot track the process.  This is evidence of existence
    // without a living process → down.
    return {
      status: "down",
      pid: null,
      stalePidFile: false,
      snapshot,
      reason: "Persisted snapshot exists but no PID file found — daemon was running previously but process is not tracked",
    };

  } catch (err: unknown) {
    // Catch-all: any unexpected error returns "unknown".
    return {
      ...unknownResult,
      reason: `Health check error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
