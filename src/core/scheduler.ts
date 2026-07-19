/**
 * Scheduler - Core scheduling engine for the Autonomous Engineering Runtime.
 *
 * The Scheduler is responsible for:
 * - Maintaining a prioritized task queue
 * - Scoring work nodes by priority (dependency boost, recency, blocking penalty)
 * - Matching node capabilities to available workers/providers
 * - Dispatching tasks to workers
 * - Handling task completion, failure, and retries
 * - Emitting scheduling events via the Event Bus
 *
 * @module core/scheduler
 */

import { EventBus, type RuntimeEvent, type EventHandler } from "./eventbus.js";
import type { IWorker } from "./types/provider.js";
import { WorkNodeState } from "./types/work-graph.js";
import { DEFAULT_SCORING_CONFIG } from "./types/work-graph.js";
import type { WorkNode, WorkGraph, PriorityScore } from "./types/work-graph.js";

// ============================================================================
// Scheduler Event Types
// ============================================================================

/** Enum of event types produced by the Scheduler. */
export enum SchedulerEventType {
  TaskScheduled = "scheduler.task_scheduled",
  TaskDequeued = "scheduler.task_dequeued",
  TaskDispatched = "scheduler.task_dispatched",
  TaskCompleted = "scheduler.task_completed",
  TaskFailed = "scheduler.task_failed",
  TaskRetrying = "scheduler.task_retrying",
  TaskCancelled = "scheduler.task_cancelled",
  WorkerOnline = "scheduler.worker_online",
  WorkerOffline = "scheduler.worker_offline",
  WorkerHealthChanged = "scheduler.worker_health_changed",
  QueueStateChanged = "scheduler.queue_state_changed",
}

/** Types of scheduling decisions. */
export enum SchedulingDecision {
  Dispatch = "dispatch",
  Queue = "queue",
  Cancel = "cancel",
  Retry = "retry",
}

// ============================================================================
// Scheduler Configuration
// ============================================================================

export interface SchedulerConfig {
  /** Maximum number of tasks the scheduler can hold in its queue */
  maxQueueSize: number;
  /** Default retry limit for failed tasks */
  defaultRetryLimit: number;
  /** Scoring configuration (overrides defaults) */
  scoringConfig?: Partial<InternalPriorityScoringConfig>;
  /** Enable automatic dispatching to workers */
  autoDispatch: boolean;
  /** Dispatch interval in milliseconds (when autoDispatch is true) */
  dispatchIntervalMs: number;
}

/** Default scheduler configuration. */
export function createDefaultSchedulerConfig(): SchedulerConfig {
  return {
    maxQueueSize: 10_000,
    defaultRetryLimit: 3,
    scoringConfig: undefined,
    autoDispatch: true,
    dispatchIntervalMs: 2_000, // 2 seconds
  };
}

// ============================================================================
// Priority Scoring Configuration (extends workgraph types)
// ============================================================================

export interface InternalPriorityScoringConfig {
  basePriorityWeight: number;
  maxDependencyBoost: number;
  blockingPenalty: number;
  recencyHalfLifeMs: number;
}

// ============================================================================
// Scheduler Internal State
// ============================================================================

/** Represents a task in the scheduler's internal queue. */
interface ScheduledTask {
  /** The work node being scheduled */
  node: WorkNode;
  /** Computed priority score */
  score: PriorityScore;
  /** Number of retry attempts so far */
  attempt: number;
  /** Time when this task was added to the queue (milliseconds) */
  queuedAt: number;
}

/** Health status report for a managed worker. */
interface WorkerStatus {
  worker: IWorker;
  healthy: boolean;
  lastHealthCheck: string;
  tasksCompleted: number;
  tasksFailed: number;
}

// ============================================================================
// Scheduler - Main Class
// ============================================================================

export class Scheduler {
  private config: SchedulerConfig;
  private eventBus?: EventBus;

  /** All work graphs managed by this scheduler (by graph id -> graph). */
  private workGraphs: Map<string, WorkGraph>;

  /** The ready queue of tasks awaiting dispatch (ordered by priority score). */
  private taskQueue: ScheduledTask[];

  /** Currently executing tasks (task id -> task record). */
  private activeTasks: Map<string, ActiveTaskRecord>;

  /** Completed task records for history tracking. */
  private completedTasks: Map<string, CompletedTaskRecord>;

  /** Worker registry by worker id. */
  private workers: Map<string, WorkerStatus>;

  /** Whether the scheduler is running (dispatch loop active). */
  private isRunning: boolean;

  /** Dispatch interval timer ID. */
  private dispatchTimer?: ReturnType<typeof setInterval>;

  /** Internal event handler subscriptions (for cleanup). */
  private _eventHandlers: (() => void)[];

  /** Monotonic counter for task IDs. */
  private _taskCounter: number;

  // --- Metrics ---
  private _metrics: SchedulerMetrics;

  // --- Scoring ---
  private _scoringConfig: InternalPriorityScoringConfig;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = createDefaultSchedulerConfig();
    Object.assign(this.config, config);

    this.workGraphs = new Map();
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.completedTasks = new Map();
    this.workers = new Map();
    this.isRunning = false;
    this._eventHandlers = [];
    this._taskCounter = 0;

    this._scoringConfig = { ...(DEFAULT_SCORING_CONFIG as InternalPriorityScoringConfig), ...config?.scoringConfig };

    this._metrics = new SchedulerMetrics();
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /** Start the scheduler. */
  async start(eventBus: EventBus): Promise<void> {
    if (this.isRunning) {
      return; // Already running
    }

    this.eventBus = eventBus;
    this.isRunning = true;

    // Subscribe to lifecycle events
    this._subscribeToEventBus();

    // Start dispatch loop
    if (this.config.autoDispatch) {
      this.dispatchTimer = setInterval(() => this._dispatchTick(), this.config.dispatchIntervalMs);
    }

    this._emitSchedulerEvent(SchedulerEventType.QueueStateChanged, {
      queueSize: 0,
      activeCount: 0,
      status: "started",
    });

    console.log(`[Scheduler] Started (autoDispatch=${this.config.autoDispatch}, interval=${this.config.dispatchIntervalMs}ms)`);
  }

  /** Stop the scheduler gracefully. */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return; // Already stopped
    }

    this.isRunning = false;

    // Clear dispatch timer
    if (this.dispatchTimer) {
      clearInterval(this.dispatchTimer);
      this.dispatchTimer = undefined;
    }

    // Unsubscribe from event bus
    for (const handler of this._eventHandlers) {
      handler();
    }
    this._eventHandlers = [];

    // Wait for active tasks to complete (with timeout)
    await this._waitForActiveTasks(5000);

    this._emitSchedulerEvent(SchedulerEventType.QueueStateChanged, {
      queueSize: 0,
      activeCount: 0,
      status: "stopped",
    });

    console.log("[Scheduler] Stopped");
  }

  /** Get the current running state. */
  isRunningState(): boolean {
    return this.isRunning;
  }

  // ========================================================================
  // Work Graph Management
  // ========================================================================

  /** Register a work graph with the scheduler. */
  registerWorkGraph(graph: WorkGraph): void {
    if (this.workGraphs.has(graph.id)) {
      console.warn(`[Scheduler] Work graph "${graph.id}" already registered, updating.`);
    }
    this.workGraphs.set(graph.id, graph);

    // Seed the queue with initially ready nodes
    for (const node of graph.nodes.values()) {
      if (node.state === WorkNodeState.Ready) {
        this._enqueueNode(node);
      } else if (node.state === WorkNodeState.Planned) {
        // Also enqueue planned nodes (they'll be scored)
        this._enqueueNode(node);
      }
    }

    this._rebalanceQueue();
    console.log(`[Scheduler] Work graph "${graph.id}" registered with ${graph.nodes.size} nodes.`);
  }

  /** Unregister a work graph. */
  unregisterWorkGraph(graphId: string): void {
    const removed = this.workGraphs.delete(graphId);
    if (removed) {
      console.log(`[Scheduler] Work graph "${graphId}" unregistered.`);
    } else {
      console.warn(`[Scheduler] Work graph "${graphId}" was not registered.`);
    }
  }

  /** Get a registered work graph by id. */
  getWorkGraph(graphId: string): WorkGraph | undefined {
    return this.workGraphs.get(graphId);
  }

  /** Get all registered work graphs. */
  getAllWorkGraphs(): WorkGraph[] {
    return [...this.workGraphs.values()];
  }

  // ========================================================================
  // Worker Management
  // ========================================================================

  /** Add a worker to the registry. */
  addWorker(worker: IWorker): void {
    this.workers.set(worker.id, {
      worker,
      healthy: true,
      lastHealthCheck: new Date().toISOString(),
      tasksCompleted: 0,
      tasksFailed: 0,
    });

    this._emitSchedulerEvent(SchedulerEventType.WorkerOnline, {
      workerId: worker.id,
      workerName: worker.name,
      workerType: worker.type,
      maxConcurrency: worker.maxConcurrency,
      capabilities: worker.capabilities,
    });
  }

  /** Remove a worker from the registry. */
  removeWorker(workerId: string): void {
    const status = this.workers.get(workerId);
    if (status) {
      this._emitSchedulerEvent(SchedulerEventType.WorkerOffline, {
        workerId,
        workerName: status.worker.name,
      });

      // Re-queue any active tasks from this worker
      for (const [taskId, task] of this.activeTasks.entries()) {
        if (task.workerId === workerId) {
          this._reenqueueTask(task);
          this.activeTasks.delete(taskId);
        }
      }

      this.workers.delete(workerId);
    } else {
      console.warn(`[Scheduler] Worker "${workerId}" was not registered.`);
    }
  }

  /** Get a worker by id. */
  getWorker(workerId: string): IWorker | undefined {
    const status = this.workers.get(workerId);
    return status?.worker;
  }

  /** Get all registered workers. */
  getAllWorkers(): IWorker[] {
    return [...this.workers.values()].map((s) => s.worker);
  }

  /** Get the count of available workers. */
  getAvailableWorkerCount(): number {
    let count = 0;
    for (const status of this.workers.values()) {
      if (status.healthy && status.worker.activeTasks < status.worker.maxConcurrency) {
        count++;
      }
    }
    return count;
  }

  // ========================================================================
  // Task Scheduling Operations
  // ========================================================================

  /** Add a single node to the scheduler's queue. */
  scheduleNode(node: WorkNode): string {
    const taskId = this._generateTaskId();
    const taskRecord: ScheduledTask = {
      node,
      score: this._computePriorityScore(node),
      attempt: 0,
      queuedAt: Date.now(),
    };

    this.taskQueue.push(taskRecord);
    this._rebalanceQueue(); // Re-sort after insert

    this._emitSchedulerEvent(SchedulerEventType.TaskScheduled, {
      taskId,
      nodeId: node.id,
      nodeType: node.type,
      priority: node.priority,
      score: taskRecord.score.totalScore,
    });

    return taskId;
  }

  /** Add multiple nodes to the scheduler's queue. */
  scheduleNodes(nodes: WorkNode[]): string[] {
    return nodes.map((node) => this.scheduleNode(node));
  }

  /** Dequeue the highest-priority task for execution. Returns null if queue is empty. */
  dequeueTask(): ScheduledTask | null {
    if (this.taskQueue.length === 0) {
      return null;
    }

    // Find the best candidate: highest score, then earliest queued
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < this.taskQueue.length; i++) {
      const task = this.taskQueue[i];
      if (task.score.totalScore > bestScore) {
        bestScore = task.score.totalScore;
        bestIndex = i;
      }
    }

    const [task] = this.taskQueue.splice(bestIndex, 1);
    return task;
  }

  /** Cancel a task in the queue. Returns the cancelled node or null. */
  cancelTask(nodeId: string): WorkNode | null {
    const index = this.taskQueue.findIndex((t) => t.node.id === nodeId);
    if (index >= 0) {
      const [task] = this.taskQueue.splice(index, 1);
      task.node.state = WorkNodeState.Cancelled;
      this._emitSchedulerEvent(SchedulerEventType.TaskCancelled, {
        nodeId: task.node.id,
        reason: "manual_cancellation",
      });
      return task.node;
    }

    // Check active tasks
    for (const [taskId, record] of this.activeTasks.entries()) {
      if (record.nodeId === nodeId) {
        record.status = TaskStatus.Cancelled;
        this._emitSchedulerEvent(SchedulerEventType.TaskCancelled, {
          taskId,
          nodeId: record.nodeId,
          reason: "manual_cancellation",
        });
        // Find the node in the graph
        const graph = this._findGraphForNode(record.nodeId);
        if (graph) {
          const node = graph.nodes.get(record.nodeId);
          return node || null;
        }
        return null;
      }
    }

    return null;
  }

  /** Get the list of ready tasks (sorted by priority). */
  getReadyTasks(): ScheduledTask[] {
    // Sort by score descending, then by queuedAt ascending
    return [...this.taskQueue].sort((a, b) => {
      if (b.score.totalScore !== a.score.totalScore) {
        return b.score.totalScore - a.score.totalScore;
      }
      return a.queuedAt - b.queuedAt;
    });
  }

  /** Get active task records. */
  getActiveTasks(): ActiveTaskRecord[] {
    return [...this.activeTasks.values()].filter((t) => t.status === TaskStatus.Active);
  }

  /** Get completed task records (last N by default). */
  getCompletedTasks(limit?: number): CompletedTaskRecord[] {
    const all = [...this.completedTasks.values()];
    const sorted = all.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  // ========================================================================
  // Task Execution Coordination
  // ========================================================================

  /** Dispatch a task to a worker. */
  dispatchTask(task: ScheduledTask, workerId?: string): SchedulingDecision {
    // Check if worker is available
    const availableWorker = this._findAvailableWorker(workerId);
    if (!availableWorker) {
      // Queue it back and wait
      this.taskQueue.push(task);
      this._rebalanceQueue();
      return SchedulingDecision.Queue;
    }

    // Check if task has capabilities the worker can handle
    const taskNode = task.node;
    if (taskNode.requiredCapabilities.length > 0) {
      const hasCapability = availableWorker.worker.capabilities.some((cap) =>
        taskNode.requiredCapabilities.includes(cap)
      );
      if (!hasCapability && taskNode.requiredCapabilities.length > 0) {
        // Worker doesn't have required capabilities, queue and try another
        this.taskQueue.push(task);
        this._rebalanceQueue();
        return SchedulingDecision.Queue;
      }
    }

    const taskId = this._generateTaskId();
    const record: ActiveTaskRecord = {
      taskId,
      nodeId: taskNode.id,
      workerId: availableWorker.worker.id,
      priority: taskNode.priority,
      createdAt: new Date().toISOString(),
      status: TaskStatus.Active,
    };

    this.activeTasks.set(taskId, record);

    // Update node state
    const graph = this._findGraphForNode(taskNode.id);
    if (graph) {
      const node = graph.nodes.get(taskNode.id);
      if (node) {
        node.state = WorkNodeState.Running;
        node.startedAt = new Date().toISOString();
        node.assignedWorkerId = availableWorker.worker.id;
        node.executionHistory.push({
          attempt: 1,
          workerId: availableWorker.worker.id,
          providerName: "unknown",
          startedAt: new Date().toISOString(),
          finishedAt: "",
          durationMs: 0,
          costIncurred: 0,
          success: false,
        });
      }
    }

    this._emitSchedulerEvent(SchedulerEventType.TaskDispatched, {
      taskId,
      nodeId: taskNode.id,
      workerId: availableWorker.worker.id,
      priority: taskNode.priority,
    });

    this._metrics.increment("tasks_dispatched");

    return SchedulingDecision.Dispatch;
  }

  /** Handle a successful task completion. */
  completeTask(taskId: string, result: { success: boolean; artifacts?: string[]; cost?: number }): void {
    const record = this.activeTasks.get(taskId);
    if (!record) {
      console.warn(`[Scheduler] Task "${taskId}" not found for completion.`);
      return;
    }

    if (result.success) {
      record.status = TaskStatus.Completed;

      // Update node state
      const graph = this._findGraphForNode(record.nodeId);
      if (graph) {
        const node = graph.nodes.get(record.nodeId);
        if (node) {
          node.state = WorkNodeState.Completed;
          node.completedAt = new Date().toISOString();

          if (result.artifacts && result.artifacts.length > 0) {
            node.knowledgeGenerated.push(...result.artifacts);
          }
        }
      }

      // Update worker stats
      const workerStatus = this.workers.get(record.workerId);
      if (workerStatus) {
        workerStatus.tasksCompleted++;
        workerStatus.lastHealthCheck = new Date().toISOString();
      }

      this._metrics.increment("tasks_completed");
      this._metrics.histogramObserve("task_latency", Date.now() - new Date(record.createdAt).getTime());

      // Transition dependents to Ready
      this._unblockDependents(record.nodeId);

      this._emitSchedulerEvent(SchedulerEventType.TaskCompleted, {
        taskId,
        nodeId: record.nodeId,
        workerId: record.workerId,
        durationMs: Date.now() - new Date(record.createdAt).getTime(),
      });
    } else {
      // Task failed
      record.status = TaskStatus.Failed;

      // Check if we should retry
      const node = this._findNodeForTask(taskId);
      if (node) {
        const lastAttempt = node.executionHistory[node.executionHistory.length - 1];
        if (lastAttempt && lastAttempt.attempt < this.config.defaultRetryLimit) {
          // Schedule retry
          this.activeTasks.delete(taskId);
          const retryTask: ScheduledTask = {
            node,
            score: this._computePriorityScore(node),
            attempt: lastAttempt.attempt + 1,
            queuedAt: Date.now(),
          };
          node.state = WorkNodeState.Running;
          this.taskQueue.push(retryTask);
          this._rebalanceQueue();

          this._emitSchedulerEvent(SchedulerEventType.TaskRetrying, {
            taskId,
            nodeId: node.id,
            attempt: lastAttempt.attempt + 1,
            maxRetries: this.config.defaultRetryLimit,
          });

          this._metrics.increment("tasks_retrying");
        } else {
          // Max retries exceeded
          if (node) {
            node.state = WorkNodeState.Failed;

            const workerStatus = this.workers.get(record.workerId);
            if (workerStatus) {
              workerStatus.tasksFailed++;
            }
          }

          this.activeTasks.delete(taskId);

          this._emitSchedulerEvent(SchedulerEventType.TaskFailed, {
            taskId,
            nodeId: record.nodeId,
            workerId: record.workerId,
            reason: "max_retries_exceeded",
            attempt: lastAttempt?.attempt ?? 0,
          });

          this._metrics.increment("tasks_failed");
        }
      } else {
        this.activeTasks.delete(taskId);
        this._emitSchedulerEvent(SchedulerEventType.TaskFailed, {
          taskId,
          nodeId: record.nodeId,
          workerId: record.workerId,
          reason: "unknown",
        });
        this._metrics.increment("tasks_failed");
      }
    }
  }

  // ========================================================================
  // Scoring
  // ========================================================================

  /** Compute the priority score for a work node. */
  computePriorityScore(node: WorkNode): PriorityScore {
    return this._computePriorityScore(node);
  }

  /** Get current scoring configuration. */
  getScoringConfig(): InternalPriorityScoringConfig {
    return { ...this._scoringConfig };
  }

  /** Update the scoring configuration. */
  setScoringConfig(config: Partial<InternalPriorityScoringConfig>): void {
    Object.assign(this._scoringConfig, config);
  }

  // ========================================================================
  // Metrics & Stats
  // ============================================================================

  /** Get scheduler metrics snapshot. */
  getMetricsSnapshot(): SchedulerMetricsSnapshot {
    return this._metrics.snapshot();
  }

  /** Get a summary of the current scheduling state. */
  getSummary(): SchedulerSummary {
    let readyCount = 0;
    let runningCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;

    for (const graph of this.workGraphs.values()) {
      for (const node of graph.nodes.values()) {
        switch (node.state) {
          case WorkNodeState.Ready:
          case WorkNodeState.Planned:
            readyCount++;
            break;
          case WorkNodeState.Running:
            runningCount++;
            break;
          case WorkNodeState.Completed:
            completedCount++;
            break;
          case WorkNodeState.Failed:
            failedCount++;
            break;
          case WorkNodeState.Cancelled:
            cancelledCount++;
            break;
        }
      }
    }

    return {
      totalGraphs: this.workGraphs.size,
      queueSize: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      completedTasks: this.completedTasks.size,
      availableWorkers: this.getAvailableWorkerCount(),
      readyCount,
      runningCount,
      completedCount,
      failedCount,
      cancelledCount,
      totalNodes: this._totalNodeCount(),
      metrics: this.getMetricsSnapshot(),
    };
  }

  // ========================================================================
  // Internal: Dispatch Tick (runs periodically when autoDispatch is enabled)
  // ========================================================================

  private _dispatchTick(): void {
    // Dequeue and dispatch all available tasks
    while (this.taskQueue.length > 0) {
      const task = this.dequeueTask();
      if (!task) break;

      // Check if any worker has capacity
      let dispatched = false;
      for (const [workerId, status] of this.workers.entries()) {
        if (!status.healthy) continue;
        if (status.worker.activeTasks >= status.worker.maxConcurrency) continue;

        const decision = this.dispatchTask(task, workerId);
        if (decision === SchedulingDecision.Dispatch) {
          dispatched = true;
          break;
        }
      }

      if (!dispatched) {
        // No available workers, queue it back
        this.taskQueue.push(task);
        this._rebalanceQueue();
        break;
      }
    }
  }

  // ========================================================================
  // Internal: Event Bus Subscriptions
  // ========================================================================

  private _subscribeToEventBus(): void {
    if (!this.eventBus) return;

    // Subscribe to worker lifecycle events
    const workerHandler: EventHandler = (event) => {
      if (event.type.startsWith("worker.")) {
        this._handleWorkerEvent(event);
      }
    };
    this.eventBus.on(SchedulerEventType.WorkerOnline, workerHandler);
    this._eventHandlers.push(() => this.eventBus!.off(SchedulerEventType.WorkerOnline));

    // Subscribe to task completion events from other subsystems
    const taskCompletedHandler: EventHandler = (event) => {
      if (event.type.startsWith("task.completed")) {
        this.completeTask(event.payload as string, { success: true });
      }
    };
    this.eventBus.on(SchedulerEventType.TaskCompleted, taskCompletedHandler);
    this._eventHandlers.push(() => this.eventBus!.off(SchedulerEventType.TaskCompleted));
  }

  private _handleWorkerEvent(event: RuntimeEvent): void {
    // Delegate worker events to the appropriate handlers
    if (event.type === SchedulerEventType.WorkerOffline) {
      const payload = event.payload as any;
      if (payload && payload.workerId) {
        this.removeWorker(payload.workerId);
      }
    }
  }

  // ========================================================================
  // Internal: Helper Methods
  // ========================================================================

  private _enqueueNode(node: WorkNode): void {
    // Avoid duplicates
    const exists = this.taskQueue.some((t) => t.node.id === node.id);
    if (!exists) {
      this.taskQueue.push({
        node,
        score: this._computePriorityScore(node),
        attempt: 0,
        queuedAt: Date.now(),
      });
    }
  }

  private _rebalanceQueue(): void {
    // Sort by score descending, then by queuedAt ascending (FIFO for same score)
    this.taskQueue.sort((a, b) => {
      if (b.score.totalScore !== a.score.totalScore) {
        return b.score.totalScore - a.score.totalScore;
      }
      return a.queuedAt - b.queuedAt;
    });

    // Enforce max queue size
    if (this.taskQueue.length > this.config.maxQueueSize) {
      const removed = this.taskQueue.splice(this.config.maxQueueSize);
      for (const task of removed) {
        task.node.state = WorkNodeState.Cancelled;
        console.warn(`[Scheduler] Queue overflow: cancelled node "${task.node.id}"`);
      }
    }
  }

  private _findAvailableWorker(workerId?: string): WorkerStatus | null {
    if (workerId) {
      const status = this.workers.get(workerId);
      if (status && status.healthy && status.worker.activeTasks < status.worker.maxConcurrency) {
        return status;
      }
      return null;
    }

    // Find any available worker with capacity
    for (const [, status] of this.workers.entries()) {
      if (status.healthy && status.worker.activeTasks < status.worker.maxConcurrency) {
        // Prefer workers with lowest active task count (load balancing)
        return status;
      }
    }

    return null;
  }

  private _unblockDependents(nodeId: string): void {
    for (const graph of this.workGraphs.values()) {
      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      // Find all nodes that depend on this one
      for (const [otherNodeId, otherNode] of graph.nodes.entries()) {
        if (otherNode.dependencies.includes(nodeId) && otherNode.state === WorkNodeState.Waiting) {
          // Check if all dependencies are satisfied
          const allDepsSatisfied = otherNode.dependencies.every((depId) => {
            const depNode = graph.nodes.get(depId);
            return depNode?.state === WorkNodeState.Completed;
          });

          if (allDepsSatisfied) {
            otherNode.state = WorkNodeState.Ready;
            this._enqueueNode(otherNode);
            console.log(`[Scheduler] Unblocked node "${otherNodeId}" due to completion of "${nodeId}".`);
          }
        }
      }
    }
  }

  private _findGraphForNode(nodeId: string): WorkGraph | null {
    for (const graph of this.workGraphs.values()) {
      if (graph.nodes.has(nodeId)) {
        return graph;
      }
    }
    return null;
  }

  private _findNodeForTask(taskId: string): WorkNode | null {
    // Check active tasks first
    const activeRecord = this.activeTasks.get(taskId);
    if (activeRecord) {
      return this._findGraphForNode(activeRecord.nodeId)?.nodes.get(activeRecord.nodeId) ?? null;
    }

    // Check completed tasks
    const completedRecord = this.completedTasks.get(taskId);
    if (completedRecord) {
      return this._findGraphForNode(completedRecord.nodeId)?.nodes.get(completedRecord.nodeId) ?? null;
    }

    return null;
  }

  private _waitForActiveTasks(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        if (this.activeTasks.size === 0 || Date.now() >= deadline) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private _generateTaskId(): string {
    this._taskCounter++;
    return `task-${this._taskCounter}`;
  }

  private _emitSchedulerEvent(eventType: string, payload: unknown): void {
    if (this.eventBus) {
      try {
        this.eventBus.publish(eventType, payload, { source: "core.scheduler" });
      } catch (err) {
        console.error(`[Scheduler] Failed to emit event ${eventType}:`, err);
      }
    }
  }

  private _totalNodeCount(): number {
    let count = 0;
    for (const graph of this.workGraphs.values()) {
      count += graph.nodes.size;
    }
    return count;
  }

  /** Compute the priority score for a work node. */
  private _computePriorityScore(node: WorkNode): PriorityScore {
    let basePriority = node.priority / 10; // Normalize to 0-1

    // Dependency boost: nodes with more dependents get boosted
    let dependencyBoost = 0;
    for (const graph of this.workGraphs.values()) {
      for (const [, otherNode] of graph.nodes.entries()) {
        if (otherNode.dependencies.includes(node.id)) {
          dependencyBoost += 1.0 / (graph.nodes.size * 2); // Normalize by graph size
        }
      }
    }
    dependencyBoost = Math.min(dependencyBoost, this._scoringConfig.maxDependencyBoost);

    // Blocking penalty: waiting/blocked nodes get penalized
    let blockingDecay = 0;
    if (node.state === WorkNodeState.Blocked || node.state === WorkNodeState.Waiting) {
      blockingDecay = this._scoringConfig.blockingPenalty;
    }

    // Recency bonus: newer ready nodes get slight bonus
    const now = Date.now();
    const nodeAge = now - new Date(node.createdAt).getTime();
    const recencyBonus = Math.exp(-this._scoringConfig.recencyHalfLifeMs / Math.max(nodeAge, 1)) * 0.5;

    // Compute total score
    const totalScore =
      (basePriority * this._scoringConfig.basePriorityWeight) +
      dependencyBoost -
      blockingDecay +
      recencyBonus;

    return {
      basePriority: Math.round(basePriority * 10) / 10,
      dependencyBoost: Math.round(dependencyBoost * 1000) / 1000,
      blockingDecay: Math.round(blockingDecay * 1000) / 1000,
      recencyBonus: Math.round(recencyBonus * 1000) / 1000,
      totalScore: Math.round(totalScore * 1000) / 1000,
    };
  }

  /** Re-enqueue a task from active tasks back to the queue (for worker failure). */
  private _reenqueueTask(task: ActiveTaskRecord): void {
    const graph = this._findGraphForNode(task.nodeId);
    if (graph) {
      const node = graph.nodes.get(task.nodeId);
      if (node) {
        node.state = WorkNodeState.Ready;
        this._enqueueNode(node);
      }
    }
  }

}

// ============================================================================
// Supporting Types & Classes
// ============================================================================

/** Task execution status. */
export enum TaskStatus {
  Active = "active",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  Timeout = "timeout",
}

/** Record of an active task assigned to a worker. */
export interface ActiveTaskRecord {
  taskId: string;
  nodeId: string;
  workerId: string;
  priority: number;
  createdAt: string;
  status: TaskStatus;
}

/** Record of a completed task for history tracking. */
export interface CompletedTaskRecord extends ActiveTaskRecord {
  status: TaskStatus.Completed | TaskStatus.Failed | TaskStatus.Cancelled;
  completedAt: string;
  durationMs?: number;
  costIncurred?: number;
  errorMessage?: string;
}

/** Scheduler metrics. */
export class SchedulerMetrics {
  private _counters = new Map<string, number>();
  private _histograms = new Map<string, number[]>();
  private _startTimestamp: number;

  constructor() {
    this._startTimestamp = Date.now();
  }

  increment(name: string): void {
    this._counters.set(name, (this._counters.get(name) ?? 0) + 1);
  }

  histogramObserve(name: string, value: number): void {
    const arr = this._histograms.get(name) ?? [];
    arr.push(value);
    // Keep last 1000 observations
    if (arr.length > 1000) {
      this._histograms.set(name, arr.slice(-500));
    }
  }

  snapshot(): SchedulerMetricsSnapshot {
    const counters = Object.fromEntries(this._counters);
    const histograms: Record<string, HistogramSummary> = {};
    for (const [name, values] of this._histograms.entries()) {
      if (values.length === 0) {
        histograms[name] = { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };
      } else {
        const sorted = [...values].sort((a, b) => a - b);
        histograms[name] = {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)],
          count: sorted.length,
        };
      }
    }

    return {
      counters,
      histograms,
      uptimeMs: Date.now() - this._startTimestamp,
    };
  }
}

export interface SchedulerMetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
  uptimeMs: number;
}

export interface HistogramSummary {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

/** Scheduler summary statistics. */
export interface SchedulerSummary {
  totalGraphs: number;
  queueSize: number;
  activeTasks: number;
  completedTasks: number;
  availableWorkers: number;
  readyCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  totalNodes: number;
  metrics: SchedulerMetricsSnapshot;
}

// ============================================================================
// Factory Function
// ============================================================================

/** Create a new Scheduler instance. */
export function createScheduler(config?: Partial<SchedulerConfig>): Scheduler {
  return new Scheduler(config);
}