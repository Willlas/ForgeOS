import { type AgentEvent } from "@cline/core";
import Config from "./config/index.js";
import Models from "./config/models.js";
import { createArchitectAgent } from "./agents/architect.js";
import { createWorkerAgent } from "./agents/worker.js";

async function main() {
    console.log(`Ollama: ${Config.ollamaBaseUrl}`);
    console.log(`Architect (${Models.architect.modelId})`);
    console.log(`Worker (${Models.worker.modelId})`);

    // Two agents with DIFFERENT models
    const architect = createArchitectAgent();
    const worker = createWorkerAgent();

    console.log("\n--- Architect response ---");
    await architect.run("I am the architect, ready to design.");

    console.log("\n--- Worker response ---");
    await worker.run("I am the worker, ready to code.");
}

main().catch(console.error);