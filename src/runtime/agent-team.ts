/**
 * AgentTeam - Coordinates multiple autonomous agents with shared context,
 * task decomposition, scheduling integration, and inter-agent communication.
 *
 * Provides:
 * - Team lifecycle management (create → running → suspended → stopped)
 * - Role-based agent assignment (Architect, Worker, Reviewer, Generalist)
 * - Shared execution context with scoping
 * - Task decomposition and distribution
 * - Agent coordination via shared context events
 * - Team-level metrics and monitoring
 * - Event-driven state transitions
 *
 * @module runtime/agent-team
 */

import { AgentConfig, IAgent } from './agent.js';
import { AgentRegistry } from './agent-registry.js';
import { SharedExecutionContext, ContextEntry, Snapshot } from './shared-context.js';

// ============================================================================
// Team State
// ============================================================================

export enum TeamState {
  Creating = "creating",
  Running = "running",
  Suspended = "suspended",
  Stopped = "stopped",
  Error = "error",
}

// ============================================================================
// Team Role
// ============================================================================

export enum TeamRole {
  Architect = "architect",
  Worker = "worker",
  Reviewer = "reviewer",
  Generalist = "generalist",
}

// ============================================================================
// Team Configuration
// ============================================================================

export interface TeamConfig {
  /** Unique team identifier */
  id: string;
  /** Display name for the team */
  name: string;
  /** Maximum number of agents in the team */
  maxAgents?: number;
  /** Default model ID for new agents */
  defaultModelId?: string;
  /** Default provider ID for new agents */
  defaultProviderId?: string;
  /** Shared context capacity */
  contextCapacity?: number;
  /** Maximum task queue size per agent */
  maxTaskQueueSize?: number;
}

export function createDefaultTeamConfig(overrides?: Partial<TeamConfig>): TeamConfig {
  return {
    id: "team-default",
    name: "Default Team",
    maxAgents: 10,
    defaultModelId: "qwen2.5-coder:7b",
    defaultProviderId: "ollama",
    contextCapacity: 1000,
    maxTaskQueueSize: 100,
    ...overrides,
  };
}

// ============================================================================
// Team Agent Assignment
// ============================================================================

export interface AgentAssignment {
  /** Assigned agent ID */
  agentId: string;
  /** Role in the team */
  role: TeamRole;
  /** Display name (may differ from agent name) */
  displayName: string;
  /** Config used to create the agent */
  config: AgentConfig;
}

// ============================================================================
// Decomposed Task
// ============================================================================

export interface DecomposedTask {
  /** Unique task identifier */
  id: string;
  /** Original parent task (null for root tasks) */
  parentId: string | null;
  /** Human-readable description */
  description: string;
  /** Required role to execute this task */
  requiredRole: TeamRole;
  /** Priority (higher = more urgent) */
  priority: number;
  /** Dependencies on other tasks */
  dependencies: string[];
  /** Status tracking */
  status: TaskStatus;
  /** Assigned agent ID */
  assignedTo: string | null;
  /** Result of execution */
  result: unknown;
  /** When the task was created */
  createdAt: string;
  /** When execution started */
  startedAt: string | null;
  /** When execution completed */
  completedAt: string | null;
}

export enum TaskStatus {
  Pending = "pending",
  Ready = "ready",
  Executing = "executing",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
}

// ============================================================================
// Team Event Types
// ============================================================================

export enum TeamEvent {
  Created = "team:created",
  Started = "team:started",
  Stopping = "team:stopping",
  Stopped = "team:stopped",
  Suspended = "team:suspended",
  Resumed = "team:resumed",
  AgentJoined = "team:agent_joined",
  AgentLeft = "team:agent_left",
  TaskDecomposed = "team:task_decomposed",
  TaskAssigned = "team:task_assigned",
  TaskCompleted = "team:task_completed",
  TaskFailed = "team:task_failed",
  ContextUpdated = "team:context_updated",
  SnapshotCreated = "team:snapshot_created",
  Error = "team:error",
}

// ============================================================================
// Team Metrics
// ============================================================================

export interface TeamMetrics {
  /** Total agents in the team */
  agentCount: number;
  /** Active agents */
  activeAgentCount: number;
  /** Total tasks decomposed */
  totalTasksDecomposed: number;
  /** Tasks completed successfully */
  tasksCompleted: number;
  /** Tasks failed */
  tasksFailed: number;
  /** Shared context entry count */
  contextEntryCount: number;
  /** Current shared context version */
  contextVersion: number;
  /** Average task completion time in ms */
  avgTaskCompletionTimeMs: number;
}

// ============================================================================
// Agent Team Class
// ============================================================================

/**
 * Orchestrates multiple agents with shared context, task decomposition,
 * and coordination capabilities.
 */
export class AgentTeam {
  private _config: TeamConfig;
  private _state: TeamState;
  private _registry: AgentRegistry;
  private _context: SharedExecutionContext;
  private _assignments = new Map<TeamRole, AgentAssignment>();
  private _tasks = new Map<string, DecomposedTask>();
  private _taskQueue: DecomposedTask[] = [];
  private _listeners = new Map<string, Array<(data: unknown) => void>>();
  private _metrics: TeamMetrics;
  private _taskCounter = 0;
  private _snapshots: Snapshot[] = [];

  constructor(config: TeamConfig) {
    this._config = createDefaultTeamConfig(config);
    this._state = TeamState.Creating;
    this._registry = new AgentRegistry();
    this._context = new SharedExecutionContext(this._config.id, this._config.contextCapacity ?? 1000);
    this._metrics = {
      agentCount: 0,
      activeAgentCount: 0,
      totalTasksDecomposed: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      contextEntryCount: this._context.entryCount,
      contextVersion: this._context.currentVersion,
      avgTaskCompletionTimeMs: 0,
    };
  }

  // ======================================================================
  // Properties
  // ======================================================================

  get config(): TeamConfig { return { ...this._config }; }
  get state(): TeamState { return this._state; }
  get id(): string { return this._config.id; }
  get name(): string { return this._config.name; }
  get registry(): AgentRegistry { return this._registry; }
  get context(): SharedExecutionContext { return this._context; }
  get isRunning(): boolean { return this._state === TeamState.Running; }
  get metrics(): TeamMetrics { return { ...this._metrics }; }

  // ======================================================================
  // Lifecycle
  // ======================================================================

  /** Starts the team, initializing all agents. */
  async start(): Promise<void> {
    if (this._state === TeamState.Stopped) {
      throw new Error(`Team[${this.id}] has been stopped`);
    }
    if (this._state === TeamState.Running) {
      return;
    }

    this._state = TeamState.Running;
    await this._registry.start();
    this._emit(TeamEvent.Created, { teamId: this.id, name: this.name });
    this._emit(TeamEvent.Started, { teamId: this.id, name: this.name });
  }

  /** Stops the team and all agents. */
  async stop(): Promise<void> {
    if (this._state === TeamState.Stopped || this._state === TeamState.Creating) {
      return;
    }

    const oldState = this._state;
    this._state = TeamState.Stopped;

    // Stop all agents
    await this._registry.stop();

    this._emit(TeamEvent.Stopping, { teamId: this.id });
    this._emit(TeamEvent.Stopped, { teamId: this.id, previousState: oldState });
  }

  /** Suspends the team (pauses all agents). */
  suspend(): void {
    if (this._state !== TeamState.Running) {
      return;
    }
    this._state = TeamState.Suspended;

    for (const [, reg] of this._registry['_agents']) {
      if (reg.isActive) {
        (reg.agent as any).pause?.();
      }
    }

    this._emit(TeamEvent.Suspended, { teamId: this.id });
  }

  /** Resumes the team. */
  resume(): void {
    if (this._state !== TeamState.Suspended) {
      return;
    }
    this._state = TeamState.Running;

    for (const [, reg] of this._registry['_agents']) {
      if ((reg.agent as any).state === 'paused') {
        (reg.agent as any).resume?.();
      }
    }

    this._emit(TeamEvent.Resumed, { teamId: this.id });
  }

  // ======================================================================
  // Agent Management
  // ======================================================================

  /** Adds an agent to the team with a specific role. */
  async addAgent(
    config: AgentConfig,
    role?: TeamRole
  ): Promise<AgentAssignment> {
    if (this._state === TeamState.Stopped) {
      throw new Error(`Team[${this.id}] is stopped`);
    }
    if (this._assignments.size >= (this._config.maxAgents ?? 10)) {
      throw new Error(
        `Team[${this.id}] has reached max agents limit (${this._config.maxAgents})`
      );
    }

    // Assign default role if not specified
    const agentRole = role ?? TeamRole.Generalist;

    // Ensure providerId and modelId are set
    if (!config.providerId) {
      config.providerId = this._config.defaultProviderId ?? "ollama";
    }
    if (!config.modelId) {
      config.modelId = this._config.defaultModelId ?? "qwen2.5-coder:7b";
    }

    // Register agent via registry (which creates the Agent instance)
    const agent = await this._registry.register(config);

    const displayName = `${config.name || agent.id} (${agentRole})`;

    const assignment: AgentAssignment = {
      agentId: agent.id,
      role: agentRole,
      displayName,
      config: { ...config },
    };

    this._assignments.set(agentRole, assignment);
    this._context.joinAgent(agent.id);

    this._updateMetrics();
    this._emit(TeamEvent.AgentJoined, { ...assignment });

    return assignment;
  }

  /** Removes an agent by role. */
  async removeAgent(role: TeamRole): Promise<boolean> {
    const assignment = this._assignments.get(role);
    if (!assignment) {
      return false;
    }

    await this._registry.unregister(assignment.agentId);
    this._context.leaveAgent(assignment.agentId);
    this._assignments.delete(role);

    this._updateMetrics();
    this._emit(TeamEvent.AgentLeft, { agentId: assignment.agentId, role });

    return true;
  }

  /** Gets an agent by role. */
  getAgent(role: TeamRole): IAgent | null {
    const assignment = this._assignments.get(role);
    if (!assignment) {
      return null;
    }
    return this._registry.get(assignment.agentId) ?? null;
  }

  /** Gets an agent by ID. */
  getAgentById(agentId: string): IAgent | null {
    return this._registry.get(agentId) ?? null;
  }

  /** Gets the architect agent. */
  getArchitect(): IAgent | null {
    return this.getAgent(TeamRole.Architect);
  }

  /** Gets the worker agent. */
  getWorker(): IAgent | null {
    return this.getAgent(TeamRole.Worker);
  }

  /** Gets the reviewer agent. */
  getReviewer(): IAgent | null {
    return this.getAgent(TeamRole.Reviewer);
  }

  /** Gets all agents as a map of role → agent. */
  getAllAgents(): Map<TeamRole, IAgent> {
    const result = new Map<TeamRole, IAgent>();
    for (const [role, assignment] of this._assignments) {
      const agent = this._registry.get(assignment.agentId);
      if (agent) {
        result.set(role, agent);
      }
    }
    return result;
  }

  // ======================================================================
  // Task Decomposition
  // ======================================================================

  /**
   * Decomposes a high-level goal into subtasks using the architect agent.
   */
  async decomposeTask(
    description: string,
    requiredRole?: TeamRole
  ): Promise<DecomposedTask[]> {
    const task: DecomposedTask = this._createRootTask(description, requiredRole);

    // Try to use the architect agent for decomposition
    const architect = this.getArchitect();
    if (architect && this._state === TeamState.Running) {
      try {
        const prompt = `You are an Architect agent. Decompose the following high-level goal into specific, actionable subtasks.

Goal: ${description}

For each subtask, provide:
- A clear description
- The role required to execute it (architect, worker, reviewer, generalist)
- Dependencies on other subtasks (if any)
- A priority (1-10)

Return the decomposition as a structured format with each subtask clearly delineated.`;

        const result = await architect.generate(prompt);

        // Parse the result into subtasks (in production, this would be more sophisticated)
        const subtasks = this._parseDecompositionResult(result.content, task.id);
        subtasks.forEach((st) => {
          this._tasks.set(st.id, st);
          this._metrics.totalTasksDecomposed++;
        });

        this._emit(TeamEvent.TaskDecomposed, { parentTaskId: task.id, subtasks });

        return [task, ...subtasks];
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this._emit(TeamEvent.Error, { teamId: this.id, error: `Decomposition failed: ${msg}` });
      }
    }

    // Fallback: create single task
    const fallbackTask: DecomposedTask = {
      ...task,
      status: TaskStatus.Ready,
      createdAt: new Date().toISOString(),
    };
    this._tasks.set(fallbackTask.id, fallbackTask);
    this._taskQueue.push(fallbackTask);

    this._metrics.totalTasksDecomposed++;
    this._emit(TeamEvent.TaskDecomposed, { parentTaskId: null, subtasks: [fallbackTask] });

    return [fallbackTask];
  }

  /** Assigns a task to an appropriate agent. */
  assignTask(taskId: string): boolean {
    const task = this._tasks.get(taskId);
    if (!task || task.status !== TaskStatus.Ready) {
      return false;
    }

    // Check dependencies
    const depsMet = task.dependencies.every(
      (depId: string) => {
        const dep = this._tasks.get(depId);
        return dep != null && dep.status === TaskStatus.Completed;
      }
    );
    if (!depsMet) {
      return false;
    }

    // Find suitable agent by role
    const assignment = this._assignments.get(task.requiredRole);
    if (!assignment) {
      // Try any available agent
      for (const [, a] of this._assignments) {
        const agent = this._registry.get(a.agentId);
        if (agent) {
          task.assignedTo = a.agentId;
          task.status = TaskStatus.Executing;
          task.startedAt = new Date().toISOString();
          this._emit(TeamEvent.TaskAssigned, { taskId, agentId: a.agentId });
          return true;
        }
      }
      return false;
    }

    const agent = this._registry.get(assignment.agentId);
    if (!agent) {
      return false;
    }

    task.assignedTo = assignment.agentId;
    task.status = TaskStatus.Executing;
    task.startedAt = new Date().toISOString();

    this._emit(TeamEvent.TaskAssigned, { taskId, agentId: assignment.agentId });

    // Execute the task
    this._executeTask(task, agent);

    return true;
  }

  /** Completes a task and propagates results. */
  completeTask(taskId: string, result: unknown): boolean {
    const task = this._tasks.get(taskId);
    if (!task || task.status !== TaskStatus.Executing) {
      return false;
    }

    const startTime = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
    const completionTime = Date.now() - startTime;

    task.status = TaskStatus.Completed;
    task.result = result;
    task.completedAt = new Date().toISOString();

    this._metrics.tasksCompleted++;
    this._updateAvgTaskCompletionTime(completionTime);

    // Update shared context with result
    if (task.assignedTo) {
      this._context.set(
        `task:${taskId}:result`,
        result,
        task.assignedTo,
        'agent'
      );
    }

    this._emit(TeamEvent.TaskCompleted, { taskId, result });

    // Check if any pending tasks are now ready
    for (const pending of this._taskQueue) {
      if (pending.dependencies.includes(taskId)) {
        pending.status = TaskStatus.Ready;
        this.assignTask(pending.id);
      }
    }

    return true;
  }

  /** Fails a task. */
  failTask(taskId: string, error: string): boolean {
    const task = this._tasks.get(taskId);
    if (!task || task.status !== TaskStatus.Executing) {
      return false;
    }

    task.status = TaskStatus.Failed;
    task.completedAt = new Date().toISOString();
    this._metrics.tasksFailed++;

    this._emit(TeamEvent.TaskFailed, { taskId, error });

    // Update shared context with error
    if (task.assignedTo) {
      this._context.set(
        `task:${taskId}:error`,
        error,
        task.assignedTo,
        'agent'
      );
    }

    return true;
  }

  /** Gets all tasks. */
  getAllTasks(): DecomposedTask[] {
    return [...this._tasks.values()];
  }

  /** Gets tasks by status. */
  getTasksByStatus(status: TaskStatus): DecomposedTask[] {
    return [...this._tasks.values()].filter((t) => t.status === status);
  }

  // ======================================================================
  // Shared Context Access
  // ======================================================================

  /** Writes to shared context. */
  setContext(key: string, value: unknown, sourceAgentId?: string): ContextEntry | null {
    const entry = this._context.set(key, value, sourceAgentId ?? null);
    this._emit(TeamEvent.ContextUpdated, entry);
    return entry;
  }

  /** Reads from shared context. */
  getContext<T = unknown>(key: string): T | null {
    return this._context.get<T>(key);
  }

  /** Creates a team snapshot. */
  createSnapshot(): Snapshot {
    const snapshot = this._context.createSnapshot();
    this._snapshots.push(snapshot);
    this._emit(TeamEvent.SnapshotCreated, snapshot);
    return snapshot;
  }

  // ======================================================================
  // Metrics & Monitoring
  // ======================================================================

  /** Returns team summary. */
  getSummary(): Record<string, unknown> {
    const agents = [...this._assignments.values()].map((a) => ({
      agentId: a.agentId,
      role: a.role,
      displayName: a.displayName,
      state: (this._registry.get(a.agentId) as any)?.state ?? 'unknown',
    }));

    const allTasks = [...this._tasks.values()];
    const tasks = {
      total: allTasks.length,
      pending: allTasks.filter((t: DecomposedTask) => t.status === TaskStatus.Pending).length,
      ready: allTasks.filter((t: DecomposedTask) => t.status === TaskStatus.Ready).length,
      executing: allTasks.filter((t: DecomposedTask) => t.status === TaskStatus.Executing).length,
      completed: allTasks.filter((t: DecomposedTask) => t.status === TaskStatus.Completed).length,
      failed: allTasks.filter((t: DecomposedTask) => t.status === TaskStatus.Failed).length,
    };

    return {
      teamId: this.id,
      name: this.name,
      state: this._state,
      agents,
      tasks,
      context: {
        entryCount: this._context.entryCount,
        agentCount: this._context.agentCount,
        version: this._context.currentVersion,
      },
      metrics: this._metrics,
    };
  }

  // ======================================================================
  // Event Emission
  // ======================================================================

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

  // ======================================================================
  // Internal
  // ======================================================================

  private _createRootTask(description: string, requiredRole?: TeamRole): DecomposedTask {
    this._taskCounter++;
    return {
      id: `task-${this.id}-${this._taskCounter}`,
      parentId: null,
      description,
      requiredRole: requiredRole ?? TeamRole.Generalist,
      priority: 5,
      dependencies: [],
      status: TaskStatus.Pending,
      assignedTo: null,
      result: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
  }

  private _parseDecompositionResult(
    content: string,
    parentTaskId: string
  ): DecomposedTask[] {
    // In production, this would parse structured output from the architect.
    // For now, create a fallback task if parsing fails.
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    return lines
      .filter((line) => line.includes('-') || line.match(/\d+\./))
      .slice(0, 10) // Limit to 10 subtasks
      .map((line, i) => {
        this._taskCounter++;
        return {
          id: `task-${this.id}-${this._taskCounter}`,
          parentId: parentTaskId,
          description: line.replace(/^[-\d.]+\s*/, '').trim(),
          requiredRole: TeamRole.Worker,
          priority: 5 - i,
          dependencies: [parentTaskId],
          status: TaskStatus.Pending,
          assignedTo: null,
          result: null,
          createdAt: new Date().toISOString(),
          startedAt: null,
          completedAt: null,
        };
      });
  }

  private async _executeTask(task: DecomposedTask, agent: IAgent): Promise<void> {
    try {
      const result = await agent.generate(task.description);
      this.completeTask(task.id, result.content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.failTask(task.id, msg);
    }
  }

  private _updateMetrics(): void {
    const agents = [...this._assignments.values()];
    this._metrics.agentCount = agents.length;
    this._metrics.activeAgentCount = agents.filter(
      (a) => {
        const agent = this._registry.get(a.agentId);
        return agent != null;
      }
    ).length;
    this._metrics.contextEntryCount = this._context.entryCount;
    this._metrics.contextVersion = this._context.currentVersion;
  }

  private _updateAvgTaskCompletionTime(completionTime: number): void {
    const alpha = 0.1;
    if (this._metrics.avgTaskCompletionTimeMs === 0) {
      this._metrics.avgTaskCompletionTimeMs = completionTime;
    } else {
      this._metrics.avgTaskCompletionTimeMs =
        alpha * completionTime + (1 - alpha) * this._metrics.avgTaskCompletionTimeMs;
    }
  }
}