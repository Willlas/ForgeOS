/**
 * Runtime Daemon Manager - Manages the Aer Runtime as a separate process.
 */

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  readPidFile,
  writePidFile,
  removePidFile,
  isPidAlive,
  CrashDetector,
  CrashRecoveryManager,
  LifecycleState,
  LifecycleStateMachine,
} from "@aer/runtime-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let daemonProcess: ReturnType<typeof spawn> | null = null;
let crashDetector: CrashDetector | null = null;
let crashRecoveryManager: CrashRecoveryManager | null = null;

function getDaemonEntryPath(): string {
  return join(__dirname, "daemon-entry.js");
}

interface DaemonOptions {
  args?: string[];
  env?: Record<string, string>;
}

function installCrashSupervisor(): void {
  const stateMachine = new LifecycleStateMachine(LifecycleState.Starting);
  const detector = new CrashDetector(stateMachine, { logger: console });
  const maxRetries = Number.parseInt(process.env.AER_MAX_RETRIES || "5", 10);
  const pollIntervalMs = Number.parseInt(process.env.AER_CRASH_POLL_MS || "2000", 10);
  const initialBackoffMs = Number.parseInt(process.env.AER_INITIAL_BACKOFF_MS || "1000", 10);

  const recovery = new CrashRecoveryManager(async () => {
    await startDaemon();
  }, {
    logger: console,
    onGiveUp: (attemptCount) => {
      console.warn(`[Supervisor] Crash recovery reached the retry cap after ${attemptCount} attempts.`);
    },
  });

  recovery.start(maxRetries, initialBackoffMs);
  detector.onCrash((pid) => {
    void recovery.recordCrash(pid);
  });
  detector.start(pollIntervalMs);

  crashDetector = detector;
  crashRecoveryManager = recovery;
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

  daemonProcess.on("exit", (code, signal) => {
    console.log(`[Supervisor] Daemon exited with code=${code ?? "null"}, signal=${signal ?? "null"}`);
    daemonProcess = null;
    if (crashDetector) {
      crashDetector.stop();
    }
    if (crashRecoveryManager && crashRecoveryManager.getAttemptCount() > 0) {
      void crashRecoveryManager.recordCrash();
    }
  });

  daemonProcess.on("error", (error) => {
    console.error("[Supervisor] Daemon spawn error:", error);
    daemonProcess = null;
    if (crashRecoveryManager) {
      void crashRecoveryManager.recordCrash();
    }
  });

  if (daemonProcess.pid) {
    writePidFile(daemonProcess.pid);
    daemonProcess.unref();
    installCrashSupervisor();
  }
}

export async function stopDaemon(): Promise<void> {
  if (crashRecoveryManager) {
    crashRecoveryManager.stop();
  }
  if (crashDetector) {
    crashDetector.stop();
  }

  const pid = readPidFile();
  if (pid > 0 && isPidAlive(pid)) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already dead */ }
  }
  if (daemonProcess) {
    try { daemonProcess.kill("SIGTERM"); } catch { /* already dead */ }
  }
  removePidFile();
  daemonProcess = null;
  crashDetector = null;
  crashRecoveryManager = null;
}

export async function restartDaemon(options?: DaemonOptions): Promise<void> {
  await stopDaemon();
  await startDaemon(options);
}

export function isRunning(): boolean {
  const pid = readPidFile();
  return isPidAlive(pid);
}
