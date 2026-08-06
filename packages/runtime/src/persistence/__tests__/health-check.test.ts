/**
 * Health Check — unit tests
 *
 * Covers all five documented branches plus the error/catch-all path:
 *   1. No PID file, no snapshot          → "unknown"
 *   2. PID file with LIVE pid           → "up"
 *   3. PID file with DEAD pid           → "down", stalePidFile === true
 *   4. Snapshot present, no PID file    → "down" (or documented 04_04 choice)
 *   5. Corrupt PID file (garbage)      → "unknown", does NOT throw
 *   6. Error / catch-all                → "unknown", does NOT throw
 *
 * All modules point at the same isolated temp dir so they share state.
 * Tests are parallel-safe (unique dirs per test).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

import { checkHealth } from "../health-check.js";
import type { HealthCheckResult } from "../health-check.js";
import { writePidFile } from "../pid-manager.js";
import { writeSnapshot, removeSnapshot } from "../state-store.js";
import type { RuntimeStateSnapshot } from "../state-store.js";

// ============================================================================
// Helpers
// ============================================================================

let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `aer-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const healthOpts = () => ({ pidDir: tmpDir, stateDir: tmpDir });

function makeSnapshot(overrides?: Partial<RuntimeStateSnapshot>): RuntimeStateSnapshot {
  return {
    schemaVersion: 1,
    pid: process.pid,
    state: "running",
    healthy: true,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("checkHealth", () => {
  // ========================================================================
  // Branch 1: No PID file, no snapshot → "unknown"
  // ========================================================================
  it("should return 'unknown' when no PID file and no snapshot exist", () => {
    const result = checkHealth(healthOpts());
    expect(result.status).toBe("unknown");
    expect(result.pid).toBeNull();
    expect(result.stalePidFile).toBe(false);
    expect(result.snapshot).toBeNull();
    expect(result.reason).toContain("No PID file and no persisted snapshot");
  });

  // ========================================================================
  // Branch 2: PID file with LIVE pid → "up"
  // ========================================================================
  it("should return 'up' when PID file contains a live process", () => {
    writePidFile(process.pid, { pidDir: tmpDir });
    const result = checkHealth(healthOpts());

    expect(result.status).toBe("up");
    expect(result.pid).toBe(process.pid);
    expect(result.stalePidFile).toBe(false);
    expect(result.reason).toContain("is alive");
  });

  // ========================================================================
  // Branch 3: PID file with DEAD pid → "down", stalePidFile === true
  // ========================================================================
  it("should return 'down' with stalePidFile when PID file contains a dead process", () => {
    writePidFile(777777, { pidDir: tmpDir });
    const result = checkHealth(healthOpts());

    expect(result.status).toBe("down");
    expect(result.pid).toBe(777777);
    expect(result.stalePidFile).toBe(true);
    expect(result.reason).toContain("not running");
  });

  // ========================================================================
  // Branch 4: Snapshot present, no PID file → "down" + snapshot included
  // ========================================================================
  it("should return 'down' with snapshot when snapshot exists but no PID file", () => {
    const snap = makeSnapshot({ state: "stopped" });
    writeSnapshot(snap, { stateDir: tmpDir });

    const result = checkHealth(healthOpts());

    expect(result.status).toBe("down");
    expect(result.pid).toBeNull();
    expect(result.stalePidFile).toBe(false);
    expect(result.snapshot).toEqual(snap);
    expect(result.reason).toContain("Persisted snapshot exists but no PID file");
  });

  // ========================================================================
  // Branch 5: Corrupt PID file (garbage) → "unknown", never throws
  // ========================================================================
  it("should return 'unknown' and not throw when PID file contains garbage", () => {
    const pidPath = path.join(tmpDir, "aer-daemon.pid");
    fs.writeFileSync(pidPath, "NOT_A_NUMBER", { flag: "w" });

    expect(() => checkHealth(healthOpts())).not.toThrow();

    const result = checkHealth(healthOpts());
    expect(result.status).toBe("unknown");
  });

  // ========================================================================
  // Branch 6: Invalid PID (out of bounds) → "unknown", never throws
  // ========================================================================
  it("should return 'unknown' for an out-of-range PID value", () => {
    const pidPath = path.join(tmpDir, "aer-daemon.pid");
    // Write a valid integer but outside validatePid bounds (>= 2^22)
    fs.writeFileSync(pidPath, String(2 ** 22), { flag: "w" });

    const result = checkHealth(healthOpts());
    expect(result.status).toBe("unknown");
    expect(result.pid).toBeNull();
    expect(result.reason).toContain("invalid value");
  });

  // ========================================================================
  // Snapshot + dead PID → snapshot is included in result
  // ========================================================================
  it("should include snapshot in result when PID is dead and snapshot exists", () => {
    const snap = makeSnapshot({ state: "running" });
    writePidFile(777777, { pidDir: tmpDir });
    writeSnapshot(snap, { stateDir: tmpDir });

    const result = checkHealth(healthOpts());

    expect(result.status).toBe("down");
    expect(result.stalePidFile).toBe(true);
    expect(result.snapshot).toEqual(snap);
  });

  // ========================================================================
  // Never-throws umbrella test
  // ========================================================================
  describe("never throws", () => {
    it("should not throw when PID file is missing and snapshot is missing", () => {
      expect(() => checkHealth(healthOpts())).not.toThrow();
    });

    it("should not throw when PID file contains garbage", () => {
      const pidPath = path.join(tmpDir, "aer-daemon.pid");
      fs.writeFileSync(pidPath, "GARBAGE", { flag: "w" });
      expect(() => checkHealth(healthOpts())).not.toThrow();
    });

    it("should not throw when snapshot file is corrupt", () => {
      writePidFile(777777, { pidDir: tmpDir });
      const snapPath = path.join(tmpDir, "aer-daemon.state.json");
      fs.writeFileSync(snapPath, "CORRUPT {{{", { flag: "w" });
      expect(() => checkHealth(healthOpts())).not.toThrow();
    });

    it("should not throw when both PID and snapshot are corrupt", () => {
      const pidPath = path.join(tmpDir, "aer-daemon.pid");
      fs.writeFileSync(pidPath, "!!!", { flag: "w" });
      const snapPath = path.join(tmpDir, "aer-daemon.state.json");
      fs.writeFileSync(snapPath, "!!!", { flag: "w" });
      expect(() => checkHealth(healthOpts())).not.toThrow();
    });
  });
});
