/**
 * Dispatcher - Runtime-level task dispatcher for the Autonomous Engineering Runtime.
 *
 * The Dispatcher bridges the Scheduler and Workers, providing:
 * - Task routing based on worker capabilities
 * - Worker lifecycle management (registration, health monitoring)
 * - Capability-based selection and load balancing
 * - Retry policy enforcement
 * - Failure propagation
 * - Cancellation support
 * - Runtime metrics integration
 * - Runtime logging integration
 *
 * @module runtime/dispatcher
 */

// eventbus types for dispatcher integration
interface EventBus {
  publish(eventType: string, payload: unknown, metadata?: Record<string, string>): void;
}
import { WorkerStatus } from "../core/types/provider.js";
import type { IWorker } from "../core/types/provider.js";
import { WorkNodeState } from "../core/workgraph.js";
import type { WorkNode } from "../core/workgraph.js";
import { MetricsCollector, Counter, Gauge, Histogram } from "../core/metrics.js";
import { LogManager, LogLevel } from "../core/logging.js";
// ============================================================================
// Task interface (local definition to avoid circular imports)
// ============================================================================

interface DispatcherScheduledTask {
  node: import("../core/workgraph.js").WorkNode;
}

// ============================================================================
// Dispatcher State
// ============================================================================

export enum DispatcherState {
  Initializing = "initializing",
  Running = "running",
  Pausing = "pausing",
  Paused = "paused",
  Stopping = "stopping",
  Stopped = "stopped",
  Error = "error",
}

// ============================================================================
// Dispatcher Configuration
// ============================================================================

export interface DispatcherConfig {
  /** Name of the dispatcher */
  name: string;
  /** Maximum retry attempts for failed tasks */
  maxRetries: number;
  /** Initial retry delay in milliseconds */
  retryDelayMs: number;
  /** Enable exponential backoff for retries */
  retryBackoffEnabled: boolean;
  /** Backoff multiplier */
  retryBackoffMultiplier: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs: number;
  /** Task timeout in milliseconds */
  taskTimeoutMs: number;
  /** Worker health check interval in milliseconds */
  workerHealthCheckIntervalMs: number;
  /** Enable automatic worker registration from providers */
  autoRegisterWorkers: boolean;
  /** Load balancing strategy */
  loadBalancingStrategy: LoadBalancingStrategy;
  /** Failure propagation mode */
  failurePropagation: FailurePropagationMode;
  /** Enable cancellation propagation */
  cancellationPropagation: boolean;
  /** Metrics collection */
  metricsEnabled: boolean;
  /** Logging configuration */
  logLevel: LogLevel;
}

export enum LoadBalancingStrategy {
  LeastConnections = "least_connections",
  RoundRobin = "round_robin",
  CapabilityMatch = "capability_match",
  Random = "random",
}

export enum FailurePropagationMode {
  None = "none",
  Upstream = "upstream",
  Downstream = "downstream",
  Both = "both",
}

export function createDefaultDispatcherConfig(overrides?: Partial<DispatcherConfig>): DispatcherConfig {
  return {
    name: "default-dispatcher",
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffEnabled: true,
    retryBackoffMultiplier: 2,
    maxRetryDelayMs: 30000,
    taskTimeoutMs: 300_000, // 5 minutes
    workerHealthCheckIntervalMs: 15_000,
    autoRegisterWorkers: true,
    loadBalancingStrategy: LoadBalancingStrategy.LeastConnections,
    failurePropagation: FailurePropagationMode.Both,
    cancellationPropagation: true,
    metricsEnabled: true,
    logLevel: LogLevel.Info,
    ...overrides,
  };
}

// ============================================================================
// Worker Registry
// ============================================================================

export interface WorkerRegistration {
  worker: IWorker;
  registeredAt: string;
  lastHealthCheck: string;
  healthy: boolean;
  tasksCompleted: number;
  tasksFailed: number;
  tasksCancelled: number;
  totalExecutionTimeMs: number;
}

export interface WorkerPool {
  name: string;
  workers: Map<string, WorkerRegistration>;
  createdAt: string;
}

class WorkerRegistry {
  private pools: Map<string, WorkerPool> = new Map();

  getOrCreatePool(poolName: string): WorkerPool {
    let pool = this.pools.get(poolName);
    if (!pool) {
      pool = {
        name: poolName,
        workers: new Map(),
        createdAt: new Date().toISOString(),
      };
      this.pools.set(poolName, pool);
    }
    return pool;
  }

  register(worker: IWorker, poolName = "default"): WorkerRegistration {
    const pool = this.getOrCreatePool(poolName);
    const registration: WorkerRegistration = {
      worker,
      registeredAt: new Date().toISOString(),
      lastHealthCheck: new Date().toISOString(),
      healthy: true,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksCancelled: 0,
      totalExecutionTimeMs: 0,
    };
    pool.workers.set(worker.id, registration);
    return registration;
  }

  unregister(workerId: string, poolName = "default"): boolean {
    const pool = this.pools.get(poolName);
    if (!pool) return false;
    return pool.workers.delete(workerId);
  }

  get(workerId: string, poolName?: string): WorkerRegistration | undefined {
    if (poolName) {
      const pool = this.pools.get(poolName);
      if (pool) {
        return pool.workers.get(workerId);
      }
    }
    // Search all pools
    for (const pool of this.pools.values()) {
      const worker = pool.workers.get(workerId);
      if (worker) return worker;
    }
    return undefined;
  }

  getAll(healthyOnly = false): WorkerRegistration[] {
    const result: WorkerRegistration[] = [];
    for (const pool of this.pools.values()) {
      for (const worker of pool.workers.values()) {
        if (healthyOnly && !worker.healthy) continue;
        if (healthyOnly && !worker.worker.isOnline) continue;
        if (healthyOnly && worker.worker.activeTasks >= worker.worker.maxConcurrency) continue;
        result.push(worker);
      }
    }
    return result;
  }

  getByName(poolName: string): WorkerPool | undefined {
    return this.pools.get(poolName);
  }

  getPools(): string[] {
    return [...this.pools.keys()];
  }

  updateHealth(workerId: string, poolName: string, healthy: boolean): void {
    const pool = this.pools.get(poolName);
    if (pool) {
      const worker = pool.workers.get(workerId);
      if (worker) {
        worker.healthy = healthy;
        worker.lastHealthCheck = new Date().toISOString();
      }
    }
  }
}

// ============================================================================
// Task Routing
// ============================================================================

export interface RoutingDecision {
  selectedWorkerId: string;
  strategy: LoadBalancingStrategy;
  reason: string;
  poolName: string;
}

export interface TaskRoute {
  taskId: string;
  nodeId: string;
  workerId: string;
  poolName: string;
  routedAt: string;
  status: TaskRouteStatus;
}

export enum TaskRouteStatus {
  Pending = "pending",
  Dispatched = "dispatched",
  Completed = "completed",
  Failed = "failed",
  Cancelled = "cancelled",
  Retrying = "retrying",
}

class TaskRouter {
  private routes: Map<string, TaskRoute> = new Map();

  createRoute(taskId: string, nodeId: string, workerId: string, poolName: string): TaskRoute {
    const route: TaskRoute = {
      taskId,
      nodeId,
      workerId,
      poolName,
      routedAt: new Date().toISOString(),
      status: TaskRouteStatus.Pending,
    };
    this.routes.set(taskId, route);
    return route;
  }

  updateStatus(taskId: string, status: TaskRouteStatus): void {
    const route = this.routes.get(taskId);
    if (route) {
      route.status = status;
    }
  }

  get(taskId: string): TaskRoute | undefined {
    return this.routes.get(taskId);
  }

  getByWorker(workerId: string): TaskRoute[] {
    const result: TaskRoute[] = [];
    for (const route of this.routes.values()) {
      if (route.workerId === workerId && route.status === TaskRouteStatus.Dispatched) {
        result.push(route);
      }
    }
    return result;
  }

  getByNode(nodeId: string): TaskRoute[] {
    const result: TaskRoute[] = [];
    for (const route of this.routes.values()) {
      if (route.nodeId === nodeId) {
        result.push(route);
      }
    }
    return result;
  }

  getAll(): TaskRoute[] {
    return [...this.routes.values()];
  }
}

// ============================================================================
// Retry Policy Engine
// ============================================================================

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

export interface RetryRecord {
  attempt: number;
  delayMs: number;
  nextRetryAt: string;
  lastError?: string;
}

class RetryPolicyEngine {
  private policies: Map<string, RetryPolicy> = new Map();

  getDefaultPolicy(): RetryPolicy {
    return {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ["timeout", "connection_error", "rate_limit", "internal_error"],
    };
  }

  setPolicy(taskType: string, policy: RetryPolicy): void {
    this.policies.set(taskType, policy);
  }

  getPolicy(taskType: string): RetryPolicy {
    return this.policies.get(taskType) ?? this.getDefaultPolicy();
  }

  computeRetryDelay(policy: RetryPolicy, attempt: number): number {
    let delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, policy.maxDelayMs);

    if (policy.jitter) {
      // Add random jitter (+/-25%)
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.round(delay);
  }

  shouldRetry(policy: RetryPolicy, attempt: number, error?: string): boolean {
    if (attempt >= policy.maxAttempts) return false;
    if (!error || policy.retryableErrors.length === 0) return true;
    return policy.retryableErrors.some((err) => error.toLowerCase().includes(err.toLowerCase()));
  }
}

// ============================================================================
// Worker Selection Strategy
// ============================================================================

class WorkerSelector {
  select(
    workers: WorkerRegistration[],
    strategy: LoadBalancingStrategy,
    requiredCapabilities?: string[]
  ): WorkerRegistration | null {
    // Filter by capabilities if specified
    let candidates = workers;
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      candidates = workers.filter((w) =>
        w.worker.canExecute(requiredCapabilities)
      );
    }

    // Filter online and healthy
    candidates = candidates.filter((w) => w.worker.isOnline && w.healthy);

    if (candidates.length === 0) return null;

    switch (strategy) {
      case LoadBalancingStrategy.LeastConnections:
        return this.leastConnections(candidates);
      case LoadBalancingStrategy.RoundRobin:
        return this.roundRobin(candidates);
      case LoadBalancingStrategy.CapabilityMatch:
        return this.capabilityMatch(candidates, requiredCapabilities ?? []);
      case LoadBalancingStrategy.Random:
        return candidates[Math.floor(Math.random() * candidates.length)];
      default:
        return this.leastConnections(candidates);
    }
  }

  private leastConnections(candidates: WorkerRegistration[]): WorkerRegistration {
    let best = candidates[0];
    for (const candidate of candidates) {
      if (candidate.worker.activeTasks < best.worker.activeTasks) {
        best = candidate;
      }
    }
    return best;
  }

  private roundRobin(candidates: WorkerRegistration[]): WorkerRegistration {
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  private capabilityMatch(
    candidates: WorkerRegistration[],
    requiredCapabilities: string[]
  ): WorkerRegistration {
    // Prefer workers with the most matching capabilities
    let best = candidates[0];
    let bestScore = -1;

    for (const candidate of candidates) {
      const score = candidate.worker.capabilities.filter((c) =>
        requiredCapabilities.includes(c)
      ).length;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return bestScore > 0 ? best : candidates[0];
  }
}

// ============================================================================
// Dispatcher Metrics
// ============================================================================

export interface DispatcherMetrics {
  tasksDispatched: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksCancelled: number;
  tasksRetried: number;
  avgRoutingTimeMs: number;
  avgTaskDurationMs: number;
  activeWorkerCount: number;
  healthyWorkerCount: number;
  totalWorkerCount: number;
}

class DispatcherMetricsCollector {
  private collector?: MetricsCollector;
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();
  private started = false;

  initialize(metricsCollector?: MetricsCollector): void {
    if (metricsCollector) {
      this.collector = metricsCollector;
      this.started = true;
    }
  }

  start(): void {
    if (!this.started) {
      this.collector = new MetricsCollector();
      this.collector.start();
      this.started = true;

      const defaultCounters = [
        "dispatcher_tasks_dispatched_total",
        "dispatcher_tasks_completed_total",
        "dispatcher_tasks_failed_total",
        "dispatcher_tasks_cancelled_total",
        "dispatcher_tasks_retried_total",
      ];
      for (const name of defaultCounters) {
        this.counters.set(name, new Counter({ name, description: `Dispatcher metric: ${name}` }));
      }

      const defaultGauges = [
        { name: "dispatcher_active_workers", desc: "Active worker count" },
        { name: "dispatcher_healthy_workers", desc: "Healthy worker count" },
        { name: "dispatcher_pending_tasks", desc: "Pending tasks in queue" },
        { name: "dispatcher_total_workers", desc: "Total registered workers" },
      ];
      for (const g of defaultGauges) {
        this.gauges.set(g.name, new Gauge({ name: g.name, description: g.desc }));
      }

      this.histograms.set("dispatcher_routing_time_ms", new Histogram({ name: "dispatcher_routing_time_ms", description: "Task routing time in ms" }));
      this.histograms.set("dispatcher_task_duration_ms", new Histogram({ name: "dispatcher_task_duration_ms", description: "Task execution duration in ms" }));
    }
  }

  stop(): void {
    if (this.collector) {
      this.collector.stop();
      this.started = false;
    }
  }

  incrementCounter(name: string, value: number = 1): void {
    if (!this.started) return;
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter({ name, description: `Dispatcher metric: ${name}` });
      this.counters.set(name, counter);
    }
    counter.inc(value);

    if (this.collector) {
      const existing = this.collector.counter({ name, description: `Dispatcher metric: ${name}` });
      existing.inc(value);
    }
  }

  setGauge(name: string, value: number): void {
    if (!this.started) return;
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = new Gauge({ name, description: `Dispatcher metric: ${name}` });
      this.gauges.set(name, gauge);
    }
    gauge.set(value);

    if (this.collector) {
      const existing = this.collector.gauge({ name, description: `Dispatcher metric: ${name}` });
      existing.set(value);
    }
  }

  observeHistogram(name: string, value: number): void {
    if (!this.started) return;
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = new Histogram({ name, description: `Dispatcher metric: ${name}` });
      this.histograms.set(name, histogram);
    }
    histogram.observe(value);

    if (this.collector) {
      const existing = this.collector.histogram({ name, description: `Dispatcher metric: ${name}` });
      existing.observe(value);
    }
  }

  getMetrics(): DispatcherMetrics {
    const tasksDispatched = this.counters.get("dispatcher_tasks_dispatched_total")?.get() ?? 0;
    const tasksCompleted = this.counters.get("dispatcher_tasks_completed_total")?.get() ?? 0;
    const tasksFailed = this.counters.get("dispatcher_tasks_failed_total")?.get() ?? 0;
    const tasksCancelled = this.counters.get("dispatcher_tasks_cancelled_total")?.get() ?? 0;
    const tasksRetried = this.counters.get("dispatcher_tasks_retried_total")?.get() ?? 0;

    const routingHist = this.histograms.get("dispatcher_routing_time_ms");
    const durationHist = this.histograms.get("dispatcher_task_duration_ms");
    const activeGauge = this.gauges.get("dispatcher_active_workers");
    const healthyGauge = this.gauges.get("dispatcher_healthy_workers");
    const totalGauge = this.gauges.get("dispatcher_total_workers");

    return {
      tasksDispatched,
      tasksCompleted,
      tasksFailed,
      tasksCancelled,
      tasksRetried,
      avgRoutingTimeMs: routingHist ? routingHist.getValue().mean : 0,
      avgTaskDurationMs: durationHist ? durationHist.getValue().mean : 0,
      activeWorkerCount: activeGauge?.get() ?? 0,
      healthyWorkerCount: healthyGauge?.get() ?? 0,
      totalWorkerCount: totalGauge?.get() ?? 0,
    };
  }
}

// ============================================================================
// Dispatcher Event Types
// ============================================================================

export enum DispatcherEventType {
  WorkerRegistered = "dispatcher.worker_registered",
  WorkerUnregistered = "dispatcher.worker_unregistered",
  WorkerHealthChanged = "dispatcher.worker_health_changed",
  TaskDispatched = "dispatcher.task_dispatched",
  TaskCompleted = "dispatcher.task_completed",
  TaskFailed = "dispatcher.task_failed",
  TaskRetrying = "dispatcher.task_retrying",
  TaskCancelled = "dispatcher.task_cancelled",
  TaskTimedOut = "dispatcher.task_timed_out",
  WorkerPoolStateChanged = "dispatcher.worker_pool_state_changed",
  RetryPolicyApplied = "dispatcher.retry_policy_applied",
}

export interface DispatcherHealth {
  healthy: boolean;
  state: DispatcherState;
  uptimeMs: number;
  startedAt: string;
  components: {
    workerRegistry: boolean;
    taskRouter: boolean;
    retryEngine: boolean;
    metricsCollector: boolean;
  };
  workers: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  tasks: {
    dispatched: number;
    completed: number;
    failed: number;
    pending: number;
  };
  errors: string[];
}

// ============================================================================
// Dispatcher - Main Class
// ============================================================================

/**
 * The Dispatcher routes tasks from the scheduler to available workers.
 *
 * It manages worker lifecycle, implements retry policies, handles failure
 * propagation, and integrates metrics and logging.
 */
export class Dispatcher {
  private config: DispatcherConfig;
  private state: DispatcherState;
  private startedAt: string;

  // Core components
  private eventBus?: EventBus;
  private logManager?: LogManager;
  private workerRegistry = new WorkerRegistry();
  private taskRouter = new TaskRouter();
  private retryEngine = new RetryPolicyEngine();
  private workerSelector = new WorkerSelector();
  private metricsCollector = new DispatcherMetricsCollector();

  // Timers
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private timeoutTimer: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Internal logger
  private readonly selfLogger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };

  constructor(config?: Partial<DispatcherConfig>) {
    this.config = createDefaultDispatcherConfig(config);
    this.state = DispatcherState.Stopped;
    this.startedAt = "";
    this.selfLogger = {
      info: (msg: string) => console.info(`[Dispatcher] ${msg}`),
      error: (msg: string) => console.error(`[Dispatcher] ${msg}`),
      warn: (msg: string) => console.warn(`[Dispatcher] ${msg}`),
    };
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /** Start the Dispatcher. */
  async start(eventBus?: EventBus, logManager?: LogManager, _metricsCollector?: MetricsCollector): Promise<void> {
    if (this.state !== DispatcherState.Stopped) {
      return;
    }

    this.state = DispatcherState.Initializing;
    this.eventBus = eventBus;
    this.logManager = logManager;
    this.startedAt = new Date().toISOString();

    try {
      await this.logDispatcher("info", "Starting Dispatcher...");

      // Initialize metrics
      if (this.config.metricsEnabled) {
        this.metricsCollector.start();
      }

      // Start worker health checks
      this.startWorkerHealthChecks();

      this.state = DispatcherState.Running;
      await this.logDispatcher("info", `Dispatcher "${this.config.name}" started successfully.`);

      this._emitEvent(DispatcherEventType.WorkerPoolStateChanged, {
        state: "running" as const,
        workerCount: this.workerRegistry.getAll().length,
      });
    } catch (error) {
      this.state = DispatcherState.Error;
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logDispatcher("error", `Failed to start Dispatcher: ${errMsg}`);
      throw error;
    }
  }

  /** Stop the Dispatcher gracefully. */
  async stop(): Promise<void> {
    if (this.state === DispatcherState.Stopped || this.state === DispatcherState.Stopping) {
      return;
    }

    this.state = DispatcherState.Stopping;
    await this.logDispatcher("info", "Stopping Dispatcher...");

    // Stop health checks
    this.stopWorkerHealthChecks();

    // Cancel all pending task timeouts
    for (const timerKey of this.timeoutTimer.keys()) {
      clearTimeout(this.timeoutTimer.get(timerKey)!);
    }
    this.timeoutTimer.clear();

    // Stop metrics
    if (this.config.metricsEnabled) {
      this.metricsCollector.stop();
    }

    this.state = DispatcherState.Stopped;
    await this.logDispatcher("info", "Dispatcher stopped.");

    this._emitEvent(DispatcherEventType.WorkerPoolStateChanged, {
      state: "stopped" as const,
    });
  }

  /** Pause the Dispatcher (pause task dispatching). */
  async pause(): Promise<void> {
    if (this.state !== DispatcherState.Running) return;
    this.state = DispatcherState.Paused;
    this.stopWorkerHealthChecks();
    await this.logDispatcher("info", "Dispatcher paused.");
  }

  /** Resume the Dispatcher. */
  async resume(): Promise<void> {
    if (this.state !== DispatcherState.Paused) return;
    this.state = DispatcherState.Running;
    this.startWorkerHealthChecks();
    await this.logDispatcher("info", "Dispatcher resumed.");
  }

  /** Get the current state. */
  getState(): DispatcherState {
    return this.state;
  }

  /** Get configuration. */
  getConfig(): DispatcherConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Worker Management
  // ========================================================================

  /** Register a worker in the default pool. */
  registerWorker(worker: IWorker, poolName = "default"): WorkerRegistration {
    const registration = this.workerRegistry.register(worker, poolName);

    void this.logDispatcher("info", `Worker "${worker.id}" registered in pool "${poolName}".`);

    this._emitEvent(DispatcherEventType.WorkerRegistered, {
      workerId: worker.id,
      workerName: worker.name,
      workerType: worker.type,
      poolName,
      capabilities: worker.capabilities,
      maxConcurrency: worker.maxConcurrency,
    });

    if (this.config.metricsEnabled) {
      this.metricsCollector.incrementCounter("dispatcher_total_workers", 1);
      this.metricsCollector.setGauge("dispatcher_total_workers", this.workerRegistry.getAll().length);
      this.metricsCollector.setGauge("dispatcher_healthy_workers", this.workerRegistry.getAll(true).length);
    }

    return registration;
  }

  /** Unregister a worker from the default pool. */
  unregisterWorker(workerId: string, poolName = "default"): boolean {
    const existed = this.workerRegistry.unregister(workerId, poolName);
    if (existed) {
      void this.logDispatcher("info", `Worker "${workerId}" unregistered from pool "${poolName}".`);

      this._emitEvent(DispatcherEventType.WorkerUnregistered, {
        workerId,
        poolName,
      });

      if (this.config.metricsEnabled) {
        this.metricsCollector.setGauge("dispatcher_total_workers", this.workerRegistry.getAll().length);
        this.metricsCollector.setGauge("dispatcher_healthy_workers", this.workerRegistry.getAll(true).length);
      }
    }
    return existed;
  }

  /** Register multiple workers from a provider. */
  registerWorkersFromProvider(
    provider: { id: string; name: string; type: string; capabilities: string[]; maxConcurrency: number },
    poolName = "default"
  ): WorkerRegistration[] {
    const workers: WorkerRegistration[] = [];

    const mockWorker: IWorker = {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      get isOnline() { return true; },
      get status() { return WorkerStatus.Ready as any; },
      get capabilities() { return provider.capabilities; },
      get maxConcurrency() { return provider.maxConcurrency; },
      get activeTasks() { return 0; },
      get remainingCapacity() { return provider.maxConcurrency; },
      start: async () => {},
      stop: async () => {},
      canExecute: (_caps: string[]) => true,
      execute: async () => ({ success: true, artifacts: [], knowledgeCaptured: [], metrics: {}, durationMs: 0 }),
      cancel: async () => true,
      healthCheck: async () => ({ status: "healthy" as const, tasksSucceeded: 0, tasksFailed: 0 }),
    };

    workers.push(this.registerWorker(mockWorker, poolName));
    return workers;
  }

  /** Get worker registration. */
  getWorker(workerId: string, poolName = "default"): WorkerRegistration | undefined {
    return this.workerRegistry.get(workerId, poolName);
  }

  /** Get all workers. */
  getAllWorkers(healthyOnly = false): WorkerRegistration[] {
    return this.workerRegistry.getAll(healthyOnly);
  }

  /** Get worker pools. */
  getWorkerPools(): string[] {
    return this.workerRegistry.getPools();
  }

  /** Get available workers for a task. */
  getAvailableWorkers(requiredCapabilities?: string[]): WorkerRegistration[] {
    const all = this.workerRegistry.getAll(true); // healthy only

    if (requiredCapabilities && requiredCapabilities.length > 0) {
      return all.filter((w) => w.worker.canExecute(requiredCapabilities));
    }

    return all;
  }

  // ========================================================================
  // Task Dispatching
  // ========================================================================

  /**
   * Dispatch a scheduled task to an appropriate worker.
   * Returns the routing decision or null if no worker is available.
   */
  async dispatchTask(task: DispatcherScheduledTask): Promise<RoutingDecision | null> {
    const startTime = Date.now();

    // Get available workers
    const requiredCapabilities: string[] | undefined = (task.node as any).requiredCapabilities;
    const availableWorkers = this.workerRegistry.getAll(true);

    if (availableWorkers.length === 0) {
      await this.logDispatcher("warn", `No available workers for node "${task.node.id}".`);
      return null;
    }

    // Select worker based on strategy
    const selectedWorker = this.workerSelector.select(
      availableWorkers,
      this.config.loadBalancingStrategy,
      requiredCapabilities
    );

    if (!selectedWorker) {
      await this.logDispatcher("warn", `No suitable worker for node "${task.node.id}".`);
      return null;
    }

    // Create routing decision
    const decision: RoutingDecision = {
      selectedWorkerId: selectedWorker.worker.id,
      strategy: this.config.loadBalancingStrategy,
      reason: this._getSelectionReason(selectedWorker, requiredCapabilities),
      poolName: "default",
    };

    // Track the route
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.taskRouter.createRoute(taskId, task.node.id, selectedWorker.worker.id, "default");

    // Measure routing time
    const routingTimeMs = Date.now() - startTime;
    if (this.config.metricsEnabled) {
      this.metricsCollector.observeHistogram("dispatcher_routing_time_ms", routingTimeMs);
    }

    // Start task timeout timer
    this._startTaskTimeout(taskId, task.node.id);

    // Update metrics
    if (this.config.metricsEnabled) {
      this.metricsCollector.incrementCounter("dispatcher_tasks_dispatched");
    }

    // Emit event
    this._emitEvent(DispatcherEventType.TaskDispatched, {
      taskId,
      nodeId: task.node.id,
      workerId: selectedWorker.worker.id,
      poolName: "default",
      strategy: this.config.loadBalancingStrategy,
      reason: decision.reason,
      routingTimeMs,
    });

    await this.logDispatcher("info", `Task "${taskId}" routed to worker "${selectedWorker.worker.id}" (${this.config.loadBalancingStrategy}) in ${routingTimeMs}ms`);

    return decision;
  }

  /**
   * Dispatch a task to a specific worker (bypassing selection).
   */
  async dispatchToWorker(
    task: DispatcherScheduledTask,
    workerId: string,
    poolName = "default"
  ): Promise<{ success: boolean; error?: string }> {
    const worker = this.workerRegistry.get(workerId, poolName);
    if (!worker) {
      return { success: false, error: `Worker "${workerId}" not found in pool "${poolName}".` };
    }

    if (!worker.worker.isOnline) {
      return { success: false, error: `Worker "${workerId}" is not online.` };
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.taskRouter.createRoute(taskId, task.node.id, workerId, poolName);

    // Start timeout
    this._startTaskTimeout(taskId, task.node.id);

    // Dispatch to worker
    const execStart = Date.now();
    try {
      const result = await worker.worker.execute(task.node);

      const durationMs = Date.now() - execStart;
      if (this.config.metricsEnabled) {
        this.metricsCollector.observeHistogram("dispatcher_task_duration_ms", durationMs);
      }

      if (result.success) {
        worker.tasksCompleted++;
        worker.totalExecutionTimeMs += durationMs;
        if (this.config.metricsEnabled) {
          this.metricsCollector.incrementCounter("dispatcher_tasks_completed");
        }

        this.taskRouter.updateStatus(taskId, TaskRouteStatus.Completed);
        this._emitEvent(DispatcherEventType.TaskCompleted, {
          taskId,
          nodeId: task.node.id,
          workerId,
          poolName,
          durationMs,
          artifacts: result.artifacts,
        });

        await this.logDispatcher("info", `Task "${taskId}" completed successfully on worker "${workerId}" in ${durationMs}ms.`);
      } else {
        // Handle failure with retry policy
        const handled = await this._handleTaskFailure(taskId, task.node as WorkNode, worker, result.error);
        if (!handled) {
          this.taskRouter.updateStatus(taskId, TaskRouteStatus.Failed);
        }
      }

      return { success: true };
    } catch (error) {
      const durationMs = Date.now() - execStart;
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (this.config.metricsEnabled) {
        this.metricsCollector.incrementCounter("dispatcher_tasks_failed");
      }
      worker.tasksFailed++;

      this.taskRouter.updateStatus(taskId, TaskRouteStatus.Failed);
      this._emitEvent(DispatcherEventType.TaskFailed, {
        taskId,
        nodeId: task.node.id,
        workerId,
        poolName,
        error: errorMsg,
        durationMs,
      });

      // Handle failure with retry policy
      await this._handleTaskFailure(taskId, task.node as WorkNode, worker, errorMsg);

      await this.logDispatcher("error", `Task "${taskId}" failed on worker "${workerId}": ${errorMsg}`);
      return { success: true };
    }
  }

  /** Complete a task successfully. */
  async completeTask(
    taskId: string,
    result: { success: boolean; artifacts?: string[]; cost?: number },
    workerId?: string,
    poolName = "default"
  ): Promise<void> {
    if (result.success) {
      this.taskRouter.updateStatus(taskId, TaskRouteStatus.Completed);
      if (this.config.metricsEnabled) {
        this.metricsCollector.incrementCounter("dispatcher_tasks_completed");
      }

      if (workerId && poolName) {
        const worker = this.workerRegistry.get(workerId, poolName);
        if (worker) {
          worker.tasksCompleted++;
        }
      }

      this._clearTaskTimeout(taskId);
      this._emitEvent(DispatcherEventType.TaskCompleted, {
        taskId,
        completedAt: new Date().toISOString(),
      });
    } else {
      this.taskRouter.updateStatus(taskId, TaskRouteStatus.Failed);
      if (this.config.metricsEnabled) {
        this.metricsCollector.incrementCounter("dispatcher_tasks_failed");
      }

      if (workerId && poolName) {
        const worker = this.workerRegistry.get(workerId, poolName);
        if (worker) {
          worker.tasksFailed++;
        }
      }

      this._clearTaskTimeout(taskId);
      this._emitEvent(DispatcherEventType.TaskFailed, {
        taskId,
        error: "manual_failure",
      });
    }
  }

  /** Fail a task with propagation. */
  async failTask(
    taskId: string,
    reason: string,
    propagate = true
  ): Promise<void> {
    this.taskRouter.updateStatus(taskId, TaskRouteStatus.Failed);
    if (this.config.metricsEnabled) {
      this.metricsCollector.incrementCounter("dispatcher_tasks_failed");
    }

    const route = this.taskRouter.get(taskId);
    if (route) {
      // Fail dependent tasks if propagation is enabled
      if (propagate && this.config.failurePropagation !== FailurePropagationMode.None) {
        await this._propagateFailure(route.nodeId, reason);
      }

      this._emitEvent(DispatcherEventType.TaskFailed, {
        taskId,
        nodeId: route.nodeId,
        workerId: route.workerId,
        poolName: route.poolName,
        reason,
      });

      await this.logDispatcher("error", `Task "${taskId}" failed: ${reason}`);
    }
  }

  /** Cancel a task with optional propagation. */
  async cancelTask(
    taskId: string,
    reason = "manual_cancellation",
    propagate = true
  ): Promise<boolean> {
    const route = this.taskRouter.get(taskId);
    if (!route) return false;

    this.taskRouter.updateStatus(taskId, TaskRouteStatus.Cancelled);
    if (this.config.metricsEnabled) {
      this.metricsCollector.incrementCounter("dispatcher_tasks_cancelled");
    }

    // Cancel on worker
    const worker = this.workerRegistry.get(route.workerId, route.poolName);
    if (worker) {
      const cancelled = await worker.worker.cancel(taskId);
      if (cancelled) {
        worker.tasksCancelled++;
      }
    }

    // Clear timeout
    this._clearTaskTimeout(taskId);

    // Propagate cancellation
    if (propagate && this.config.cancellationPropagation) {
      await this._propagateCancellation(route.nodeId, reason);
    }

    this._emitEvent(DispatcherEventType.TaskCancelled, {
      taskId,
      nodeId: route.nodeId,
      workerId: route.workerId,
      poolName: route.poolName,
      reason,
    });

    await this.logDispatcher("info", `Task "${taskId}" cancelled: ${reason}`);
    return true;
  }

  // ========================================================================
  // Retry Policy Management
  // ========================================================================

  /** Apply retry policy to a failed task. Returns true if retry was scheduled. */
  async applyRetryPolicy(
    taskId: string,
    nodeId: string,
    workerId: string,
    error: string,
    attempt: number,
    _poolName = "default"
  ): Promise<boolean> {
    const policy = this.retryEngine.getPolicy("default");

    if (!this.retryEngine.shouldRetry(policy, attempt, error)) {
      await this.logDispatcher("warn", `Max retries reached for task "${taskId}" after ${attempt} attempts.`);
      return false;
    }

    const delayMs = this.retryEngine.computeRetryDelay(policy, attempt);
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

    this._emitEvent(DispatcherEventType.TaskRetrying, {
      taskId,
      nodeId,
      workerId,
      attempt,
      delayMs,
      nextRetryAt,
      lastError: error,
    });

    if (this.config.metricsEnabled) {
      this.metricsCollector.incrementCounter("dispatcher_tasks_retried");
    }
    await this.logDispatcher("info", `Retrying task "${taskId}" in ${delayMs}ms (attempt ${attempt}/${policy.maxAttempts}).`);

    // Schedule retry after delay
    setTimeout(async () => {
      const availableWorkers = this.workerRegistry.getAll(true);
      if (availableWorkers.length > 0) {
        const selectedWorker = this.workerSelector.select(availableWorkers, this.config.loadBalancingStrategy);
        if (selectedWorker) {
          await this.logDispatcher("info", `Retry dispatch for task "${taskId}" to worker "${selectedWorker.worker.id}".`);
        }
      }
    }, delayMs);

    return true;
  }

  /** Set a custom retry policy for a task type. */
  setRetryPolicy(taskType: string, policy: RetryPolicy): void {
    this.retryEngine.setPolicy(taskType, policy);
    this._emitEvent(DispatcherEventType.RetryPolicyApplied, { taskType, policy });
  }

  /** Get the current retry policy. */
  getRetryPolicy(taskType?: string): RetryPolicy {
    return this.retryEngine.getPolicy(taskType ?? "default");
  }

  // ========================================================================
  // Health Monitoring
  // ========================================================================

  /** Get dispatcher health status. */
  getHealth(): DispatcherHealth {
    const allWorkers = this.workerRegistry.getAll(false);
    const healthyWorkers = this.workerRegistry.getAll(true);
    const errors: string[] = [];

    const components = {
      workerRegistry: true,
      taskRouter: true,
      retryEngine: true,
      metricsCollector: this.config.metricsEnabled,
    };

    const unhealthyCount = allWorkers.length - healthyWorkers.length;
    if (unhealthyCount > 0) {
      errors.push(`${unhealthyCount} worker(s) unhealthy`);
    }

    return {
      healthy: errors.length === 0 && this.state === DispatcherState.Running,
      state: this.state,
      uptimeMs: this.startedAt ? Date.now() - new Date(this.startedAt).getTime() : 0,
      startedAt: this.startedAt || new Date().toISOString(),
      components,
      workers: {
        total: allWorkers.length,
        healthy: healthyWorkers.length,
        unhealthy: unhealthyCount,
      },
      tasks: {
        dispatched: this.metricsCollector.getMetrics().tasksDispatched,
        completed: this.metricsCollector.getMetrics().tasksCompleted,
        failed: this.metricsCollector.getMetrics().tasksFailed,
        pending: allWorkers.reduce((sum, w) => sum + w.worker.activeTasks, 0),
      },
      errors,
    };
  }

  // ========================================================================
  // Metrics
  // ========================================================================

  /** Get dispatcher metrics. */
  getMetrics(): DispatcherMetrics {
    return this.metricsCollector.getMetrics();
  }

  // ========================================================================
  // Logging
  // ========================================================================

  /** Set the log level. */
  setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
  }

  /** Get the logger for a specific component. */
  getLogger(componentName: string): {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  } {
    const prefix = `[Dispatcher:${componentName}]`;
    return {
      info: (msg: string) => console.info(`${prefix} ${msg}`),
      warn: (msg: string) => console.warn(`${prefix} ${msg}`),
      error: (msg: string) => console.error(`${prefix} ${msg}`),
      debug: (msg: string) => console.debug(`${prefix} ${msg}`),
    };
  }

  // ========================================================================
  // Internal Methods
  // ========================================================================

  private async logDispatcher(level: "info" | "warn" | "error", message: string): Promise<void> {
    switch (level) {
      case "info":
        this.selfLogger.info(message);
        break;
      case "warn":
        this.selfLogger.warn(message);
        break;
      case "error":
        this.selfLogger.error(message);
        break;
    }

    if (this.logManager) {
      const logger = this.logManager.getLogger("dispatcher");
      switch (level) {
        case "info":
          logger.info(message);
          break;
        case "warn":
          logger.warn(message);
          break;
        case "error":
          logger.error(message);
          break;
      }
    }
  }

  private _emitEvent(eventType: string, payload: unknown): void {
    if (this.eventBus) {
      try {
        this.eventBus.publish(eventType, payload, { source: "runtime.dispatcher" });
      } catch (err) {
        console.error(`[Dispatcher] Failed to emit event ${eventType}:`, err);
      }
    }
  }

  private startWorkerHealthChecks(): void {
    this.stopWorkerHealthChecks();

    this.healthCheckTimer = setInterval(async () => {
      const workers = this.workerRegistry.getAll(false);
      for (const worker of workers) {
        try {
          const health = await worker.worker.healthCheck();
          const wasHealthy = worker.healthy;
          worker.healthy = health.status === "healthy";
          worker.lastHealthCheck = new Date().toISOString();

          if (wasHealthy !== worker.healthy) {
            this._emitEvent(DispatcherEventType.WorkerHealthChanged, {
              workerId: worker.worker.id,
              healthy: worker.healthy,
              status: health.status,
            });
          }
        } catch (error) {
          const wasHealthy = worker.healthy;
          worker.healthy = false;
          worker.lastHealthCheck = new Date().toISOString();

          if (wasHealthy !== worker.healthy) {
            this._emitEvent(DispatcherEventType.WorkerHealthChanged, {
              workerId: worker.worker.id,
              healthy: false,
              error: error instanceof Error ? error.message : String(error),
            });

            await this.logDispatcher("warn", `Worker "${worker.worker.id}" health check failed.`);
          }
        }
      }

      if (this.config.metricsEnabled) {
        this.metricsCollector.setGauge("dispatcher_healthy_workers", this.workerRegistry.getAll(true).length);
      }
    }, this.config.workerHealthCheckIntervalMs);
  }

  private stopWorkerHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private _startTaskTimeout(taskId: string, nodeId: string): void {
    const existing = this.timeoutTimer.get(taskId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      await this.logDispatcher("error", `Task "${taskId}" timed out after ${this.config.taskTimeoutMs}ms.`);
      if (this.config.metricsEnabled) {
        this.metricsCollector.incrementCounter("dispatcher_tasks_failed");
      }
      this.taskRouter.updateStatus(taskId, TaskRouteStatus.Failed);

      this._emitEvent(DispatcherEventType.TaskTimedOut, {
        taskId,
        nodeId,
        timeoutMs: this.config.taskTimeoutMs,
      });

      this.timeoutTimer.delete(taskId);
    }, this.config.taskTimeoutMs);

    this.timeoutTimer.set(taskId, timer);
  }

  private _clearTaskTimeout(taskId: string): void {
    const timer = this.timeoutTimer.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimer.delete(taskId);
    }
  }

  private _getSelectionReason(worker: WorkerRegistration, requiredCapabilities?: string[]): string {
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const matches = worker.worker.capabilities.filter((c: string) => requiredCapabilities.includes(c));
      if (matches.length > 0) {
        return `Capability match: ${matches.join(", ")} (${this.config.loadBalancingStrategy})`;
      }
    }
    return `${this.config.loadBalancingStrategy} - activeTasks: ${worker.worker.activeTasks}`;
  }

  private async _propagateFailure(nodeId: string, reason: string): Promise<void> {
    const routes = this.taskRouter.getByNode(nodeId);
    for (const route of routes) {
      if (route.status === TaskRouteStatus.Dispatched || route.status === TaskRouteStatus.Pending) {
        await this.failTask(route.taskId, `Propagated from node "${nodeId}": ${reason}`, false);
      }
    }
  }

  private async _propagateCancellation(nodeId: string, reason: string): Promise<void> {
    const routes = this.taskRouter.getByNode(nodeId);
    for (const route of routes) {
      if (route.status === TaskRouteStatus.Dispatched || route.status === TaskRouteStatus.Pending) {
        await this.cancelTask(route.taskId, `Propagated from node "${nodeId}": ${reason}`, false);
      }
    }
  }

  private async _handleTaskFailure(
    taskId: string,
    node: WorkNode & { executionHistory?: unknown[] },
    worker: WorkerRegistration,
    error?: string
  ): Promise<boolean> {
    const attempt = (node as any).executionHistory?.length ?? 1;
    const policy = this.retryEngine.getPolicy("default");

    if (this.retryEngine.shouldRetry(policy, attempt, error)) {
      const delayMs = this.retryEngine.computeRetryDelay(policy, attempt);

      this._emitEvent(DispatcherEventType.TaskRetrying, {
        taskId,
        nodeId: node.id,
        workerId: worker.worker.id,
        attempt,
        delayMs,
        lastError: error,
      });

      if (this.config.metricsEnabled) {
        this.metricsCollector.incrementCounter("dispatcher_tasks_retried");
      }
      await this.logDispatcher("info", `Retrying task "${taskId}" in ${delayMs}ms (attempt ${attempt}/${policy.maxAttempts}).`);

      setTimeout(async () => {
        const availableWorkers = this.workerRegistry.getAll(true);
        if (availableWorkers.length > 0) {
          const selectedWorker = this.workerSelector.select(availableWorkers, this.config.loadBalancingStrategy);
          if (selectedWorker) {
            (node as any).state = WorkNodeState.Running;
            await this.logDispatcher("info", `Retry dispatch for task "${taskId}" to worker "${selectedWorker.worker.id}".`);
          }
        }
      }, delayMs);

      return true;
    } else {
      // Max retries exceeded
      (node as any).state = WorkNodeState.Failed;
      worker.tasksFailed++;

      this.taskRouter.updateStatus(taskId, TaskRouteStatus.Failed);
      if (this.config.metricsEnabled) {
        this.metricsCollector.incrementCounter("dispatcher_tasks_failed");
      }

      await this.logDispatcher("error", `Task "${taskId}" failed after ${attempt} attempts.`);

      if (this.config.failurePropagation !== FailurePropagationMode.None) {
        await this._propagateFailure(node.id, "max_retries_exceeded");
      }

      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/** Create a new Dispatcher instance. */
export function createDispatcher(config?: Partial<DispatcherConfig>): Dispatcher {
  return new Dispatcher(createDefaultDispatcherConfig(config));
}