/**
 * Crash Recovery Manager tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { CrashRecoveryManager } from "../crash-recovery-manager.js";
import { DEFAULT_BACKOFF_POLICY } from "../types.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CrashRecoveryManager", () => {
  it("should stop retrying after maxRetries is reached", async () => {
    vi.useFakeTimers();
    const restartFn = vi.fn(async () => undefined);
    const manager = new CrashRecoveryManager(restartFn, {
      policy: { ...DEFAULT_BACKOFF_POLICY, jitter: false },
    });

    manager.start(3);

    for (let i = 0; i < 4; i++) {
      const pending = manager.recordCrash();
      const delay = Math.min(1000 * Math.pow(2, i), 30000);
      await vi.advanceTimersByTimeAsync(delay);
      await pending;
    }

    expect(restartFn).toHaveBeenCalledTimes(3);
    expect(manager.getAttemptCount()).toBe(4);
  });

  it("should cancel a pending restart when stop() is called", async () => {
    vi.useFakeTimers();
    const restartFn = vi.fn(async () => undefined);
    const manager = new CrashRecoveryManager(restartFn, {
      policy: { ...DEFAULT_BACKOFF_POLICY, jitter: false },
    });

    manager.start(3);
    const pending = manager.recordCrash();
    manager.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(restartFn).not.toHaveBeenCalled();
    void pending;
  });

  it("should ignore re-entrant recordCrash calls while a restart is pending", async () => {
    vi.useFakeTimers();
    const restartFn = vi.fn(async () => undefined);
    const manager = new CrashRecoveryManager(restartFn, {
      policy: { ...DEFAULT_BACKOFF_POLICY, jitter: false },
    });

    manager.start(5);

    const first = manager.recordCrash();
    const second = manager.recordCrash();
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);

    expect(restartFn).toHaveBeenCalledTimes(1);
  });
});
