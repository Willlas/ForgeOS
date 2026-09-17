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
  WorkspaceList = "workspace:list",
  WorkspaceSearch = "workspace:search",
  WorkspaceExecute = "workspace:execute",
  /**
   * Cancel an in-flight workspace operation by its opId (idempotent).
   * The first call triggers cancellation; later calls report
   * `alreadyFinished: true` without side effects.
   */
  WorkspaceCancel = "workspace:cancel",
  /**
   * Authenticated handshake: a socket must complete this before any other
   * request is accepted. Unauthenticated requests are rejected.
   */
  SessionHello = "session:hello",
  WorkspacePreview = "workspace:preview",
  WorkspaceApprove = "workspace:approve",
  WorkspaceApply = "workspace:apply",

  // Session Grant Management
  WorkspaceGrant = "workspace:grant",
  WorkspaceRevoke = "workspace:revoke",
  WorkspaceGrantList = "workspace:grant:list",
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
  /** The workspace file changed since the approval was issued (expected-hash mismatch). */
  HashConflict = 9,
  /** A read-write change requires an explicit approval that was not provided. */
  ApprovalRequired = 10,
  /** The approval is missing, expired, or does not bind this session/grant/diff. */
  ApprovalRejected = 11,
  /** A write failed and restoring the pre-change state also failed. */
  RollbackFailed = 12,
  /** Socket has not completed the `session:hello` handshake. */
  Unauthenticated = 13,
  /** Requested sessionId does not match the session bound to the socket. */
  SessionMismatch = 14,
  /** Command rejected by policy (allowlist, read-only mode, unsafe command). */
  CommandRejected = 15,
  /** A session id is already claimed by another active socket (impersonation guard). */
  SessionInUse = 16,
}

export interface IPCError {
  code: IPCErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Error carrying a stable IPC protocol error code. Server-side code throws
 * these so a specific code reaches the client (e.g. unknown command →
 * `ProtocolViolation`) instead of always degrading to
 * {@link IPCErrorCode.InternalError}.
 */
export class IpcProtocolError extends Error {
  readonly code: IPCErrorCode;
  readonly details?: unknown;

  constructor(code: IPCErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "IpcProtocolError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
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

  /** Optional session used to isolate tool grants and conversation state. */
  sessionId?: string;
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

export interface IPCToolCall {
  id: string;
  sessionId: string;
  tool: string;
  input: unknown;
}

export interface IPCToolResult {
  id: string;
  sessionId: string;
  tool: string;
  success: boolean;
  output?: unknown;
  error?: IPCError;
}

export interface ToolApprovalRequest {
  toolCallId: string;
  sessionId: string;
  summary: string;
  requestedAt: number;
}

export interface ToolCancelRequest {
  toolCallId: string;
  sessionId: string;
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

export interface WorkspaceListPayload {
  rootPath: string;
  relativePath?: string;
}

export interface WorkspaceSearchPayload {
  rootPath: string;
  query: string;
}

export interface WorkspaceExecutePayload {
  rootPath: string;
  command: string;
  args?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface SessionHelloPayload {
  /** Optional client-declared session id (e.g. `AER_SESSION_ID`). */
  declaredSessionId?: string;
}

export interface SessionHelloResponsePayload {
  /** The session id the server bound to this socket. */
  sessionId: string;
  issuedAt: string;
}

export interface WorkspaceCancelPayload {
  opId: string;
  reason?: string;
}

export interface WorkspaceCancelResponsePayload {
  cancelled: boolean;
  alreadyFinished: boolean;
}

/**
 * Ordered lifecycle phase for an in-flight workspace operation:
 * `start` → `progress`* → exactly one final phase (`result` | `error` | `cancel`).
 * Events are written to the owning socket in emission order, so a consumer
 * observes a single deterministic sequence per operation.
 */
export type IPCToolEventPhase = "start" | "progress" | "result" | "error" | "cancel";

/** Payload for the daemon → client `tool:event` stream (one IPCEvent per phase). */
export interface IPCToolEventData {
  phase: IPCToolEventPhase;
  /** Correlates all phases of one operation (also usable for `workspace:cancel`). */
  opId: string;
  sessionId: string;
  command: string;
  /** progress phase: which stream the chunk arrived on. */
  stream?: "stdout" | "stderr";
  /** progress phase: the captured text chunk. */
  chunk?: string;
  /** progress phase: cumulative captured output bytes. */
  totalBytes?: number;
  /** Final result payload (result and cancel phases). */
  result?: unknown;
  /** Error / cancellation reason (error and cancel phases). */
  message?: string;
}

// ----------------------------------------------------------------------------
// Workspace Apply flow (preview -> approve -> apply)
// ----------------------------------------------------------------------------

/** A single proposed file mutation. `expectedHash` is the sha256 of the file
 *  content the change is based on (defaults to the current content hash). */
export interface WorkspaceApplyChangePayload {
  relativePath: string;
  content: string;
  expectedHash?: string;
}

export interface WorkspacePreviewPayload {
  rootPath: string;
  changes: WorkspaceApplyChangePayload[];
}

export interface WorkspacePreviewFileInfoPayload {
  relativePath: string;
  expectedHash: string;
  size: number;
}

export interface WorkspacePreviewResponsePayload {
  rootPath: string;
  /** Deterministic fingerprint of the change set — bind the approval to this. */
  diffHash: string;
  files: WorkspacePreviewFileInfoPayload[];
}

export interface WorkspaceApprovePayload {
  rootPath: string;
  diffHash: string;
  expiresInSeconds?: number;
}

/** Audit-safe approval record. The secret token is never included. */
export interface WorkspaceApproveResponsePayload {
  approvalId: string;
  sessionId: string;
  grantId: string;
  rootPath: string;
  diffHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface WorkspaceApplyPayload {
  rootPath: string;
  approvalId: string;
  changes: WorkspaceApplyChangePayload[];
}

export interface WorkspaceApplyResponsePayload {
  rootPath: string;
  applied: boolean;
  rolledBack: boolean;
  restored: string[];
  files: Array<{ relativePath: string; previousHash: string; newHash: string }>;
  diffHash: string;
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
  [IPCCommand.WorkspaceList]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceSearch]: LONG_OPERATION_TIMEOUT,
  [IPCCommand.WorkspaceExecute]: LONG_OPERATION_TIMEOUT,
  [IPCCommand.WorkspaceGrant]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceRevoke]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceGrantList]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspacePreview]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceApprove]: DEFAULT_TIMEOUT,
  [IPCCommand.WorkspaceApply]: LONG_OPERATION_TIMEOUT,
  [IPCCommand.WorkspaceCancel]: DEFAULT_TIMEOUT,
  [IPCCommand.SessionHello]: DEFAULT_TIMEOUT,
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
