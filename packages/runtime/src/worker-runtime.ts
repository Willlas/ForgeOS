/**
 * WorkerRuntime - Per-worker lifecycle management with heartbeat, watchdog, and capacity tracking.
 *
 * The ExecutionRuntime manages workers through WorkerRuntime instances which provide:
 * - Health monitoring via heartbeat mechanism
 * - Automatic detection of unresponsive workers (watchdog)
 * - Capacity tracking and load distribution
 * - Graceful degradation and recovery
 * - Event-driven health status updates
 *
 * @module runtime/worker-runtime
 */

import type { IWorker, WorkerHealthStatus } from "./core/types/provider.js";

// ============================================================================
// Worker Runtime State
// ============================================================================

export enum WorkerRuntimeState {
  Initializing = "initializing",
  Online = "online",
  Degraded = "degraded",
  Offline = "offline",
  Error = "error",
}

// ============================================================================
// Heartbeat
// ============================================================================

export interface HeartbeatInfo {
  /** Last heartbeat timestamp (ISO 8601) */
  lastHeartbeat: string;
  /** Last heartbeat timestamp (epoch ms) */
  lastHeartbeatMs: number;
  /** Consecutive missed heartbeats */
  missedCount: number;
  /** Whether worker responded to latest heartbeat */
  responsive: boolean;
}

// ============================================================================
// Worker Runtime Metrics
// ============================================================================

export interface WorkerRuntimeMetrics {
  /** Total tasks executed */
  tasksExecuted: number;
  /** Tasks that succeeded */
  tasksSucceeded: number;
  /** Tasks that failed */
  tasksFailed: number;
  /** Average task duration in ms */
  avgTaskDurationMs: number;
  /** P95 task duration in ms */
  p95TaskDurationMs: number;
  /** Total uptime in ms */
  uptimeMs: number;
  /** Heartbeat miss rate (0-1) */
  heartbeatMissRate: number;
  /** Current capacity ratio (0-1) */
  capacityRatio: number;
}

// ============================================================================
// Worker Runtime Configuration
// ============================================================================

export interface WorkerRuntimeConfig {
  /** Worker ID to manage */
  workerId: string;
  /** Heartbeat interval in milliseconds (default: 5000) */
  heartbeatIntervalMs?: number;
  /** Watchdog timeout in milliseconds - if missed heartbeats exceed this, worker is dead (default: 3 * heartbeatInterval) */
  watchdogTimeoutMultiplier?: number;
  /** Degraded threshold - worker is degraded after this many consecutive misses (default: 1) */
  degradedThreshold?: number;
  /** Maximum tasks before forced idle (default: 100) */
  maxTasksBeforeIdle?: number;
  /** Idle timeout in ms - worker auto-idles after this (default: 300000 / 5min) */
  idleTimeoutMs?: number;
}

// ============================================================================
// WorkerRuntime Class
// ============================================================================

/**
 * Manages the lifecycle and health of a single IWorker instance.
 *
 * Provides:
 * - Heartbeat monitoring (periodic health checks)
 * - Watchdog (automatic dead worker detection)
 * - Capacity tracking
 * - State transitions
 * - Event emission
 */
export class WorkerRuntime {
  private _config: WorkerRuntimeConfig;
  private _worker: IWorker | null;
  private _state: WorkerRuntimeState;
  private _heartbeat: HeartbeatInfo;
  private _metrics: WorkerRuntimeMetrics;
  private _heartbeatTimer: number | null;
  private _idleTimer: number | null;
  private _listeners = new Map<string, Array<(data: unknown) => void>>();
  private _tasksExecuted = 0;
  private _taskDurations: number[];
  private readonly _maxTaskDurationsStored = 1000;

  constructor(config: WorkerRuntimeConfig) {
    this._config = config;
    this._worker = null;
    this._state = WorkerRuntimeState.Initializing;
    const now = Date.now();
    this._heartbeat = {
      lastHeartbeat: new Date(now).toISOString(),
      lastHeartbeatMs: now,
      missedCount: 0,
      responsive: true,
    };
    this._metrics = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      avgTaskDurationMs: 0,
      p95TaskDurationMs: 0,
      uptimeMs: 0,
      heartbeatMissRate: 0,
      capacityRatio: 0,
    };
    this._heartbeatTimer = null;
    this._idleTimer = null;
    this._taskDurations = [];
  }

  // ========================================================================
  // Properties
  // ========================================================================

  get config(): WorkerRuntimeConfig { return this._config; }
  get worker(): IWorker | null { return this._worker; }
  get state(): WorkerRuntimeState { return this._state; }
  get heartbeat(): HeartbeatInfo { return { ...this._heartbeat }; }
  get metrics(): WorkerRuntimeMetrics { return { ...this._metrics }; }
  get isOnline(): boolean {
    return this._state === WorkerRuntimeState.Online || this._state === WorkerRuntimeState.Degraded;
  }
  get capacityRatio(): number {
    if (!this._worker) return 0;
    const remaining = this._worker.remainingCapacity;
    const max = this._worker.maxConcurrency;
    return remaining / Math.max(max, 1);
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /** Attaches the underlying IWorker. */
  attach(worker: IWorker): void {
    this._worker = worker;
    this._emit("attached", { workerId: worker.id, workerName: worker.name });
  }

  /** Starts heartbeat monitoring. */
  async startHeartbeat(): Promise<void> {
    if (this._heartbeatTimer != null) {
      clearInterval(this._heartbeatTimer);
    }

    const interval = this._config.heartbeatIntervalMs ?? 5000;

    // Initial heartbeat
    await this._performHeartbeat();

    // Periodic heartbeat
    this._heartbeatTimer = globalThis.setInterval(() => this._performHeartbeat(), interval) as unknown as number;

    this._emit("heartbeatStarted", { workerId: this._config.workerId, interval });
  }

  /** Stops heartbeat monitoring. */
  stopHeartbeat(): void {
    if (this._heartbeatTimer != null) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    this._emit("heartbeatStopped", { workerId: this._config.workerId });
  }

  /** Starts the worker and begins monitoring. */
  async start(): Promise<void> {
    if (!this._worker) {
      throw new Error(`WorkerRuntime[${this._config.workerId}]: No worker attached`);
    }

    this._state = WorkerRuntimeState.Initializing;
    this._emit("stateChanged", { workerId: this._config.workerId, oldState: null, newState: this._state });

    try {
      await this._worker.start();
      this._state = WorkerRuntimeState.Online;
      this._metrics.uptimeMs = Date.now() - new Date(this._heartbeat.lastHeartbeat).getTime();

      this._emit("stateChanged", {
        workerId: this._config.workerId,
        oldState: WorkerRuntimeState.Initializing,
        newState: this._state,
      });

      // Start heartbeat monitoring
      await this.startHeartbeat();

      // Start idle timer
      this._startIdleTimer();
    } catch (error) {
      this._state = WorkerRuntimeState.Error;
      const msg = error instanceof Error ? error.message : String(error);
      this._emit("error", { workerId: this._config.workerId, error: msg });
      throw error;
    }
  }

  /** Stops the worker and cleanup. */
  async stop(): Promise<void> {
    this.stopHeartbeat();
    this._stopIdleTimer();

    if (this._worker) {
      try {
        await this._worker.stop();
      } catch {
        // Ignore stop errors
      }
    }

    const oldState = this._state;
    this._state = WorkerRuntimeState.Offline;
    this._worker = null;
    this._metrics.uptimeMs = Date.now() - new Date(this._heartbeat.lastHeartbeat).getTime();

    this._emit("stateChanged", { workerId: this._config.workerId, oldState, newState: this._state });
    this._emit("stopped", { workerId: this._config.workerId });
  }

  // ========================================================================
  // Heartbeat Mechanism
  // ========================================================================

  private async _performHeartbeat(): Promise<void> {
    const oldMissed = this._heartbeat.missedCount;

    if (!this._worker || !this._worker.isOnline) {
      // Worker is offline or detached
      this._heartbeat.missedCount++;
      this._heartbeat.responsive = false;
      this._heartbeat.lastHeartbeatMs = Date.now();
      this._heartbeat.lastHeartbeat = new Date().toISOString();

      // Check watchdog threshold
      const multiplier = this._config.watchdogTimeoutMultiplier ?? 3;
      if (this._heartbeat.missedCount >= multiplier) {
        await this._onWorkerDead();
      } else if (this._heartbeat.missedCount >= (this._config.degradedThreshold ?? 1)) {
        await this._onWorkerDegraded();
      }

      return;
    }

    try {
      const health = await this._worker.healthCheck();
      this._heartbeat.responsive = true;
      this._heartbeat.missedCount = 0;
      this._heartbeat.lastHeartbeatMs = Date.now();
      this._heartbeat.lastHeartbeat = new Date().toISOString();

      // Update state based on health
      if (health.status === "healthy" && this._state === WorkerRuntimeState.Degraded) {
        this._state = WorkerRuntimeState.Online;
        this._emit("recovered", { workerId: this._config.workerId });
      }

      this._emit("heartbeat", {
        workerId: this._config.workerId,
        responsive: true,
        health,
        missedCount: 0,
      });
    } catch {
      this._heartbeat.missedCount++;
      this._heartbeat.responsive = false;
      this._heartbeat.lastHeartbeatMs = Date.now();
      this._heartbeat.lastHeartbeat = new Date().toISOString();

      const multiplier = this._config.watchdogTimeoutMultiplier ?? 3;
      if (this._heartbeat.missedCount >= multiplier) {
        await this._onWorkerDead();
      } else if (this._heartbeat.missedCount >= (this._config.degradedThreshold ?? 1)) {
        await this._onWorkerDegraded();
      }
    }

    // Update heartbeat miss rate in metrics
    const totalHeartbeats = oldMissed + this._heartbeat.missedCount;
    this._metrics.heartbeatMissRate = totalHeartbeats > 0 ? this._heartbeat.missedCount / Math.max(totalHeartbeats, 1) : 0;
  }

  private async _onWorkerDegraded(): Promise<void> {
    if (this._state !== WorkerRuntimeState.Degraded) {
      this._state = WorkerRuntimeState.Degraded;
      this._emit("stateChanged", {
        workerId: this._config.workerId,
        oldState: WorkerRuntimeState.Online,
        newState: this._state,
      });
      this._emit("degraded", {
        workerId: this._config.workerId,
        missedCount: this._heartbeat.missedCount,
      });
    }
  }

  private async _onWorkerDead(): Promise<void> {
    if (this._state !== WorkerRuntimeState.Error) {
      this._state = WorkerRuntimeState.Error;
      this._emit("stateChanged", {
        workerId: this._config.workerId,
        oldState: this._state,
        newState: this._state,
      });
      this._emit("dead", {
        workerId: this._config.workerId,
        missedCount: this._heartbeat.missedCount,
      });

      // Try to recover the underlying worker
      if (this._worker) {
        try {
          await this._worker.stop();
          await this._worker.start();
          // If recovery succeeded
          this._heartbeat.missedCount = 0;
          this._state = WorkerRuntimeState.Online;
          this._emit("recovered", { workerId: this._config.workerId });
        } catch {
          // Recovery failed, keep Error state
          this._emit("recoveryFailed", { workerId: this._config.workerId });
        }
      }
    }
  }

  // ========================================================================
  // Idle Timer
  // ========================================================================

  private _startIdleTimer(): void {
    const idleTimeout = this._config.idleTimeoutMs ?? 300000;
    this._idleTimer = globalThis.setTimeout(() => this._onIdle(), idleTimeout) as unknown as number;
  }

  private _stopIdleTimer(): void {
    if (this._idleTimer != null) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  private _onIdle(): void {
    if (!this._worker) return;
    if (this._worker.activeTasks === 0 && this._state === WorkerRuntimeState.Online) {
      this._emit("idle", { workerId: this._config.workerId });
    }
  }

  private _resetIdleTimer(): void {
    this._stopIdleTimer();
    if (this._state === WorkerRuntimeState.Online || this._state === WorkerRuntimeState.Degraded) {
      this._startIdleTimer();
    }
  }

  // ========================================================================
  // Task Tracking
  // ========================================================================

  /** Records a completed task for metrics. */
  recordTask(durationMs: number, success: boolean): void {
    this._tasksExecuted++;
    if (success) {
      this._metrics.tasksSucceeded++;
    } else {
      this._metrics.tasksFailed++;
    }

    // Track duration (keep last N values)
    this._taskDurations.push(durationMs);
    if (this._taskDurations.length > this._maxTaskDurationsStored) {
      this._taskDurations.shift();
    }

    // Update averages
    const n = this._taskDurations.length;
    const sum = this._taskDurations.reduce((a, b) => a + b, 0);
    this._metrics.avgTaskDurationMs = sum / n;

    // P95
    const sorted = [...this._taskDurations].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this._metrics.p95TaskDurationMs = sorted[p95Index] ?? 0;

    this._metrics.tasksExecuted = this._tasksExecuted;
    this._resetIdleTimer();
    this._emit("taskRecorded", {
      workerId: this._config.workerId,
      durationMs,
      success,
      metrics: this._metrics,
    });
  }

  // ========================================================================
  // Execution
  // ========================================================================

  /** Executes a node via the underlying worker. */
  async execute(node: unknown): Promise<import("./core/types/provider.js").TaskExecutionResult> {
    if (!this._worker) {
      throw new Error(`WorkerRuntime[${this._config.workerId}]: No worker available`);
    }
    if (!this.isOnline) {
      throw new Error(`WorkerRuntime[${this._config.workerId}]: Worker is not online (state=${this._state})`);
    }

    const startTime = Date.now();
    try {
      const result = await this._worker.execute(node);
      this.recordTask(Date.now() - startTime, result.success);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordTask(duration, false);
      throw error;
    }
  }

  // ========================================================================
  // Health Check
  // ========================================================================

  /** Returns comprehensive health status. */
  healthCheck(): WorkerHealthStatus {
    if (!this._worker) {
      return {
        status: "unhealthy",
        error: "No worker attached",
        tasksSucceeded: this._metrics.tasksSucceeded,
        tasksFailed: this._metrics.tasksFailed,
      };
    }

    return {
      status: this._state === WorkerRuntimeState.Online ? "healthy"
        : this._state === WorkerRuntimeState.Degraded ? "degraded"
        : "unhealthy",
      uptimeMs: this._metrics.uptimeMs,
      tasksSucceeded: this._metrics.tasksSucceeded,
      tasksFailed: this._metrics.tasksFailed,
      memoryUsageBytes: undefined,
      cpuUsagePercent: undefined,
    };
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

// ============================================================================
// WorkerPool - Manages multiple WorkerRuntime instances
// ============================================================================

export interface WorkerPoolConfig {
  /** Pool name */
  name: string;
  /** Maximum pool size */
  maxSize?: number;
}

export enum WorkerPoolState {
  Initializing = "initializing",
  Ready = "ready",
  ShuttingDown = "shuttingDown",
  Shutdown = "shutdown",
}

/** Manages a pool of WorkerRuntime instances. */
export class WorkerPool {
  private _config: WorkerPoolConfig;
  private _workers = new Map<string, WorkerRuntime>();
  private _state: WorkerPoolState;
  private _roundRobinIndex = 0;
  private _listeners = new Map<string, Array<(data: unknown) => void>>();

  constructor(config: WorkerPoolConfig) {
    this._config = config;
    this._state = WorkerPoolState.Initializing;
  }

  get state(): WorkerPoolState { return this._state; }
  get size(): number { return this._workers.size; }
  get onlineCount(): number {
    return [...this._workers.values()].filter((w) => w.isOnline).length;
  }
  get workers(): ReadonlyArray<WorkerRuntime> {
    return [...this._workers.values()];
  }

  /** Adds a worker to the pool. */
  add(workerId: string, workerRuntime: WorkerRuntime): void {
    if (this._workers.has(workerId)) {
      throw new Error(`WorkerPool[${this._config.name}]: Worker ${workerId} already exists`);
    }
    this._workers.set(workerId, workerRuntime);
    this._emit("workerAdded", { workerId, pool: this._config.name });
  }

  /** Removes a worker from the pool. */
  remove(workerId: string): WorkerRuntime | null {
    const worker = this._workers.get(workerId);
    if (worker) {
      this._workers.delete(workerId);
      this._emit("workerRemoved", { workerId, pool: this._config.name });
    }
    return worker ?? null;
  }

  /** Gets a worker by ID. */
  get(workerId: string): WorkerRuntime | undefined {
    return this._workers.get(workerId);
  }

  /** Selects the next available worker using round-robin among healthy workers. */
  selectWorker(): WorkerRuntime | null {
    const ids = [...this._workers.keys()];
    if (ids.length === 0) return null;

    // First try online workers with capacity
    const candidates: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const idx = (this._roundRobinIndex + i) % ids.length;
      const worker = this._workers.get(ids[idx]);
      if (worker && worker.isOnline && worker.capacityRatio > 0) {
        candidates.push(ids[idx]);
      }
    }

    if (candidates.length === 0) return null;

    const selected = candidates[this._roundRobinIndex % candidates.length];
    this._roundRobinIndex = (this._roundRobinIndex + 1) % ids.length;
    return this._workers.get(selected) ?? null;
  }

  /** Starts all workers. */
  async startAll(): Promise<void> {
    const promises = [...this._workers.values()].map((w) => w.start());
    await Promise.all(promises);
    this._state = WorkerPoolState.Ready;
    this._emit("ready", { pool: this._config.name });
  }

  /** Stops all workers. */
  async stopAll(): Promise<void> {
    this._state = WorkerPoolState.ShuttingDown;
    const promises = [...this._workers.values()].map((w) => w.stop());
    await Promise.allSettled(promises);
    this._state = WorkerPoolState.Shutdown;
    this._emit("shutdown", { pool: this._config.name });
  }

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