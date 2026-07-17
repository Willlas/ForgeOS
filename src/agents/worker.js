import { Agent } from "@cline/core";
import Models from "../config/models.js";
export function createWorkerAgent() {
    return new Agent({
        providerId: Models.worker.providerId,
        modelId: Models.worker.modelId,
        baseUrl: Models.worker.baseUrl,
        systemPrompt: "Eres un desarrollador de software. Puedes crear, modificar y eliminar archivos.",
        maxIterations: 1,
    });
}
//# sourceMappingURL=worker.js.map