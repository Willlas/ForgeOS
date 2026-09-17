/**
 * Graceful Shutdown Handler tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { CleanupCoordinator } from "../cleanup-coordinator.js";
import { GracefulShutdownHandler } from "../graceful-shutdown-handler.js";
import { LifecycleStateMachine } from "../lifecycle-state-machine.js";
import { LifecycleState } from "../types.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GracefulShutdownHandler", () => {
  it("should transition to stopping and resolve on fast shutdown", async () => {
    vi.useFakeTimers();
    const coordinator = new CleanupCoordinator();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const exitSpy = vi.fn();

    coordinator.registerResource("runtime", async () => {
      return;
    });

    const handler = new GracefulShutdownHandler(coordinator, fsm, console, exitSpy);
    handler.initialize(1000);

    await handler.trigger("sigterm");

    expect(fsm.getState()).toBe(LifecycleState.Stopping);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
    handler.dispose();
  });

  it("should be idempotent for repeated trigger calls", async () => {
    vi.useFakeTimers();
    const coordinator = new CleanupCoordinator();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const executeSpy = vi.spyOn(coordinator, "execute").mockResolvedValue(undefined);
    const exitSpy = vi.fn();
    const handler = new GracefulShutdownHandler(coordinator, fsm, console, exitSpy);

    handler.initialize(1000);
    await Promise.all([handler.trigger("sigint"), handler.trigger("sigint")]);

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    handler.dispose();
  });

  it("should force exit when shutdown exceeds the timeout", async () => {
    vi.useFakeTimers();
    const coordinator = new CleanupCoordinator();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const exitSpy = vi.fn();

    coordinator.registerResource("hung", () => new Promise(() => undefined));
    const handler = new GracefulShutdownHandler(coordinator, fsm, console, exitSpy);
    handler.initialize(1000);

    void handler.trigger("timeout");
    await vi.advanceTimersByTimeAsync(1001);

    expect(exitSpy).toHaveBeenCalled();
    handler.dispose();
  });
});
