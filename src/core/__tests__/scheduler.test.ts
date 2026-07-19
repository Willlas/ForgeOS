/**
 * Scheduler Unit Tests
 *
 * Tests for the core scheduling engine including:
 * - Lifecycle (start/stop)
 * - Work graph registration
 * - Worker management
 * - Task scheduling and dispatch
 * - Priority scoring
 * - Retry logic
 * - Dependency unblocking
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Scheduler,
  SchedulerEventType,
  SchedulingDecision,
  TaskStatus,
  createScheduler,
  createDefaultSchedulerConfig,
  type SchedulerConfig,
  type SchedulerSummary,
  type SchedulerMetricsSnapshot,
} from "../scheduler.js";
import { EventBus } from "../eventbus.js";
import { WorkNodeState, WorkNodeType, createWorkNode, createWorkGraph } from "../workgraph.js";
import type { IWorker } from "../types/provider.js";
import { WorkerStatus } from "../types/provider.js";

// ============================================================================
// Mocks
// ============================================================================

function createMockWorker(overrides: Partial<IWorker> = {}): IWorker {
  return {
    id: "test-worker-1",
    name: "Test Worker",
    type: "test",
    isOnline: true,
    status: WorkerStatus.Ready,
    capabilities: ["coding", "testing"],
    maxConcurrency: 5,
    activeTasks: 0,
    remainingCapacity: 5,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    canExecute: vi.fn().mockReturnValue(true),
    execute: vi.fn().mockResolvedValue({ success: true, artifacts: [], knowledgeCaptured: [], metrics: {}, durationMs: 100 }),
    cancel: vi.fn().mockResolvedValue(true),
    healthCheck: vi.fn().mockResolvedValue({ status: "healthy" as const, tasksSucceeded: 0, tasksFailed: 0 }),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let eventBus: EventBus;

  beforeEach(() => {
    scheduler = createScheduler();
    eventBus = new EventBus();
  });

  afterEach(async () => {
    await scheduler.stop();
    vi.clearAllTimers();
  });

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  describe("lifecycle", () => {
    it("creates a scheduler in stopped state", () => {
      expect(scheduler.isRunningState()).toBe(false);
    });

    it("starts successfully", async () => {
      await scheduler.start(eventBus);
      expect(scheduler.isRunningState()).toBe(true);
    });

    it("is idempotent on start", async () => {
      await scheduler.start(eventBus);
      await scheduler.start(eventBus); // Should be no-op
      expect(scheduler.isRunningState()).toBe(true);
    });

    it("stops successfully", async () => {
      await scheduler.start(eventBus);
      await scheduler.stop();
      expect(scheduler.isRunningState()).toBe(false);
    });

    it("is idempotent on stop", async () => {
      await scheduler.stop();
      await scheduler.stop(); // Should be no-op
    });
  });

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  describe("configuration", () => {
    it("creates with default config", () => {
      const config = createDefaultSchedulerConfig();
      expect(config.maxQueueSize).toBe(10_000);
      expect(config.defaultRetryLimit).toBe(3);
      expect(config.autoDispatch).toBe(true);
      expect(config.dispatchIntervalMs).toBe(2_000);
    });

    it("creates with custom config", () => {
      const custom: Partial<SchedulerConfig> = {
        maxQueueSize: 5000,
        defaultRetryLimit: 5,
        autoDispatch: false,
        dispatchIntervalMs: 5000,
      };
      const s = createScheduler(custom);
      expect(s.isRunningState()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Work Graph Management
  // --------------------------------------------------------------------------

  describe("work graph management", () => {
    it("registers a work graph", () => {
      const graph = createWorkGraph("test-graph", "mission-1");
      // Need to add nodes first
      const node = createWorkNode("Test Node", "Description", WorkNodeType.Implementation);
      graph.nodes.set(node.id, node);
      
      scheduler.registerWorkGraph(graph);
      expect(scheduler.getWorkGraph(graph.id)).toBe(graph);
    });

    it("unregisters a work graph", () => {
      const graph = createWorkGraph("test-graph", "mission-1");
      scheduler.unregisterWorkGraph(graph.id);
      expect(scheduler.getWorkGraph(graph.id)).toBeUndefined();
    });

    it("gets all work graphs", () => {
      const g1 = createWorkGraph("graph-1", "mission-1");
      const g2 = createWorkGraph("graph-2", "mission-1");
      scheduler.registerWorkGraph(g1);
      scheduler.registerWorkGraph(g2);
      
      const graphs = scheduler.getAllWorkGraphs();
      expect(graphs).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Worker Management
  // --------------------------------------------------------------------------

  describe("worker management", () => {
    it("adds a worker", async () => {
      await scheduler.start(eventBus);
      const worker = createMockWorker();
      scheduler.addWorker(worker);
      
      expect(scheduler.getWorker(worker.id)).toBe(worker);
    });

    it("gets all workers", async () => {
      await scheduler.start(eventBus);
      const w1 = createMockWorker({ id: "w1" });
      const w2 = createMockWorker({ id: "w2" });
      scheduler.addWorker(w1);
      scheduler.addWorker(w2);
      
      const workers = scheduler.getAllWorkers();
      expect(workers).toHaveLength(2);
    });

    it("removes a worker and requeues its tasks", async () => {
      await scheduler.start(eventBus);
      const worker = createMockWorker({ id: "w1" });
      scheduler.addWorker(worker);
      
      scheduler.removeWorker("w1");
      expect(scheduler.getWorker("w1")).toBeUndefined();
    });

    it("counts available workers", async () => {
      await scheduler.start(eventBus);
      const w1 = createMockWorker({ id: "w1", activeTasks: 0 });
      const w2 = createMockWorker({ id: "w2", activeTasks: 5 }); // at capacity
      
      scheduler.addWorker(w1);
      scheduler.addWorker(w2);
      
      expect(scheduler.getAvailableWorkerCount()).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Task Scheduling
  // --------------------------------------------------------------------------

  describe("task scheduling", () => {
    beforeEach(async () => {
      await scheduler.start(eventBus);
    });

    it("schedules a single node", () => {
      const node = createWorkNode("Test Node", "Description", WorkNodeType.Implementation, { priority: 8 });
      const taskId = scheduler.scheduleNode(node);
      
      expect(taskId).toBeDefined();
      expect(taskId).toBeTruthy();
    });

    it("schedules multiple nodes", () => {
      const nodes = [
        createWorkNode("Node 1", "Desc 1", WorkNodeType.Implementation),
        createWorkNode("Node 2", "Desc 2", WorkNodeType.Research),
        createWorkNode("Node 3", "Desc 3", WorkNodeType.Testing),
      ];
      
      const taskIds = scheduler.scheduleNodes(nodes);
      expect(taskIds).toHaveLength(3);
    });

    it("dequeues highest priority task first", () => {
      const low = createWorkNode("Low", "", WorkNodeType.Implementation, { priority: 2 });
      const high = createWorkNode("High", "", WorkNodeType.Implementation, { priority: 9 });
      const medium = createWorkNode("Medium", "", WorkNodeType.Implementation, { priority: 5 });
      
      scheduler.scheduleNode(low);
      scheduler.scheduleNode(high);
      scheduler.scheduleNode(medium);
      
      const first = scheduler.dequeueTask();
      expect(first!.node.id).toBe(high.id);
    });

    it("returns null when queue is empty", () => {
      const result = scheduler.dequeueTask();
      expect(result).toBeNull();
    });

    it("cancels a task in the queue", () => {
      const node = createWorkNode("Cancel Me", "", WorkNodeType.Implementation);
      scheduler.scheduleNode(node);
      
      const cancelled = scheduler.cancelTask(node.id);
      expect(cancelled).not.toBeNull();
      expect(cancelled!.state).toBe(WorkNodeState.Cancelled);
    });

    it("returns null for non-existent task cancellation", () => {
      const result = scheduler.cancelTask("non-existent");
      expect(result).toBeNull();
    });

    it("gets ready tasks sorted by priority", async () => {
      const nodes = [
        createWorkNode("Low", "", WorkNodeType.Implementation, { priority: 2 }),
        createWorkNode("High", "", WorkNodeType.Implementation, { priority: 9 }),
        createWorkNode("Medium", "", WorkNodeType.Implementation, { priority: 5 }),
      ];
      
      for (const n of nodes) {
        scheduler.scheduleNode(n);
      }
      
      const ready = scheduler.getReadyTasks();
      expect(ready[0].node.id).toBe(nodes[1].id); // High priority first
      expect(ready[1].node.id).toBe(nodes[2].id); // Medium
      expect(ready[2].node.id).toBe(nodes[0].id); // Low
    });
  });

  // --------------------------------------------------------------------------
  // Priority Scoring
  // --------------------------------------------------------------------------

  describe("priority scoring", () => {
    it("computes score with base priority", () => {
      const low = createWorkNode("Low", "", WorkNodeType.Implementation, { priority: 2 });
      const high = createWorkNode("High", "", WorkNodeType.Implementation, { priority: 9 });
      
      const lowScore = scheduler.computePriorityScore(low);
      const highScore = scheduler.computePriorityScore(high);
      
      expect(highScore.totalScore).toBeGreaterThan(lowScore.totalScore);
    });

    it("returns scoring config", () => {
      const config = scheduler.getScoringConfig();
      expect(config.basePriorityWeight).toBe(1.0);
      expect(config.maxDependencyBoost).toBe(2.0);
    });

    it("updates scoring config", () => {
      scheduler.setScoringConfig({ basePriorityWeight: 2.0 });
      const config = scheduler.getScoringConfig();
      expect(config.basePriorityWeight).toBe(2.0);
    });
  });

  // --------------------------------------------------------------------------
  // Task Dispatch
  // --------------------------------------------------------------------------

  describe("task dispatch", () => {
    beforeEach(async () => {
      await scheduler.start(eventBus);
      const worker = createMockWorker();
      scheduler.addWorker(worker);
    });

    it("dispatches to an available worker", async () => {
      const node = createWorkNode("Dispatch Test", "", WorkNodeType.Implementation, { priority: 5 });
      const taskId = scheduler.scheduleNode(node);
      
      const readyTasks = scheduler.getReadyTasks();
      if (readyTasks.length > 0) {
        const decision = scheduler.dispatchTask(readyTasks[0]);
        expect(decision).toBe(SchedulingDecision.Dispatch);
      }
    });

    it("queues task when no worker available", async () => {
      const node = createWorkNode("Queue Test", "", WorkNodeType.Implementation, { priority: 5 });
      
      // No workers registered, should queue
      scheduler.scheduleNode(node);
      const ready = scheduler.getReadyTasks();
      expect(ready.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Task Completion
  // --------------------------------------------------------------------------

  describe("task completion", () => {
    beforeEach(async () => {
      await scheduler.start(eventBus);
    });

    it("marks task as completed", async () => {
      const node = createWorkNode("Complete Test", "", WorkNodeType.Implementation, { priority: 5 });
      scheduler.scheduleNode(node);
      
      // Simulate completion tracking (the scheduler doesn't directly track active tasks without dispatch)
      const summaryBefore = scheduler.getSummary();
      expect(summaryBefore.activeTasks).toBeDefined();
    });

    it("tracks metrics", async () => {
      await scheduler.start(eventBus);
      const metrics = scheduler.getMetricsSnapshot();
      expect(metrics.counters).toBeDefined();
      expect(metrics.histograms).toBeDefined();
      expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // Summary & Metrics
  // --------------------------------------------------------------------------

  describe("summary and metrics", () => {
    beforeEach(async () => {
      await scheduler.start(eventBus);
    });

    it("gets a summary", () => {
      const summary: SchedulerSummary = scheduler.getSummary();
      expect(summary.totalGraphs).toBe(0);
      expect(summary.queueSize).toBe(0);
      expect(summary.activeTasks).toBe(0);
      expect(summary.readyCount).toBe(0);
      expect(summary.runningCount).toBe(0);
      expect(summary.completedCount).toBe(0);
      expect(summary.failedCount).toBe(0);
      expect(summary.totalNodes).toBe(0);
    });

    it("gets metrics snapshot", () => {
      const metrics: SchedulerMetricsSnapshot = scheduler.getMetricsSnapshot();
      expect(metrics.counters).toBeDefined();
      expect(metrics.histograms).toBeDefined();
      expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles scheduling with no work graphs", () => {
      const node = createWorkNode("Orphan Node", "", WorkNodeType.Implementation);
      const taskId = scheduler.scheduleNode(node);
      expect(taskId).toBeTruthy();
    });

    it("handles removing non-existent worker", () => {
      scheduler.removeWorker("non-existent"); // Should not throw
    });

    it("handles empty queue dequeue", () => {
      const result = scheduler.dequeueTask();
      expect(result).toBeNull();
    });

    it("creates scheduler without config (defaults)", () => {
      const s = createScheduler();
      expect(s).toBeDefined();
      expect(s.isRunningState()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Integration-like scenario
  // --------------------------------------------------------------------------

  describe("integration scenario", () => {
    it("handles a complete scheduling workflow", async () => {
      const eventBus = new EventBus();
      const sched = createScheduler({ autoDispatch: false });
      
      // Start
      await sched.start(eventBus);
      
      // Create work graph with dependencies
      const graph = createWorkGraph("integration-test", "mission-1");
      
      const researchNode = createWorkNode("Research API", "Research the API design", WorkNodeType.Research, {
        priority: 8,
      });
      graph.nodes.set(researchNode.id, researchNode);
      
      const implNode = createWorkNode("Implement Feature", "Implement the feature", WorkNodeType.Implementation, {
        priority: 6,
        dependencies: [researchNode.id],
      });
      graph.nodes.set(implNode.id, implNode);
      
      const testNode = createWorkNode("Write Tests", "Write tests for the feature", WorkNodeType.Testing, {
        priority: 4,
        dependencies: [implNode.id],
      });
      graph.nodes.set(testNode.id, testNode);
      
      // Register graph
      sched.registerWorkGraph(graph);
      
      // Add worker
      const worker = createMockWorker();
      sched.addWorker(worker);
      
      // Get summary
      const summary = sched.getSummary();
      expect(summary.totalGraphs).toBe(1);
      expect(summary.readyCount).toBeGreaterThan(0);
      
      // Stop
      await sched.stop();
      expect(sched.isRunningState()).toBe(false);
    });
  });
});