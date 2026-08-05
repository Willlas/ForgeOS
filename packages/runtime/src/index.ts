/**
 * Runtime module - Execution runtime components.
 *
 * @module runtime/index
 */

export { 
  Dispatcher, 
  createDispatcher, 
  DispatcherState, 
  LoadBalancingStrategy, 
  FailurePropagationMode,
  TaskRouteStatus,
  createDefaultDispatcherConfig 
} from "./dispatcher.js";

export type { 
  DispatcherConfig, 
  DispatcherMetrics, 
  DispatcherHealth, 
  DispatcherEventType,
  RoutingDecision, 
  TaskRoute, 
  RetryPolicy, 
  RetryRecord,
  WorkerRegistration,
  WorkerPool 
} from "./dispatcher.js";

export { 
  ExecutionEngine, 
  EngineEvent,
  createDefaultExecutionEngineConfig 
} from "./engine.js";

export type { 
  ExecutionEngineConfig, 
  WorkflowSubmission, 
  WorkflowResult 
} from "./engine.js";

export { 
  WorkerRuntime, 
  WorkerRuntimeState, 
  WorkerPoolState 
} from "./worker-runtime.js";

export type { 
  WorkerPool as RuntimeWorkerPool, 
  WorkerRuntimeConfig, 
  HeartbeatInfo, 
  WorkerRuntimeMetrics, 
  WorkerPoolConfig 
} from "./worker-runtime.js";

export { 
  ExecutionContext, 
  ExecutionContextState 
} from "./context.js";

export type { 
  ExecutionContextConfig, 
  ExecutionSpan 
} from "./context.js";

export type { CancellationTokenSource } from "./cancellation.js";
export { CancellationToken } from "./cancellation.js";

// Workflow Runtime exports
export { 
  WorkflowEngine, 
  WorkflowExecutionContext, 
  WorkflowExecutionEngine,
  WorkflowStatus, 
  WorkflowEvent,
  EngineeringWorkflowType, 
  EngineeringWorkflowBuilder,
  createStandardEngineeringWorkflows,
  createDefaultWorkflowEngineConfig,
} from "./workflow-engine.js";

export type { 
  WorkflowEngineConfig, 
  WorkflowExecutionPlan, 
  WorkflowNodeResult 
} from "./workflow-engine.js";

// Multi-Agent Runtime exports
export { 
  Agent, 
  AgentState, 
  createDefaultAgentConfig 
} from "./agent.js";

export type { 
  AgentConfig, 
  ConversationEntry, 
  AgentMemory, 
  MemoryEntry, 
  SemanticEntry,
  AgentCapability,
  AgentMetrics,
  GenerationOptions,
  GenerationResult,
  StreamChunk,
  IAgent 
} from "./agent.js";

export { 
  AgentRegistry, 
  createDefaultAgentRegistryConfig 
} from "./agent-registry.js";

export type { 
  AgentRegistryConfig, 
  AgentRegistration 
} from "./agent-registry.js";

export { 
  AgentTeam, 
  TeamState, 
  TeamRole, 
  TaskStatus, 
  TeamEvent,
  createDefaultTeamConfig 
} from "./agent-team.js";

export type { 
  TeamConfig, 
  TeamMetrics, 
  AgentAssignment, 
  DecomposedTask 
} from "./agent-team.js";

export { 
  SharedExecutionContext, 
  ContextEvent 
} from "./shared-context.js";

export type { 
  ContextEntry, 
  Snapshot 
} from "./shared-context.js";

// IPC Communication exports
export { IpcTransport, getIpcSocketPath } from "./ipc-transport.js";
export { IpcServer } from "./ipc-server.js";
export {
  IPCCommand,
  IPCErrorCode,
  generateRequestId,
  getTimeoutForCommand,
} from "./ipc-protocol.js";
export type {
  IPCRequest,
  IPCResponse,
  IPCError,
  IPCEvent,
  RuntimeStatusPayload,
  HealthCheckPayload,
  ConfigGetPayload,
} from "./ipc-protocol.js";

// Runtime Core exports
export { Runtime, RuntimeState, createRuntime, createDefaultConfig } from "./core/runtime.js";
export type { RuntimeConfig, RuntimeHealth } from "./core/runtime.js";

// Core Subsystem exports — EventBus
export { EventBus, getEventBus, initializeEventBus, shutdownEventBus } from "./core/eventbus.js";
export type { RuntimeEvent, EventHandler, EventFilter, EventSubscription, EventBusStats } from "./core/eventbus.js";

// Core Subsystem exports — Workspace
export {
  Workspace,
  WorkspaceEventType,
  DEFAULT_WORKSPACE_CONFIG,
  INDEX_VERSION,
  createWorkspace,
  createDefaultWorkspace,
} from "./core/workspace.js";
export type {
  FileReadResult,
  FileWriteResult,
  FileMetadata,
  WorkspaceConfig,
  WorkspaceSnapshot,
  SnapshotFile,
  WorkspaceIndex,
  WorkspaceChange,
  WorkspaceDiff,
  DiffFile,
} from "./core/workspace.js";

// Core Subsystem exports — Knowledge
export {
  KnowledgeType,
  InMemoryKnowledgeStore,
  KnowledgeManager,
  createKnowledgeItem,
  createKnowledgeManager,
} from "./core/knowledge.js";
export type {
  KnowledgeItem,
  KnowledgeQuery,
  KnowledgeQueryResult,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraph,
  LessonLearned,
  IKnowledgeStore,
} from "./core/knowledge.js";

// Core Subsystem exports — Metrics
export {
  MetricType,
  Counter,
  Gauge,
  Histogram,
  Timer,
  MetricsCollector,
  RuntimeMetrics,
  ConsoleMetricExporter,
} from "./core/metrics.js";
export type {
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  TimerOptions,
  CounterValue,
  GaugeValue,
  HistogramValue,
  TimerValue,
  MetricValue,
  IMetricExporter,
} from "./core/metrics.js";

// Core Subsystem exports — Scheduler
export {
  SchedulerEventType,
  SchedulingDecision,
  createDefaultSchedulerConfig,
  Scheduler,
  TaskStatus as SchedulerTaskStatus,
  SchedulerMetrics,
  createScheduler,
} from "./core/scheduler.js";
export type {
  SchedulerConfig,
  InternalPriorityScoringConfig,
  ActiveTaskRecord,
  CompletedTaskRecord,
  SchedulerMetricsSnapshot,
  HistogramSummary,
  SchedulerSummary,
} from "./core/scheduler.js";

// Core Subsystem exports — Logging
export {
  LogLevel,
  parseLogLevel,
  ConsoleLogTarget,
  FileLogTarget,
  InMemoryLogTarget,
  NullLogTarget,
  EventBusLogTarget,
  LogFilter,
  Logger,
  LogManager,
  createDefaultLogger,
  createBenchmark,
} from "./core/logging.js";
export type { LogEvent, ILogTarget, LoggerConfig } from "./core/logging.js";

// Core Subsystem exports — WorkGraph
export {
  WorkGraphEngine,
  generateNodeId,
  createWorkNode,
  createWorkGraph,
  WorkNodeState,
  WorkNodeType,
  WorkGraphLifecycleState,
} from "./core/workgraph.js";
export type {
  WorkNode,
  WorkGraph,
  WorkNodeFilter,
  WorkGraphQueryResult,
  PriorityScore,
  PriorityScoringConfig,
  AddNodeResult,
  NodeRemovedResult,
} from "./core/workgraph.js";

// Configuration exports
export { Config } from "./config/index.js";
export { Models } from "./config/models.js";

// Provider interface exports
export {
  DEFAULT_SAMPLING_PARAMS,
  ProviderRegistry,
  registerProvider,
  createProvider,
  listAvailableProviders,
  WorkerStatus,
} from "./core/types/provider.js";
export type {
  ProviderCapabilities,
  BaseProviderConfig,
  OllamaProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  ProviderConfig,
  MessageContent,
  Message,
  ToolCall,
  ToolResult,
  InferenceRequest,
  InferenceConstraints,
  ModelSamplingParams,
  ToolDefinition,
  GeneratedToken,
  UsageMetrics,
  ToolCallResult,
  InferenceResponse,
  IProvider,
  ProviderHealthStatus,
  ProviderModelInfo,
  InferenceStreamChunk,
  ProviderFactory,
  IWorker,
  WorkerHealthStatus,
  TaskExecutionResult,
  ExecutionArtifact,
} from "./core/types/provider.js";

// Provider implementation exports
export { OllamaProvider, ProviderWorker, registerDefaultProviders } from "./providers/index.js";

// Agent Execution Coordinator exports
export {
  AgentExecutionCoordinator,
  getAgentExecutionCoordinator,
  resetAgentExecutionCoordinator,
} from "./agent-execution-coordinator.js";
export type { ExecutionRequest, ExecutionResult } from "./agent-execution-coordinator.js";

// Persistence — PID Manager exports
export {
  getPidFilePath,
  writePidFile,
  readPidFile,
  removePidFile,
  isPidAlive,
  isStale,
  validatePid,
  cleanupStale,
} from "./persistence/pid-manager.js";

// Persistence — State Store exports
export {
  SNAPSHOT_SCHEMA_VERSION,
  getSnapshotPath,
  writeSnapshot,
  readSnapshot,
  removeSnapshot,
  getLastHeartbeat,
} from "./persistence/state-store.js";
export type { RuntimeStateSnapshot } from "./persistence/state-store.js";

// Persistence — Health Check exports
export { checkHealth } from "./persistence/health-check.js";
export type { HealthStatus, HealthCheckResult } from "./persistence/health-check.js";
