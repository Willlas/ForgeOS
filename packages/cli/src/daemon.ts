/**
 * Runtime Daemon Manager - Manages the Aer Runtime as a separate process.
 */

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Canonical PID functions — single source of truth from runtime-lib
import {
  readPidFile,
  writePidFile,
  removePidFile,
  isPidAlive,
} from "@aer/runtime-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let daemonProcess: ReturnType<typeof spawn> | null = null;

function getDaemonEntryPath(): string {
  return join(__dirname, "daemon-entry.js");
}

interface DaemonOptions {
  args?: string[];
  env?: Record<string, string>;
}

export async function startDaemon(options?: DaemonOptions): Promise<void> {
  const existingPid = readPidFile();
  if (existingPid > 0 && isPidAlive(existingPid)) return;

  removePidFile();

  const entryPath = getDaemonEntryPath();
  const args = options?.args || [];

  daemonProcess = spawn("node", [entryPath, ...args], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...(options?.env || {}) }
  });

  if (daemonProcess.pid) {
    writePidFile(daemonProcess.pid);
    daemonProcess.unref();
  }
}

export async function stopDaemon(): Promise<void> {
  const pid = readPidFile();
  if (pid > 0 && isPidAlive(pid)) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
  }
  if (daemonProcess) {
    try { daemonProcess.kill("SIGTERM"); } catch { /* already dead */ }
  }
  removePidFile();
  daemonProcess = null;
}

export async function restartDaemon(options?: DaemonOptions): Promise<void> {
  await stopDaemon();
  await startDaemon(options);
}

export function isRunning(): boolean {
  const pid = readPidFile();
  return isPidAlive(pid);
}
