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
