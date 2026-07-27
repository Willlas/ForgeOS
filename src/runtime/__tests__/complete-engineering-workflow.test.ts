/**
 * Complete Engineering Workflow Test
 * Demonstrates a full Architect -> Worker -> Reviewer workflow
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AgentTeam, TeamRole } from "../agent-team.js";
import { createDefaultTeamConfig } from "../agent-team.js";
import { WorkflowEngine, EngineeringWorkflowType } from "../workflow-engine.js";

describe("Complete Engineering Workflow", () => {
  let team: AgentTeam;
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    const config = createDefaultTeamConfig({ 
      id: "complete-workflow-team", 
      name: "Complete Workflow Team" 
    });
    team = new AgentTeam(config);
    workflowEngine = new WorkflowEngine();
  });

  it("should demonstrate full engineering cycle with all agent roles", async () => {
    await team.start();
    
    // Add all required agent roles
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
  });

  it("should execute standard engineering workflows", async () => {
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

    // Test submitting standard workflows
    const workflow1 = workflowEngine.submitStandardWorkflow(EngineeringWorkflowType.ArchitectToWorker);
    const workflow2 = workflowEngine.submitStandardWorkflow(EngineeringWorkflowType.WorkerToReviewer);
    const workflow3 = workflowEngine.submitStandardWorkflow(EngineeringWorkflowType.FullEngineeringCycle);

    expect(workflow1).toMatch(/^wf-/);
    expect(workflow2).toMatch(/^wf-/);
    expect(workflow3).toMatch(/^wf-/);
  });

  it("should maintain context throughout the engineering process", async () => {
    await team.start();
    
    // Add agents
    await team.addAgent({
      id: "context-arch",
      name: "Context Architect",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Architect with context awareness",
    }, TeamRole.Architect);

    await team.addAgent({
      id: "context-worker",
      name: "Context Worker",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      systemPrompt: "Worker with context awareness",
    }, TeamRole.Worker);

    // Set initial project context
    team.setContext("project_name", "ForgeOS Multi-Agent System");
    team.setContext("project_goals", "Build autonomous engineering runtime");
    team.setContext("tech_stack", "TypeScript, Node.js, LLMs");

    // Verify context is set and accessible
    const projectName = team.getContext<string>("project_name");
    const goals = team.getContext<string>("project_goals");
    const stack = team.getContext<string>("tech_stack");
    
    expect(projectName).toBe("ForgeOS Multi-Agent System");
    expect(goals).toBe("Build autonomous engineering runtime");
    expect(stack).toBe("TypeScript, Node.js, LLMs");

    // Decompose a task that would use this context
    const tasks = await team.decomposeTask("Implement agent coordination system");
    
    expect(tasks.length).toBeGreaterThan(0);
  });
});