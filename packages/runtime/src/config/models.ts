import Config from "./index.js";

export const Models = {
  architect: {
    providerId: "ollama" as const,
    modelId: Config.architectModel,
    baseUrl: Config.ollamaBaseUrl,
  } as const,
  worker: {
    providerId: "ollama" as const,
    modelId: Config.workerModel,
    baseUrl: Config.ollamaBaseUrl,
  } as const,
} as const;

export default Models;