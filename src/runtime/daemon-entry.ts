#!/usr/bin/env node

/**
 * Runtime Daemon Entry Point
 *
 * Standalone executable that runs the ForgeOS Runtime as a daemon process.
 * Supports --verbose, --environment, and --config CLI flags.
 * Initializes IPC server for CLI communication.
 */

import { createRuntime } from "../index.js";
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";
import { IpcServer } from "./ipc-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
// PID File
// ============================================================================

function getPidFilePath(): string {
  const customDir = process.env.FORGEOS_DAEMON_PID_DIR;
  if (customDir) return join(customDir, "forgeos-daemon.pid");
  const projectRoot = join(__dirname, "..", "..");
  return join(projectRoot, ".daemon", "forgeos-daemon.pid");
}

function writePidFile(): void {
  const pidPath = getPidFilePath();
  const pidDir = dirname(pidPath);
  try { mkdirSync(pidDir, { recursive: true }); } catch { /* exists */ }
  writeFileSync(pidPath, String(process.pid), { flag: "w" });
}

function removePidFile(): void {
  try {
    const p = getPidFilePath();
    if (existsSync(p)) unlinkSync(p);
  } catch { /* best effort */ }
}

// ============================================================================
// Health Endpoint (HTTP Server)
// ============================================================================

let healthServer: http.Server | null = null;

function startHealthServer(): void {
  const port = parseInt(process.env.FORGEOS_HEALTH_PORT || "3099", 10);

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
// Signal Handling
// ============================================================================

function shutdown(): void {
  console.log("[Daemon] Shutting down...");
  removePidFile();

  if (healthServer) {
    healthServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  // Write PID file
  writePidFile();

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

main().catch((error) => {
  console.error("[Daemon] Fatal error:", error);
  removePidFile();
  process.exit(1);
});
