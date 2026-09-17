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
import { createProvider } from "../core/types/provider.js";
import type { ProviderConfig } from "../core/types/provider.js";
import type { AskPayload, AskResponsePayload } from "../ipc-protocol.js";
import {
  WorkspaceTools,
  CommandCancellationToken,
} from "../workspace-tools.js";
import type {
  WorkspaceExecuteOptions,
  WorkspaceCommandResult,
  CommandCancellation,
} from "../workspace-tools.js";
import { SessionGrantManager, getSessionGrantManager } from "../session-grant-manager.js";
import type { SessionGrantRegisterPayload, SessionGrantResult, SessionGrantListResponse } from "../session-grant-manager.js";
import type {
  WorkspaceReadPayload, WorkspaceReadResponsePayload, WorkspaceListPayload,
  WorkspaceSearchPayload, WorkspaceExecutePayload,
  WorkspacePreviewPayload, WorkspacePreviewResponsePayload,
  WorkspaceApprovePayload, WorkspaceApproveResponsePayload,
  WorkspaceApplyPayload, WorkspaceApplyResponsePayload,
} from "../ipc-protocol.js";

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

  // Session grant isolation (per-session workspace access control)
  private readonly sessionGrantManager: SessionGrantManager;

  // Pending workspace approvals (single-use approvalId -> session-scoped binding).
  // Only audit-safe data is stored here; the secret approval token stays on the grant.
  private pendingWorkspaceApprovals = new Map<string, { sessionId: string; rootPath: string; diffHash: string; grantId?: string; createdAt: string; expiresAt: string }>();
  private workspaceApprovalCounter = 0;
  private static readonly WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS = 300;
  private static readonly WORKSPACE_APPROVAL_MAX_TTL_SECONDS = 3600;

  // In-flight workspace execute operations (sprint011 task 11). The Runtime
  // owns cancellation so `stop()` and per-session cleanup stay authoritative;
  // the IPC server delegates `workspace:cancel` here and drives the streamed
  // events. opId -> cancellation token, with the owning session for grouping.
  private workspaceOperations = new Map<string, CommandCancellation>();
  private workspaceOperationSessions = new Map<string, string>();
  private workspaceOperationCounter = 0;

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
    this.sessionGrantManager = getSessionGrantManager();

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

  async ask(payload: AskPayload): Promise<AskResponsePayload> {
    if (this.state !== RuntimeState.Running) {
      throw new Error(`Runtime is not running (state=${this.state})`);
    }
    if (!payload.prompt.trim()) {
      throw new Error("Ask prompt must not be empty");
    }

    const startedAt = Date.now();
    const providerConfig: ProviderConfig = {
      name: payload.providerId ?? "ollama",
      type: payload.providerId ?? "ollama",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      defaultModel: payload.modelId ?? process.env.WORKER_MODEL ?? "qwen2.5-coder:7b",
    };
    const provider = createProvider(providerConfig);
    await provider.initialize();
    try {
      const response = await provider.generate({
        requestId: `ask_${Date.now()}`,
        correlationId: `ask_${Date.now()}`,
        modelId: payload.modelId ?? process.env.WORKER_MODEL ?? "qwen2.5-coder:7b",
        messages: [
          ...(payload.history ?? []),
          { role: "user", content: payload.prompt },
        ],
        constraints: { maxTokens: payload.maxTokens },
        sampling: { temperature: payload.temperature },
      });
      return {
        content: response.content ?? "",
        modelId: response.modelId,
        tokensUsed: response.usage.totalTokens,
        latencyMs: response.latencyMs || Date.now() - startedAt,
      };
    } finally {
      await provider.shutdown();
    }
  }

  // ========================================================================
  // Session Grant Management (acceptance criterion: two clients cannot cross-read)
  // ========================================================================

  /**
   * Register a workspace grant for an IPC session.
   */
  registerSessionGrant(sessionId: string, payload: SessionGrantRegisterPayload): SessionGrantResult {
    return this.sessionGrantManager.registerGrant(sessionId, payload);
  }

  /**
   * Revoke one or all grants for an IPC session.
   */
  revokeSessionGrant(sessionId: string, rootPath?: string): { revoked: number } {
    return { revoked: this.sessionGrantManager.revokeGrant(sessionId, rootPath) };
  }

  /**
   * List active grants for an IPC session (audit-safe, no secrets).
   */
  getSessionGrants(sessionId: string): SessionGrantListResponse {
    return this.sessionGrantManager.listGrants(sessionId);
  }

  /**
   * List all active sessions with grants.
   */
  listActiveGrantSessions(): string[] {
    return this.sessionGrantManager.listSessions();
  }

  /**
   * Get the SessionGrantManager (for advanced usage and testing).
   */
  getSessionGrantManager(): SessionGrantManager {
    return this.sessionGrantManager;
  }

  // ========================================================================
  // Authorized Workspace Operations (session-scoped)
  // ========================================================================

  async readAuthorizedWorkspace(payload: WorkspaceReadPayload, sessionId: string): Promise<WorkspaceReadResponsePayload> {
    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("read")) {
      throw new Error("Workspace tool 'read' is not granted for this session");
    }
    const tools = await WorkspaceTools.create({
      rootPath: payload.rootPath,
      mode: grant.mode,
      tools: grant.tools,
      allowedCommands: grant.allowedCommands,
      expiresAt: grant.expiresAt,
      approvalRequired: grant.approvalRequired,
      approvalToken: grant.approvalToken,
      maxReadBytes: grant.maxReadBytes,
    });
    const result = await tools.readFile(payload.relativePath);
    return { rootPath: payload.rootPath, relativePath: payload.relativePath, content: result.content };
  }

  async listAuthorizedWorkspace(payload: WorkspaceListPayload, sessionId: string): Promise<unknown> {
    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("list")) {
      throw new Error("Workspace tool 'list' is not granted for this session");
    }
    const tools = await WorkspaceTools.create({
      rootPath: payload.rootPath,
      mode: grant.mode,
      tools: grant.tools,
    });
    return tools.list(payload.relativePath ?? ".");
  }

  async searchAuthorizedWorkspace(payload: WorkspaceSearchPayload, sessionId: string): Promise<string[]> {
    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("search")) {
      throw new Error("Workspace tool 'search' is not granted for this session");
    }
    const tools = await WorkspaceTools.create({
      rootPath: payload.rootPath,
      mode: grant.mode,
      tools: grant.tools,
    });
    return tools.search(payload.query);
  }

  async executeAuthorizedWorkspace(
    payload: WorkspaceExecutePayload,
    sessionId: string,
    options?: WorkspaceExecuteOptions & { opId?: string },
  ): Promise<WorkspaceCommandResult> {
    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("execute")) {
      throw new Error("Workspace tool 'execute' is not granted for this session");
    }
    const allowedCommands = grant.allowedCommands ??
      (process.env.AER_ALLOWED_COMMANDS ?? "dotnet").split(",").map((c) => c.trim()).filter(Boolean);
    const tools = await WorkspaceTools.create({
      rootPath: payload.rootPath,
      mode: "read-write",
      tools: ["execute"],
      allowedCommands,
    });
    // Register the operation so cancellation is authoritative here: the IPC
    // server delegates `workspace:cancel` and disconnect cleanup to the runtime,
    // and `stop()` force-kills anything still in flight (sprint011 task 11).
    const opId = options?.opId ?? this.nextWorkspaceOperationId();
    const cancellation = options?.cancellation ?? new CommandCancellationToken();
    this.workspaceOperations.set(opId, cancellation);
    this.workspaceOperationSessions.set(opId, sessionId);
    try {
      return await tools.execute(payload.command, payload.args ?? [], {
        timeoutMs: options?.timeoutMs ?? payload.timeoutMs,
        maxOutputBytes: options?.maxOutputBytes ?? payload.maxOutputBytes,
        onOutput: options?.onOutput,
        onCancel: options?.onCancel,
        cancellation,
      });
    } finally {
      this.workspaceOperations.delete(opId);
      this.workspaceOperationSessions.delete(opId);
    }
  }

  /**
   * Cancel an in-flight workspace operation by id. Idempotent — safe to call
   * repeatedly and on already-finished operations (sprint011 task 11).
   */
  cancelWorkspaceOperation(opId: string): { cancelled: boolean; alreadyFinished: boolean } {
    const token = this.workspaceOperations.get(opId);
    if (!token) return { cancelled: false, alreadyFinished: true };
    if (token.cancelled) return { cancelled: true, alreadyFinished: true };
    token.cancel();
    return { cancelled: true, alreadyFinished: false };
  }

  /** Cancel every in-flight operation owned by a session (used on disconnect). */
  cancelWorkspaceOperationsForSession(sessionId: string): number {
    let count = 0;
    for (const [opId, sid] of this.workspaceOperationSessions) {
      if (sid === sessionId && this.cancelWorkspaceOperation(opId).cancelled) count++;
    }
    return count;
  }

  /** Cancel every in-flight workspace operation (used on stop / close). */
  cancelAllWorkspaceOperations(): number {
    let count = 0;
    for (const opId of [...this.workspaceOperations.keys()]) {
      if (this.cancelWorkspaceOperation(opId).cancelled) count++;
    }
    return count;
  }

  private nextWorkspaceOperationId(): string {
    this.workspaceOperationCounter++;
    return `wsop_${this.workspaceOperationCounter}`;
  }

  // ========================================================================
  // Authorized Workspace Mutation Lifecycle (Preview -> Approve -> Apply)
  // ========================================================================

  /**
   * Preview a batch of proposed changes without writing anything to disk.
   *
   * Requires a read-write grant that includes the `apply` tool. Computes a
   * deterministic `diffHash` over the resolved change set (each file's baseline
   * hash + new content) that the caller must bind to when approving.
   */
  async previewAuthorizedWorkspace(payload: WorkspacePreviewPayload, sessionId: string): Promise<WorkspacePreviewResponsePayload> {
    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("apply")) {
      throw new Error("Workspace tool 'apply' is not granted for this session");
    }
    const tools = await WorkspaceTools.create({
      rootPath: payload.rootPath,
      mode: grant.mode,
      tools: grant.tools,
      allowedCommands: grant.allowedCommands,
      expiresAt: grant.expiresAt,
      approvalRequired: grant.approvalRequired,
      approvalToken: grant.approvalToken,
      maxReadBytes: grant.maxReadBytes,
    });
    const result = await tools.preview(payload.changes);
    return { rootPath: payload.rootPath, diffHash: result.diffHash, files: result.files };
  }

  /**
   * Approve a previously previewed change set.
   *
   * Issues a single-use `approvalId` bound to this session, rootPath and the exact
   * `diffHash` that was previewed. The secret approval token is never stored here —
   * it stays on the grant and is only re-validated at apply time.
   */
  async approveAuthorizedWorkspace(payload: WorkspaceApprovePayload, sessionId: string): Promise<WorkspaceApproveResponsePayload> {
    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("apply")) {
      throw new Error("Workspace tool 'apply' is not granted for this session");
    }
    if (typeof payload.diffHash !== "string" || payload.diffHash.length === 0) {
      throw new Error("Approve requires a non-empty diffHash from a prior preview");
    }

    const now = Date.now();
    const ttlSeconds = (typeof payload.expiresInSeconds === "number" && Number.isFinite(payload.expiresInSeconds) && payload.expiresInSeconds > 0)
      ? Math.min(payload.expiresInSeconds, Runtime.WORKSPACE_APPROVAL_MAX_TTL_SECONDS)
      : Runtime.WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS;
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
    const approvalId = `wsa_${sessionId.slice(0, 8)}_${now}_${++this.workspaceApprovalCounter}`;
    const grantId = this.resolveGrantId(sessionId, payload.rootPath);

    this.pendingWorkspaceApprovals.set(approvalId, {
      sessionId,
      rootPath: payload.rootPath,
      diffHash: payload.diffHash,
      grantId,
      createdAt,
      expiresAt,
    });
    return { approvalId, sessionId, grantId, rootPath: payload.rootPath, diffHash: payload.diffHash, createdAt, expiresAt };
  }

  /**
   * Apply a previously approved change set.
   *
   * The `approvalId` is single-use: it is validated against the requesting session,
   * the bound rootPath and diffHash, checked for expiry, then consumed. The write
   * itself is delegated to {@link WorkspaceTools.applyBatch}, which re-verifies the
   * secret token and per-file expected hashes and rolls back any files already
   * written if the batch fails part-way.
   */
  async applyAuthorizedWorkspace(payload: WorkspaceApplyPayload, sessionId: string): Promise<WorkspaceApplyResponsePayload> {
    const stored = this.pendingWorkspaceApprovals.get(payload.approvalId);
    if (!stored) {
      throw new Error("Unknown or already-consumed approvalId");
    }
    if (stored.sessionId !== sessionId) {
      throw new Error("Approval belongs to a different session");
    }
    if (stored.rootPath !== payload.rootPath) {
      throw new Error("Approval rootPath does not match the requested rootPath");
    }
    if (Date.parse(stored.expiresAt) <= Date.now()) {
      this.pendingWorkspaceApprovals.delete(payload.approvalId);
      throw new Error("Approval has expired");
    }

    const grant = this.sessionGrantManager.getGrant(sessionId, payload.rootPath);
    if (!grant.tools.includes("apply")) {
      throw new Error("Workspace tool 'apply' is not granted for this session");
    }
    const tools = await WorkspaceTools.create({
      rootPath: payload.rootPath,
      mode: grant.mode,
      tools: grant.tools,
      allowedCommands: grant.allowedCommands,
      expiresAt: grant.expiresAt,
      approvalRequired: grant.approvalRequired,
      approvalToken: grant.approvalToken,
      maxReadBytes: grant.maxReadBytes,
      sessionId,
      grantId: stored.grantId,
    });
    const result = await tools.applyBatch(payload.changes, {
      sessionId,
      grantId: stored.grantId,
      diffHash: stored.diffHash,
      token: grant.approvalToken,
    });

    // Approvals are single-use: consume the record only after a successful apply.
    this.pendingWorkspaceApprovals.delete(payload.approvalId);
    return {
      rootPath: payload.rootPath,
      applied: result.applied,
      rolledBack: result.rolledBack,
      restored: result.restored,
      files: result.files,
      diffHash: result.diffHash,
    };
  }

  /**
   * Resolve the grantId for a session + rootPath. `SessionGrantManager.getGrant`
   * strips the id for audit safety, so it is recovered from the audit list here.
   */
  private resolveGrantId(sessionId: string, rootPath: string): string {
    const normalize = (p: string) => p.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
    const target = normalize(rootPath);
    const { grants } = this.sessionGrantManager.listGrants(sessionId);
    for (const g of grants) {
      if (normalize(g.rootPath) === target) return g.grantId;
    }
    return `grant_${sessionId.slice(0, 8)}_${rootPath}`;
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

      // Kill any in-flight workspace command process trees first so stopping
      // cannot leak orphaned children (sprint011 task 11).
      this.cancelAllWorkspaceOperations();

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