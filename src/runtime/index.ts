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
