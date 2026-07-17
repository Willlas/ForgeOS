import { Agent } from "@cline/core";
import Config from "./config/index.js";
import Models from "./config/models.js";

async function main() {
    // Usar configuración centralizada
    console.log(`Ollama: ${Config.ollamaBaseUrl}`);
    console.log(`Architect: ${Models.architect.modelId}`);
    console.log(`Worker: ${Models.worker.modelId}`);

    // Agent individual como proof-of-concept
    const agent = new Agent({
        providerId: Models.worker.providerId,
        modelId: Models.worker.modelId,
        baseUrl: Models.worker.baseUrl,
        maxIterations: 1,
    });

    agent.subscribe((event: import("@cline/core").AgentEvent) => {
        if (event.type === "assistant-text-delta") {
            process.stdout.write(event.text ?? "");
        }
    });

    await agent.run("Say hello");
}

main().catch(console.error);