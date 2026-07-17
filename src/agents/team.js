import { AgentTeam } from "@cline/core";
import Models from "../config/models.js";
import { createArchitectAgent } from "./architect.js";
import { createWorkerAgent } from "./worker.js";
export function createAgentTeam() {
    const team = new AgentTeam();
    // Register agents with unique IDs
    team.addAgent("architect", {
        providerId: Models.architect.providerId,
        modelId: Models.architect.modelId,
        baseUrl: Models.architect.baseUrl,
        systemPrompt: "Eres un arquitecto de software senior. NUNCA modifiques archivos. Solo diseñas y delegas.",
    });
    team.addAgent("worker", {
        providerId: Models.worker.providerId,
        modelId: Models.worker.modelId,
        baseUrl: Models.worker.baseUrl,
        systemPrompt: "Eres un desarrollador de software. Puedes crear, modificar y eliminar archivos.",
    });
    return team;
}
//# sourceMappingURL=team.js.map