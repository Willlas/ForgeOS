/**
 * Lifecycle State Machine tests
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { LifecycleState } from "../types.js";
import { LifecycleStateMachine } from "../lifecycle-state-machine.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LifecycleStateMachine", () => {
  describe("construction", () => {
    it("should default to Starting", () => {
      const fsm = new LifecycleStateMachine();
      expect(fsm.getState()).toBe(LifecycleState.Starting);
    });

    it("should honor the provided initial state", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Running);
      expect(fsm.getState()).toBe(LifecycleState.Running);
    });
  });

  describe("transitions", () => {
    it("should allow valid transitions in_sequence", () => {
      const fsm = new LifecycleStateMachine();
      fsm.transition(LifecycleState.Running);
      expect(fsm.getState()).toBe(LifecycleState.Running);
      fsm.transition(LifecycleState.Stopping);
      expect(fsm.getState()).toBe(LifecycleState.Stopping);
      expect(() => fsm.transition(LifecycleState.Running)).toThrow(
        "Illegal lifecycle transition: stopping → running",
      );
    });

    it("should allow the crash/restart cycle", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Running);
      fsm.transition(LifecycleState.Crashed);
      fsm.transition(LifecycleState.Restarting);
      fsm.transition(LifecycleState.Running);
      expect(fsm.getState()).toBe(LifecycleState.Running);
    });

    it("should be a no-op when transitioning to the same state", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Running);
      const listener = vi.fn();
      fsm.onStateChange(listener);

      fsm.transition(LifecycleState.Running);

      expect(listener).not.toHaveBeenCalled();
      expect(fsm.getState()).toBe(LifecycleState.Running);
    });
  });

  describe("listeners", () => {
    it("should notify listeners in registration order on a real transition", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Starting);
      const calls: Array<[LifecycleState, LifecycleState]> = [];
      const first = vi.fn((from, to) => calls.push([from, to]));
      const second = vi.fn((from, to) => calls.push([from, to]));

      fsm.onStateChange(first);
      fsm.onStateChange(second);
      fsm.transition(LifecycleState.Running);

      expect(first).toHaveBeenCalledWith(LifecycleState.Starting, LifecycleState.Running);
      expect(second).toHaveBeenCalledWith(LifecycleState.Starting, LifecycleState.Running);
      expect(calls).toHaveLength(2);
    });

    it("should unsubscribe listeners", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Starting);
      const listener = vi.fn();
      const unsubscribe = fsm.onStateChange(listener);

      unsubscribe();
      fsm.transition(LifecycleState.Running);

      expect(listener).not.toHaveBeenCalled();
    });

    it("should keep working when a listener throws", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Starting);
      const good = vi.fn();
      fsm.onStateChange(() => {
        throw new Error("boom");
      });
      fsm.onStateChange(good);

      expect(() => fsm.transition(LifecycleState.Running)).not.toThrow();
      expect(good).toHaveBeenCalledWith(LifecycleState.Starting, LifecycleState.Running);
      expect(fsm.getState()).toBe(LifecycleState.Running);
    });
  });

  describe("illegal transitions", () => {
    it("should throw when the transition is not allowed", () => {
      const fsm = new LifecycleStateMachine(LifecycleState.Stopping);
      expect(() => fsm.transition(LifecycleState.Running)).toThrow(
        "Illegal lifecycle transition: stopping → running",
      );
    });
  });
});
