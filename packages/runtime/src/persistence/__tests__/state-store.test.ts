/**
 * State Store — unit tests
 *
 * Covers write/read round-trip, atomic-write crash simulation (orphan .tmp file),
 * corrupt-file resilience, removeSnapshot idempotency, and getLastHeartbeat.
 *
 * Every test uses an isolated temp dir so tests are parallel-safe.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

import {
  getSnapshotPath,
  writeSnapshot,
  readSnapshot,
  removeSnapshot,
  getLastHeartbeat,
} from "../state-store.js";
import type { RuntimeStateSnapshot } from "../state-store.js";

// ============================================================================
// Helpers
// ============================================================================

let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `aer-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const stateOpts = () => ({ stateDir: tmpDir });

/** Build a minimal valid snapshot for testing. */
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

describe("StateStore", () => {
  // ========================================================================
  // write → read round-trip
  // ========================================================================
  describe("write / read round-trip", () => {
    it("should return a deep-equal object after write then read", () => {
      const snap = makeSnapshot({
        state: "running",
        healthy: true,
        uptimeSeconds: 42,
      });
      writeSnapshot(snap, stateOpts());
      const loaded = readSnapshot(stateOpts());
      expect(loaded).toEqual(snap);
    });

    it("should write to the expected file path", () => {
      writeSnapshot(makeSnapshot(), stateOpts());
      const expected = path.join(tmpDir, "aer-daemon.state.json");
      expect(fs.existsSync(expected)).toBe(true);
    });
  });

  // ========================================================================
  // Atomic-write crash simulation — orphan .tmp file
  // ========================================================================
  describe("atomic-write crash simulation", () => {
    it("should return null when only a .tmp file exists (crash before rename)", () => {
      const snapPath = getSnapshotPath(stateOpts());
      const tmpPath = `${snapPath}.tmp`;

      // Simulate a crash: write a .tmp file but never rename it.
      fs.writeFileSync(tmpPath, JSON.stringify(makeSnapshot()), { flag: "w" });
      expect(fs.existsSync(tmpPath)).toBe(true);
      expect(fs.existsSync(snapPath)).toBe(false);

      // readSnapshot should return null and NOT throw
      expect(readSnapshot(stateOpts())).toBeNull();

      // The orphan .tmp should be cleaned up by readSnapshot
      expect(fs.existsSync(tmpPath)).toBe(false);
    });
  });

  // ========================================================================
  // Corrupt final file
  // ========================================================================
  describe("corrupt final file", () => {
    it("should return null for garbage bytes in the snapshot file", () => {
      const snapPath = getSnapshotPath(stateOpts());
      fs.writeFileSync(snapPath, "THIS IS NOT JSON {{{{", { flag: "w" });

      expect(readSnapshot(stateOpts())).toBeNull();
    });

    it("should return null for valid JSON that lacks required fields", () => {
      const snapPath = getSnapshotPath(stateOpts());
      fs.writeFileSync(snapPath, JSON.stringify({ foo: "bar" }), { flag: "w" });

      expect(readSnapshot(stateOpts())).toBeNull();
    });
  });

  // ========================================================================
  // removeSnapshot — idempotent
  // ========================================================================
  describe("removeSnapshot", () => {
    it("should remove the snapshot file", () => {
      writeSnapshot(makeSnapshot(), stateOpts());
      removeSnapshot(stateOpts());
      expect(readSnapshot(stateOpts())).toBeNull();
    });

    it("should be idempotent (no throw when called twice)", () => {
      writeSnapshot(makeSnapshot(), stateOpts());
      removeSnapshot(stateOpts());
      expect(() => removeSnapshot(stateOpts())).not.toThrow();
    });
  });

  // ========================================================================
  // getLastHeartbeat
  // ========================================================================
  describe("getLastHeartbeat", () => {
    it("should return capturedAt after a write", () => {
      const ts = "2026-01-01T00:00:00.000Z";
      writeSnapshot(makeSnapshot({ capturedAt: ts }), stateOpts());
      expect(getLastHeartbeat(stateOpts())).toBe(ts);
    });

    it("should return null when no snapshot exists", () => {
      expect(getLastHeartbeat(stateOpts())).toBeNull();
    });
  });
});
