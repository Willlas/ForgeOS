/**
 * PID Manager — unit tests
 *
 * Covers write/read round-trip, isPidAlive, isStale, cleanupStale,
 * missing-file edge case, and validatePid bounds.
 *
 * Every test uses an isolated temp dir so tests are parallel-safe.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

import {
  getPidFilePath,
  writePidFile,
  readPidFile,
  removePidFile,
  isPidAlive,
  isStale,
  cleanupStale,
  validatePid,
} from "../pid-manager.js";

// ============================================================================
// Helpers
// ============================================================================

/** Create (and return) a unique temp dir; cleaned up in afterEach. */
let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `aer-pid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const pidOpts = () => ({ pidDir: tmpDir });

// ============================================================================
// Tests
// ============================================================================

describe("PidManager", () => {
  // ========================================================================
  // write → read round-trip
  // ========================================================================
  describe("write / read round-trip", () => {
    it("should return the same pid after write then read", () => {
      writePidFile(process.pid, pidOpts());
      expect(readPidFile(pidOpts())).toBe(process.pid);
    });

    it("should write the pid to the expected file path", () => {
      writePidFile(12345, pidOpts());
      const expected = path.join(tmpDir, "aer-daemon.pid");
      expect(fs.existsSync(expected)).toBe(true);
      expect(fs.readFileSync(expected, "utf-8").trim()).toBe("12345");
    });
  });

  // ========================================================================
  // isPidAlive
  // ========================================================================
  describe("isPidAlive", () => {
    it("should return true for the current process", () => {
      expect(isPidAlive(process.pid)).toBe(true);
    });

    it("should return false for a bogus pid", () => {
      expect(isPidAlive(99999999)).toBe(false);
    });

    it("should return false for pid <= 0", () => {
      expect(isPidAlive(0)).toBe(false);
      expect(isPidAlive(-1)).toBe(false);
    });
  });

  // ========================================================================
  // isStale / cleanupStale — dead pid
  // ========================================================================
  describe("isStale / cleanupStale with dead pid", () => {
    it("should detect stale PID file (dead pid)", () => {
      writePidFile(99999999, pidOpts());
      expect(isStale(pidOpts())).toBe(true);
    });

    it("should remove the file and return true on cleanupStale", () => {
      writePidFile(99999999, pidOpts());
      const result = cleanupStale(pidOpts());
      expect(result).toBe(true);
      expect(readPidFile(pidOpts())).toBe(-1);
    });
  });

  // ========================================================================
  // cleanupStale — live pid
  // ========================================================================
  describe("cleanupStale with live pid", () => {
    it("should return false and leave file untouched for a live pid", () => {
      writePidFile(process.pid, pidOpts());
      const result = cleanupStale(pidOpts());
      expect(result).toBe(false);
      expect(readPidFile(pidOpts())).toBe(process.pid);
    });
  });

  // ========================================================================
  // readPidFile — missing file
  // ========================================================================
  describe("readPidFile with no file", () => {
    it("should return -1 when no PID file exists", () => {
      expect(readPidFile(pidOpts())).toBe(-1);
    });
  });

  // ========================================================================
  // validatePid bounds
  // ========================================================================
  describe("validatePid", () => {
    it("should reject pid <= 0", () => {
      expect(validatePid(0)).toBe(false);
      expect(validatePid(-1)).toBe(false);
    });

    it("should reject pid >= 2^22", () => {
      expect(validatePid(2 ** 22)).toBe(false);
      expect(validatePid(9999999)).toBe(false);
    });

    it("should accept valid positive pids", () => {
      expect(validatePid(1)).toBe(true);
      expect(validatePid(1000)).toBe(true);
      expect(validatePid(process.pid)).toBe(true);
    });
  });

  // ========================================================================
  // removePidFile — idempotent
  // ========================================================================
  describe("removePidFile", () => {
    it("should remove the PID file", () => {
      writePidFile(12345, pidOpts());
      removePidFile(pidOpts());
      expect(readPidFile(pidOpts())).toBe(-1);
    });

    it("should be idempotent (no throw when called twice)", () => {
      writePidFile(12345, pidOpts());
      removePidFile(pidOpts());
      expect(() => removePidFile(pidOpts())).not.toThrow();
    });
  });
});
