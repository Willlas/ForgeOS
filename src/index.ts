/**
 * Autonomous Engineering Runtime - Main Entry Point
 *
 * Exports all core subsystems for external use.
 * This is the public API surface of the Runtime.
 *
 * @module aer
 */

// ============================================================================
// Runtime Core
// ============================================================================

export { Runtime, RuntimeState, createRuntime, createDefaultConfig } from "./core/runtime.js";
export type { RuntimeConfig, RuntimeHealth } from "./core/runtime.js";

// ============================================================================
// Event Bus
// ============================================================================

export {
  EventBus,
  getEventBus,
  initializeEventBus,
  shutdownEventBus,
} from "./core/eventbus.js";
export type {
  RuntimeEvent,
  EventHandler,
  EventFilter,
  EventSubscription,
  EventBusStats,
} from "./core/eventbus.js";

// ============================================================================
// Types
// ============================================================================

export * from "./core/types/index.js";

// ============================================================================
// Workspace
// ============================================================================

export { Workspace } from "./core/workspace.js";
export type { WorkspaceConfig, WorkspaceSnapshot } from "./core/workspace.js";

// ============================================================================
// Knowledge System
// ============================================================================

export {
  KnowledgeManager,
  InMemoryKnowledgeStore,
  createKnowledgeItem,
  KnowledgeType,
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

// ============================================================================
// Metrics
// ============================================================================

export {
  MetricsCollector,
  RuntimeMetrics,
  MetricType,
  Counter,
  Gauge,
  Histogram,
  Timer,
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

// ============================================================================
// Logging
// ============================================================================

export {
  LogLevel,
  parseLogLevel,
  LogManager,
  Logger,
  ConsoleLogTarget,
  FileLogTarget,
  InMemoryLogTarget,
  NullLogTarget,
  LogFilter,
  createDefaultLogger,
  createBenchmark,
} from "./core/logging.js";
export type {
  LogEvent,
  ILogTarget,
  LoggerConfig,
} from "./core/logging.js";

// ============================================================================
// Work Graph
// ============================================================================

export * from "./core/types/work-graph.js";

// ============================================================================
// Provider System
// ============================================================================

export * from "./core/types/provider.js";

// ============================================================================
// Note: The following subsystems are planned but not yet implemented:
// - Ollama Provider
// - Scheduler
// - Dispatcher
// - Worker Runtime
// - Agent Registry
// - CLI
// 
// They will be added in subsequent milestones.

// ============================================================================
// Version
// ============================================================================

export const VERSION = "0.1.0";