/**
 * Provider Types - Abstraction layer for external AI model services.
 *
 * The provider abstraction ensures the Runtime remains completely decoupled
 * from any specific model implementation. New providers can be added without
 * modifying existing code.
 *
 * @module core/types/provider
 */

// ============================================================================
// Provider Capability Model
// ============================================================================

/**
 * Defines what a provider can do.
 * Used by the scheduler for capability matching.
 */
export interface ProviderCapabilities {
  /** Can stream responses */
  streaming: boolean;

  /** Supports structured JSON output */
  jsonOutput: boolean;

  /** Supports function/tool calling */
  toolCalling: boolean;

  /** Supports multi-modal input (images, files) */
  multiModal: boolean;

  /** Can generate embeddings */
  embeddings: boolean;

  /** Can execute code */
  codeExecution: boolean;

  /** Can access external tools */
  externalAccess: boolean;

  /** Maximum context window size in tokens */
  maxContextTokens: number;

  /** Minimum context window size in tokens */
  minContextTokens: number;

  /** Supported output formats */
  outputFormats: string[];

  /** Tags describing provider capabilities */
  tags: string[];
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Connection configuration for a provider.
 * Each provider type defines its own config schema.
 */
export interface BaseProviderConfig {
  /** Unique provider name (must be lowercase alphanumeric with hyphens) */
  name: string;

  /** Provider type identifier */
  type: string;

  /** Connection timeout in milliseconds */
  timeoutMs?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Base URL for API endpoint */
  baseUrl?: string;

  /** Authentication method (abstracted) */
  auth?: Record<string, unknown>;

  /** Provider-specific options */
  [key: string]: unknown;
}

/**
 * Ollama provider configuration.
 */
export interface OllamaProviderConfig extends BaseProviderConfig {
  type: "ollama";
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  requestTimeoutMs?: number;
}

/**
 * OpenAI provider configuration.
 */
export interface OpenAIProviderConfig extends BaseProviderConfig {
  type: "openai";
  apiKey: string;
  organizationId?: string;
  defaultModel?: string;
}

/**
 * Anthropic provider configuration.
 */
export interface AnthropicProviderConfig extends BaseProviderConfig {
  type: "anthropic";
  apiKey: string;
  version?: string;
  defaultModel?: string;
}

/**
 * Union of all known provider configs.
 */
export type ProviderConfig =
  | OllamaProviderConfig
  | OpenAIProviderConfig
  | AnthropicProviderConfig
  | BaseProviderConfig;

// ============================================================================
// Inference Request/Response Model
// ============================================================================

/**
 * Input content for a model message.
 */
export interface MessageContent {
  type: "text" | "image" | "tool_result" | "file";
  text?: string;
  imageUrl?: string;
  toolCallId?: string;
  filePath?: string;
}

/**
 * A single message in a conversation.
 */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | MessageContent[];
  id?: string;
  timestamp?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

/**
 * A tool call request from the model.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Result of a tool call execution.
 */
export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

/**
 * Request sent to a provider for inference.
 */
export interface InferenceRequest {
  /** Provider-assigned request ID (for tracing) */
  requestId: string;

  /** Model identifier */
  modelId: string;

  /** Conversation messages */
  messages: Message[];

  /** Available tools for the model to use */
  tools?: ToolDefinition[];

  /** Constraints on what the model should produce */
  constraints?: InferenceConstraints;

  /** Sampling parameters */
  sampling?: ModelSamplingParams;

  /** Correlation ID across subsystems */
  correlationId: string;

  /** Causation ID - which event triggered this */
  causationId?: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Constraints on model output.
 */
export interface InferenceConstraints {
  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Stop sequences */
  stopSequences?: string[];

  /** Logit bias for specific tokens */
  logitBias?: Record<string, number>;

  /** Suppress specific output patterns */
  suppressPatterns?: string[];

  /** Required output format */
  format?: "text" | "json" | "markdown";
}

/**
 * Sampling parameters for model inference.
 */
export interface ModelSamplingParams {
  /** Temperature (0.0 - 2.0) */
  temperature?: number;

  /** Top-p sampling threshold */
  topP?: number;

  /** Nucleus sampling count */
  topK?: number;

  /** Repetition penalty */
  repetitionPenalty?: number;

  /** Frequency penalty */
  frequencyPenalty?: number;

  /** Presence penalty */
  presencePenalty?: number;

  /** Minimum generation tokens */
  minTokens?: number;
}

/**
 * Default sampling parameters.
 */
export const DEFAULT_SAMPLING_PARAMS: ModelSamplingParams = {
  temperature: 0.7,
  topP: 0.9,
  topK: undefined,
  repetitionPenalty: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
  minTokens: 1,
};

/**
 * Definition of a tool the model can use.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

// ============================================================================
// Inference Response Model
// ============================================================================

/**
 * A single generated token with metadata.
 */
export interface GeneratedToken {
  text: string;
  logProb: number;
  rank?: number;
  topTokens?: Record<string, number>;
}

/**
 * Metadata about inference resource usage.
 */
export interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  inputCost?: number;
  outputCost?: number;
}

/**
 * Result of a single tool call in the model response.
 */
export interface ToolCallResult {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  isError: boolean;
}

/**
 * Complete response from a provider inference call.
 */
export interface InferenceResponse {
  /** Provider-assigned response ID */
  id: string;

  /** Model that generated this response */
  modelId: string;

  /** Generated message content */
  content: string | null;

  /** Tool calls requested by the model (if any) */
  toolCalls?: ToolCallResult[];

  /** Whether generation was complete */
  stopReason: "end_turn" | "max_tokens" | "model_limit" | "content_filter" | "error";

  /** Which finish reason token ended generation */
  finishReason?: string;

  /** Token usage metrics */
  usage: UsageMetrics;

  /** Duration of the inference call in milliseconds */
  latencyMs: number;

  /** Timestamp of response generation */
  timestamp: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Core provider interface - all providers must implement this.
 * This is the key abstraction that makes the runtime provider-agnostic.
 */
export interface IProvider {
  /** Unique name of this provider */
  readonly name: string;

  /** Type identifier for this provider */
  readonly type: string;

  /** Capabilities this provider supports */
  readonly capabilities: ProviderCapabilities;

  /** Whether the provider is healthy and accepting requests */
  readonly health: ProviderHealthStatus;

  /** Configuration used by this provider */
  readonly config: ProviderConfig;

  // --- Lifecycle ---

  /** Initialize the provider (connect to API, validate credentials) */
  initialize(): Promise<void>;

  /** Gracefully shut down the provider */
  shutdown(): Promise<void>;

  // --- Inference ---

  /** Generate a completion from the model */
  generate(request: InferenceRequest): Promise<InferenceResponse>;

  /** Stream tokens from the model */
  stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk>;

  // --- Health ---

  /** Check provider health status */
  healthCheck(): Promise<ProviderHealthStatus>;

  /** Get available models for this provider */
  listModels(): Promise<ProviderModelInfo[]>;

  // --- Event Emission ---

  /** Subscribe to provider events */
  on(event: string, handler: (data: unknown) => void): () => void;
}

/**
 * Health status of a provider.
 */
export interface ProviderHealthStatus {
  /** Overall health state */
  status: "healthy" | "degraded" | "unhealthy";

  /** Last successful operation timestamp */
  lastSuccessfulOperation?: string;

  /** Error message if unhealthy */
  error?: string;

  /** Response latency percentile (p99) in ms */
  p99LatencyMs?: number;

  /** Success rate over the last N requests */
  successRate?: number;

  /** Uptime in milliseconds */
  uptimeMs?: number;

  /** Detailed status information */
  metadata?: Record<string, unknown>;
}

/**
 * Information about an available model.
 */
export interface ProviderModelInfo {
  /** Unique model identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Developer / provider */
  vendor: string;

  /** Maximum context window size */
  maxContextTokens: number;

  /** Maximum output tokens */
  maxOutputTokens: number;

  /** Whether the model supports streaming */
  supportsStreaming: boolean;

  /** Whether the model supports tool calling */
  supportsToolCalling: boolean;

  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Inference Stream Chunk
// ============================================================================

/**
 * A chunk of tokens from a streaming inference response.
 */
export interface InferenceStreamChunk {
  /** Chunk ID for ordering */
  chunkId: number;

  /** Generated tokens in this chunk */
  delta: string;

  /** Cumulative usage metrics */
  usage?: Partial<UsageMetrics>;

  /** Whether the stream is complete */
  done: boolean;

  /** Stop reason if the stream ended */
  stopReason?: string;
}

// ============================================================================
// Provider Factory Pattern
// ============================================================================

/**
 * Function type for creating provider instances.
 */
export type ProviderFactory = (config: ProviderConfig) => IProvider;

/**
 * Registry of available provider factories.
 * Providers register themselves here.
 */
export const ProviderRegistry = new Map<string, ProviderFactory>();

/**
 * Registers a provider factory by type name.
 */
export function registerProvider(type: string, factory: ProviderFactory): void {
  if (ProviderRegistry.has(type)) {
    console.warn(`Provider type "${type}" already registered, overwriting.`);
  }
  ProviderRegistry.set(type, factory);
}

/**
 * Creates a provider instance from configuration.
 */
export function createProvider(config: ProviderConfig): IProvider {
  const factory = ProviderRegistry.get(config.type);
  if (!factory) {
    throw new Error(
      `Unknown provider type: "${config.type}". Registered types: ${[...ProviderRegistry.keys()].join(", ")}`
    );
  }
  return factory(config);
}

/**
 * Lists all registered provider types.
 */
export function listAvailableProviders(): string[] {
  return [...ProviderRegistry.keys()];
}

// ============================================================================
// Worker Types
// ============================================================================

/**
 * A worker is a runtime entity that executes work nodes.
 * Workers may wrap providers, cache layers, or local processes.
 */
export interface IWorker {
  /** Unique worker identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Type of worker (e.g., "ollama", "openai", "local") */
  readonly type: string;

  /** Whether the worker is online and accepting tasks */
  readonly isOnline: boolean;

  /** Current operational status */
  readonly status: WorkerStatus;

  /** Available capabilities for scheduling decisions */
  readonly capabilities: string[];

  /** Concurrency limit */
  readonly maxConcurrency: number;

  /** Currently active task count */
  readonly activeTasks: number;

  /** Remaining capacity */
  readonly remainingCapacity: number;

  // --- Lifecycle ---

  /** Start the worker */
  start(): Promise<void>;

  /** Stop the worker gracefully */
  stop(): Promise<void>;

  /** Check if the worker can accept a task with given capabilities */
  canExecute(capabilities: string[]): boolean;

  // --- Task Execution ---

  /** Execute a work node */
  execute(node: unknown): Promise<TaskExecutionResult>;

  /** Cancel an executing task */
  cancel(taskId: string): Promise<boolean>;

  // --- Health ---

  /** Check worker health */
  healthCheck(): Promise<WorkerHealthStatus>;
}

/**
 * Worker operational status.
 */
export enum WorkerStatus {
  Initializing = "initializing",
  Ready = "ready",
  Busy = "busy",
  Degraded = "degraded",
  Offline = "offline",
  Error = "error",
}

/**
 * Health status of a worker.
 */
export interface WorkerHealthStatus {
  /** Overall health */
  status: "healthy" | "degraded" | "unhealthy";

  /** Error message if unhealthy */
  error?: string;

  /** Memory usage in bytes */
  memoryUsageBytes?: number;

  /** CPU usage percentage */
  cpuUsagePercent?: number;

  /** Uptime in milliseconds */
  uptimeMs?: number;

  /** Tasks executed successfully */
  tasksSucceeded: number;

  /** Tasks that failed */
  tasksFailed: number;
}

/**
 * Result of executing a work node.
 */
export interface TaskExecutionResult {
  /** Whether the execution succeeded */
  success: boolean;

  /** Output artifacts from the execution */
  artifacts: ExecutionArtifact[];

  /** Knowledge captured during execution */
  knowledgeCaptured: string[];

  /** Metrics collected during execution */
  metrics: Record<string, unknown>;

  /** Error message if failed */
  error?: string;

  /** Time taken in milliseconds */
  durationMs: number;

  /** Whether partial results are available despite failure */
  partialResult?: boolean;
}

/**
 * An artifact produced by a task execution.
 */
export interface ExecutionArtifact {
  /** Type of artifact */
  type: "file" | "knowledge" | "code" | "documentation" | "metric" | "diagnostic";

  /** File path (for file artifacts) */
  path?: string;

  /** Content of the artifact */
  content: string;

  /** Size in bytes */
  size?: number;
}

