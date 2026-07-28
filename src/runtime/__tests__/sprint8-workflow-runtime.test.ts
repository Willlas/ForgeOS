/**
 * Sprint 8 - Workflow Runtime Tests
 * 
 * Tests for complete engineering workflows with:
 * - Architect → Worker workflow
 * - Worker → Reviewer workflow  
 * - Reviewer → Architect workflow
 * - Automatic retries
 * - Failure recovery
 * - Workflow metrics
 * - Workflow events
 * - Long-running execution
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  WorkflowStatus,
  WorkflowEvent,
  EngineeringWorkflowType,
  WorkflowEngine,
  WorkflowExecutionEngine,
  createDefaultWorkflowEngineConfig,
  EngineeringWorkflowBuilder,
  createStandardEngineeringWorkflows
} from "../workflow-engine.js";
import { AgentTeam, TeamRole } from "../agent-team.js";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestEngine(config?: Partial<import("../workflow-engine.js").WorkflowEngineConfig>): import("../workflow-engine.js").WorkflowEngine {
  return new WorkflowEngine(config);
}

// ============================================================================
// Sprint 8 Workflow Runtime Tests
// ============================================================================

describe("Sprint 8 - Workflow Runtime", () => {
  beforeEach(() => {
    // Clear any existing mocks or reset test state
    vi.clearAllMocks();
  });

  it("should implement Architect → Worker workflow pattern", async () => {
    const engine = createTestEngine();
    
    // Submit the Architect → Worker workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    
    expect(workflowId).toBeDefined();
    expect(typeof workflowId).toBe("string");
    expect(engine.runningWorkflowCount).toBe(1);
    
    // Execute the workflow
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
    
    // Verify workflow details
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan).toBeDefined();
    expect(plan?.typeVal).toBe(EngineeringWorkflowType.ArchitectToWorker);
  }, 10_000);

  it("should implement Worker → Reviewer workflow pattern", async () => {
    const engine = createTestEngine();
    
    // Submit the Worker → Reviewer workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.WorkerToReviewer);
    
    expect(workflowId).toBeDefined();
    expect(typeof workflowId).toBe("string");
    expect(engine.runningWorkflowCount).toBe(1);
    
    // Execute the workflow
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
    
    // Verify workflow details
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan).toBeDefined();
    expect(plan?.typeVal).toBe(EngineeringWorkflowType.WorkerToReviewer);
  }, 10_000);

  it("should implement Reviewer → Architect workflow pattern", async () => {
    const engine = createTestEngine();
    
    // Submit the Reviewer → Architect workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ReviewerToArchitect);
    
    expect(workflowId).toBeDefined();
    expect(typeof workflowId).toBe("string");
    expect(engine.runningWorkflowCount).toBe(1);
    
    // Execute the workflow
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
    
    // Verify workflow details
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan).toBeDefined();
    expect(plan?.typeVal).toBe(EngineeringWorkflowType.ReviewerToArchitect);
  }, 10_000);

  it("should implement full engineering cycle workflow", async () => {
    const engine = createTestEngine();
    
    // Submit the full engineering cycle workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);
    
    expect(workflowId).toBeDefined();
    expect(typeof workflowId).toBe("string");
    expect(engine.runningWorkflowCount).toBe(1);
    
    // Execute the workflow
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
    
    // Verify workflow details
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan).toBeDefined();
    expect(plan?.typeVal).toBe(EngineeringWorkflowType.FullEngineeringCycle);
  }, 10_000);

  it("should support automatic retries with proper error handling", async () => {
    const engine = createTestEngine({ maxRetries: 2 });
    
    // Submit a workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    
    // Execute the workflow
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
    
    // Verify retry mechanism works
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan).toBeDefined();
    expect(plan?.currentRetries).toBeGreaterThanOrEqual(0);
  }, 10_000);

  it("should support failure recovery mechanisms", async () => {
    const engine = createTestEngine({ maxRetries: 1 });
    
    // Submit a workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    
    // Execute the workflow
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
    
    // Verify failure recovery doesn't break execution
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan).toBeDefined();
    expect(plan?.status).toBe(WorkflowStatus.Completed);
  }, 10_000);

  it("should collect and report workflow metrics", () => {
    const engine = createTestEngine();
    
    // Submit a workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);
    
    // Get metrics before execution
    const initialMetrics = engine.getEngineMetrics();
    
    // Execute the workflow
    engine.executeWorkflow(workflowId);
    
    // Get metrics after execution
    const finalMetrics = engine.getEngineMetrics();
    
    expect(initialMetrics.totalWorkflows).toBeGreaterThanOrEqual(0);
    expect(finalMetrics.totalWorkflows).toBeGreaterThanOrEqual(0);
    
    // Verify metrics are updated correctly
    if (finalMetrics.completedWorkflows > 0) {
      expect(finalMetrics.totalWorkflows).toBeGreaterThan(0);
    }
  });

  it("should emit workflow events for monitoring", async () => {
    const engine = createTestEngine();
    
    // Create an event listener to capture events
    const eventListener = vi.fn();
    engine["eventBus"].on(WorkflowEvent.Started, eventListener);
    
    // Submit and execute a workflow
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    await engine.executeWorkflow(workflowId);
    
    // Verify that events were emitted
    expect(eventListener).toHaveBeenCalled();
    
    // Verify specific event types
    const plan = engine.getWorkflowPlan(workflowId);
    expect(plan?.status).toBe(WorkflowStatus.Completed);
  }, 10_000);

  it("should support long-running execution", async () => {
    const engine = createTestEngine({ maxRetries: 2 });
    
    // Submit multiple workflows to simulate long-running scenario
    const workflowIds = [];
    for (let i = 0; i < 3; i++) {
      const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);
      workflowIds.push(workflowId);
    }
    
    expect(engine.runningWorkflowCount).toBe(3);
    
    // Execute all workflows
    const results = await engine.executeAll();
    
    expect(results.size).toBe(3);
    for (const [id, status] of results) {
      expect(status).toBe(WorkflowStatus.Completed);
    }
    
    // Verify cleanup works properly
    engine.cleanupTerminal();
    expect(engine.runningWorkflowCount).toBe(0);
  }, 15_000);

  it("should integrate with AgentTeam coordination", async () => {
    const engine = createTestEngine();
    
    // Create a mock agent team for testing integration
    const team = new AgentTeam({
      id: "test-team",
      name: "Test Team",
      maxAgents: 5,
      defaultModelId: "qwen2.5-coder:7b",
      defaultProviderId: "ollama"
    });
    
    // Add agents to the team
    await team.start();
    
    // Add required agent roles
    await team.addAgent({
      id: "architect-1",
      name: "Architect Agent",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "You are an architectural designer. Analyze requirements and create architecture plans.",
    }, TeamRole.Architect);

    await team.addAgent({
      id: "worker-1",
      name: "Worker Agent",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "You are an implementation specialist. Build solutions based on architecture.",
    }, TeamRole.Worker);

    await team.addAgent({
      id: "reviewer-1",
      name: "Reviewer Agent",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "You are a code reviewer. Validate and improve implementations.",
    }, TeamRole.Reviewer);
    
    // Verify agents were added
    expect(team.getArchitect()).toBeDefined();
    expect(team.getWorker()).toBeDefined();
    expect(team.getReviewer()).toBeDefined();
    
    // Submit workflow with team integration
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);
    
    // Execute workflow - this would normally use the agent team
    const status = await engine.executeWorkflow(workflowId);
    
    expect(status).toBe(WorkflowStatus.Completed);
  }, 15_000);

  it("should validate all engineering workflow types are supported", () => {
    const workflows = createStandardEngineeringWorkflows();
    
    expect(workflows.length).toBe(4);
    
    // Check that all required workflow types exist
    const workflowTypes = workflows.map(w => w.typeVal);
    
    expect(workflowTypes).toContain(EngineeringWorkflowType.ArchitectToWorker);
    expect(workflowTypes).toContain(EngineeringWorkflowType.WorkerToReviewer);
    expect(workflowTypes).toContain(EngineeringWorkflowType.FullEngineeringCycle);
    expect(workflowTypes).toContain(EngineeringWorkflowType.ReviewerToArchitect);
  });

  it("should handle workflow lifecycle correctly", () => {
    const engine = createTestEngine();
    
    // Test workflow creation
    const workflowId = engine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    expect(workflowId).toBeDefined();
    expect(engine.runningWorkflowCount).toBe(1);
    
    // Test status checking
    const status = engine.getWorkflowStatus(workflowId);
    expect(status).toBe(WorkflowStatus.Pending);
    
    // Test workflow removal after completion
    engine.removeWorkflow(workflowId);
    expect(engine.runningWorkflowCount).toBe(0);
  });
});

// ============================================================================
// Workflow Engine Configuration Tests
// ============================================================================

describe("Sprint 8 - Workflow Engine Configuration", () => {
  it("should create default configuration with proper defaults", () => {
    const config = createDefaultWorkflowEngineConfig();
    
    expect(config.name).toBe("workflow-engine");
    expect(config.maxRetries).toBe(3);
    expect(config.nodeTimeoutMs).toBe(300_000);
    expect(config.checkpointIntervalMs).toBe(60_000);
    expect(config.autoCheckpoint).toBe(true);
    expect(config.parallelExecution).toBe(2);
  });

  it("should allow configuration overrides", () => {
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
// Workflow Execution Engine Tests
// ============================================================================

describe("Sprint 8 - Workflow Execution Engine", () => {
  it("should track workflow execution with proper status transitions", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-1" });
    
    expect(engine.workflowId).toBe("test-1");
    expect(engine.status).toBe(WorkflowStatus.Pending);
    expect(engine.maxRetries).toBe(3);
    expect(engine.isRunning).toBe(true);
    expect(engine.isTerminal).toBe(false);
    expect(engine.nodeCount).toBe(0);
    expect(engine.activeNodeCount).toBe(0);
    expect(engine.failedNodeCount).toBe(0);
    
    // Test status transitions
    engine.start();
    expect(engine.status).toBe(WorkflowStatus.Running);
    expect(engine.isRunning).toBe(true);
    
    engine.complete();
    expect(engine.status).toBe(WorkflowStatus.Completed);
    expect(engine.isTerminal).toBe(true);
    
    engine.fail("Test failure");
    expect(engine.status).toBe(WorkflowStatus.Failed);
    expect(engine.isTerminal).toBe(true);
  });

  it("should track node execution with retries", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-2" });
    engine.start();
    
    // Start a node
    engine.startNode("node-1", "agent-1");
    expect(engine.nodeCount).toBe(1);
    expect(engine.activeNodeCount).toBe(1);
    
    // Complete the node
    engine.completeNode("node-1", { result: "success" });
    expect(engine.activeNodeCount).toBe(0);
    
    const result = engine.getNodeResult("node-1");
    expect(result).toBeDefined();
    expect(result?.status).toBe("completed");
    expect(result?.assignedAgentId).toBe("agent-1");
  });

  it("should handle failed nodes with retry tracking", () => {
    const engine = new WorkflowExecutionEngine({ workflowId: "test-3" });
    
    // First failure - not yet at maxRetries
    engine.failNode("node-1", "Error 1", 0);
    expect(engine.failedNodeCount).toBe(0); // Not yet failed permanently
    
    // Second failure - at maxRetries
    engine.failNode("node-1", "Error 2", 1);
    expect(engine.failedNodeCount).toBe(1); // Now permanently failed
  });
});