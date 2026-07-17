import { Agent } from "@cline/core";
import Models from "../config/models.js";
export function createArchitectAgent() {
    return new Agent({
        providerId: Models.architect.providerId,
        modelId: Models.architect.modelId,
        baseUrl: Models.architect.baseUrl,
        systemPrompt: "Eres un arquitecto de software senior. NUNCA modifiques archivos. Solo diseñas y delegas.",
        maxIterations: 1,
    });
}
//# sourceMappingURL=architect.js.map