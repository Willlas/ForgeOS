/**
 * Ollama Provider Implementation
 *
 * Implements IProvider for Ollama's local inference API.
 * This provider connects to a local Ollama instance and provides
 * text generation, streaming, and model listing capabilities.
 *
 * @module providers/ollama-provider
 */

import type {
  IProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  ProviderCapabilities,
  ProviderConfig,
  ProviderHealthStatus,
  ProviderModelInfo,
} from "../core/types/provider.js";

// ============================================================================
// Ollama API Types
// ============================================================================

/** Ollama chat API request body. */
interface OllamaChatRequest {
  model: string;
  messages?: OllamaMessage[];
  stream: boolean;
  format?: "json";
  options?: Record<string, unknown>;
}

/** Ollama chat API message. */
interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

/** Ollama chat API response (non-streaming). */
interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    images?: string[];
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  prompt_eval_duration?: number;
  done_reason?: string;
}

/** Ollama chat API streaming response chunk. */
interface OllamaChatChunk {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  prompt_eval_duration?: number;
}

/** Ollama models list response. */
interface OllamaModelsResponse {
  models: OllamaModelInfo[];
}

/** Ollama model info. */
interface OllamaModelInfo {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: OllamaModelDetails;
}

/** Ollama model details. */
interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

// ============================================================================
// Default Capabilities
// ============================================================================

/** Default Ollama provider capabilities. */
const DEFAULT_OLLAMA_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  jsonOutput: true,
  toolCalling: false,
  multiModal: false,
  embeddings: false,
  codeExecution: false,
  externalAccess: false,
  maxContextTokens: 131_072,
  minContextTokens: 512,
  outputFormats: ["text", "json"],
  tags: ["local", "open-source", "llama-compatible"],
};

// ============================================================================
// OllamaProvider Implementation
// ============================================================================

/**
 * Provider implementation for Ollama.
 * Connects to a local Ollama instance via HTTP API.
 */
export class OllamaProvider implements IProvider {
  readonly name: string;
  readonly type: string;
  readonly capabilities: ProviderCapabilities;
  health: ProviderHealthStatus;

  private baseUrl: string;
  private defaultModel: string;
  private timeoutMs: number;
  private maxRetries: number;
  private apiKey?: string;
  private _initialized: boolean;
  private availableModels: ProviderModelInfo[] = [];
  private lastHealthCheck: number = Date.now();
  private _config: ProviderConfig;

  /** Constructor. */
  constructor(config: ProviderConfig) {
    this.name = "ollama";
    this.type = "ollama";
    this.capabilities = DEFAULT_OLLAMA_CAPABILITIES;
    this.health = { status: "unhealthy", uptimeMs: 0 };

    // Extract config (ollama config always has baseUrl and type)
    const ollamaConfig = config as NonNullable<
      Pick<ProviderConfig, "baseUrl" | "type"> & {
        defaultModel?: string;
        timeoutMs?: number;
        maxRetries?: number;
        apiKey?: string;
      }
    >;

    const normalizedBaseUrl = ollamaConfig.baseUrl || "http://localhost:11434";
    const normalizedDefaultModel = ollamaConfig.defaultModel || "qwen2.5-coder:7b";
    const normalizedTimeoutMs = ollamaConfig.timeoutMs ?? 60_000;
    const normalizedMaxRetries = ollamaConfig.maxRetries ?? 3;

    this.baseUrl = normalizedBaseUrl;
    this.defaultModel = normalizedDefaultModel;
    this.timeoutMs = normalizedTimeoutMs;
    this.maxRetries = normalizedMaxRetries;
    this.apiKey = ollamaConfig.apiKey;
    this._initialized = false;
    this._config = {
      ...config,
      baseUrl: normalizedBaseUrl,
      defaultModel: normalizedDefaultModel,
      timeoutMs: normalizedTimeoutMs,
      maxRetries: normalizedMaxRetries,
    };
  }

  /** Configuration used by this provider. */
  get config(): ProviderConfig {
    return this._config;
  }

  // ======================================================================
  // Lifecycle
  // ======================================================================

  /** Initialize the provider - validates connection to Ollama. */
  async initialize(): Promise<void> {
    try {
      const status = await this.healthCheck();
      if (status.status !== "healthy") {
        throw new Error(`Ollama health check failed: ${status.error || "unknown"}`);
      }
      this._initialized = true;
      this.health = {
        status: "healthy",
        lastSuccessfulOperation: new Date().toISOString(),
        uptimeMs: Date.now() - this.lastHealthCheck,
        metadata: { connected: true, modelCount: this.availableModels.length },
      };

      try {
        this.availableModels = await this._fetchModels();
      } catch {
        // Models list is optional; continue without it.
        this.availableModels = [];
      }
    } catch (error) {
      this._initialized = false;
      this.health = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
      };
      throw new Error(`Ollama provider initialization failed: ${this.health.error}`);
    }
  }

  /** Gracefully shut down the provider. */
  async shutdown(): Promise<void> {
    this._initialized = false;
    this.health = { status: "unhealthy", lastSuccessfulOperation: this.health.lastSuccessfulOperation };
  }

  // ======================================================================
  // Inference
  // ======================================================================

  /** Generate a completion from the Ollama model. */
  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    if (!this._initialized) {
      throw new Error("OllamaProvider not initialized");
    }

    const model = request.modelId || this.defaultModel;
    const ollamaMessages = this._convertMessages(request.messages);
    const format = request.constraints?.format === "json" ? "json" : undefined;

    const body: OllamaChatRequest = {
      model,
      messages: ollamaMessages,
      stream: false,
      format,
      options: this._buildOptions(request),
    };

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const startTime = Date.now();

        const response = await this._post<OllamaChatResponse>(
          "/api/chat",
          body,
          this.timeoutMs
        );

        const latencyMs = Date.now() - startTime;

        return this._buildResponse(response, model, latencyMs, request);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms...
          await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        }
      }
    }

    throw new Error(
      `Ollama generate failed after ${this.maxRetries + 1} attempts: ${lastError}`
    );
  }

  /** Stream tokens from the Ollama model. */
  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk> {
    if (!this._initialized) {
      throw new Error("OllamaProvider not initialized");
    }

    const model = request.modelId || this.defaultModel;
    const ollamaMessages = this._convertMessages(request.messages);

    const body: OllamaChatRequest = {
      model,
      messages: ollamaMessages,
      stream: true,
      format: request.constraints?.format === "json" ? "json" : undefined,
      options: this._buildOptions(request),
    };

    let chunkId = 0;
    let accumulatedContent = "";
    let evalCount = 0;
    let promptEvalCount = 0;

    // Use fetch with ReadableStream for SSE-like behavior.
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/chat`;

    const response = await fetch(url, {
      method: "POST",
      headers: this._buildHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Ollama stream HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Ollama stream body is unreadable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          let chunk: OllamaChatChunk;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue; // Skip malformed JSON
          }

          accumulatedContent += chunk.message?.content || "";
          evalCount = chunk.eval_count ?? evalCount;
          promptEvalCount = chunk.prompt_eval_count ?? promptEvalCount;

          const isDone = chunk.done ?? false;

          yield {
            chunkId: chunkId++,
            delta: chunk.message?.content || "",
            done: isDone,
            stopReason: isDone ? (chunk.done_reason ?? "stop") : undefined,
            usage: isDone
              ? {
                  promptTokens: promptEvalCount,
                  completionTokens: evalCount,
                  totalTokens: promptEvalCount + evalCount,
                }
              : undefined,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Yield a final empty done chunk.
    yield {
      chunkId: chunkId,
      delta: "",
      done: true,
      stopReason: "stop",
      usage: {
        promptTokens: promptEvalCount,
        completionTokens: evalCount,
        totalTokens: promptEvalCount + evalCount,
      },
    };
  }

  // ======================================================================
  // Health
  // ======================================================================

  /** Check provider health status. */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      const url = `${this.baseUrl.replace(/\/$/, "")}/api/tags`;
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as OllamaModelsResponse;
      this.availableModels = this._parseModels(data.models);

      this.health = {
        status: "healthy",
        lastSuccessfulOperation: new Date().toISOString(),
        p99LatencyMs: Date.now() - start,
        successRate: 1.0,
        uptimeMs: Date.now() - this.lastHealthCheck,
        metadata: { modelCount: this.availableModels.length },
      };

      this.lastHealthCheck = Date.now();
    } catch (error) {
      this.health = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
        uptimeMs: Date.now() - this.lastHealthCheck,
        successRate: 0,
      };
    }

    return this.health;
  }

  /** Get available models for this provider. */
  async listModels(): Promise<ProviderModelInfo[]> {
    if (!this._initialized) {
      // Fetch even if not initialized.
      await this.healthCheck();
    }
    return [...this.availableModels];
  }

  /** Subscribe to provider events (no-op for Ollama). */
  on(_event: string, _handler: (data: unknown) => void): () => void {
    // Ollama does not support long-lived subscriptions.
    return () => {}; // No-op unsubscribe
  }

  // ======================================================================
  // Private Helpers
  // ======================================================================

  /** Convert internal messages to Ollama message format. */
  private _convertMessages(messages: InferenceRequest["messages"]): OllamaMessage[] {
    return (messages || []).map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      images: undefined,
    }));
  }

  /** Build Ollama options from inference request sampling params. */
  private _buildOptions(request: InferenceRequest): Record<string, unknown> {
    const s = request.sampling || {};
    const options: Record<string, unknown> = {};

    if (s.temperature !== undefined) options.temperature = s.temperature;
    if (s.topP !== undefined) options.top_p = s.topP;
    if (s.topK !== undefined) options.top_k = s.topK;
    if (s.repetitionPenalty !== undefined) options.repition_penalty = s.repetitionPenalty;
    if (s.frequencyPenalty !== undefined) options.frequency_penalty = s.frequencyPenalty;
    if (s.presencePenalty !== undefined) options.presence_penalty = s.presencePenalty;
    if (s.minTokens !== undefined) options.num_predict = s.minTokens;

    // Map constraints
    if (request.constraints?.maxTokens !== undefined) {
      options.num_predict = request.constraints.maxTokens;
    }
    if (request.constraints?.stopSequences) {
      options.stop = request.constraints.stopSequences;
    }

    return options;
  }

  /** Build the InferenceResponse from Ollama response. */
  private _buildResponse(
    response: OllamaChatResponse,
    modelId: string,
    latencyMs: number,
    _request: InferenceRequest
  ): InferenceResponse {
    return {
      id: `ollama-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      modelId,
      content: response.message?.content || null,
      stopReason: this._parseStopReason(response.done_reason),
      usage: {
        promptTokens: response.prompt_eval_count ?? 0,
        completionTokens: response.eval_count ?? 0,
        totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      },
      latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  /** Parse Ollama stop reason into our canonical format. */
  private _parseStopReason(reason?: string): InferenceResponse["stopReason"] {
    if (!reason) return "end_turn";
    const lower = reason.toLowerCase();
    if (lower.includes("max")) return "max_tokens";
    if (lower.includes("limit")) return "model_limit";
    return "end_turn";
  }

  /** Fetch available models from Ollama. */
  private async _fetchModels(): Promise<ProviderModelInfo[]> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/tags`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) return [];

    const data = await response.json() as OllamaModelsResponse;
    return this._parseModels(data.models);
  }

  /** Parse raw Ollama model info into ProviderModelInfo. */
  private _parseModels(models: OllamaModelInfo[]): ProviderModelInfo[] {
    return models.map((m) => ({
      id: m.name,
      name: m.name,
      vendor: "Ollama",
      maxContextTokens: 131_072,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      supportsToolCalling: false,
      metadata: {
        sizeBytes: m.size,
        format: m.details?.format,
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
        quantization: m.details?.quantization_level,
      },
    }));
  }

  /** Build common HTTP headers for Ollama API calls. */
  private _buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /** Perform an HTTP POST to the Ollama API with timeout. */
  private async _post<T>(endpoint: string, body: unknown, timeoutMs: number): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this._buildHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(
        `Ollama API error ${response.status}: ${bodyText || response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }
}