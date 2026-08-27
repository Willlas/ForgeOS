/**
 * IPC Command Protocol / RPC Schema Definitions
 *
 * Defines message structure, command types, request/response structures,
 * error codes, and correlation IDs for communication between CLI and daemon.
 */

// ============================================================================
// Command Types
// ============================================================================

export enum IPCCommand {
  // Lifecycle
  RuntimeStart = "runtime:start",
  RuntimeStop = "runtime:stop",
  RuntimeStatus = "runtime:status",
  RuntimePause = "runtime:pause",
  RuntimeResume = "runtime:resume",

  // Health
  HealthCheck = "health:check",

  // Event Bus
  EventsList = "events:list",

  // Workspace
  WorkspaceGetInfo = "workspace:get-info",
  WorkspaceSnapshot = "workspace:snapshot",

  // Knowledge
  KnowledgeQuery = "knowledge:query",
  KnowledgeGetState = "knowledge:get-state",

  // Metrics
  MetricsGet = "metrics:get",
  MetricsReset = "metrics:reset",

  // Logging
  LogsGet = "logs:get",
  LogLevelSet = "log:level:set",

  // Config
  ConfigGet = "config:get",

  // Inference
  Ask = "inference:ask",
  WorkspaceRead = "workspace:read",
}

// ============================================================================
// Error Codes
// ============================================================================

export enum IPCErrorCode {
  Success = 0,
  UnknownCommand = 1,
  InvalidPayload = 2,
  DaemonNotRunning = 3,
  RuntimeNotInitialized = 4,
  Timeout = 5,
  InternalError = 6,
  SerializationError = 7,
  ConnectionRefused = 8,
}

export interface IPCError {
  code: IPCErrorCode;
  message: string;
  details?: unknown;
}

// ============================================================================
// Message Envelope
// ============================================================================

export interface IPCRequest {
  /** Unique correlation ID for request/response matching */
  id: string;

  /** Command identifier */
  command: IPCCommand;

  /** Command payload (command-specific) */
  payload?: unknown;

  /** Timestamp when request was created */
  timestamp: number;

  /** Optional timeout override in ms */
  timeout?: number;
}

export interface IPCResponse {
  /** Matches the request ID */
  id: string;

  /** Whether the operation succeeded */
  success: boolean;

  /** Response data (if successful) */
  data?: unknown;

  /** Error information (if failed) */
  error?: IPCError;

  /** Timestamp when response was created */
  timestamp: number;
}

/** Asynchronous event pushed from daemon to CLI */
export interface IPCEvent {
  /** Event type identifier */
  type: string;

  /** Event payload */
  data: unknown;

  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Payload Types
// ============================================================================

export interface RuntimeStatusPayload {
  state: string;
  startedAt: string;
  config: Record<string, unknown>;
}

export interface HealthCheckPayload {
  healthy: boolean;
  state: string;
  uptimeSeconds: number;
  startedAt: string;
  components: Record<string, boolean>;
  resources?: Record<string, unknown>;
  errors: string[];
}

export interface ConfigGetPayload {
  config: Record<string, unknown>;
}

export interface AskPayload {
  prompt: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  modelId?: string;
  providerId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AskResponsePayload {
  content: string;
  modelId: string;
  tokensUsed: number;
  latencyMs: number;
}

export interface WorkspaceReadPayload {
  rootPath: string;
  relativePath: string;
  mode?: "read-only" | "read-write";
}

export interface WorkspaceReadResponsePayload {
  rootPath: string;
  relativePath: string;
  content: string;
}

// ============================================================================
// Timeout Configuration
// ============================================================================

const DEFAULT_TIMEOUT = 5000;
const LONG_OPERATION_TIMEOUT = 30000;
const INFERENCE_TIMEOUT = 120000;

export const COMMAND_TIMEOUTS: Record<IPCCommand, number> = {
  [IPCCommand.RuntimeStart]: LONG_OPERATION_TIMEOUT,
  [IPCCommand.RuntimeStop]: LONG_OPERATION_TIMEOUT,
  [IPCCommand.RuntimeStatus]: DEFAULT_TIMEOUT,
  [IPCCommand.RuntimePause]: DEFAULT_TIMEOUT,
  [IPCCommand.RuntimeResume]: DEFAULT_TIMEOUT,
  [IPCCommand.HealthCheck]: DEFAULT_TIMEOUT,
  [IPCCommand.EventsList]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceGetInfo]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceSnapshot]: LONG_OPERATION_TIMEOUT,
  [IPCCommand.KnowledgeQuery]: DEFAULT_TIMEOUT,
  [IPCCommand.KnowledgeGetState]: DEFAULT_TIMEOUT,
  [IPCCommand.MetricsGet]: DEFAULT_TIMEOUT,
  [IPCCommand.MetricsReset]: DEFAULT_TIMEOUT,
  [IPCCommand.LogsGet]: DEFAULT_TIMEOUT,
  [IPCCommand.LogLevelSet]: DEFAULT_TIMEOUT,
  [IPCCommand.ConfigGet]: DEFAULT_TIMEOUT,
  [IPCCommand.Ask]: INFERENCE_TIMEOUT,
  [IPCCommand.WorkspaceRead]: DEFAULT_TIMEOUT,
};

export function getTimeoutForCommand(command: IPCCommand): number {
  return COMMAND_TIMEOUTS[command] ?? DEFAULT_TIMEOUT;
}

// ============================================================================
// Correlation ID Generation
// ============================================================================

let idCounter = 0;

export function generateRequestId(): string {
  return `req_${Date.now()}_${++idCounter}`;
}
