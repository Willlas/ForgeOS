/**
 * Watchdog Monitor tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { LifecycleStateMachine } from "../lifecycle-state-machine.js";
import { LifecycleState } from "../types.js";
import { WatchdogMonitor } from "../watchdog-monitor.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("WatchdogMonitor", () => {
  it("should not fire while the probe remains healthy", async () => {
    vi.useFakeTimers();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const onUnresponsive = vi.fn();
    const monitor = new WatchdogMonitor(fsm, async () => true, console);

    monitor.onUnresponsive(onUnresponsive);
    monitor.start(100, 50, 2);

    await vi.advanceTimersByTimeAsync(500);

    expect(onUnresponsive).not.toHaveBeenCalled();
    monitor.stop();
  });

  it("should fire after the configured number of failed probes", async () => {
    vi.useFakeTimers();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const onUnresponsive = vi.fn();
    let calls = 0;
    const monitor = new WatchdogMonitor(
      fsm,
      async () => {
        calls += 1;
        return calls < 3;
      },
      console,
    );

    monitor.onUnresponsive(onUnresponsive);
    monitor.start(100, 50, 2);

    await vi.advanceTimersByTimeAsync(500);

    expect(onUnresponsive).toHaveBeenCalledTimes(1);
    monitor.stop();
  });

  it("should skip polling while the state machine is stopping", async () => {
    vi.useFakeTimers();
    const fsm = new LifecycleStateMachine(LifecycleState.Stopping);
    const probe = vi.fn(async () => false);
    const monitor = new WatchdogMonitor(fsm, probe, console);

    monitor.start(100, 25, 1);
    await vi.advanceTimersByTimeAsync(500);

    expect(probe).not.toHaveBeenCalled();
    monitor.stop();
  });
});
