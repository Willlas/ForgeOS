/**
 * EventBus Tests - Comprehensive test suite for the Runtime event bus.
 *
 * Tests:
 * - Event publishing and subscription
 * - Wildcard patterns
 * - Dead letter queue
 * - Statistics tracking
 * - Event filtering
 * - Unsubscription
 * - One-time subscriptions
 * - Correlation IDs
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus, type RuntimeEvent, type EventHandler } from "../eventbus";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  // ========================================================================
  // Lifecycle Tests
  // ========================================================================

  describe("Lifecycle", () => {
    it("should start and report running state", async () => {
      await bus.start();
      expect(bus.isRunning()).toBe(true);
    });

    it("should be idempotent on start", async () => {
      await bus.start();
      const spy = vi.spyOn(console, "log");
      await bus.start();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should shutdown cleanly", async () => {
      await bus.start();
      await bus.shutdown();
      expect(bus.isRunning()).toBe(false);
    });
  });

  // ========================================================================
  // Publishing Tests
  // ========================================================================

  describe("Publishing", () => {
    it("should deliver event to exact type subscriber", async () => {
      const handler = vi.fn();
      bus.on("test.event", handler);
      await bus.start();
      bus.publish("test.event", { data: 1 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe("test.event");
      expect(handler.mock.calls[0][0].payload).toEqual({ data: 1 });
    });

    it("should return the published RuntimeEvent", () => {
      const handler = vi.fn();
      bus.on("test.event", handler);
      const event = bus.publish("test.event", { data: 1 });

      expect(event.type).toBe("test.event");
      expect(event.payload).toEqual({ data: 1 });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.source).toBe("unknown");
      expect(event.sequence).toBeGreaterThan(0);
    });

    it("should publish with custom options", () => {
      const handler = vi.fn();
      bus.on("test.event", handler);
      const event = bus.publish("test.event", { data: 1 }, {
        source: "test-source",
        correlationId: "corr-123",
        metadata: { custom: true },
        priority: 0.9,
      });

      expect(event.source).toBe("test-source");
      expect(event.correlationId).toBe("corr-123");
      expect(event.metadata).toEqual({ custom: true });
      expect(event.priority).toBe(0.9);
    });

    it("should publish asynchronously", async () => {
      const handler = vi.fn();
      bus.on("test.event", handler);
      await bus.start();

      const eventPromise = bus.publishAsync("test.event", { data: 1 });
      const event = await eventPromise;

      expect(event.type).toBe("test.event");
    });

    it("should track events by type in stats", async () => {
      await bus.start();
      bus.publish("type.a", {});
      bus.publish("type.a", {});
      bus.publish("type.b", {});

      const stats = bus.getStats();
      expect(stats.eventsPublished).toBe(3);
      expect(stats.eventsByType["type.a"]).toBe(2);
      expect(stats.eventsByType["type.b"]).toBe(1);
    });

    it("should track events by source in stats", async () => {
      await bus.start();
      bus.publish("event", {}, { source: "s1" });
      bus.publish("event", {}, { source: "s2" });
      bus.publish("event", {}, { source: "s1" });

      const stats = bus.getStats();
      expect(stats.eventsBySource["s1"]).toBe(2);
      expect(stats.eventsBySource["s2"]).toBe(1);
    });
  });

  // ========================================================================
  // Subscription Tests
  // ========================================================================

  describe("Subscription", () => {
    it("should support on/subscribe alias", async () => {
      const handler = vi.fn();
      bus.on("test.event", handler);
      await bus.start();
      bus.publish("test.event", {});
      expect(handler).toHaveBeenCalled();
    });

    it("should unsubscribe when returned function is called", async () => {
      const handler = vi.fn();
      const unsub = bus.on("test.event", handler);
      await bus.start();

      bus.publish("test.event", {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      bus.publish("test.event", {});
      expect(handler).toHaveBeenCalledTimes(1); // No second call
    });

    it("should support once (fire exactly one time)", async () => {
      const handler = vi.fn();
      bus.once("test.event", handler);
      await bus.start();

      bus.publish("test.event", {});
      bus.publish("test.event", {});
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return active subscriptions", async () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on("a", h1);
      bus.on("b", h2);
      await bus.start();

      const subs = bus.getSubscriptions();
      expect(subs.length).toBe(2);
    });

    it("should track invocation count per subscription", async () => {
      const handler = vi.fn();
      bus.on("test.event", handler);
      await bus.start();

      bus.publish("test.event", 1);
      bus.publish("test.event", 2);
      bus.publish("test.event", 3);

      const subs = bus.getSubscriptions();
      expect(subs[0].invocationCount).toBe(3);
    });
  });

  // ========================================================================
  // Wildcard Pattern Tests
  // ========================================================================

  describe("Wildcard Patterns", () => {
    it("should match wildcard pattern worker.*", async () => {
      const handler = vi.fn();
      bus.onWildcard("worker.*", handler);
      await bus.start();

      bus.publish("worker.start", {});
      bus.publish("worker.complete", {});
      bus.publish("scheduler.tick", {}); // Should not match

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should match scheduler.* pattern", async () => {
      const handler = vi.fn();
      bus.onWildcard("scheduler.*", handler);
      await bus.start();

      bus.publish("scheduler.tick", {});
      bus.publish("scheduler.assign", {});
      bus.publish("worker.start", {}); // Should not match

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should match workspace.* pattern", async () => {
      const handler = vi.fn();
      bus.onWildcard("workspace.*", handler);
      await bus.start();

      bus.publish("workspace.read", {});
      bus.publish("workspace.write", {});
      bus.publish("event.bus.tick", {}); // Should not match

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================================================
  // Dead Letter Queue Tests
  // ========================================================================

  describe("Dead Letter Queue", () => {
    it("should add failed handlers to dead letter queue", async () => {
      const failingHandler = vi.fn(() => {
        throw new Error("handler error");
      });
      bus.on("test.event", failingHandler);
      await bus.start();

      bus.publish("test.event", {});

      expect(bus.getDeadLetterQueue().length).toBeGreaterThan(0);
      expect(bus.getStats().errors).toBeGreaterThan(0);
    });

    it("should respect max dead letter size", () => {
      const maxDlq = 5;
      const smallBus = new EventBus({ maxDeadLetterSize: maxDlq });

      const failingHandler = vi.fn(() => {
        throw new Error("fail");
      });
      smallBus.on("fail.event", failingHandler);

      for (let i = 0; i < 10; i++) {
        smallBus.publish("fail.event", {});
      }

      expect(smallBus.getDeadLetterQueue().length).toBe(maxDlq);
      smallBus.shutdown();
    });

    it("should clear dead letter queue", async () => {
      const failingHandler = vi.fn(() => {
        throw new Error("fail");
      });
      bus.on("test.event", failingHandler);
      await bus.start();

      bus.publish("test.event", {});
      bus.clearDeadLetterQueue();

      expect(bus.getDeadLetterQueue().length).toBe(0);
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe("Statistics", () => {
    it("should reset statistics", async () => {
      await bus.start();
      bus.publish("event", {});
      bus.publish("event", {});

      expect(bus.getStats().eventsPublished).toBe(2);

      bus.resetStats();
      const stats = bus.getStats();
      expect(stats.eventsPublished).toBe(0);
      expect(stats.eventsDelivered).toBe(0);
      expect(stats.deadLetterCount).toBe(0);
    });

    it("should track subscription count", async () => {
      await bus.start();
      bus.on("a", vi.fn());
      bus.on("b", vi.fn());
      bus.on("c", vi.fn());

      const stats = bus.getStats();
      expect(stats.subscriptionCount).toBe(3);
    });

    it("should calculate average processing time", async () => {
      await bus.start();
      bus.on("slow.event", (_e) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _start = performance.now();
        // Small delay to ensure measurable time
      });

      bus.publish("slow.event", {});
      bus.publish("slow.event", {});

      const stats = bus.getStats();
      expect(stats.avgProcessingTimeMs).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Error Handling Tests
  // ========================================================================

  describe("Error Handling", () => {
    it("should not crash on handler errors", async () => {
      const handler = vi.fn(() => {
        throw new Error("test error");
      });
      bus.on("error.event", handler);
      await bus.start();

      expect(() => bus.publish("error.event", {})).not.toThrow();
    });

    it("should emit handler_error event on failure", async () => {
      const errorHandler = vi.fn();
      const failingHandler = vi.fn(() => {
        throw new Error("test error");
      });

      bus.on("error.event", failingHandler);
      bus.on("event_bus.handler_error", errorHandler);
      await bus.start();

      bus.publish("error.event", {});

      expect(errorHandler).toHaveBeenCalled();
    });

    it("should handle async handler errors", async () => {
      const errorHandler = vi.fn();
      const asyncFailingHandler = vi.fn(async () => {
        await Promise.resolve();
        throw new Error("async error");
      });

      bus.on("async.error", asyncFailingHandler);
      bus.on("event_bus.handler_error", errorHandler);
      await bus.start();

      bus.publish("async.error", {});

      // Wait for async handler to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Correlation ID Tests
  // ========================================================================

  describe("Correlation IDs", () => {
    it("should chain events via causationId", async () => {
      const parentEvents: RuntimeEvent[] = [];
      const childEvents: RuntimeEvent[] = [];

      bus.on("chain.event", (e) => {
        parentEvents.push(e);
        bus.publish("chain.event.child", { parentType: e.type }, {
          causationId: e.id,
          correlationId: e.correlationId,
        });
      });

      bus.on("chain.event.child", (e) => {
        childEvents.push(e);
      });

      await bus.start();
      const parent = bus.publish("chain.event", {}, { correlationId: "corr-1" });

      expect(parentEvents.length).toBe(1);
      expect(childEvents.length).toBe(1);
      expect(childEvents[0].causationId).toBe(parent.id);
    });

    it("should preserve correlationId across events", async () => {
      const handler = vi.fn();
      bus.onWildcard("first.*", handler);
      await bus.start();

      bus.publish("first.event", {}, { correlationId: "corr-123" });

      expect(handler.mock.calls.length).toBe(1);
      expect(handler.mock.calls[0][0].correlationId).toBe("corr-123");
    });
  });

  // ========================================================================
  // Filtering Tests
  // ========================================================================

  describe("Event Filtering", () => {
    it("should only deliver to matching filtered subscriptions", async () => {
      const evenHandler = vi.fn();
      bus.subscribe(
        "number.event",
        evenHandler,
        { filter: (e) => (e.payload as number) % 2 === 0 }
      );
      await bus.start();

      bus.publish("number.event", 1);
      bus.publish("number.event", 2);
      bus.publish("number.event", 3);
      bus.publish("number.event", 4);

      expect(evenHandler).toHaveBeenCalledTimes(2); // 2 and 4
    });

    it("should support function-based subscription pattern", async () => {
      const schedulerOnly = vi.fn();
      bus.subscribe(
        (e) => e.type.startsWith("scheduler"),
        schedulerOnly,
        { filter: (e) => (e.payload as { level?: string })?.level === "high" }
      );
      await bus.start();

      bus.publish("scheduler.tick", { level: "low" });
      bus.publish("scheduler.tick", { level: "high" });
      bus.publish("worker.start", { level: "high" });

      expect(schedulerOnly).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================================================
  // Off Tests
  // ========================================================================

  describe("Off (bulk unsubscribe)", () => {
    it("should deactivate all handlers for a type", async () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on("multi.event", h1);
      bus.on("multi.event", h2);
      await bus.start();

      bus.publish("multi.event", {});
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);

      bus.off("multi.event");

      bus.publish("multi.event", {});
      expect(h1).toHaveBeenCalledTimes(1); // No second call
      expect(h2).toHaveBeenCalledTimes(1); // No second call
    });
  });

  // ========================================================================
  // Integration-style Tests
  // ========================================================================

  describe("Integration Scenarios", () => {
    it("should handle a simple event chain", async () => {
      const log: string[] = [];

      bus.on("task.start", (e) => {
        log.push("task.start received");
        bus.publish("task.processing", e.payload, { source: "scheduler" });
      });

      bus.on("task.processing", (e) => {
        log.push("task.processing received");
        bus.publish("task.complete", { result: "done" }, { source: "worker" });
      });

      bus.on("task.complete", (e) => {
        log.push("task.complete received");
      });

      await bus.start();
      bus.publish("task.start", { taskId: "123" });

      expect(log).toEqual([
        "task.start received",
        "task.processing received",
        "task.complete received",
      ]);
    });

    it("should handle concurrent subscribers for same event", async () => {
      const results: number[] = [];
      bus.on("math.event", (e) => {
        results.push((e.payload as number) + 1);
      });
      bus.on("math.event", (e) => {
        results.push((e.payload as number) * 2);
      });

      await bus.start();
      bus.publish("math.event", 5);

      expect(results).toContain(6); // 5 + 1
      expect(results).toContain(10); // 5 * 2
    });
  });
});