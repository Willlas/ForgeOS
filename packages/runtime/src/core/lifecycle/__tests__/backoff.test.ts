/**
 * Backoff calculator tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { computeBackoffDelay, shouldRetry } from "../backoff.js";
import { DEFAULT_BACKOFF_POLICY, LifecycleState } from "../types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeBackoffDelay", () => {
  it("should return the initial delay for the first retry without jitter", () => {
    expect(computeBackoffDelay(1, { ...DEFAULT_BACKOFF_POLICY, jitter: false })).toBe(
      DEFAULT_BACKOFF_POLICY.initialDelayMs,
    );
  });

  it("should follow the exponential formula without jitter", () => {
    const policy = { ...DEFAULT_BACKOFF_POLICY, jitter: false };
    expect(computeBackoffDelay(2, policy)).toBe(2000);
    expect(computeBackoffDelay(3, policy)).toBe(4000);
  });

  it("should clamp to maxDelayMs", () => {
    const policy = { ...DEFAULT_BACKOFF_POLICY, jitter: false, maxDelayMs: 5000, multiplier: 2 };
    expect(computeBackoffDelay(20, policy)).toBe(5000);
  });

  it("should keep jittered output within the clamped range", () => {
    const policy = { ...DEFAULT_BACKOFF_POLICY, jitter: true };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    const delay = computeBackoffDelay(3, policy);

    expect(randomSpy).toHaveBeenCalled();
    expect(delay).toBe(2000);
  });

  it("should normalize invalid attempts and fallback on bad policy values", () => {
    const result = computeBackoffDelay(0, { ...DEFAULT_BACKOFF_POLICY, initialDelayMs: -10, maxDelayMs: -5, multiplier: -2, jitter: false });
    expect(result).toBe(DEFAULT_BACKOFF_POLICY.initialDelayMs);
  });
});

describe("shouldRetry", () => {
  it("should retry while the attempt is within the max retry budget", () => {
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(3, 3)).toBe(true);
    expect(shouldRetry(4, 3)).toBe(false);
  });
});

describe("lifecycle smoke check", () => {
  it("should keep the lifecycle enum stable", () => {
    expect(LifecycleState.Starting).toBe("starting");
    expect(LifecycleState.Running).toBe("running");
    expect(LifecycleState.Stopping).toBe("stopping");
    expect(LifecycleState.Crashed).toBe("crashed");
    expect(LifecycleState.Restarting).toBe("restarting");
  });
});
