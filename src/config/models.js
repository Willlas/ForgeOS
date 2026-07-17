import Config from "./index.js";
export const Models = {
    architect: {
        providerId: "ollama",
        modelId: Config.architectModel,
        baseUrl: Config.ollamaBaseUrl,
    },
    worker: {
        providerId: "ollama",
        modelId: Config.workerModel,
        baseUrl: Config.ollamaBaseUrl,
    },
};
export default Models;
//# sourceMappingURL=models.js.map