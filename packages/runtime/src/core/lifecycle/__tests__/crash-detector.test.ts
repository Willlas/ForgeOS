/**
 * Crash Detector tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { CrashDetector } from "../crash-detector.js";
import { LifecycleStateMachine } from "../lifecycle-state-machine.js";
import { LifecycleState } from "../types.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CrashDetector", () => {
  it("should fire onCrash once when a previously alive pid dies", () => {
    vi.useFakeTimers();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const onCrash = vi.fn();
    let alive = true;

    const detector = new CrashDetector(fsm, {
      readPid: () => 42,
      isAlive: () => alive,
    });

    detector.onCrash(onCrash);
    detector.start(100);

    vi.advanceTimersByTime(100);
    expect(onCrash).not.toHaveBeenCalled();

    alive = false;
    vi.advanceTimersByTime(100);

    expect(onCrash).toHaveBeenCalledTimes(1);
    expect(onCrash).toHaveBeenCalledWith(42);
    detector.stop();
  });

  it("should ignore pids that are not alive or not yet tracked", () => {
    vi.useFakeTimers();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const onCrash = vi.fn();

    const detector = new CrashDetector(fsm, {
      readPid: () => 0,
      isAlive: () => false,
    });

    detector.onCrash(onCrash);
    detector.start(100);
    vi.advanceTimersByTime(500);

    expect(onCrash).not.toHaveBeenCalled();
    detector.stop();
  });

  it("should allow a second crash after the pid is back alive", () => {
    vi.useFakeTimers();
    const fsm = new LifecycleStateMachine(LifecycleState.Running);
    const onCrash = vi.fn();
    let alive = true;

    const detector = new CrashDetector(fsm, {
      readPid: () => 42,
      isAlive: () => alive,
    });

    detector.onCrash(onCrash);
    detector.start(100);

    vi.advanceTimersByTime(100);
    alive = false;
    vi.advanceTimersByTime(100);

    alive = true;
    vi.advanceTimersByTime(100);
    alive = false;
    vi.advanceTimersByTime(100);

    expect(onCrash).toHaveBeenCalledTimes(2);
    detector.stop();
  });
});
