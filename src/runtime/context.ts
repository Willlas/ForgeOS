/**
 * ExecutionContext - Per-task execution context with tracing, state, and metadata.
 *
 * The ExecutionRuntime uses ExecutionContext to track all aspects of a running task:
 * - Tracing (correlation IDs, spans, timing)
 * - State machine (pending -> running -> completed/failed/cancelled)
 * - Metadata (user data, error info, cost tracking)
 * - Checkpoint support for resume/recovery
 *
 * @module runtime/context
 */

// ============================================================================
// Execution Span - Distributed tracing
// ============================================================================

export interface ExecutionSpan {
  /** Unique span identifier */
  spanId: string;
  /** Parent span identifier (null for root span) */
  parentId: string | null;
  /** Operation name */
  operation: string;
  /** Start timestamp (ISO 8601) */
  startTime: string;
  /** End timestamp (ISO 8601), empty if still active */
  endTime: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Status of the span */
  status: "ok" | "error" | "cancelled" | "timeout";
  /** Associated error message */
  error?: string;
  /** Key-value attributes */
  attributes: Record<string, string>;
}

// ============================================================================
// Execution State Machine
// ============================================================================

export enum ExecutionContextState {
  Pending = "pending",
  Scheduling = "scheduling",
  Assigned = "assigned",
  Running = "running",
  Completing = "completing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  Retrying = "retrying",
  Checkpointed = "checkpointed",
}

// ============================================================================
// Execution Context Configuration
// ============================================================================

export interface ExecutionContextConfig {
  /** Task ID (if not provided, one will be generated) */
  taskId?: string;
  /** Workflow/graph identifier */
  workflowId?: string;
  /** Node/work-item identifier */
  nodeId?: string;
}

/**
 * Execution context tracks the full lifecycle of a single task execution.
 *
 * Features:
 * - Distributed tracing via spans
 * - State machine for task lifecycle
 * - Checkpoint/save for resume/recovery
 * - Cost and resource tracking
 */
export class ExecutionContext {
  private _taskId: string;
  private _workflowId: string;
  private _nodeId: string | null;
  private _state: ExecutionContextState;
  private _rootSpan: ExecutionSpan;
  private readonly _childSpans = new Map<string, ExecutionSpan>();
  private _startTime: string;
  private _endTime: string;
  private _correlationId: string;
  private _error: string | null;
  private _costIncurred: number;
  private _tokenUsage: { prompt: number; completion: number; total: number };
  private readonly _metadata: Record<string, unknown> = {};
  private readonly _attributes: Record<string, string> = {};
  private _checkpointData: Record<string, unknown> | null;
  private _retries = 0;
  private _maxRetries = 3;
  private readonly _listeners = new Map<string, Array<(data: unknown) => void>>();

  constructor(config?: ExecutionContextConfig) {
    this._taskId = config?.taskId ?? `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._workflowId = config?.workflowId ?? `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this._nodeId = config?.nodeId ?? null;
    this._state = ExecutionContextState.Pending;
    this._error = null;
    this._costIncurred = 0;
    this._tokenUsage = { prompt: 0, completion: 0, total: 0 };
    this._checkpointData = null;

    const now = new Date().toISOString();
    this._startTime = now;
    this._endTime = "";
    this._correlationId = `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Root span
    this._rootSpan = {
      spanId: this._taskId,
      parentId: null,
      operation: "execution",
      startTime: now,
      endTime: "",
      durationMs: 0,
      status: "ok" as const,
      attributes: {},
    };
  }

  // ========================================================================
  // Properties
  // ========================================================================

  get taskId(): string { return this._taskId; }
  get workflowId(): string { return this._workflowId; }
  get nodeId(): string | null { return this._nodeId; }
  get state(): ExecutionContextState { return this._state; }
  get rootSpan(): ExecutionSpan { return this._rootSpan; }
  get startTime(): string { return this._startTime; }
  get endTime(): string { return this._endTime; }
  get correlationId(): string { return this._correlationId; }
  get error(): string | null { return this._error; }
  get costIncurred(): number { return this._costIncurred; }
  get tokenUsage(): Readonly<{ prompt: number; completion: number; total: number }> {
    return { ...this._tokenUsage };
  }
  get metadata(): Record<string, unknown> { return { ...this._metadata }; }
  get attributes(): Record<string, string> { return { ...this._attributes }; }
  get checkpointData(): Record<string, unknown> | null {
    return this._checkpointData ? { ...this._checkpointData } : null;
  }
  get retries(): number { return this._retries; }
  get maxRetries(): number { return this._maxRetries; }
  get activeChildSpanCount(): number { return this._childSpans.size; }

  // ========================================================================
  // State Transitions
  // ========================================================================

  /**
   * Transitions the context to a new state. Fires state change events.
   * Returns true if transition was successful, false otherwise.
   */
  transitionTo(newState: ExecutionContextState): boolean {
    const validTransitions: Record<ExecutionContextState, ExecutionContextState[]> = {
      [ExecutionContextState.Pending]: [
        ExecutionContextState.Scheduling,
        ExecutionContextState.Failed,
        ExecutionContextState.Cancelled,
      ],
      [ExecutionContextState.Scheduling]: [
        ExecutionContextState.Assigned,
        ExecutionContextState.Failed,
        ExecutionContextState.Cancelled,
      ],
      [ExecutionContextState.Assigned]: [
        ExecutionContextState.Running,
        ExecutionContextState.Failed,
        ExecutionContextState.Cancelled,
      ],
      [ExecutionContextState.Running]: [
        ExecutionContextState.Completing,
        ExecutionContextState.Failed,
        ExecutionContextState.Cancelled,
        ExecutionContextState.Retrying,
        ExecutionContextState.Checkpointed,
      ],
      [ExecutionContextState.Completing]: [
        ExecutionContextState.Completed,
        ExecutionContextState.Failed,
      ],
      [ExecutionContextState.Completed]: [],
      [ExecutionContextState.Failed]: [],
      [ExecutionContextState.Cancelled]: [],
      [ExecutionContextState.Retrying]: [
        ExecutionContextState.Assigned,
        ExecutionContextState.Failed,
        ExecutionContextState.Cancelled,
      ],
      [ExecutionContextState.Checkpointed]: [
        ExecutionContextState.Assigned,
        ExecutionContextState.Failed,
        ExecutionContextState.Cancelled,
      ],
    };

    const allowed = validTransitions[this._state];
    if (!allowed.includes(newState)) {
      console.warn(
        `[ExecutionCtx:${this._taskId}] Invalid state transition: ${this._state} -> ${newState}`
      );
      return false;
    }

    const oldState = this._state;
    this._state = newState;

    // Update end time for terminal states
    if (
      newState === ExecutionContextState.Completed ||
      newState === ExecutionContextState.Failed ||
      newState === ExecutionContextState.Cancelled
    ) {
      this._endTime = new Date().toISOString();
      this._rootSpan.endTime = this._endTime;
      this._rootSpan.durationMs = Date.now() - new Date(this._startTime).getTime();
    }

    // If retrying, increment counter
    if (newState === ExecutionContextState.Retrying) {
      this._retries++;
    }

    this._emit("stateChanged", {
      taskId: this._taskId,
      oldState,
      newState,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  // ========================================================================
  // Span Management
  // ========================================================================

  /** Creates a child span for sub-operation tracking. */
  createChildSpan(operation: string, parentId?: string): ExecutionSpan {
    const parentId_ = parentId ?? this._rootSpan.spanId;
    const spanId = `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const span: ExecutionSpan = {
      spanId,
      parentId: parentId_,
      operation,
      startTime: now,
      endTime: "",
      durationMs: 0,
      status: "ok" as const,
      attributes: {},
    };

    this._childSpans.set(spanId, span);
    this._emit("spanCreated", { spanId, operation, taskId: this._taskId });
    return span;
  }

  /** Ends a child span with optional status and error. */
  endSpan(spanId: string, status: ExecutionSpan["status"] = "ok", error?: string): void {
    const span = this._childSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date().toISOString();
    span.durationMs = Date.now() - new Date(span.startTime).getTime();
    span.status = status;
    if (error) span.error = error;

    this._emit("spanEnded", { spanId, status, taskId: this._taskId });
  }

  /** Returns all child spans. */
  getChildSpans(): ExecutionSpan[] {
    return [...this._childSpans.values()];
  }

  // ========================================================================
  // Metadata & Attributes
  // ========================================================================

  setMetadata(key: string, value: unknown): void {
    this._metadata[key] = value;
    this._emit("metadataChanged", { taskId: this._taskId, key, value });
  }

  setAttribute(key: string, value: string): void {
    this._attributes[key] = value;
  }

  getMetadata<T>(key: string): T | undefined {
    return this._metadata[key] as T | undefined;
  }

  // ========================================================================
  // Cost & Token Tracking
  // ========================================================================

  addCost(amount: number): void {
    this._costIncurred += amount;
    this._emit("costChanged", { taskId: this._taskId, costIncurred: this._costIncurred });
  }

  recordTokenUsage(promptTokens: number, completionTokens: number): void {
    this._tokenUsage.prompt += promptTokens;
    this._tokenUsage.completion += completionTokens;
    this._tokenUsage.total = this._tokenUsage.prompt + this._tokenUsage.completion;
    this._emit("tokensRecorded", { taskId: this._taskId, promptTokens, completionTokens });
  }

  // ========================================================================
  // Error Handling
  // ========================================================================

  setError(message: string): void {
    this._error = message;
    if (this._state !== ExecutionContextState.Failed) {
      this.transitionTo(ExecutionContextState.Failed);
    }
    this._emit("error", { taskId: this._taskId, error: message });
  }

  // ========================================================================
  // Checkpoint Support for Resume/Recovery
  // ========================================================================

  checkpoint(data: Record<string, unknown>): void {
    this._checkpointData = { ...data };
    this.transitionTo(ExecutionContextState.Checkpointed);
    this._emit("checkpointed", { taskId: this._taskId, data });
  }

  clearCheckpoint(): void {
    this._checkpointData = null;
  }

  // ========================================================================
  // Event Emission
  // ========================================================================

  on(event: string, handler: (data: unknown) => void): () => void {
    const handlers = this._listeners.get(event) ?? [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }

  private _emit(event: string, data: unknown): void {
    const handlers = this._listeners.get(event) ?? [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch {
        // ignore listener errors
      }
    }
  }

  // ========================================================================
  // Serialization / Recovery
  // ========================================================================

  /** Serializes the context for persistence/storage. */
  serialize(): string {
    const snapshot = {
      taskId: this._taskId,
      workflowId: this._workflowId,
      nodeId: this._nodeId,
      state: this._state,
      correlationId: this._correlationId,
      error: this._error,
      costIncurred: this._costIncurred,
      tokenUsage: this._tokenUsage,
      metadata: this._metadata,
      attributes: this._attributes,
      checkpointData: this._checkpointData,
      retries: this._retries,
      maxRetries: this._maxRetries,
      startTime: this._startTime,
      endTime: this._endTime,
      rootSpan: this._rootSpan,
    };
    return JSON.stringify(snapshot, null, 2);
  }

  /** Deserializes a snapshot back into a new context. */
  static deserialize(json: string): ExecutionContext {
    const snapshot = JSON.parse(json) as Record<string, unknown>;
    const ctx = new ExecutionContext({
      taskId: (snapshot.taskId as string) ?? undefined,
      workflowId: (snapshot.workflowId as string) ?? undefined,
      nodeId: (snapshot.nodeId as string) ?? undefined,
    });

    if (snapshot.state !== undefined) (ctx as any)._state = snapshot.state;
    if (snapshot.correlationId) (ctx as any)._correlationId = snapshot.correlationId;
    if (snapshot.error) (ctx as any)._error = snapshot.error;
    if (snapshot.costIncurred != null) (ctx as any)._costIncurred = snapshot.costIncurred;
    if (snapshot.tokenUsage && typeof snapshot.tokenUsage === "object") {
      (ctx as any)._tokenUsage = { ...snapshot.tokenUsage };
    }
    if (snapshot.metadata && typeof snapshot.metadata === "object") {
      (ctx as any)._metadata = { ...(snapshot.metadata as Record<string, unknown>) };
    }
    if (snapshot.attributes && typeof snapshot.attributes === "object") {
      (ctx as any)._attributes = { ...(snapshot.attributes as Record<string, string>) };
    }
    if (snapshot.checkpointData && snapshot.checkpointData !== null) {
      (ctx as any)._checkpointData = { ...(snapshot.checkpointData as Record<string, unknown>) };
    }
    if (snapshot.retries != null) (ctx as any)._retries = snapshot.retries;
    if ((snapshot.maxRetries as number | undefined) != null) {
      (ctx as any)._maxRetries = snapshot.maxRetries as number;
    }
    if (snapshot.startTime) (ctx as any)._startTime = snapshot.startTime;
    if (snapshot.endTime) (ctx as any)._endTime = snapshot.endTime;

    return ctx;
  }

  /** Returns a summary object for logging/metrics. */
  summary(): {
    taskId: string;
    workflowId: string;
    state: ExecutionContextState;
    durationMs: number;
    costIncurred: number;
    tokenUsage: { prompt: number; completion: number; total: number };
    retries: number;
    error: string | null;
  } {
    const durationMs = Date.now() - new Date(this._startTime).getTime();

    return {
      taskId: this._taskId,
      workflowId: this._workflowId,
      state: this._state,
      durationMs,
      costIncurred: this._costIncurred,
      tokenUsage: { ...this._tokenUsage },
      retries: this._retries,
      error: this._error,
    };
  }
}