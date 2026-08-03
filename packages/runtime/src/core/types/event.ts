/**
 * Event Types - Domain events emitted by all runtime subsystems.
 *
 * Every important action in the Autonomous Engineering Runtime produces an event.
 * Events are immutable, timestamped, and fully typed.
 *
 * @module core/types/event
 */

/** Unique event identifier using ULID-like pattern */
export type EventId = string;

/** ISO 8601 timestamp */
export type Timestamp = string;

/**
 * Severity levels for events.
 * Used by logging and monitoring subsystems.
 */
export enum EventSeverity {
  Trace = "TRACE",
  Debug = "DEBUG",
  Info = "INFO",
  Warn = "WARN",
  Error = "ERROR",
  Fatal = "FATAL",
}

/**
 * All event types in the system, organized by subsystem.
 */
export enum EventType {
  // Runtime lifecycle
  RuntimeStarting = "runtime.starting",
  RuntimeStarted = "runtime.started",
  RuntimeStopping = "runtime.stopping",
  RuntimeStopped = "runtime.stopped",

  // Mission events
  MissionUpdated = "mission.updated",
  MissionValidated = "mission.validated",
  MissionFailed = "mission.failed",

  // Work graph events
  WorkGraphNodeCreated = "workgraph.node.created",
  WorkGraphNodeUpdated = "workgraph.node.updated",
  WorkGraphNodeDeleted = "workgraph.node.deleted",
  WorkGraphStateChanged = "workgraph.state.changed",
  WorkGraphExported = "workgraph.exported",

  // Scheduler events
  TaskScheduled = "scheduler.task.scheduled",
  TaskDequeued = "scheduler.task.dequeued",
  TaskRescheduled = "scheduler.task.rescheduled",
  SchedulerQueueFull = "scheduler.queue.full",
  SchedulerHealthChecked = "scheduler.health.checked",

  // Dispatcher events
  TaskDispatched = "dispatcher.task.dispatched",
  TaskDispatchFailed = "dispatcher.task.dispatch.failed",
  TaskCompleted = "dispatcher.task.completed",
  TaskFailed = "dispatcher.task.failed",
  TaskRetrying = "dispatcher.task.retrying",
  TaskCancelled = "dispatcher.task.cancelled",

  // Worker events
  WorkerRegistered = "worker.registered",
  WorkerUnregistered = "worker.unregistered",
  WorkerHeartbeat = "worker.heartbeat",
  WorkerOffline = "worker.offline",
  WorkerCapacityChanged = "worker.capacity.changed",

  // Provider events
  ProviderRegistered = "provider.registered",
  ProviderUnregistered = "provider.unregistered",
  ProviderHealthChecked = "provider.health.checked",
  ProviderError = "provider.error",
  InferenceStarted = "inference.started",
  InferenceFinished = "inference.finished",
  InferenceFailed = "inference.failed",

  // Knowledge events
  KnowledgeIndexed = "knowledge.indexed",
  KnowledgeQueried = "knowledge.queried",
  KnowledgeUpdated = "knowledge.updated",
  KnowledgeDeleted = "knowledge.deleted",

  // Workspace events
  WorkspaceFileChanged = "workspace.file.changed",
  WorkspaceSnapshotCreated = "workspace.snapshot.created",
  WorkspaceSnapshotRestored = "workspace.snapshot.restored",

  // Experiment events
  ExperimentStarted = "experiment.started",
  ExperimentCompleted = "experiment.completed",
  ExperimentFailed = "experiment.failed",

  // Metrics events
  MetricsCollected = "metrics.collected",
  MetricsExported = "metrics.exported",

  // Log events
  LogProduced = "log.produced",

  // Recovery events
  RecoveryInitiated = "recovery.initiated",
  RecoveryCompleted = "recovery.completed",

  // Sub-agent events
  SubAgentCreated = "subagent.created",
  SubAgentCompleted = "subagent.completed",
  SubAgentFailed = "subagent.failed",
}

/**
 * Base event structure - all events extend this.
 */
export interface BaseEvent<TType extends EventType = EventType> {
  /** Unique event identifier */
  id: EventId;

  /** Event type identifier */
  type: TType;

  /** ISO 8601 timestamp of event creation */
  timestamp: Timestamp;

  /** Severity level for the event */
  severity: EventSeverity;

  /** Source subsystem that generated this event */
  source: string;

  /** Correlation identifier for tracing across subsystems */
  correlationId: string;

  /** Causation identifier - ID of the event that caused this event */
  causationId?: EventId;

  /** Version of the event schema */
  version: number;
}

/**
 * Generic payload container for typed events.
 */
export interface EventPayload {
  [key: string]: unknown;
}

/**
 * Typed event with payload.
 */
export interface TypedEvent<
  TType extends EventType,
  TPayload extends EventPayload
> extends BaseEvent<TType> {
  /** Event-specific payload data */
  payload: TPayload;
}

// ============================================================================
// Runtime Lifecycle Events
// ============================================================================

export interface RuntimeStartingPayload extends EventPayload {
  version: string;
  environment: string;
  configHash: string;
}

export interface RuntimeStartedPayload extends EventPayload {
  uptimeMs: number;
  componentsInitialized: string[];
}

export interface RuntimeStoppingPayload extends EventPayload {
  reason: string;
  activeTasks: number;
}

// ============================================================================
// Mission Events
// ============================================================================

export interface MissionUpdatedPayload extends EventPayload {
  missionId: string;
  changes: string[];
  validated: boolean;
}

export interface MissionValidatedPayload extends EventPayload {
  missionId: string;
  validator: string;
  constraints: string[];
}

// ============================================================================
// Work Graph Events
// ============================================================================

export interface WorkGraphNodeCreatedPayload extends EventPayload {
  nodeId: string;
  nodeType: string;
  title: string;
  dependencies: string[];
}

export interface WorkGraphNodeUpdatedPayload extends EventPayload {
  nodeId: string;
  previousState: string;
  newState: string;
  changes: string[];
}

export interface WorkGraphNodeDeletedPayload extends EventPayload {
  nodeId: string;
  reason: string;
}

// ============================================================================
// Scheduler Events
// ============================================================================

export interface TaskScheduledPayload extends EventPayload {
  taskId: string;
  priority: number;
  capability: string;
  estimatedCost: number;
  queuePosition: number;
}

export interface TaskDequeuedPayload extends EventPayload {
  taskId: string;
  selectedWorkerId?: string;
  reason: string;
}

// ============================================================================
// Dispatcher Events
// ============================================================================

export interface TaskDispatchedPayload extends EventPayload {
  taskId: string;
  workerId: string;
  providerName: string;
  dispatchTimeMs: number;
}

export interface TaskCompletedPayload extends EventPayload {
  taskId: string;
  workerId: string;
  durationMs: number;
  tokensUsed?: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// Worker Events
// ============================================================================

export interface WorkerRegisteredPayload extends EventPayload {
  workerId: string;
  workerType: string;
  capabilities: string[];
  maxConcurrency: number;
}

export interface WorkerHeartbeatPayload extends EventPayload {
  workerId: string;
  status: string;
  activeTasks: number;
  capacityRemaining: number;
}

// ============================================================================
// Provider Events
// ============================================================================

export interface ProviderRegisteredPayload extends EventPayload {
  providerName: string;
  providerType: string;
  capabilities: string[];
  models: string[];
}

export interface InferenceStartedPayload extends EventPayload {
  inferenceId: string;
  providerName: string;
  modelName: string;
  taskId?: string;
  estimatedTokens?: number;
}

// ============================================================================
// Knowledge Events
// ============================================================================

export interface KnowledgeIndexedPayload extends EventPayload {
  knowledgeId: string;
  category: string;
  sourceNodeId?: string;
  vectorDimensions?: number;
}

// ============================================================================
// Workspace Events
// ============================================================================

export interface WorkspaceFileChangedPayload extends EventPayload {
  filePath: string;
  changeType: "created" | "modified" | "deleted";
  fileSize?: number;
}

// ============================================================================
// Experiment Events
// ============================================================================

export interface ExperimentStartedPayload extends EventPayload {
  experimentId: string;
  hypothesis: string;
  relatedNodeId?: string;
}

// ============================================================================
// Metrics Events
// ============================================================================

export interface MetricsCollectedPayload extends EventPayload {
  metricCount: number;
  categories: string[];
  source: string;
}

// ============================================================================
// Recovery Events
// ============================================================================

export interface RecoveryInitiatedPayload extends EventPayload {
  reason: string;
  lastKnownState?: string;
  targetNodeId?: string;
}

// ============================================================================
// Sub-Agent Events
// ============================================================================

export interface SubAgentCreatedPayload extends EventPayload {
  subAgentId: string;
  parentTaskId: string;
  role: string;
  capabilities: string[];
}

// ============================================================================
// Event Type to Payload Mapping
// ============================================================================

/**
 * Maps every EventType to its corresponding payload type.
 * Enables type-safe event handling via discriminated unions.
 */
export interface EventPayloadMap {
  // Runtime lifecycle
  [EventType.RuntimeStarting]: RuntimeStartingPayload;
  [EventType.RuntimeStarted]: RuntimeStartedPayload;
  [EventType.RuntimeStopping]: RuntimeStoppingPayload;
  [EventType.RuntimeStopped]: unknown;

  // Mission
  [EventType.MissionUpdated]: MissionUpdatedPayload;
  [EventType.MissionValidated]: MissionValidatedPayload;
  [EventType.MissionFailed]: EventPayload;

  // Work graph
  [EventType.WorkGraphNodeCreated]: WorkGraphNodeCreatedPayload;
  [EventType.WorkGraphNodeUpdated]: WorkGraphNodeUpdatedPayload;
  [EventType.WorkGraphNodeDeleted]: WorkGraphNodeDeletedPayload;
  [EventType.WorkGraphStateChanged]: EventPayload;
  [EventType.WorkGraphExported]: EventPayload;

  // Scheduler
  [EventType.TaskScheduled]: TaskScheduledPayload;
  [EventType.TaskDequeued]: TaskDequeuedPayload;
  [EventType.TaskRescheduled]: EventPayload;
  [EventType.SchedulerQueueFull]: EventPayload;
  [EventType.SchedulerHealthChecked]: EventPayload;

  // Dispatcher
  [EventType.TaskDispatched]: TaskDispatchedPayload;
  [EventType.TaskDispatchFailed]: EventPayload;
  [EventType.TaskCompleted]: TaskCompletedPayload;
  [EventType.TaskFailed]: EventPayload;
  [EventType.TaskRetrying]: EventPayload;
  [EventType.TaskCancelled]: EventPayload;

  // Worker
  [EventType.WorkerRegistered]: WorkerRegisteredPayload;
  [EventType.WorkerUnregistered]: EventPayload;
  [EventType.WorkerHeartbeat]: WorkerHeartbeatPayload;
  [EventType.WorkerOffline]: EventPayload;
  [EventType.WorkerCapacityChanged]: EventPayload;

  // Provider
  [EventType.ProviderRegistered]: ProviderRegisteredPayload;
  [EventType.ProviderUnregistered]: EventPayload;
  [EventType.ProviderHealthChecked]: EventPayload;
  [EventType.ProviderError]: EventPayload;
  [EventType.InferenceStarted]: InferenceStartedPayload;
  [EventType.InferenceFinished]: EventPayload;
  [EventType.InferenceFailed]: EventPayload;

  // Knowledge
  [EventType.KnowledgeIndexed]: KnowledgeIndexedPayload;
  [EventType.KnowledgeQueried]: EventPayload;
  [EventType.KnowledgeUpdated]: EventPayload;
  [EventType.KnowledgeDeleted]: EventPayload;

  // Workspace
  [EventType.WorkspaceFileChanged]: WorkspaceFileChangedPayload;
  [EventType.WorkspaceSnapshotCreated]: EventPayload;
  [EventType.WorkspaceSnapshotRestored]: EventPayload;

  // Experiment
  [EventType.ExperimentStarted]: ExperimentStartedPayload;
  [EventType.ExperimentCompleted]: EventPayload;
  [EventType.ExperimentFailed]: EventPayload;

  // Metrics
  [EventType.MetricsCollected]: MetricsCollectedPayload;
  [EventType.MetricsExported]: EventPayload;

  // Log
  [EventType.LogProduced]: EventPayload;

  // Recovery
  [EventType.RecoveryInitiated]: RecoveryInitiatedPayload;
  [EventType.RecoveryCompleted]: EventPayload;

  // Sub-agent
  [EventType.SubAgentCreated]: SubAgentCreatedPayload;
  [EventType.SubAgentCompleted]: EventPayload;
  [EventType.SubAgentFailed]: EventPayload;
}

/**
 * Generic event type that maps to the correct payload for each event type.
 * Uses EventPayload as a safe union type for all payloads since they all extend EventPayload.
 */
export type RuntimeEvent<TType extends EventType = EventType> = TypedEvent<TType, EventPayload>;
