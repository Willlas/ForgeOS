import dotenv from "dotenv";

dotenv.config();

export const Config = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  architectModel: process.env.ARCHITECT_MODEL ?? "qwen3.6:27b",
  workerModel: process.env.WORKER_MODEL ?? "Qwen3-Coder:latest",
} as const;

export default Config;