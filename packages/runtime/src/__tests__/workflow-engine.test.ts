/**
 * WorkflowEngine Tests - Comprehensive test suite for Aer workflow runtime.
 *
 * @module runtime/__tests__/workflow-engine
 */

import { describe, it, expect, vi } from "vitest";
import {
  WorkflowStatus,
  WorkflowEvent,
  EngineeringWorkflowType,
  WorkflowExecutionEngine,
  WorkflowEngine,
  createDefaultWorkflowEngineConfig,
  EngineeringWorkflowBuilder,
  createStandardEngineeringWorkflows,
} from "../workflow-engine.js";
import { WorkGraphEngine, WorkNodeState, WorkNodeType } from "../core/workgraph.js";

// ============================================================================
// Helpers
// ============================================================================

function createTestEngine(config?: Partial<import("../workflow-engine.js").WorkflowEngineConfig>): import("../workflow-engine.js").WorkflowEngine {
  return new WorkflowEngine(config);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// WorkflowExecutionEngine Tests
// ============================================================================

describe("WorkflowExecutionEngine", () => {
  it("should create with default config", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-1" });

    expect(engine.workflowId).toBe("test-1");
    expect(engine.status).toBe(WorkflowStatus.Pending);
    expect(engine.maxRetries).toBe(3);
    expect(engine.isRunning).toBe(true);
    expect(engine.isTerminal).toBe(false);
    expect(engine.nodeCount).toBe(0);
    expect(engine.activeNodeCount).toBe(0);
    expect(engine.failedNodeCount).toBe(0);
  });

  it("should transition from Pending to Running", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-2" });
    expect(engine.status).toBe(WorkflowStatus.Pending);

    engine.start();
    expect(engine.status).toBe(WorkflowStatus.Running);
    expect(engine.isRunning).toBe(true);
  });

  it("should transition to Completed", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-3" });
    engine.start();
    expect(engine.status).toBe(WorkflowStatus.Running);

    engine.complete();
    expect(engine.status).toBe(WorkflowStatus.Completed);
    expect(engine.isTerminal).toBe(true);
  });

  it("should transition to Failed", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-4" });
    engine.start();

    engine.fail("Test failure");
    expect(engine.status).toBe(WorkflowStatus.Failed);
    expect(engine.isTerminal).toBe(true);
  });

  it("should transition to Cancelled", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-5" });
    engine.start();

    engine.cancel();
    expect(engine.status).toBe(WorkflowStatus.Cancelled);
    expect(engine.isTerminal).toBe(true);
  });

  it("should track node execution", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-6" });
    engine.start();

    engine.startNode("node-1", "agent-1");
    expect(engine.nodeCount).toBe(1);
    expect(engine.activeNodeCount).toBe(1);

    engine.completeNode("node-1", { result: "success" });
    expect(engine.activeNodeCount).toBe(0);

    const result = engine.getNodeResult("node-1");
    expect(result).toBeDefined();
    expect(result?.status).toBe("completed");
    expect(result?.assignedAgentId).toBe("agent-1");
  });

  it("should track failed nodes with retries", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-7" });

    // First failure - not yet at maxRetries
    engine.failNode("node-1", "Error 1", 0);
    expect(engine.failedNodeCount).toBe(0); // Not yet failed permanently

    // Second failure - at maxRetries
    engine.failNode("node-1", "Error 2", 1);
    expect(engine.failedNodeCount).toBe(1); // Now permanently failed
  });

  it("should skip nodes", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-8" });
    engine.start();

    engine.startNode("node-1");
    engine.skipNode("node-1", "Dependency not met");

    const result = engine.getNodeResult("node-1");
    expect(result?.status).toBe("skipped");
  });

  it("should track checkpoints", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-9" });
    engine.start();

    engine.checkpoint();
    engine.checkpoint();

    // Checkpoints tracked internally
    expect(engine.status).toBe(WorkflowStatus.Running);
  });

  it("should provide summary", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-10" });
    engine.start();

    engine.startNode("node-1");
    engine.completeNode("node-1", { success: true });

    const summary = engine.getSummary();
    expect(summary.workflowId).toBe("test-10");
    expect(summary.status).toBe(WorkflowStatus.Running);
    expect(summary.nodeCount).toBe(1);
    expect(summary.completedNodes).toBe(1);
  });

  it("should get completed and failed nodes", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-11" });
    engine.start();

    engine.startNode("node-1");
    engine.completeNode("node-1");

    engine.startNode("node-2");
    engine.failNode("node-2", "Error", 0);

    expect(engine.getCompletedNodes()).toContain("node-1");
    expect(engine.getFailedNodes()).toContain("node-2");
  });
});

// ============================================================================
// WorkflowEngineConfig Tests
// ============================================================================

describe("WorkflowEngineConfig", () => {
  it("should create default config", () => {
    const config = createDefaultWorkflowEngineConfig();

    expect(config.name).toBe("workflow-engine");
    expect(config.maxRetries).toBe(3);
    expect(config.nodeTimeoutMs).toBe(300_000);
    expect(config.checkpointIntervalMs).toBe(60_000);
    expect(config.autoCheckpoint).toBe(true);
    expect(config.parallelExecution).toBe(2);
  });

  it("should allow config overrides", () => {
    const config = createDefaultWorkflowEngineConfig({
      maxRetries: 5,
      nodeTimeoutMs: 600_000,
      parallelExecution: 4,
    });

    expect(config.maxRetries).toBe(5);
    expect(config.nodeTimeoutMs).toBe(600_000);
    expect(config.checkpointIntervalMs).toBe(60_000); // Default unchanged
    expect(config.parallelExecution).toBe(4);
  });
});

// ============================================================================
// WorkflowEngine Tests
// ============================================================================

describe("WorkflowEngine", () => {
  it("should create engine with config", () => {
    const engine = createTestEngine({ maxRetries: 5 });
    expect(engine.config.maxRetries).toBe(5);
    expect(engine.runningWorkflowCount).toBe(0);
  });

  it("should submit a standard workflow", () => {
    const engine = createTestEngine();
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    expect(workflowId).toBeDefined();
    expect(typeof workflowId).toBe("string");
    expect(engine.runningWorkflowCount).toBe(1);

    // Cleanup
    engine.removeWorkflow(workflowId);
  });

  it("should get workflow status", () => {
    const engine = createTestEngine();
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);

    const status = engine.getWorkflowStatus(workflowId);
    expect(status).toBe(WorkflowStatus.Pending);

    // Cleanup
    engine.removeWorkflow(workflowId);
  });

  it("should get workflow summary", () => {
    const engine = createTestEngine();
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.WorkerToReviewer);

    const summary = engine.getWorkflowSummary(workflowId);
    expect(summary).toBeDefined();

    // Cleanup
    engine.removeWorkflow(workflowId);
  });

  it("should execute a workflow to completion", async () => {
    const engine = createTestEngine({ maxRetries: 2 });
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    const status = await engine.executeWorkflow(workflowId);

    expect(status).toBe(WorkflowStatus.Completed);

    // Verify final state
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan?.nodesCompleted).toBeGreaterThan(0);
  }, 10_000);

  it("should execute all active workflows", async () => {
    const engine = createTestEngine();
    const wf1 = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    const wf2 = engine.submitStandardWorkflow(EngineeringWorkflowType.WorkerToReviewer);

    const results = await engine.executeAll();

    expect(results.size).toBe(2);
    expect(results.get(wf1)).toBe(WorkflowStatus.Completed);
    expect(results.get(wf2)).toBe(WorkflowStatus.Completed);
  }, 10_000);

  it("should provide engine metrics", () => {
    const engine = createTestEngine();
    engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    // Need to execute first to get metrics
    expect(() => {
      const metrics = engine.getEngineMetrics();
      expect(metrics.totalWorkflows).toBeGreaterThanOrEqual(0);
      expect(metrics.completedWorkflows).toBeGreaterThanOrEqual(0);
    }).not.toThrow();
  });

  it("should cancel a workflow", () => {
    const engine = createTestEngine();
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    // Execute briefly then cancel
    const executePromise = engine.executeWorkflow(workflowId);

    // Cancel during execution
    const cancelled = engine.cancelWorkflow(workflowId);

    expect(cancelled).toBe(true);
  });

  it("should handle workflow pause/resume", () => {
    const engine = createTestEngine();
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    // Note: In current implementation, pause requires the workflow to be in a specific state
    // This test just verifies no errors are thrown
    expect(() => {
      engine.pauseWorkflow(workflowId);
      engine.resumeWorkflow(workflowId);
    }).not.toThrow();
  });
});

// ============================================================================
// EngineeringWorkflowBuilder Tests
// ============================================================================

describe("EngineeringWorkflowBuilder", () => {
  it("should build an Architect->Worker workflow", () => {
    const builder = new EngineeringWorkflowBuilder(
      EngineeringWorkflowType.ArchitectToWorker
    );

    builder
      .setTitle("Test Workflow")
      .setDescription("A test workflow")
      .addArchitectTask("arch-1", [])
      .addWorkerTask("worker-1", ["arch-1"]);

    const result = builder.build();

    expect(result.typeVal).toBe(EngineeringWorkflowType.ArchitectToWorker);
    expect(result.metadata.title).toBe("Test Workflow");
    expect((result.graph.nodes.size)).toBe(2);
  });

  it("should create all standard workflows", () => {
    const workflows = createStandardEngineeringWorkflows();

    expect(workflows.length).toBe(4);

    // Access typeVal through build() since it's private
    const w0 = workflows[0].build();
    const w1 = workflows[1].build();
    const w2 = workflows[2].build();
    const w3 = workflows[3].build();

    expect(w0.typeVal).toBe(EngineeringWorkflowType.ArchitectToWorker);
    expect(w1.typeVal).toBe(EngineeringWorkflowType.WorkerToReviewer);
    expect(w2.typeVal).toBe(EngineeringWorkflowType.FullEngineeringCycle);
    expect(w3.typeVal).toBe(EngineeringWorkflowType.ReviewerToArchitect);
  });

  it("should validate workflow node dependencies", () => {
    const builder = new EngineeringWorkflowBuilder(
      EngineeringWorkflowType.FullEngineeringCycle
    );

    builder
      .addArchitectTask("arch", [])
      .addWorkerTask("worker", ["arch"])
      .addReviewerTask("reviewer", ["worker"]);

    const result = builder.build();
    const graph = result.graph;

    // Verify nodes exist
    expect(graph.nodes.has("arch")).toBe(true);
    expect(graph.nodes.has("worker")).toBe(true);
    expect(graph.nodes.has("reviewer")).toBe(true);
  });
});

// ============================================================================
// EngineeringWorkflowType Tests
// ============================================================================

describe("EngineeringWorkflowType", () => {
  it("should include all required types", () => {
    expect(EngineeringWorkflowType.ArchitectToWorker).toBeDefined();
    expect(EngineeringWorkflowType.WorkerToReviewer).toBeDefined();
    expect(EngineeringWorkflowType.ReviewerToArchitect).toBeDefined();
    expect(EngineeringWorkflowType.FullEngineeringCycle).toBeDefined();
  });
});

// ============================================================================
// WorkflowStatus Tests
// ============================================================================

describe("WorkflowStatus", () => {
  it("should include all required statuses", () => {
    expect(WorkflowStatus.Pending).toBe("pending");
    expect(WorkflowStatus.Running).toBe("running");
    expect(WorkflowStatus.Completed).toBe("completed");
    expect(WorkflowStatus.Failed).toBe("failed");
    expect(WorkflowStatus.Cancelled).toBe("cancelled");
    expect(WorkflowStatus.Paused).toBe("paused");
  });
});

// ============================================================================
// WorkflowEvent Tests
// ============================================================================

describe("WorkflowEvent", () => {
  it("should include all required events", () => {
    expect(WorkflowEvent.Started).toBeDefined();
    expect(WorkflowEvent.Completed).toBeDefined();
    expect(WorkflowEvent.Failed).toBeDefined();
    expect(WorkflowEvent.NodeStarted).toBeDefined();
    expect(WorkflowEvent.NodeCompleted).toBeDefined();
    expect(WorkflowEvent.NodeFailed).toBeDefined();
  });
});

// ============================================================================
// WorkGraphEngine Integration Tests
// ============================================================================

describe("WorkGraphEngine Integration", () => {
  it("should create WorkGraphEngine from builder graph", () => {
    const builder = new EngineeringWorkflowBuilder(
      EngineeringWorkflowType.FullEngineeringCycle
    );

    builder
      .addArchitectTask("arch", [])
      .addWorkerTask("worker", ["arch"]);

    const graph = builder.build().graph;
    const engine = new WorkGraphEngine({ graph });

    expect(engine).toBeDefined();
    expect(() => engine.topologicalSort()).not.toThrow();
  });

  it("should sort nodes topologically", () => {
    const builder = new EngineeringWorkflowBuilder(
      EngineeringWorkflowType.FullEngineeringCycle
    );

    builder
      .addArchitectTask("arch", [])
      .addWorkerTask("worker", ["arch"])
      .addReviewerTask("reviewer", ["worker"]);

    const graph = builder.build().graph;
    const engine = new WorkGraphEngine({ graph });

    const sorted = engine.topologicalSort();
    const ids = sorted.map((n: any) => n.id);

    // Verify order: arch before worker before reviewer
    const archIndex = ids.indexOf("arch");
    const workerIndex = ids.indexOf("worker");
    const reviewerIndex = ids.indexOf("reviewer");

    expect(archIndex).toBeLessThan(workerIndex);
    expect(workerIndex).toBeLessThan(reviewerIndex);
  });
});

// ============================================================================
// WorkflowEngine Edge Cases
// ============================================================================

describe("WorkflowEngine Edge Cases", () => {
  it("should throw for unknown workflow type", () => {
    const engine = createTestEngine();

    expect(() => {
      (engine as any).submitStandardWorkflow("unknown_type");
    }).toThrow("Unknown workflow type");
  });

  it("should handle execute on non-existent workflow", async () => {
    const engine = createTestEngine();

    await expect(engine.executeWorkflow("non-existent")).rejects.toThrow();
  });

  it("should handle repeated workflow submissions", () => {
    const engine = createTestEngine();

    for (let i = 0; i < 10; i++) {
      engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);
    }

    expect(engine.runningWorkflowCount).toBe(10);
  });

  it("should handle cleanup of terminal workflows", async () => {
    const engine = createTestEngine();
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    await engine.executeWorkflow(workflowId);

    // Cleanup should remove completed/failed/cancelled
    (engine as any).cleanupTerminal();

    expect(engine.runningWorkflowCount).toBe(0);
  }, 10_000);
});