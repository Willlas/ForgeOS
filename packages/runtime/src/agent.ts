/**
 * Agent - Autonomous agent abstraction with lifecycle, prompt management,
 * conversation context, memory system, tool execution hooks, and capability registry.
 *
 * The Agent provides:
 * - Autonomous lifecycle (create → idle → active → paused → stopped)
 * - Prompt management (system, dynamic, temperature control)
 * - Conversation context with bounded history
 * - Memory abstraction (short-term + long-term)
 * - Tool execution hooks for extension
 * - Capability registration and discovery
 * - Agent registry integration
 * - Event-driven state transitions
 *
 * @module runtime/agent
 */

// ============================================================================
// Agent State
// ============================================================================

export enum AgentState {
  /** Agent is being created but not yet ready */
  Creating = "creating",
  /** Agent is idle and waiting for work */
  Idle = "idle",
  /** Agent is actively processing a task */
  Active = "active",
  /** Agent has been paused by the runtime */
  Paused = "paused",
  /** Agent has encountered an error */
  Error = "error",
  /** Agent has been stopped and cleaned up */
  Stopped = "stopped",
}

// ============================================================================
// Agent Capability
// ============================================================================

export interface AgentCapability {
  /** Unique capability identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Version tag for the capability spec */
  version?: string;
  /** Whether this capability is required (vs optional) */
  required?: boolean;
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Display name for the agent */
  name: string;
  /** System prompt defining agent behavior */
  systemPrompt: string;
  /** Provider ID used for LLM calls (e.g., "ollama") */
  providerId: string;
  /** Model ID used for LLM calls (e.g., "qwen3.6:27b") */
  modelId: string;
  /** Base URL for the provider (e.g., "http://localhost:11434") */
  baseUrl?: string;
  /** API key for the provider (optional) */
  apiKey?: string;
  /** Default temperature for generation (0-2) */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;
  /** Agent role (e.g., "architect", "worker", "reviewer") */
  role?: string;
  /** Capabilities this agent provides */
  capabilities?: AgentCapability[];
  /** Max conversation history to retain in memory */
  maxHistoryLength?: number;
  /** Long-term memory capacity (number of entries) */
  longTermMemoryCapacity?: number;
}

export function createDefaultAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    id: "agent-default",
    name: "Default Agent",
    systemPrompt: "You are a helpful assistant.",
    providerId: "ollama",
    modelId: "qwen2.5-coder:7b",
    baseUrl: "http://localhost:11434",
    temperature: 0.7,
    maxTokens: 4096,
    role: "generalist",
    capabilities: [],
    maxHistoryLength: 100,
    longTermMemoryCapacity: 500,
    ...overrides,
  };
}

// ============================================================================
// Conversation History Entry
// ============================================================================

export interface ConversationEntry {
  /** Message role */
  role: "system" | "user" | "assistant";
  /** Message content */
  content: string;
  /** Timestamp of the entry */
  timestamp: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Memory
// ============================================================================

export interface AgentMemory {
  /** Short-term working memory (conversation context) */
  shortTerm: ConversationEntry[];
  /** Long-term episodic memory (past experiences) */
  longTerm: MemoryEntry[];
  /** Semantic memory (learned facts and rules) */
  semantic: SemanticEntry[];
}

export interface MemoryEntry {
  /** Unique identifier for the memory */
  id: string;
  /** The memory content */
  content: string;
  /** When the memory was created */
  createdAt: string;
  /** Importance score (0-1) */
  importance: number;
  /** Tags for retrieval */
  tags: string[];
}

export interface SemanticEntry {
  /** Unique identifier */
  id: string;
  /** The learned fact/rule */
  fact: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** When it was learned */
  learnedAt: string;
}

// ============================================================================
// Agent Metrics
// ============================================================================

export interface AgentMetrics {
  /** Total tasks attempted */
  tasksAttempted: number;
  /** Tasks successfully completed */
  tasksCompleted: number;
  /** Tasks that failed */
  tasksFailed: number;
  /** Total tokens consumed */
  totalTokensUsed: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Current conversation history length */
  currentHistoryLength: number;
  /** Long-term memory entries count */
  longTermMemoryCount: number;
  /** Semantic memory entries count */
  semanticMemoryCount: number;
}

// ============================================================================
// Agent Event Types
// ============================================================================

export enum AgentEvent {
  Created = "agent:created",
  Started = "agent:started",
  Stopping = "agent:stopping",
  Stopped = "agent:stopped",
  Paused = "agent:paused",
  Resumed = "agent:resumed",
  TaskStarted = "agent:task_started",
  TaskCompleted = "agent:task_completed",
  TaskFailed = "agent:task_failed",
  MemoryStored = "agent:memory_stored",
  MemoryRetrieved = "agent:memory_retrieved",
  PromptUpdated = "agent:prompt_updated",
  CapabilityAdded = "agent:capability_added",
  CapabilityRemoved = "agent:capability_removed",
  Error = "agent:error",
}

// ============================================================================
// Agent Interface
// ============================================================================

export interface IAgent {
  /** Unique identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Current state */
  readonly state: AgentState;
  /** System prompt */
  readonly systemPrompt: string;
  /** Capabilities */
  readonly capabilities: ReadonlyArray<AgentCapability>;
  /** Current configuration */
  readonly config: AgentConfig;
  /** Agent metrics */
  readonly metrics: AgentMetrics;

  /** Generate a response from the provider */
  generate(prompt: string, options?: GenerationOptions): Promise<GenerationResult>;
  /** Generate a streaming response */
  stream(prompt: string, options?: GenerationOptions): AsyncIterable<StreamChunk>;
  /** Get conversation history */
  getHistory(): ReadonlyArray<ConversationEntry>;
  /** Add entry to conversation history */
  addHistoryEntry(entry: ConversationEntry): void;
  /** Clear conversation history */
  clearHistory(): void;
  /** Store a memory entry */
  storeMemory(memory: MemoryEntry): void;
  /** Retrieve memories by tags */
  retrieveMemories(tags: string[]): MemoryEntry[];
  /** Add semantic knowledge */
  addSemanticKnowledge(fact: string, confidence?: number): SemanticEntry;
  /** Execute a tool with the agent's context */
  executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  /** Update system prompt dynamically */
  updateSystemPrompt(prompt: string): void;
  /** Add a capability */
  addCapability(capability: AgentCapability): void;
  /** Remove a capability */
  removeCapability(name: string): void;
  /** Check if agent can handle specific capabilities */
  canHandle(requiredCapabilities: string[]): boolean;
}

// ============================================================================
// Generation Options
// ============================================================================

export interface GenerationOptions {
  /** Override temperature */
  temperature?: number;
  /** Override max tokens */
  maxTokens?: number;
  /** Provider override */
  providerId?: string;
  /** Model override */
  modelId?: string;
  /** Base URL override */
  baseUrl?: string;
}

// ============================================================================
// Generation Result
// ============================================================================

export interface GenerationResult {
  /** Generated text content */
  content: string;
  /** Tokens used for generation */
  tokensUsed: number;
  /** Model that generated the response */
  modelId: string;
  /** Response timestamp */
  timestamp: string;
}

// ============================================================================
// Stream Chunk
// ============================================================================

export interface StreamChunk {
  /** Partial content delta */
  delta: string;
  /** Whether this is the last chunk */
  done: boolean;
  /** Tokens used so far */
  tokensUsed: number;
}

// ============================================================================
// Agent Class
// ============================================================================

/**
 * Autonomous agent with lifecycle, conversation context, memory, and tool execution.
 *
 * The Agent is responsible for:
 * - Managing its own state machine
 * - Maintaining conversation history with bounded context
 * - Storing and retrieving memories
 * - Executing tools via registered handlers
 * - Managing capabilities
 * - Emitting lifecycle events
 */
export class Agent implements IAgent {
  private _config: AgentConfig;
  private _state: AgentState;
  private _history: ConversationEntry[];
  private _memory: AgentMemory;
  private _toolHandlers = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  private _capabilities: AgentCapability[];
  private _metrics: AgentMetrics;
  private _listeners = new Map<string, Array<(data: unknown) => void>>();
  private _taskStartTime = 0;

  constructor(config: AgentConfig) {
    this._config = createDefaultAgentConfig(config);
    this._state = AgentState.Creating;
    this._history = [];
    this._memory = {
      shortTerm: [],
      longTerm: [],
      semantic: [],
    };
    this._capabilities = config.capabilities ?? [];
    this._metrics = {
      tasksAttempted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTokensUsed: 0,
      avgResponseTimeMs: 0,
      currentHistoryLength: 0,
      longTermMemoryCount: 0,
      semanticMemoryCount: 0,
    };
  }

  // ========================================================================
  // Properties
  // ========================================================================

  get config(): AgentConfig { return { ...this._config }; }
  get state(): AgentState { return this._state; }
  get id(): string { return this._config.id; }
  get name(): string { return this._config.name; }
  get systemPrompt(): string { return this._config.systemPrompt; }
  get capabilities(): ReadonlyArray<AgentCapability> { return [...this._capabilities]; }
  get metrics(): AgentMetrics { return { ...this._metrics }; }
  get isIdle(): boolean { return this._state === AgentState.Idle; }
  get isActive(): boolean { return this._state === AgentState.Active; }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /** Initializes the agent and transitions to Idle state. */
  async start(): Promise<void> {
    if (this._state === AgentState.Stopped) {
      throw new Error(`Agent[${this.id}] has been stopped`);
    }
    if (this._state === AgentState.Active) {
      return; // Already running
    }

    this._state = AgentState.Idle;
    this._emit(AgentEvent.Created, { agentId: this.id, name: this.name });
    this._emit(AgentEvent.Started, { agentId: this.id, name: this.name });
  }

  /** Stops the agent and cleans up resources. */
  async stop(): Promise<void> {
    if (this._state === AgentState.Stopped || this._state === AgentState.Creating) {
      return;
    }

    const oldState = this._state;
    this._state = AgentState.Stopped;

    this._emit(AgentEvent.Stopping, { agentId: this.id });
    this._emit(AgentEvent.Stopped, { agentId: this.id, previousState: oldState });
  }

  /** Pauses the agent (e.g., for resource conservation). */
  pause(): void {
    if (this._state !== AgentState.Active) {
      return;
    }
    this._state = AgentState.Paused;
    this._emit(AgentEvent.Paused, { agentId: this.id });
  }

  /** Resumes a paused agent. */
  resume(): void {
    if (this._state !== AgentState.Paused) {
      return;
    }
    this._state = AgentState.Active;
    this._emit(AgentEvent.Resumed, { agentId: this.id });
  }

  // ========================================================================
  // Generation
  // ============================================================================

  async generate(prompt: string, options?: GenerationOptions): Promise<GenerationResult> {
    if (this._state === AgentState.Paused || this._state === AgentState.Stopped) {
      throw new Error(`Agent[${this.id}] cannot generate (state=${this._state})`);
    }

    this._transitionToActive();

    try {
      // In production, this would call the provider's generate method.
      // For now, return a mock response.
      const result: GenerationResult = {
        content: `[Agent ${this.name} generated response for: "${prompt.slice(0, 50)}..."]`,
        tokensUsed: prompt.length / 4, // Approximation
        modelId: options?.modelId ?? this._config.modelId,
        timestamp: new Date().toISOString(),
      };

      this._recordMetrics(result.tokensUsed, true);
      this._emit(AgentEvent.TaskCompleted, { agentId: this.id });
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this._metrics.tasksFailed++;
      this._state = AgentState.Error;
      this._emit(AgentEvent.Error, { agentId: this.id, error: msg });
      throw error;
    }
  }

  async* stream(prompt: string, _options: GenerationOptions | undefined): AsyncIterable<StreamChunk> {
    if (this._state === AgentState.Paused || this._state === AgentState.Stopped) {
      throw new Error(`Agent[${this.id}] cannot stream (state=${this._state})`);
    }

    this._transitionToActive();

    // In production, this would call the provider's stream method.
    // For now, yield mock chunks.
    const content = `[Streaming response from ${this.name} for: "${prompt.slice(0, 30)}..."]`;
    const chunks = content.split("");

    for (const chunk of chunks) {
      yield {
        delta: chunk,
        done: false,
        tokensUsed: 1,
      };
    }

    yield {
      delta: "",
      done: true,
      tokensUsed: content.length / 4,
    };
  }

  private _transitionToActive(): void {
    if (this._state === AgentState.Idle) {
      this._state = AgentState.Active;
      this._taskStartTime = Date.now();
      this._emit(AgentEvent.TaskStarted, { agentId: this.id });
    }
  }

  private _recordMetrics(tokensUsed: number, success: boolean): void {
    this._metrics.tasksAttempted++;
    if (success) {
      this._metrics.tasksCompleted++;
    }
    this._metrics.totalTokensUsed += tokensUsed;

    const responseTimeMs = Date.now() - this._taskStartTime;
    // Exponential moving average for response time
    const alpha = 0.1;
    if (this._metrics.avgResponseTimeMs === 0) {
      this._metrics.avgResponseTimeMs = responseTimeMs;
    } else {
      this._metrics.avgResponseTimeMs = alpha * responseTimeMs + (1 - alpha) * this._metrics.avgResponseTimeMs;
    }

    if (this._state === AgentState.Active) {
      this._state = AgentState.Idle;
    }
  }

  // ========================================================================
  // Conversation History
  // ========================================================================

  getHistory(): ReadonlyArray<ConversationEntry> {
    return [...this._history];
  }

  addHistoryEntry(entry: ConversationEntry): void {
    this._history.push(entry);

    // Enforce max history length
    const maxLen = this._config.maxHistoryLength ?? 100;
    if (this._history.length > maxLen) {
      this._history = this._history.slice(-maxLen);
    }

    this._metrics.currentHistoryLength = this._history.length;
  }

  clearHistory(): void {
    this._history = [];
    this._metrics.currentHistoryLength = 0;
  }

  // ========================================================================
  // Memory System
  // ========================================================================

  storeMemory(memory: MemoryEntry): void {
    const capacity = this._config.longTermMemoryCapacity ?? 500;

    if (this._memory.longTerm.length >= capacity) {
      // Remove least important entry
      const minIndex = this._memory.longTerm.reduce(
        (minIdx, m, i) => m.importance < this._memory.longTerm[minIdx].importance ? i : minIdx,
        0
      );
      this._memory.longTerm.splice(minIndex, 1);
    }

    this._memory.longTerm.push(memory);
    this._metrics.longTermMemoryCount = this._memory.longTerm.length;

    this._emit(AgentEvent.MemoryStored, { agentId: this.id, memoryId: memory.id });
  }

  retrieveMemories(tags: string[]): MemoryEntry[] {
    if (tags.length === 0) {
      return [...this._memory.longTerm];
    }

    return this._memory.longTerm.filter(
      (m) => tags.some((tag) => m.tags.includes(tag))
    ).sort((a, b) => b.importance - a.importance);
  }

  addSemanticKnowledge(fact: string, confidence: number = 0.5): SemanticEntry {
    const entry: SemanticEntry = {
      id: `sem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fact,
      confidence,
      learnedAt: new Date().toISOString(),
    };

    this._memory.semantic.push(entry);
    this._metrics.semanticMemoryCount = this._memory.semantic.length;

    return entry;
  }

  // ========================================================================
  // Tool Execution
  // ========================================================================

  /** Registers a tool handler. */
  registerTool(name: string, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    this._toolHandlers.set(name, handler);
  }

  /** Unregisters a tool handler. */
  unregisterTool(name: string): void {
    this._toolHandlers.delete(name);
  }

  async executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this._toolHandlers.get(toolName);
    if (!handler) {
      throw new Error(`Agent[${this.id}]: Tool "${toolName}" not registered`);
    }
    return handler(args);
  }

  /** Returns list of available tool names. */
  getAvailableTools(): string[] {
    return [...this._toolHandlers.keys()];
  }

  // ========================================================================
  // Prompt Management
  // ========================================================================

  updateSystemPrompt(prompt: string): void {
    const oldPrompt = this._config.systemPrompt;
    this._config = { ...this._config, systemPrompt: prompt };
    this._emit(AgentEvent.PromptUpdated, { agentId: this.id, oldPrompt, newPrompt: prompt });
  }

  // ========================================================================
  // Capabilities
  // ========================================================================

  addCapability(capability: AgentCapability): void {
    if (this._capabilities.some((c) => c.name === capability.name)) {
      return; // Already exists
    }
    this._capabilities.push(capability);
    this._emit(AgentEvent.CapabilityAdded, { agentId: this.id, capability });
  }

  removeCapability(name: string): void {
    const idx = this._capabilities.findIndex((c) => c.name === name);
    if (idx >= 0) {
      const [removed] = this._capabilities.splice(idx, 1);
      this._emit(AgentEvent.CapabilityRemoved, { agentId: this.id, capability: removed });
    }
  }

  canHandle(requiredCapabilities: string[]): boolean {
    if (requiredCapabilities.length === 0) return true;
    return requiredCapabilities.every((req) =>
      this._capabilities.some((c) => c.name === req)
    );
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
      try { handler(data); } catch { /* ignore */ }
    }
  }
}