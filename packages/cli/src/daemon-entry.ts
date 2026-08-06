#!/usr/bin/env node

/**
 * Runtime Daemon Entry Point
 *
 * Standalone executable that runs the Aer Runtime as a daemon process.
 * Supports --verbose, --environment, and --config CLI flags.
 * Initializes IPC server for CLI communication.
 *
 * Lifecycle integration (Design 04):
 *  - START: cleanupStale() → writePidFile() → writeSnapshot(initial state)
 *  - HEARTBEAT: periodic writeSnapshot() every AER_STATE_HEARTBEAT_MS (default 5 s)
 *  - STOP:    clear heartbeat → writeSnapshot(stopped) → removePidFile → removeSnapshot
 *  - FATAL:   best-effort writeSnapshot(error) + removePidFile (never mask original error)
 *
 * Snapshot-on-clean-shutdown policy: REMOVE the snapshot file. This means a later `aer status`
 * reports "unknown" rather than a stale "stopped", which is the correct semantic — there is no
 * daemon running and no evidence of a crash to investigate.
 */

import {
  createRuntime,
  IpcServer,
  cleanupStale,
  writePidFile,
  removePidFile,
  writeSnapshot,
  removeSnapshot,
} from "@aer/runtime-lib";
import http from "http";

// ============================================================================
// CLI Flag Parsing
// ============================================================================

const args = process.argv.slice(2);
const config: Record<string, string | undefined> = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--verbose" || args[i] === "-v") {
    config.logLevel = "debug";
  } else if (args[i] === "--environment" || args[i] === "-e") {
    config.environment = args[++i];
  } else if (args[i] === "--config") {
    config.configPath = args[++i];
  }
}

// ============================================================================
// Health Endpoint (HTTP Server)
// ============================================================================

let healthServer: http.Server | null = null;

function startHealthServer(): void {
  const port = parseInt(process.env.AER_HEALTH_PORT || "3099", 10);

  healthServer = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", pid: process.pid, uptime: process.uptime() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  healthServer.listen(port, () => {
    console.log(`[Daemon] Health server listening on port ${port}`);
  });
}

// ============================================================================
// Signal Handling & Lifecycle
// ============================================================================

/** Reference to the running Runtime instance (needed for heartbeat + final snapshot). */
let runtimeInstance: Awaited<ReturnType<typeof createRuntime>> | null = null;

/** Handle returned by setInterval for the heartbeat timer. */
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Idempotent shutdown handler. Safe to call multiple times.
 * Order: clear heartbeat → final snapshot → remove PID → remove snapshot.
 */
function shutdown(): void {
  // Guard: only execute cleanup once
  if (shutdownExecuted) return;
  shutdownExecuted = true;

  console.log("[Daemon] Shutting down...");

  // (a) Clear the heartbeat timer to prevent leaking handles / keeping process alive.
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // (b) Best-effort: write a final snapshot with the actual runtime state (or "stopped").
  try {
    if (runtimeInstance) {
      const finalSnapshot = runtimeInstance.getSnapshot();
      writeSnapshot(finalSnapshot);
    }
  } catch {
    // Best-effort — do not let a snapshot write failure mask shutdown.
  }

  // (c) Remove the PID file.
  removePidFile();

  // (d) Remove the snapshot file.
  //     Policy: on clean shutdown, remove the snapshot so a later `status`
  //     reports "unknown" rather than stale "stopped".
  removeSnapshot();

  if (healthServer) {
    healthServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

/** Tracks whether shutdown() has already run (idempotency guard). */
let shutdownExecuted = false;

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // -----------------------------------------------------------------------
  // STEP 2a: Clean up stale PID file from a prior crash, if any.
  // -----------------------------------------------------------------------
  const hadStale = cleanupStale();
  if (hadStale) {
    console.log("[Daemon] Cleaned up stale PID file from prior crash");
  }

  // -----------------------------------------------------------------------
  // STEP 2b: Write the fresh PID file.
  // -----------------------------------------------------------------------
  writePidFile(process.pid);

  // Start health server
  startHealthServer();

  console.log(`[Daemon] Started (PID: ${process.pid})`);

  if (config.logLevel) {
    console.log(`[Daemon] Log level: ${config.logLevel}`);
  }
  if (config.environment) {
    console.log(`[Daemon] Environment: ${config.environment}`);
  }
  if (config.configPath) {
    console.log(`[Daemon] Config path: ${config.configPath}`);
  }

  // Create and start the runtime
  const runtime = await createRuntime();
  await runtime.start();
  console.log("[Daemon] Runtime started successfully");

  // Store reference for lifecycle access (heartbeat, final snapshot).
  runtimeInstance = runtime;

  // -----------------------------------------------------------------------
  // STEP 2c: Write initial state snapshot.
  // -----------------------------------------------------------------------
  writeSnapshot(runtime.getSnapshot());
  console.log("[Daemon] Initial state snapshot written");

  // -----------------------------------------------------------------------
  // STEP 3: Heartbeat timer — periodic snapshot writes.
  // -----------------------------------------------------------------------
  const heartbeatMs = parseInt(process.env.AER_STATE_HEARTBEAT_MS || "5000", 10);
  heartbeatTimer = setInterval(() => {
    try {
      if (runtimeInstance) {
        writeSnapshot(runtimeInstance.getSnapshot());
      }
    } catch {
      // Best-effort — a single heartbeat failure should not crash the daemon.
    }
  }, heartbeatMs);
  // Do NOT pass unref() — we want the timer to keep the process alive alongside
  // the IPC server promise below. The timer is cleared explicitly on shutdown.

  console.log(`[Daemon] Heartbeat interval set to ${heartbeatMs}ms`);

  // Setup IPC server for CLI communication
  const ipcServer = new IpcServer();
  ipcServer.setRuntime(runtime);

  // Handlers are dispatched internally by IpcServer via setRuntime()
  // No need for explicit registerHandler calls

  // Start listening on IPC socket
  await ipcServer.listen();
  console.log("[Daemon] IPC server started");

  // Prevent shutdown from closing immediately while waiting for IPC commands
  return new Promise<void>((resolve) => {
    const gracefulShutdown = () => {
      ipcServer.close();
      resolve();
    };
    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  });
}

// ============================================================================
// Fatal Error Handler (STEP 5)
// ============================================================================

main().catch((error) => {
  console.error("[Daemon] Fatal error:", error);

  // Best-effort: write an error snapshot if we have a runtime instance.
  try {
    if (runtimeInstance) {
      const errorSnapshot = runtimeInstance.getSnapshot();
      // Override state to "error" to signal the crash.
      (errorSnapshot as unknown as Record<string, unknown>).state = "error";
      writeSnapshot(errorSnapshot);
    }
  } catch {
    // Best-effort — never let this mask the original error.
  }

  removePidFile();
  process.exit(1);
});
