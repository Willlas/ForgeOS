/**
 * Verification script for health-check module (Design 04).
 * Runs all 5 scenarios in isolated temp directories.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { checkHealth, writePidFile, removePidFile, writeSnapshot, removeSnapshot } from "@aer/runtime-lib";

const LIVE_PID = process.pid; // this script itself is alive

// Create an isolated temp base dir for all tests.
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "health-check-verify-"));
console.error(`Temp dir: ${tmpBase}`);

function scenario(name, fn) {
  try {
    const dir = path.join(tmpBase, name.replace(/\s+/g, "_"));
    fs.mkdirSync(dir, { recursive: true });
    const result = fn(dir);
    console.log(`\n=== Scenario: ${name} ===`);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`SCENARIO FAILED: ${name}`, e);
  }
}

// ── Scenario 1: No PID file, no snapshot → "unknown" ──
scenario("no_pid_no_snapshot", (dir) => {
  // Ensure dirs are empty.
  return checkHealth({ pidDir: dir, stateDir: dir });
});

// ── Scenario 2: PID file with live pid → "up" ──
scenario("live_pid", (dir) => {
  writePidFile(LIVE_PID, { pidDir: dir });
  const result = checkHealth({ pidDir: dir, stateDir: dir });
  removePidFile({ pidDir: dir });
  return result;
});

// ── Scenario 3: PID file with dead pid → "down", stalePidFile true ──
scenario("dead_pid", (dir) => {
  const deadPid = 99999; // unlikely to exist
  writePidFile(deadPid, { pidDir: dir });
  const result = checkHealth({ pidDir: dir, stateDir: dir });
  removePidFile({ pidDir: dir });
  return result;
});

// ── Scenario 4: Snapshot present, no PID file → "down" (documented policy) ──
scenario("snapshot_no_pid", (dir) => {
  writeSnapshot(
    {
      schemaVersion: 1,
      pid: 12345,
      state: "running",
      healthy: true,
      capturedAt: new Date().toISOString(),
    },
    { stateDir: dir }
  );
  const result = checkHealth({ pidDir: dir, stateDir: dir });
  removeSnapshot({ stateDir: dir });
  return result;
});

// ── Scenario 5: Corrupt PID file (garbage) → no throw, "unknown" with reason ──
scenario("corrupt_pid_file", (dir) => {
  // Write garbage directly to the PID file path.
  const pidFilePath = path.join(dir, "aer-daemon.pid");
  fs.writeFileSync(pidFilePath, "NOT-A-NUMBER-GARBAGE!!!", "utf-8");
  const result = checkHealth({ pidDir: dir, stateDir: dir });
  fs.unlinkSync(pidFilePath);
  return result;
});

// ── External import check (DoD requirement) ──
console.log("\n=== External Import Check ===");
try {
  const result = await checkHealth();
  console.log("checkHealth() returned:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("External import FAILED:", e);
}

// ── Public API surface check ──
console.log("\n=== Public API Surface ===");
try {
  const mod = await import("@aer/runtime-lib");
  const healthKeys = Object.keys(mod).filter((k) => /[Hh]ealth/.test(k));
  console.log("Health-related exports:", healthKeys);
} catch (e) {
  console.error("API surface check FAILED:", e);
}

// Cleanup
try {
  fs.rmSync(tmpBase, { recursive: true, force: true });
} catch { /* ignore */ }
