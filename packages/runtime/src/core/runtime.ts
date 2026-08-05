/**
 * Runtime Core - The main orchestrator for the Autonomous Engineering Runtime.
 *
 * Provides:
 * - Lifecycle management (start, stop, status)
 * - Subsystem initialization and wiring
 * - Event routing between subsystems
 * - Health monitoring
 * - State persistence
 *
 * The Runtime is a thin layer that connects all subsystems together.
 * Business logic stays in the subsystems.
 *
 * @module core/runtime
 */

import { EventBus } from "./eventbus.js";
import { Workspace } from "./workspace.js";
import { KnowledgeManager, InMemoryKnowledgeStore } from "./knowledge.js";
import { MetricsCollector, RuntimeMetrics } from "./metrics.js";
import { LogManager, LogLevel, InMemoryLogTarget, ConsoleLogTarget } from "./logging.js";
import type { RuntimeStateSnapshot } from "../persistence/state-store.js";
import { SNAPSHOT_SCHEMA_VERSION } from "../persistence/state-store.js";

// ============================================================================
// Runtime State
// ============================================================================

export enum RuntimeState {
  Initializing = "initializing",
  Running = "running",
  Pausing = "pausing",
  Paused = "paused",
  Stopping = "stopping",
  Stopped = "stopped",
  Error = "error",
}

// ============================================================================
// Runtime Configuration
// ============================================================================

export interface RuntimeConfig {
  /** Name of the runtime instance */
  name: string;

  /** Environment (development, staging, production) */
  environment: string;

  /** Workspace root path */
  workspaceRoot?: string;

  /** Knowledge store implementation */
  knowledgeStore?: unknown;

  /** Log level */
  logLevel: LogLevel;

  /** Enable metrics collection */
  metricsEnabled: boolean;

  /** Enable health checks */
  healthCheckEnabled: boolean;

  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;
}

// ============================================================================
// Default Runtime Configuration
// ============================================================================

export function createDefaultConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    name: "autonomous-engineering-runtime",
    environment: process.env.NODE_ENV ?? "development",
    logLevel: LogLevel.Info,
    metricsEnabled: true,
    healthCheckEnabled: true,
    healthCheckIntervalMs: 30_000, // 30 seconds
    ...overrides,
  };
}

// ============================================================================
// Runtime Health Status
// ============================================================================

export interface RuntimeHealth {
  /** Overall runtime health */
  healthy: boolean;

  /** Overall status */
  state: RuntimeState;

  /** Uptime in seconds */
  uptimeSeconds: number;

  /** Start timestamp */
  startedAt: string;

  /** Component health status */
  components: {
    eventBus: boolean;
    workspace: boolean;
    knowledge: boolean;
    metrics: boolean;
    logging: boolean;
  };

  /** System resource information (if available) */
  resources?: {
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
  };

  /** Health check errors */
  errors: string[];
}

// ============================================================================
// Runtime - Main Orchestrator
// ============================================================================

/**
 * The Autonomous Engineering Runtime.
 *
 * Manages the lifecycle and wiring of all subsystems.
 */
export class Runtime {
  private config: RuntimeConfig;
  private state: RuntimeState;
  private startedAt: string;

  // Subsystems
  private eventBus?: EventBus;
  private workspace?: Workspace;
  private knowledgeManager?: KnowledgeManager;
  private metricsCollector?: MetricsCollector;
  private runtimeMetrics?: RuntimeMetrics;
  private logManager?: LogManager;

  // Health check timer
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  // Internal logger for the runtime itself
  private readonly selfLogger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };

  constructor(config?: RuntimeConfig) {
    this.config = createDefaultConfig(config);
    this.state = RuntimeState.Stopped;
    this.startedAt = "";

    // Create a simple internal logger (will be replaced after subsystem init)
    this.selfLogger = {
      info: (msg: string) => console.info(`[Runtime] ${msg}`),
      error: (msg: string) => console.error(`[Runtime] ${msg}`),
      warn: (msg: string) => console.warn(`[Runtime] ${msg}`),
    };
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Start the Runtime and all subsystems.
   */
  async start(): Promise<void> {
    this.state = RuntimeState.Initializing;

    try {
      await this.logSelf("info", "Starting Autonomous Engineering Runtime...");

      // 1. Initialize Logging (first, everything depends on logging)
      await this.initializeLogging();

      // 2. Initialize Event Bus
      await this.initializeEventBus();

      // 3. Initialize Workspace
      await this.initializeWorkspace();

      // 4. Initialize Knowledge System
      await this.initializeKnowledge();

      // 5. Initialize Metrics
      await this.initializeMetrics();

      // 6. Wire log events to event bus
      await this.wireLogEvents();

      // 7. Start health checks
      if (this.config.healthCheckEnabled) {
        this.startHealthChecks();
      }

      // Set running state
      this.state = RuntimeState.Running;
      this.startedAt = new Date().toISOString();

      await this.logSelf("info", `Runtime "${this.config.name}" started successfully.`);
    } catch (error) {
      this.state = RuntimeState.Error;
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logSelf("error", `Failed to start Runtime: ${errMsg}`);
      throw error;
    }
  }

  /**
   * Stop the Runtime and all subsystems gracefully.
   */
  async stop(): Promise<void> {
    if (this.state === RuntimeState.Stopped || this.state === RuntimeState.Stopping) {
      return; // Already stopped or stopping
    }

    this.state = RuntimeState.Stopping;

    try {
      await this.logSelf("info", "Stopping Autonomous Engineering Runtime...");

      // Stop health checks
      if (this.config.healthCheckEnabled) {
        this.stopHealthChecks();
      }

      // Shutdown in reverse order
      if (this.metricsCollector) {
        this.metricsCollector.stop();
      }

      if (this.knowledgeManager) {
        await this.knowledgeManager.shutdown();
      }

      if (this.eventBus) {
        await this.eventBus.shutdown();
      }

      if (this.logManager) {
        await this.logManager.shutdown();
      }

      this.state = RuntimeState.Stopped;
      await this.logSelf("info", "Runtime stopped.");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logSelf("error", `Error stopping Runtime: ${errMsg}`);
      this.state = RuntimeState.Error;
      throw error;
    }
  }

  /**
   * Pause the Runtime (pause event processing and metrics).
   */
  async pause(): Promise<void> {
    if (this.state !== RuntimeState.Running) {
      return;
    }

    this.state = RuntimeState.Paused;

    if (this.eventBus) {
      // Pause by unsubscribing all subscriptions
      const subscriptions = this.eventBus.getSubscriptions();
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    }

    if (this.metricsCollector) {
      this.metricsCollector.stop();
    }

    await this.logSelf("info", "Runtime paused.");
  }

  /**
   * Resume the Runtime.
   */
  async resume(): Promise<void> {
    if (this.state !== RuntimeState.Paused) {
      return;
    }

    this.state = RuntimeState.Running;

    // Resume is a no-op since pause just unsubscribed all subscriptions
    // The event bus continues to work, events are just not routed if no subscribers exist
    if (this.metricsCollector && this.config.metricsEnabled) {
      this.metricsCollector.start();
    }

    await this.logSelf("info", "Runtime resumed.");
  }

  /**
   * Get the current state.
   */
  getState(): RuntimeState {
    return this.state;
  }

  /**
   * Get the configuration.
   */
  getConfig(): RuntimeConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Subsystem Accessors
  // ========================================================================

  /**
   * Get the event bus (for external integration).
   */
  getEventBus(): EventBus | undefined {
    return this.eventBus;
  }

  /**
   * Get the workspace.
   */
  getWorkspace(): Workspace | undefined {
    return this.workspace;
  }

  /**
   * Get the knowledge manager.
   */
  getKnowledgeManager(): KnowledgeManager | undefined {
    return this.knowledgeManager;
  }

  /**
   * Get the metrics collector.
   */
  getMetricsCollector(): MetricsCollector | undefined {
    return this.metricsCollector;
  }

  /**
   * Get the log manager.
   */
  getLogManager(): LogManager | undefined {
    return this.logManager;
  }

  /**
   * Get the runtime metrics.
   */
  getRuntimeMetrics(): RuntimeMetrics | undefined {
    return this.runtimeMetrics;
  }

  // ========================================================================
  // Health
  // ========================================================================

  /**
   * Get the current health status.
   */
  getHealth(): RuntimeHealth {
    const errors: string[] = [];

    const components = {
      eventBus: this.checkEventBus(),
      workspace: this.checkWorkspace(),
      knowledge: this.checkKnowledge(),
      metrics: this.checkMetrics(),
      logging: this.checkLogging(),
    };

    for (const [key, healthy] of Object.entries(components)) {
      if (!healthy) {
        errors.push(`Component "${key}" is unhealthy`);
      }
    }

    const memoryUsage = typeof process !== "undefined" && process.memoryUsage ? process.memoryUsage() : null;
    const resources = memoryUsage
      ? {
          memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        }
      : undefined;

    return {
      healthy: errors.length === 0,
      state: this.state,
      uptimeSeconds: this.startedAt
        ? (Date.now() - new Date(this.startedAt).getTime()) / 1000
        : 0,
      startedAt: this.startedAt || new Date().toISOString(),
      components,
      resources,
      errors,
    };
  }

  /**
   * Produce a plain-JSON snapshot of runtime state + health + metrics.
   * No I/O — this is a pure in-memory projection consumed by the StateStore.
   */
  getSnapshot(): RuntimeStateSnapshot {
    const health = this.getHealth();

    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      pid: process.pid,
      state: this.getState(),
      healthy: health.healthy,
      startedAt: health.startedAt,
      uptimeSeconds: health.uptimeSeconds,
      health: {
        healthy: health.healthy,
        state: health.state,
        uptimeSeconds: health.uptimeSeconds,
        startedAt: health.startedAt,
        components: health.components,
        resources: health.resources,
        errors: health.errors,
      },
      metrics: this.getMetricsCollector()?.getSummary(),
      capturedAt: new Date().toISOString(),
    };
  }

  private checkEventBus(): boolean {
    return !!this.eventBus;
  }

  private checkWorkspace(): boolean {
    return !!this.workspace;
  }

  private checkKnowledge(): boolean {
    return !!this.knowledgeManager && this.knowledgeManager.isInitializedFlag();
  }

  private checkMetrics(): boolean {
    return !!this.metricsCollector;
  }

  private checkLogging(): boolean {
    return !!this.logManager;
  }

  // ========================================================================
  // Subsystem Initialization
  // ========================================================================

  private async initializeLogging(): Promise<void> {
    const consoleTarget = new ConsoleLogTarget();
    const inMemoryTarget = new InMemoryLogTarget(5000);

    const manager = new LogManager({
      minLevel: this.config.logLevel,
      targets: [consoleTarget, inMemoryTarget],
    });

    this.logManager = manager;
  }

  private async initializeEventBus(): Promise<void> {
    if (this.eventBus) {
      return; // Already initialized
    }

    this.eventBus = new EventBus();
    await this.eventBus.start();
  }

  private async initializeWorkspace(): Promise<void> {
    if (this.workspace) {
      return; // Already initialized
    }

    const workspaceRoot = this.config.workspaceRoot ?? process.cwd();
    const workspaceConfig = {
      rootPath: workspaceRoot,
      includes: ["src", "docs", "tests", "config"],
      excludes: ["node_modules", ".git", "dist", "build"],
      maxContentAddressedSize: 1_048_576,
      watchEnabled: true,
      watchDebounceMs: 300,
      snapshotRetention: 10,
      indexEnabled: true,
    };
    this.workspace = new Workspace(workspaceConfig);
  }

  private async initializeKnowledge(): Promise<void> {
    if (this.knowledgeManager) {
      return;
    }

    const store = this.config.knowledgeStore
      ? (this.config.knowledgeStore as any)
      : new InMemoryKnowledgeStore();

    this.knowledgeManager = new KnowledgeManager(store);
    await this.knowledgeManager.initialize();
  }

  private async initializeMetrics(): Promise<void> {
    if (!this.config.metricsEnabled) {
      return;
    }

    this.metricsCollector = new MetricsCollector();
    this.metricsCollector.start();

    this.runtimeMetrics = new RuntimeMetrics(this.metricsCollector);
  }

  // ========================================================================
  // Wiring
  // ========================================================================

  private async wireLogEvents(): Promise<void> {
    // Wire log events from LogManager to EventBus if both exist
    if (this.logManager && this.eventBus) {
      // The EventBus emits 'log' events
      // This is a simplified integration point
      // In production, each Logger would be configured with the EventBus as a target
    }
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  private startHealthChecks(): void {
    this.stopHealthChecks();

    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        if (!health.healthy) {
          await this.logSelf("warn", `Health check warning: ${health.errors.join(", ")}`);
        }
      } catch (error) {
        await this.logSelf("error", `Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  private async performHealthCheck(): Promise<RuntimeHealth> {
    const health: RuntimeHealth = {
      healthy: true,
      state: this.state,
      uptimeSeconds: this.startedAt
        ? (Date.now() - new Date(this.startedAt).getTime()) / 1000
        : 0,
      startedAt: this.startedAt || new Date().toISOString(),
      components: {
        eventBus: true,
        workspace: true,
        knowledge: true,
        metrics: true,
        logging: true,
      },
      errors: [],
    };

    // Check EventBus
    if (this.eventBus) {
      health.components.eventBus = this.eventBus.isRunning();
    } else {
      health.components.eventBus = false;
      health.healthy = false;
      health.errors.push("EventBus not initialized");
    }

    // Check Workspace
    if (this.workspace) {
      health.components.workspace = true;
    } else {
      health.components.workspace = false;
      health.healthy = false;
      health.errors.push("Workspace not initialized");
    }

    return health;
  }

  // ========================================================================
  // Internal Utilities
  // ========================================================================

  private async logSelf(level: "info" | "warn" | "error", message: string): Promise<void> {
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

    // Also log through the LogManager if available
    if (this.logManager) {
      const logger = this.logManager.getLogger("runtime.core");
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
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Runtime instance.
 */
export function createRuntime(config?: Partial<RuntimeConfig>): Runtime {
  return new Runtime(createDefaultConfig(config));
}