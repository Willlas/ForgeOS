/**
 * Runtime Daemon Manager - Manages the ForgeOS Runtime as a separate process.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPidFilePath(): string {
  const customDir = process.env.FORGEOS_DAEMON_PID_DIR;
  if (customDir) return join(customDir, "forgeos-daemon.pid");
  const projectRoot = join(__dirname, "..", "..");
  return join(projectRoot, ".daemon", "forgeos-daemon.pid");
}

function writePidFile(pid: number): void {
  const pidPath = getPidFilePath();
  const pidDir = dirname(pidPath);
  try { mkdirSync(pidDir, { recursive: true }); } catch { /* exists */ }
  writeFileSync(pidPath, String(pid), { flag: "w" });
}

function readPidFile(): number {
  const p = getPidFilePath();
  if (!existsSync(p)) return -1;
  try { return parseInt(readFileSync(p, "utf-8").trim(), 10); } catch { return -1; }
}

function removePidFile(): void {
  try { const p = getPidFilePath(); if (existsSync(p)) unlinkSync(p); } catch { /* best effort */ }
}

function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

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
