/**
 * Integration tests for multi-agent runtime coordination.
 * Demonstrates how Architect, Worker, and Reviewer agents coordinate together.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AgentTeam, TeamRole, TaskStatus } from "../agent-team.js";
import { createDefaultTeamConfig } from "../agent-team.js";

describe("Multi-Agent Runtime Coordination", () => {
  let team: AgentTeam;

  beforeEach(() => {
    const config = createDefaultTeamConfig({ 
      id: "test-coordination-team", 
      name: "Test Coordination Team" 
    });
    team = new AgentTeam(config);
  });

  it("should demonstrate full engineering workflow with Architect, Worker, and Reviewer", async () => {
    await team.start();
    
    // Add the three required agent roles
    const architect = await team.addAgent({
      id: "architect-1",
      name: "Architect Agent",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "You are an architectural designer. Analyze requirements and create architecture plans.",
    }, TeamRole.Architect);

    const worker = await team.addAgent({
      id: "worker-1",
      name: "Worker Agent",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "You are an implementation specialist. Build solutions based on architecture.",
    }, TeamRole.Worker);

    const reviewer = await team.addAgent({
      id: "reviewer-1",
      name: "Reviewer Agent",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "You are a code reviewer. Validate and improve implementations.",
    }, TeamRole.Reviewer);

    // Verify all agents were added
    expect(architect).toBeDefined();
    expect(worker).toBeDefined();
    expect(reviewer).toBeDefined();

    // Get the agents by role
    const retrievedArchitect = team.getArchitect();
    const retrievedWorker = team.getWorker();
    const retrievedReviewer = team.getReviewer();

    expect(retrievedArchitect).toBeDefined();
    expect(retrievedWorker).toBeDefined();
    expect(retrievedReviewer).toBeDefined();

    // Test that we can get all agents
    const allAgents = team.getAllAgents();
    expect(allAgents.size).toBeGreaterThanOrEqual(3);
  });

  it("should coordinate agent roles in task execution flow", async () => {
    await team.start();
    
    // Add agents
    await team.addAgent({
      id: "arch-1",
      name: "Architect",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Architect role",
    }, TeamRole.Architect);

    await team.addAgent({
      id: "worker-1",
      name: "Worker",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Worker role",
    }, TeamRole.Worker);

    await team.addAgent({
      id: "reviewer-1",
      name: "Reviewer",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Reviewer role",
    }, TeamRole.Reviewer);

    // Decompose a task
    const tasks = await team.decomposeTask("Build a REST API with CRUD operations");
    
    expect(tasks.length).toBeGreaterThan(0);
    
    // Verify we can get the agents by their roles
    const architect = team.getArchitect();
    const worker = team.getWorker();
    const reviewer = team.getReviewer();
    
    expect(architect).toBeDefined();
    expect(worker).toBeDefined();
    expect(reviewer).toBeDefined();
  });

  it("should maintain shared context across agent interactions", async () => {
    await team.start();
    
    // Add agents
    await team.addAgent({
      id: "shared-arch",
      name: "Shared Architect",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Architect role with shared context",
    }, TeamRole.Architect);

    await team.addAgent({
      id: "shared-worker",
      name: "Shared Worker",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Worker role with shared context",
    }, TeamRole.Worker);

    // Set some initial context
    team.setContext("project_scope", "Build a full-stack application");
    team.setContext("tech_stack", "React + Node.js + MongoDB");
    
    // Verify context is accessible
    const scope = team.getContext<string>("project_scope");
    const stack = team.getContext<string>("tech_stack");
    
    expect(scope).toBe("Build a full-stack application");
    expect(stack).toBe("React + Node.js + MongoDB");
    
    // Decompose task and verify context is available for task execution
    const tasks = await team.decomposeTask("Implement user authentication module");
    expect(tasks.length).toBeGreaterThan(0);
  });
});