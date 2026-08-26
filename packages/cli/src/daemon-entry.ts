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
  getIpcSocketPath,
  LifecycleState,
  LifecycleStateMachine,
  CleanupCoordinator,
  createIpcSocketCleanup,
  GracefulShutdownHandler,
  exitCodeFor,
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
// Signal Handling & Lifecycle (Design 05 — lifecycle modules)
// ============================================================================

/** Reference to the running Runtime instance (needed for heartbeat + final snapshot). */
let runtimeInstance: Awaited<ReturnType<typeof createRuntime>> | null = null;

/** Handle returned by setInterval for the heartbeat timer. */
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;

let lifecycleStateMachine: LifecycleStateMachine | null = null;
let shutdownHandler: GracefulShutdownHandler | null = null;

function createShutdownCoordinator(ipcServer: IpcServer): CleanupCoordinator {
  const coordinator = new CleanupCoordinator();
  const ipcSocketCleanup = createIpcSocketCleanup(getIpcSocketPath());

  coordinator.registerResource("ipc-accept", async () => {
    try {
      ipcServer.close();
    } catch {
      // best effort
    }
    await ipcSocketCleanup();
  });

  coordinator.registerResource("heartbeat", () => {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
  });

  coordinator.registerResource("runtime", async () => {
    if (runtimeInstance) {
      await runtimeInstance.stop();
    }
  });

  coordinator.registerResource("snapshot-final", async () => {
    if (runtimeInstance) {
      writeSnapshot(runtimeInstance.getSnapshot());
    }
    removeSnapshot();
  });

  coordinator.registerResource("pid", () => {
    removePidFile();
  });

  coordinator.registerResource("health-server", async () => {
    if (!healthServer) return;
    await new Promise<void>((resolve) => {
      healthServer!.close(() => resolve());
      setTimeout(() => resolve(), 1500);
    });
  });

  return coordinator;
}

function initializeShutdownHandler(ipcServer: IpcServer): void {
  lifecycleStateMachine = new LifecycleStateMachine(LifecycleState.Starting);
  const coordinator = createShutdownCoordinator(ipcServer);
  shutdownHandler = new GracefulShutdownHandler(coordinator, lifecycleStateMachine, console);
  shutdownHandler.initialize(
    parseInt(process.env.AER_SHUTDOWN_TIMEOUT_MS || "10000", 10),
  );
}

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
  _heartbeatTimer = setInterval(() => {
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

  // Create the lifecycle manager once the runtime is ready and before the
  // daemon waits for work.
  initializeShutdownHandler(ipcServer);
  if (lifecycleStateMachine) {
    lifecycleStateMachine.transition(LifecycleState.Running);
  }

  // Handlers are dispatched internally by IpcServer via setRuntime()
  // No need for explicit registerHandler calls

  // Start listening on IPC socket
  await ipcServer.listen();
  console.log("[Daemon] IPC server started");

  // Keep the daemon alive until the graceful shutdown handler exits the process.
  return new Promise<void>(() => undefined);
}

// ============================================================================
// Fatal Error Handler (STEP 5)
// ============================================================================

main().catch(async (error) => {
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

  if (shutdownHandler) {
    await shutdownHandler.trigger("fatal", error);
    return;
  }

  removePidFile();
  process.exit(exitCodeFor("fatal"));
});
