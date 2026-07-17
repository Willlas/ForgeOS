import {} from "@cline/core";
import Config from "./config/index.js";
import Models from "./config/models.js";
import { createArchitectAgent } from "./agents/architect.js";
import { createWorkerAgent } from "./agents/worker.js";
import { createAgentTeam } from "./agents/team.js";
import { createTeamRuntime } from "./runtime/team-runtime.js";
import { runTeamTaskWorkflow } from "./workflows/team-task-flow.js";
async function main() {
    console.log(`Ollama: ${Config.ollamaBaseUrl}`);
    console.log(`Architect (${Models.architect.modelId})`);
    console.log(`Worker (${Models.worker.modelId})`);
    // === Individual agents (Commit 3) ===
    console.log("\n--- Individual: Architect ---");
    const architect = createArchitectAgent();
    await architect.run("I am the architect, ready to design.");
    console.log("\n--- Individual: Worker ---");
    const worker = createWorkerAgent();
    await worker.run("I am the worker, ready to code.");
    // === AgentTeam (Commit 4) ===
    console.log("\n--- AgentTeam: runSequential ---");
    const team = createAgentTeam();
    const results = await team.runSequential([
        { agentId: "architect", message: "I am the architect via team.", metadata: {} },
        { agentId: "worker", message: "I am the worker via team.", metadata: {} },
    ]);
    console.log("Team results count:", results.length);
    // === Delegate Workflow (Commit 5) - Placeholder for future implementation ===
    // delegate workflow requires real Agent instances which need API keys
    // === AgentTeamsRuntime (Commit 6) ===
    console.log("\n--- AgentTeamsRuntime (Commit 6) ---");
    const { teamRuntime, bootstrapResult } = createTeamRuntime();
    console.log("Team ID:", teamRuntime.getTeamId());
    console.log("Team Name:", teamRuntime.getTeamName());
    // Run a task workflow
    const taskResult = await runTeamTaskWorkflow(teamRuntime, bootstrapResult, "Hello World API Task", "Create a simple hello world API endpoint");
    console.log("Task outcome:", taskResult.outcome);
    // Cleanup
    teamRuntime.cleanup();
}
main().catch(console.error);
//# sourceMappingURL=index.js.map