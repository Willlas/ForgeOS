import { type AgentEvent } from "@cline/core";
import Config from "./config/index.js";
import Models from "./config/models.js";
import { createArchitectAgent } from "./agents/architect.js";
import { createWorkerAgent } from "./agents/worker.js";
import { createAgentTeam } from "./agents/team.js";

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
        { agentId: "architect", message: "I am the architect via team." },
        { agentId: "worker", message: "I am the worker via team." },
    ]);

    console.log("Team results count:", results.length);
}

main().catch(console.error);