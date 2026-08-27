/**
 * Cleanup Coordinator tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CleanupCoordinator,
  createIpcSocketCleanup,
} from "../cleanup-coordinator.js";
import { LifecycleState } from "../types.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CleanupCoordinator", () => {
  it("should execute registered cleanups in order", async () => {
    const coordinator = new CleanupCoordinator();
    const order: string[] = [];

    coordinator.registerResource("first", async () => {
      order.push("first");
    });
    coordinator.registerResource("second", async () => {
      order.push("second");
    });
    coordinator.registerResource("third", async () => {
      order.push("third");
    });

    await coordinator.execute({
      reason: "sigterm",
      state: LifecycleState.Stopping,
      triggeredAt: new Date().toISOString(),
    });

    expect(order).toEqual(["first", "second", "third"]);
  });

  it("should continue after a failing cleanup and report failures", async () => {
    const coordinator = new CleanupCoordinator();
    const order: string[] = [];

    coordinator.registerResource("first", async () => {
      order.push("first");
    });
    coordinator.registerResource("middle", async () => {
      order.push("middle");
      throw new Error("middle failed");
    });
    coordinator.registerResource("third", async () => {
      order.push("third");
    });

    await coordinator.execute({
      reason: "sigterm",
      state: LifecycleState.Stopping,
      triggeredAt: new Date().toISOString(),
    });

    expect(order).toEqual(["first", "middle", "third"]);
    expect(coordinator.getFailures()).toHaveLength(1);
    expect(coordinator.getFailures()[0].name).toBe("middle");
  });

  it("should replace an existing resource entry by name", async () => {
    const coordinator = new CleanupCoordinator();
    const calls: string[] = [];

    coordinator.registerResource("pid", async () => {
      calls.push("first");
    });
    coordinator.registerResource("pid", async () => {
      calls.push("second");
    });

    await coordinator.execute({
      reason: "explicit",
      state: LifecycleState.Running,
      triggeredAt: new Date().toISOString(),
    });

    expect(calls).toEqual(["second"]);
  });

  it("should ignore ENOENT when unlinking a missing socket", async () => {
    const socketPath = path.join(os.tmpdir(), `aer-socket-${Date.now()}.sock`);
    const cleanup = createIpcSocketCleanup(socketPath);
    await expect(cleanup()).resolves.toBeUndefined();
  });
});
