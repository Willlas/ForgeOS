/**
 * Provider Worker - Adapter that wraps an IProvider as an IWorker.
 *
 * The Scheduler expects IWorker implementations for task execution.
 * Providers implement IProvider (LLM inference interface). This adapter
 * bridges the two by wrapping a provider and translating between
 * WorkNode execution and LLM inference calls.
 *
 * @module providers/provider-worker
 */

import type {
  IProvider,
  IWorker,
  InferenceRequest,
  ProviderConfig,
  WorkerHealthStatus,
  TaskExecutionResult,
  ExecutionArtifact,
} from "../core/types/provider.js";
import { WorkerStatus } from "../core/types/provider.js";

// ============================================================================
// ID Generation (simple counter-based to avoid nanoid dependency)
// ============================================================================

let _idCounter = 0;
function generateId(): string {
  _idCounter++;
  return `w-${Date.now()}-${_idCounter}`;
}

// ============================================================================
// ProviderWorkerConfig
// ============================================================================

export interface ProviderWorkerConfig {
  /** Override name for the worker (defaults to provider name). */
  name?: string;
  /** Worker ID prefix. */
  idPrefix?: string;
  /** Maximum concurrent tasks this worker can handle. */
  maxConcurrency?: number;
}

// ============================================================================
// ProviderWorker - Adapter class
// ============================================================================

/**
 * Wraps an IProvider and exposes it as an IWorker for the Scheduler.
 *
 * Key translations:
 * - WorkNode (code/documentation generation) → Provider generates content via LLM
 * - TaskExecutionResult → wraps InferenceResponse artifacts
 */
export class ProviderWorker implements IWorker {
  public readonly id: string;
  public readonly name: string;
  public readonly type: string;

  private _provider: IProvider;
  private _config: ProviderWorkerConfig;
  private _maxConcurrency: number;
  private _isOnline: boolean;
  private _status: WorkerStatus;
  private _activeTasksCount: number;
  private _tasksSucceeded: number;
  private _tasksFailed: number;
  private _startTime: number;
  private _listeners: Map<string, Array<(data: unknown) => void>>;

  constructor(provider: IProvider, config?: ProviderWorkerConfig) {
    this._provider = provider;
    this._config = config ?? {};
    this.id = generateId();
    this.name = this._config.name ?? provider.name;
    this.type = provider.type;
    this._maxConcurrency = this._config.maxConcurrency ?? 4;
    this._isOnline = false;
    this._status = WorkerStatus.Offline;
    this._activeTasksCount = 0;
    this._tasksSucceeded = 0;
    this._tasksFailed = 0;
    this._startTime = 0;
    this._listeners = new Map();
  }

  // ========================================================================
  // IWorker Implementation
  // ========================================================================

  get provider(): IProvider {
    return this._provider;
  }

  get health(): WorkerHealthStatus {
    const ph = this._provider.health;
    // Map ProviderHealthStatus to WorkerHealthStatus
    return {
      status: ph.status as "healthy" | "degraded" | "unhealthy",
      uptimeMs: this._startTime ? Date.now() - this._startTime : 0,
      tasksSucceeded: this._tasksSucceeded,
      tasksFailed: this._tasksFailed,
    };
  }

  private _getCapabilityTags(): string[] {
    const caps = this._provider.capabilities;
    const tags: string[] = [];
    if (caps.streaming) tags.push("streaming");
    if (caps.jsonOutput) tags.push("json-output");
    if (caps.toolCalling) tags.push("tool-calling");
    if (caps.multiModal) tags.push("multi-modal");
    if (caps.embeddings) tags.push("embeddings");
    if (caps.codeExecution) tags.push("code-execution");
    if (caps.externalAccess) tags.push("external-access");
    return tags;
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  get status(): WorkerStatus {
    return this._status;
  }

  get maxConcurrency(): number {
    return this._maxConcurrency;
  }

  get activeTasks(): number {
    return this._activeTasksCount;
  }

  get remainingCapacity(): number {
    return Math.max(0, this._maxConcurrency - this._activeTasksCount);
  }

  get capabilities(): string[] {
    return this._getCapabilityTags();
  }

  // --- Lifecycle ---

  async start(): Promise<void> {
    await this._provider.initialize();
    this._isOnline = true;
    this._status = WorkerStatus.Ready;
    this._startTime = Date.now();
    this._emit("online", { workerId: this.id, workerName: this.name });
  }

  async stop(): Promise<void> {
    await this._provider.shutdown();
    this._isOnline = false;
    this._status = WorkerStatus.Offline;
    this._activeTasksCount = 0;
    this._emit("offline", { workerId: this.id, workerName: this.name });
  }

  canExecute(capabilities: string[]): boolean {
    if (!this._isOnline) return false;
    if (this._activeTasksCount >= this._maxConcurrency) return false;
    if (capabilities.length === 0) return true;

    const providerCaps = this.capabilities;
    return capabilities.some((cap) => providerCaps.includes(cap));
  }

  // --- Task Execution ---

  async execute(node: unknown): Promise<TaskExecutionResult> {
    if (!this._isOnline) {
      return { success: false, artifacts: [], knowledgeCaptured: [], metrics: {}, error: "Worker is offline", durationMs: 0 };
    }

    if (this._activeTasksCount >= this._maxConcurrency) {
      return { success: false, artifacts: [], knowledgeCaptured: [], metrics: {}, error: "Worker at maximum concurrency", durationMs: 0 };
    }

    const startTime = Date.now();
    this._activeTasksCount++;

    try {
      const workNode = node as Record<string, unknown>;

      // Build inference request from work node data
      const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }> = [];
      if (workNode.systemPrompt) {
        messages.push({ role: "system", content: String(workNode.systemPrompt) });
      }
      if (workNode.userPrompt || workNode.instructions) {
        messages.push({ role: "user", content: String(workNode.userPrompt ?? workNode.instructions) });
      }

      const inferenceRequest: InferenceRequest = {
        requestId: `req-${generateId()}`,
        modelId: (workNode.modelId as string) ?? this._provider.config.defaultModel as string ?? "default",
        messages: messages as any,
        tools: workNode.tools as any[],
        constraints: workNode.constraints as any,
        correlationId: (workNode.correlationId as string) ?? `corr-${generateId()}`,
      };

      // Generate response via provider
      const response = await this._provider.generate(inferenceRequest);

      // Build artifacts from response
      const artifacts: ExecutionArtifact[] = [];
      if (response.content) {
        artifacts.push({
          type: "code",
          content: response.content,
          size: Buffer.byteLength(response.content, "utf-8"),
        });
      }

      // Capture knowledge from tool calls
      const knowledgeCaptured: string[] = [];
      if (response.toolCalls) {
        for (const tc of response.toolCalls) {
          knowledgeCaptured.push(`Tool call: ${tc.name}(${JSON.stringify(tc.arguments)})`);
        }
      }

      this._tasksSucceeded++;
      this._emit("task_completed", { workerId: this.id, durationMs: Date.now() - startTime });

      return {
        success: true,
        artifacts,
        knowledgeCaptured,
        metrics: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          latencyMs: response.latencyMs,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this._tasksFailed++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this._emit("task_failed", { workerId: this.id, error: errorMessage });

      return {
        success: false,
        artifacts: [],
        knowledgeCaptured: [],
        metrics: {},
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this._activeTasksCount--;
    }
  }

  async cancel(_taskId: string): Promise<boolean> {
    return true;
  }

  // --- Health ---

  async healthCheck(): Promise<WorkerHealthStatus> {
    const providerHealth = await this._provider.healthCheck();
    const uptimeMs = this._startTime ? Date.now() - this._startTime : 0;

    if (providerHealth.status === "healthy") {
      return {
        status: "healthy",
        uptimeMs,
        tasksSucceeded: this._tasksSucceeded,
        tasksFailed: this._tasksFailed,
      };
    }

    return {
      status: "unhealthy",
      error: providerHealth.error,
      uptimeMs,
      tasksSucceeded: this._tasksSucceeded,
      tasksFailed: this._tasksFailed,
    };
  }

  // --- Event Emission ---

  on(event: string, handler: (data: unknown) => void): () => void {
    const handlers = this._listeners.get(event) ?? [];
    handlers.push(handler);
    this._listeners.set(event, handlers);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  // ========================================================================
  // Internal
  // ========================================================================

  private _emit(event: string, data: unknown): void {
    const handlers = this._listeners.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[ProviderWorker:${this.name}] Error emitting event "${event}":`, err);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a Worker from an existing Provider instance.
 */
export function createProviderWorker(provider: IProvider, config?: ProviderWorkerConfig): ProviderWorker {
  return new ProviderWorker(provider, config);
}

/**
 * Creates a Worker from a ProviderConfig by auto-creating the provider,
 * initializing it, and wrapping it as a worker.
 */
export async function createWorkerFromProviderConfig(config: ProviderConfig, workerConfig?: ProviderWorkerConfig): Promise<{
  worker: ProviderWorker;
  provider: IProvider;
}> {
  // Dynamically import the provider factory from the core types
  const { createProvider } = await import("../core/types/provider.js");
  const provider = createProvider(config);
  await provider.initialize();

  const worker = new ProviderWorker(provider, workerConfig);
  await worker.start();

  return { worker, provider };
}