/**
 * PID file manager — consolidated, canonical module for daemon PID tracking.
 *
 * Provides atomic write, stale detection, validation, and cleanup.
 * Importable from @aer/runtime-lib without pulling in CLI code.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Reasonable upper bound for PIDs on modern Unix & Windows (2^22 = 4194304). */
const PID_CEILING = 2 ** 22;

/** Default filename stored inside the PID directory. */
const PID_FILENAME = "aer-daemon.pid";

interface PidManagerOptions {
  pidDir?: string | undefined;
}

function resolvePidDir(options?: PidManagerOptions): string {
  if (options?.pidDir) return options.pidDir;
  const customDir = process.env.AER_DAEMON_PID_DIR;
  if (customDir) return customDir;
  // Default: <repo>/.daemon  (runtime-lib lives under packages/runtime/src,
  // so go up three levels to reach the repo root).
  const projectRoot = path.join(__dirname, "..", "..", "..");
  return path.join(projectRoot, ".daemon");
}

/**
 * Compute the full PID file path.
 */
export function getPidFilePath(options?: PidManagerOptions): string {
  return path.join(resolvePidDir(options), PID_FILENAME);
}

/**
 * Write the PID atomically (temp file + rename).
 */
export function writePidFile(pid: number, options?: PidManagerOptions): void {
  const pidPath = getPidFilePath(options);
  const pidDir = path.dirname(pidPath);
  try {
    fs.mkdirSync(pidDir, { recursive: true });
  } catch {
    // Directory already exists — harmless.
  }

  const tmpPath = `${pidPath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmpPath, String(pid), { flag: "w" });
    fs.renameSync(tmpPath, pidPath);
  } catch {
    // Best-effort cleanup of leftover temp file.
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore.
    }
    throw new Error(`Failed to write PID file at ${pidPath}`);
  }
}

/**
 * Read the stored PID. Returns -1 if the file is missing or unreadable.
 */
export function readPidFile(options?: PidManagerOptions): number {
  const p = getPidFilePath(options);
  if (!fs.existsSync(p)) return -1;
  try {
    return parseInt(fs.readFileSync(p, "utf-8").trim(), 10);
  } catch {
    return -1;
  }
}

/**
 * Best-effort removal of the PID file.
 */
export function removePidFile(options?: PidManagerOptions): void {
  try {
    const p = getPidFilePath(options);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // Best effort — ignore errors.
  }
}

/**
 * Check whether a PID corresponds to an alive process (POSIX / Windows signal-0 probe).
 */
export function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine if the PID file exists but tracks a dead process.
 */
export function isStale(options?: PidManagerOptions): boolean {
  const pid = readPidFile(options);
  if (pid === -1) return false;
  return !isPidAlive(pid);
}

/**
 * Validate that a PID value is within sane bounds.
 */
export function validatePid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0 && pid < PID_CEILING;
}

/**
 * If the PID file is stale (process dead), remove it and return true.
 * Otherwise return false.
 */
export function cleanupStale(options?: PidManagerOptions): boolean {
  if (isStale(options)) {
    removePidFile(options);
    return true;
  }
  return false;
}
