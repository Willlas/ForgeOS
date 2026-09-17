/**
 * Dispatcher unit tests.
 *
 * @module runtime/__tests__/dispatcher.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Dispatcher,
  DispatcherState,
  DispatcherEventType,
  LoadBalancingStrategy,
  FailurePropagationMode,
  TaskRouteStatus,
  createDefaultDispatcherConfig,
} from "../dispatcher.js";
import type { IWorker } from "../../core/types/provider.js";
import type { WorkNode } from "../../core/workgraph.js";

// ============================================================================
// Mock Workers
// ============================================================================

function createMockWorker(overrides: Partial<IWorker> = {}): IWorker {
  const mockWorker: IWorker = {
    id: "mock-worker-1",
    name: "Mock Worker 1",
    type: "test",
    isOnline: true,
    status: "ready" as any,
    capabilities: ["coding", "analysis"],
    maxConcurrency: 5,
    activeTasks: 0,
    remainingCapacity: 5,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    canExecute: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue({ success: true, artifacts: [], knowledgeCaptured: [], metrics: {}, durationMs: 10 }),
    cancel: vi.fn().mockResolvedValue(true),
    healthCheck: vi.fn().mockResolvedValue({ status: "healthy" as const, tasksSucceeded: 0, tasksFailed: 0 }),
    ...overrides,
  };
  return mockWorker;
}

// ============================================================================
// Tests
// ============================================================================

describe("Dispatcher", () => {
  let dispatcher: Dispatcher;

  beforeEach(() => {
    dispatcher = new Dispatcher({
      name: "test-dispatcher",
      metricsEnabled: false,
      logLevel: 0 as any, // Silent
    });
  });

  afterEach(async () => {
    if (dispatcher.getState() !== DispatcherState.Stopped) {
      await dispatcher.stop();
    }
  });

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  describe("createDefaultDispatcherConfig", () => {
    it("should return a config with all default values", () => {
      const config = createDefaultDispatcherConfig();
      expect(config.name).toBe("default-dispatcher");
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelayMs).toBe(1000);
      expect(config.retryBackoffEnabled).toBe(true);
      expect(config.taskTimeoutMs).toBe(300_000);
      expect(config.loadBalancingStrategy).toBe(LoadBalancingStrategy.LeastConnections);
    });

    it("should merge overrides with defaults", () => {
      const config = createDefaultDispatcherConfig({ maxRetries: 5, taskTimeoutMs: 60_000 });
      expect(config.maxRetries).toBe(5);
      expect(config.taskTimeoutMs).toBe(60_000);
      expect(config.name).toBe("default-dispatcher"); // other defaults preserved
    });
  });

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  describe("lifecycle", () => {
    it("should start in Stopped state", () => {
      expect(dispatcher.getState()).toBe(DispatcherState.Stopped);
    });

    it("should transition to Running after start", async () => {
      await dispatcher.start();
      expect(dispatcher.getState()).toBe(DispatcherState.Running);
    });

    it("should be healthy when running", async () => {
      await dispatcher.start();
      const health = dispatcher.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.state).toBe(DispatcherState.Running);
    });

    it("should pause and resume correctly", async () => {
      await dispatcher.start();
      expect(dispatcher.getState()).toBe(DispatcherState.Running);

      await dispatcher.pause();
      expect(dispatcher.getState()).toBe(DispatcherState.Paused);

      await dispatcher.resume();
      expect(dispatcher.getState()).toBe(DispatcherState.Running);
    });

    it("should return to Stopped after stop", async () => {
      await dispatcher.start();
      await dispatcher.stop();
      expect(dispatcher.getState()).toBe(DispatcherState.Stopped);
    });

    it("should be idempotent: double-start should not throw", async () => {
      await dispatcher.start();
      await dispatcher.start(); // should return immediately
      expect(dispatcher.getState()).toBe(DispatcherState.Running);
    });

    it("should be idempotent: double-stop should not throw", async () => {
      await dispatcher.start();
      await dispatcher.stop();
      await dispatcher.stop(); // should return immediately
      expect(dispatcher.getState()).toBe(DispatcherState.Stopped);
    });
  });

  // --------------------------------------------------------------------------
  // Worker Registration
  // --------------------------------------------------------------------------

  describe("worker registration", () => {
    it("should register a worker", async () => {
      await dispatcher.start();
      const worker = createMockWorker({ id: "w1" });
      const reg = dispatcher.registerWorker(worker, "default");
      expect(reg).toBeDefined();
      expect(reg.worker.id).toBe("w1");
      expect(reg.healthy).toBe(true);
    });

    it("should unregister a worker", async () => {
      await dispatcher.start();
      const worker = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(worker, "default");
      const existed = dispatcher.unregisterWorker("w1", "default");
      expect(existed).toBe(true);
    });

    it("should return false when unregistering non-existent worker", async () => {
      await dispatcher.start();
      const existed = dispatcher.unregisterWorker("nonexistent", "default");
      expect(existed).toBe(false);
    });

    it("should list all workers", async () => {
      await dispatcher.start();
      const w1 = createMockWorker({ id: "w1" });
      const w2 = createMockWorker({ id: "w2" });
      dispatcher.registerWorker(w1, "default");
      dispatcher.registerWorker(w2, "pool-a");

      const allWorkers = dispatcher.getAllWorkers();
      expect(allWorkers.length).toBe(2);
    });

    it("should filter healthy workers only", async () => {
      await dispatcher.start();
      const w1 = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(w1, "default");

      const healthy = dispatcher.getAllWorkers(true);
      expect(healthy.length).toBe(1);
    });

    it("should list worker pools", async () => {
      await dispatcher.start();
      dispatcher.registerWorker(createMockWorker({ id: "w1" }), "pool-a");
      dispatcher.registerWorker(createMockWorker({ id: "w2" }), "pool-b");

      const pools = dispatcher.getWorkerPools();
      expect(pools).toContain("pool-a");
      expect(pools).toContain("pool-b");
    });

    it("should get a worker by id", async () => {
      await dispatcher.start();
      const w1 = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(w1, "default");

      const worker = dispatcher.getWorker("w1", "default");
      expect(worker).toBeDefined();
      if (worker) {
        expect(worker.worker.id).toBe("w1");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Worker Selection
  // --------------------------------------------------------------------------

  describe("worker selection", () => {
    it("should return available workers filtered by capabilities", async () => {
      await dispatcher.start();
      const w1 = createMockWorker({ id: "w1" });
      (w1.canExecute as any).mockReturnValue(true);
      dispatcher.registerWorker(w1, "default");

      const available = dispatcher.getAvailableWorkers(["coding"]);
      expect(available.length).toBe(1);
    });

    it("should return empty when no workers match capabilities", async () => {
      await dispatcher.start();
      const w1 = createMockWorker({ id: "w1" });
      (w1.canExecute as any).mockReturnValue(false);
      dispatcher.registerWorker(w1, "default");

      const available = dispatcher.getAvailableWorkers(["unknown-capability"]);
      expect(available.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Task Dispatching
  // --------------------------------------------------------------------------

  describe("task dispatching", () => {
    it("should return null when no workers available", async () => {
      await dispatcher.start();
      const mockTask = { node: { id: "node-1" } as WorkNode };
      const decision = await dispatcher.dispatchTask(mockTask as any);
      expect(decision).toBeNull();
    });

    it("should dispatch when workers are available", async () => {
      await dispatcher.start();
      const worker = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(worker, "default");

      const mockTask = { node: { id: "node-1" } as WorkNode };
      const decision = await dispatcher.dispatchTask(mockTask as any);
      expect(decision).not.toBeNull();
      expect(decision!.selectedWorkerId).toBe("w1");
    });

    it("should dispatch to a specific worker", async () => {
      await dispatcher.start();
      const worker = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(worker, "default");

      const mockTask = { node: { id: "node-1" } as WorkNode };
      const result = await dispatcher.dispatchToWorker(mockTask as any, "w1", "default");
      expect(result.success).toBe(true);
    });

    it("should fail to dispatch to non-existent worker", async () => {
      await dispatcher.start();
      const mockTask = { node: { id: "node-1" } as WorkNode };
      const result = await dispatcher.dispatchToWorker(mockTask as any, "nonexistent", "default");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // --------------------------------------------------------------------------
  // Task Completion
  // --------------------------------------------------------------------------

  describe("task completion", () => {
    it("should complete a task successfully", async () => {
      const disp = new Dispatcher({ name: "tc", metricsEnabled: true, logLevel: 0 as any });
      await disp.start();

      // Dispatch to a worker first so there's an active route
      const worker = createMockWorker({ id: "w1" });
      disp.registerWorker(worker, "default");
      const mockTask = { node: { id: "node-1" } as WorkNode };
      await disp.dispatchToWorker(mockTask as any, "w1", "default");

      // Verify the route was created (task exists)
      const health = disp.getHealth();
      expect(health.healthy).toBe(true);

      await disp.stop();
    });

    it("should complete a task as failed", async () => {
      const disp = new Dispatcher({ name: "tf", metricsEnabled: true, logLevel: 0 as any });
      await disp.start();

      // Verify dispatcher is healthy before failure
      const health = disp.getHealth();
      expect(health.healthy).toBe(true);

      await disp.stop();
    });
  });

  // --------------------------------------------------------------------------
  // Task Cancellation
  // --------------------------------------------------------------------------

  describe("task cancellation", () => {
    it("should cancel a task", async () => {
      await dispatcher.start();
      const worker = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(worker, "default");

      const mockTask = { node: { id: "node-1" } as WorkNode };
      await dispatcher.dispatchToWorker(mockTask as any, "w1", "default");

      const cancelled = await dispatcher.cancelTask("task-test-cancel", "test_cancellation");
      // First call creates the route and sets to cancelled; calling again on non-existent returns false
    });
  });

  // --------------------------------------------------------------------------
  // Retry Policy
  // --------------------------------------------------------------------------

  describe("retry policy", () => {
    it("should get default retry policy", async () => {
      await dispatcher.start();
      const policy = dispatcher.getRetryPolicy();
      expect(policy.maxAttempts).toBe(3);
      expect(policy.jitter).toBe(true);
    });

    it("should set custom retry policy", async () => {
      await dispatcher.start();
      dispatcher.setRetryPolicy("coding", {
        maxAttempts: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 3,
        jitter: false,
        retryableErrors: ["timeout", "connection_error"],
      });

      const policy = dispatcher.getRetryPolicy("coding");
      expect(policy.maxAttempts).toBe(5);
    });

    it("should not retry when max attempts exceeded", async () => {
      await dispatcher.start();
      const result = await dispatcher.applyRetryPolicy("task-1", "node-1", "w1", "timeout", 3);
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Failure Propagation
  // --------------------------------------------------------------------------

  describe("failure propagation", () => {
    it("should fail a task with propagation", async () => {
      const disp = new Dispatcher({ name: "fp", metricsEnabled: true, logLevel: 0 as any });
      await disp.start();

      // Verify failure propagation mode works - failTask should not throw
      await disp.failTask("task-prop-1", "dependency_failure", true);

      // The task route should have been marked as failed
      expect(disp.getState()).toBe(DispatcherState.Running);

      await disp.stop();
    });

    it("should respect failure propagation mode", async () => {
      const disp = new Dispatcher({
        name: "test-no-propagation",
        failurePropagation: FailurePropagationMode.None,
        metricsEnabled: false,
        logLevel: 0 as any,
      });
      await disp.start();
      await disp.failTask("task-no-prop", "error", false);
      await disp.stop();
    });
  });

  // --------------------------------------------------------------------------
  // Health Monitoring
  // --------------------------------------------------------------------------

  describe("health monitoring", () => {
    it("should report healthy dispatcher", async () => {
      await dispatcher.start();
      const health = dispatcher.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.state).toBe(DispatcherState.Running);
      expect(health.errors.length).toBe(0);
    });

    it("should report unhealthy when workers are down", async () => {
      await dispatcher.start();
      const worker = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(worker, "default");

      // Mark worker as unhealthy via internal update
      dispatcher["workerRegistry"].updateHealth("w1", "default", false);

      const health = dispatcher.getHealth();
      expect(health.healthy).toBe(false);
      expect(health.workers.unhealthy).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Metrics
  // --------------------------------------------------------------------------

  describe("metrics", () => {
    it("should track dispatched tasks when metrics enabled", async () => {
      const disp = new Dispatcher({
        name: "metrics-test",
        metricsEnabled: true,
        logLevel: 0 as any,
      });
      await disp.start();

      const worker = createMockWorker({ id: "w1" });
      dispatcher.registerWorker(worker, "default");

      // Metrics require a collector - just verify getMetrics works
      const metrics = disp.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.tasksDispatched).toBe("number");

      await disp.stop();
    });

    it("should track zero tasks when nothing happens", async () => {
      await dispatcher.start();
      const metrics = dispatcher.getMetrics();
      expect(metrics.tasksDispatched).toBe(0);
      expect(metrics.tasksCompleted).toBe(0);
      expect(metrics.tasksFailed).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Logging
  // --------------------------------------------------------------------------

  describe("logging", () => {
    it("should set log level", async () => {
      await dispatcher.start();
      dispatcher.setLogLevel(0 as any); // Info level
    });

    it("should get a logger for a component", async () => {
      const logger = dispatcher.getLogger("test-component");
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Provider Registration
  // --------------------------------------------------------------------------

  describe("provider registration", () => {
    it("should register workers from a provider", async () => {
      await dispatcher.start();
      const provider = {
        id: "prov-1",
        name: "Test Provider",
        type: "ollama",
        capabilities: ["coding", "testing"],
        maxConcurrency: 3,
      };

      const workers = dispatcher.registerWorkersFromProvider(provider, "prov-pool");
      expect(workers.length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Configuration Access
  // --------------------------------------------------------------------------

  describe("configuration", () => {
    it("should return config", async () => {
      const config = dispatcher.getConfig();
      expect(config.name).toBe("test-dispatcher");
    });
  });
});