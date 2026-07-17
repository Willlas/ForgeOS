import { Agent } from "@cline/core";

async function main() {
    const agent = new Agent({
        providerId: "ollama",
        modelId: "qwen2.5-coder:7b",
        baseUrl: "http://localhost:11434",
        maxIterations: 1
    });

    agent.subscribe((event: import("@cline/core").AgentEvent) => {
        if (event.type === "assistant-text-delta") {
            process.stdout.write(event.text ?? "");
        }
    });

    await agent.run("Say hello");
}

main().catch(console.error);