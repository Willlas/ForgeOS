/**
 * IPC Server Handler
 * Runs inside the daemon process, receives IPC messages, dispatches to Runtime methods, returns responses.
 */

import { EventEmitter } from "events";
import net from "net";
import { IpcTransport, getIpcSocketPath } from "./ipc-transport.js";
import {
  IPCCommand,
  IPCRequest,
  IPCResponse,
  IPCEvent,
  IPCErrorCode,
  IpcProtocolError,
} from "./ipc-protocol.js";
import type {
  WorkspaceExecutePayload,
  SessionHelloPayload,
  SessionHelloResponsePayload,
  WorkspaceCancelPayload,
  IPCToolEventData,
} from "./ipc-protocol.js";

export class IpcServer extends EventEmitter {
  private transport: IpcTransport;
  private handlers = new Map<IPCCommand, (payload?: unknown) => Promise<unknown>>();
  private runtimeInstance: any = null;
  private socketPath: string;

  // Per-socket session binding (sprint011 task 10). A socket may use only the
  // session id it bound at `session:hello`; concurrent clients are isolated by
  // socket, and responses + streamed events route to the owning socket only.
  private boundSessions = new Map<net.Socket, string>();
  /** session id -> the live socket that claims it (impersonation guard). */
  private sessionOwners = new Map<string, net.Socket>();
  /** opId -> owning socket, so `workspace:cancel` is isolated per session. */
  private operationOwners = new Map<string, net.Socket>();

  /** Commands that operate on session-scoped state and require a bound session. */
  private static readonly sessionRequired = new Set<IPCCommand>([
    IPCCommand.WorkspaceRead,
    IPCCommand.WorkspaceList,
    IPCCommand.WorkspaceSearch,
    IPCCommand.WorkspaceExecute,
    IPCCommand.WorkspaceCancel,
    IPCCommand.WorkspacePreview,
    IPCCommand.WorkspaceApprove,
    IPCCommand.WorkspaceApply,
    IPCCommand.WorkspaceGrant,
    IPCCommand.WorkspaceRevoke,
    IPCCommand.WorkspaceGrantList,
  ]);

  constructor(socketPath?: string) {
    super();
    this.transport = new IpcTransport();
    this.socketPath = socketPath || getIpcSocketPath();
    this.transport.on("message", (msg, socket) => {
      void this.handleMessage(msg, socket);
    });
    this.transport.on("clientConnected", (socket) => this.handleClientConnected(socket));
    this.transport.on("clientDisconnected", (socket) => this.handleClientDisconnected(socket));
    this.transport.on("error", (err) => this.emit("error", err));
  }

  setRuntime(runtime: any): void {
    this.runtimeInstance = runtime;
  }

  /** Register a custom handler for a command (overrides default dispatch). */
  registerHandler(command: IPCCommand, handler: (payload?: unknown) => Promise<unknown>): void {
    this.handlers.set(command, handler);
  }

  /** Dispatch an IPC request to the appropriate Runtime method. */
  private async dispatchRequest(command: IPCCommand, payload?: unknown, claimedSessionId?: string, socket?: net.Socket): Promise<unknown> {
    if (!this.runtimeInstance) {
      throw new IpcProtocolError(IPCErrorCode.RuntimeNotInitialized, "Runtime not initialized");
    }
    const rt = this.runtimeInstance;

    // Authenticated handshake binds the socket to a session before any stateful
    // command is accepted.
    if (command === IPCCommand.SessionHello) {
      return this.bindSession(socket, payload as SessionHelloPayload | undefined);
    }

    // Resolve the effective session id. Stateful commands are ALWAYS resolved
    // from the socket's bound session (the claimed id is only a cross-check);
    // other commands fall back to the claimed id or a shared "anonymous" scope.
    const sid = IpcServer.sessionRequired.has(command)
      ? this.resolveBoundSession(socket, claimedSessionId)
      : (claimedSessionId ?? "anonymous");

    switch (command) {
      case IPCCommand.RuntimeStart:
        await rt.start();
        return { status: "running" };
      case IPCCommand.RuntimeStop:
        await rt.stop();
        return { stopped: true };
      case IPCCommand.RuntimeStatus:
        return { state: rt.getState(), config: rt.getConfig() };
      case IPCCommand.RuntimePause:
        await rt.pause();
        return { paused: true };
      case IPCCommand.RuntimeResume:
        await rt.resume();
        return { resumed: true };
      case IPCCommand.HealthCheck:
        return rt.getHealth();
      case IPCCommand.EventsList: {
        const bus = rt.getEventBus();
        if (!bus) throw new Error("EventBus not available");
        return bus.getStats();
      }
      case IPCCommand.KnowledgeQuery: {
        const km = rt.getKnowledgeManager();
        if (!km) throw new Error("KnowledgeManager not available");
        if (typeof payload === "object" && payload !== null && "key" in payload)
          return km.get(String((payload as any).key));
        return km.query({ tagFilters: [], verifiedOnly: false, minConfidence: 0, sortBy: "modifiedAt", sortOrder: "desc", limit: 100, offset: 0 });
      }
      case IPCCommand.KnowledgeGetState: {
        const km = rt.getKnowledgeManager();
        if (!km) throw new Error("KnowledgeManager not available");
        const stats = await km.getStatistics();
        const graph = await km.getGraph();
        return { statistics: stats, graph };
      }
      case IPCCommand.MetricsGet: {
        const metrics = rt.getRuntimeMetrics();
        if (!metrics) {
          throw new Error("RuntimeMetrics are not available. Metrics collection may be disabled.");
        }
        return metrics.getAllMetrics();
      }
      case IPCCommand.ConfigGet:
        return rt.getConfig();
      case IPCCommand.Ask:
        if (typeof payload !== "object" || payload === null || !("prompt" in payload)) {
          throw new Error("Ask requires a payload with 'prompt' field");
        }
        return rt.ask(payload);
      // ---- Session-scoped workspace operations (require registered grant) ----
      case IPCCommand.WorkspaceRead:
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("relativePath" in payload)) {
          throw new Error("WorkspaceRead requires rootPath and relativePath");
        }
        return rt.readAuthorizedWorkspace(payload, sid);
      case IPCCommand.WorkspaceList:
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload)) {
          throw new Error("WorkspaceList requires rootPath");
        }
        return rt.listAuthorizedWorkspace(payload, sid);
      case IPCCommand.WorkspaceSearch:
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("query" in payload)) {
          throw new Error("WorkspaceSearch requires rootPath and query");
        }
        return rt.searchAuthorizedWorkspace(payload, sid);
      case IPCCommand.WorkspaceExecute:
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("command" in payload)) {
          throw new Error("WorkspaceExecute requires rootPath and command");
        }
        return this.executeWithStreaming(payload as WorkspaceExecutePayload, sid, socket);
      case IPCCommand.WorkspaceCancel: {
        const opId = (typeof payload === "object" && payload !== null && "opId" in payload)
          ? String((payload as WorkspaceCancelPayload).opId)
          : "";
        if (!opId) {
          throw new IpcProtocolError(IPCErrorCode.InvalidPayload, "workspace:cancel requires an opId");
        }
        // Per-session cancellation isolation: only the socket that owns the
        // in-flight operation may cancel it.
        const owner = this.operationOwners.get(opId);
        if (owner && owner !== socket) {
          throw new IpcProtocolError(IPCErrorCode.SessionMismatch, "workspace:cancel rejected: operation is owned by another session");
        }
        if (typeof rt.cancelWorkspaceOperation !== "function") {
          throw new IpcProtocolError(IPCErrorCode.InternalError, "Runtime does not support workspace cancellation");
        }
        return rt.cancelWorkspaceOperation(opId);
      }
      case IPCCommand.WorkspacePreview: {
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("changes" in payload)) {
          throw new Error("WorkspacePreview requires rootPath and changes");
        }
        return rt.previewAuthorizedWorkspace(payload, sid);
      }
      case IPCCommand.WorkspaceApprove: {
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("diffHash" in payload)) {
          throw new Error("WorkspaceApprove requires rootPath and diffHash");
        }
        return rt.approveAuthorizedWorkspace(payload, sid);
      }
      case IPCCommand.WorkspaceApply: {
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("approvalId" in payload) || !("changes" in payload)) {
          throw new Error("WorkspaceApply requires rootPath, approvalId and changes");
        }
        return rt.applyAuthorizedWorkspace(payload, sid);
      }
      // ---- Session Grant Management ----
      case IPCCommand.WorkspaceGrant: {
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload)) {
          throw new Error("WorkspaceGrant requires a payload with rootPath");
        }
        return rt.registerSessionGrant(sid, payload);
      }
      case IPCCommand.WorkspaceRevoke: {
        const rootPath = (typeof payload === "object" && payload !== null && "rootPath" in payload)
          ? String((payload as any).rootPath) : undefined;
        return rt.revokeSessionGrant(sid, rootPath);
      }
      case IPCCommand.WorkspaceGrantList:
        return rt.getSessionGrants(sid);
	case IPCCommand.LogsGet: {
		const lm = rt.getLogManager();
		if (!lm) {
			throw new Error("LogManager is not available.");
		}
		return lm.getRecentLogs(100);
	}
	case IPCCommand.MetricsReset: {
		const mc = rt.getMetricsCollector();
		if (!mc) {
			throw new Error("MetricsCollector is not available.");
		}
		mc.reset();
		return { reset: true };
	}
      case IPCCommand.LogLevelSet: {
        if (typeof payload !== "object" || payload === null || !("level" in payload)) {
          throw new Error("LogLevelSet requires a payload with 'level' field");
        }
        const level = String((payload as any).level);
        // The Runtime stores logLevel in its config; mutate it directly
        rt.config.logLevel = (function parseLevel(s: string): number {
          const map: Record<string, number> = {
            trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5, off: 6,
          };
          return map[s.toLowerCase()] ?? 2; // default Info
        })(level);
        return { level };
      }
      case IPCCommand.WorkspaceGetInfo: {
        const ws = rt.getWorkspace();
        if (!ws) throw new Error("Workspace not available");
        return { health: ws.getHealth(), config: ws.getConfig() };
      }
      case IPCCommand.WorkspaceSnapshot: {
        const ws = rt.getWorkspace();
        if (!ws) throw new Error("Workspace not available");
        return ws.createSnapshot();
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async listen(): Promise<void> {
    await this.transport.listen(this.socketPath);
    console.log(`[IPC Server] Listening on ${this.socketPath}`);
  }

  close(): void {
    // Cancel any in-flight workspace operations so a shutting-down daemon never
    // leaves a child process tree running.
    if (this.runtimeInstance) {
      for (const sid of new Set(this.boundSessions.values())) {
        try {
          this.runtimeInstance.cancelWorkspaceOperationsForSession?.(sid);
        } catch {
          // best-effort cancellation
        }
      }
    }
    this.boundSessions.clear();
    this.sessionOwners.clear();
    this.operationOwners.clear();
    this.transport.close();
  }

  private async handleMessage(msg: unknown, socket?: net.Socket): Promise<void> {
    if (typeof msg !== "object" || msg === null || !("id" in msg) || !("command" in msg)) {
      console.warn("[IPC Server] Received invalid message");
      return;
    }

    const request = msg as IPCRequest;
    let response: IPCResponse;

    try {
      // Use custom handler if registered, otherwise fall back to internal dispatch
      const customHandler = this.handlers.get(request.command);
      let result: unknown;
      if (customHandler) {
        result = await customHandler(request.payload);
      } else {
        result = await this.dispatchRequest(request.command, request.payload, request.sessionId, socket);
      }
      response = {
        id: request.id,
        success: true,
        data: result,
        timestamp: Date.now(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const code = err instanceof IpcProtocolError ? err.code : IPCErrorCode.InternalError;
      response = {
        id: request.id,
        success: false,
        error: { code, message: errorMsg, details: err instanceof IpcProtocolError ? err.details : undefined },
        timestamp: Date.now(),
      };
    }

    this.transport.send(response, socket);
  }

  private handleClientConnected(socket: net.Socket): void {
    // The actual binding is completed by `session:hello`; connected sockets are
    // only marked as active until they authenticate. This keeps a clean
    // disconnect lifecycle without creating orphaned grant/session state.
    void socket;
  }

  private handleClientDisconnected(socket: net.Socket): void {
    const sessionId = this.boundSessions.get(socket);
    if (sessionId) {
      this.sessionOwners.delete(sessionId);
      this.boundSessions.delete(socket);
      if (this.runtimeInstance?.cancelWorkspaceOperationsForSession) {
        try {
          this.runtimeInstance.cancelWorkspaceOperationsForSession(sessionId);
        } catch {
          // Best-effort cleanup during disconnect.
        }
      }
    }
    for (const [opId, owner] of this.operationOwners.entries()) {
      if (owner === socket) {
        this.operationOwners.delete(opId);
      }
    }
  }

  private bindSession(socket: net.Socket | undefined, payload?: SessionHelloPayload): SessionHelloResponsePayload {
    if (!socket) {
      throw new IpcProtocolError(IPCErrorCode.Unauthenticated, "Session hello requires a live socket");
    }
    const declared = (payload && typeof payload === "object" && "declaredSessionId" in payload)
      ? String((payload as SessionHelloPayload).declaredSessionId ?? "").trim()
      : "";
    if (!declared) {
      throw new IpcProtocolError(IPCErrorCode.Unauthenticated, "session:hello requires a declaredSessionId");
    }
    const existing = this.boundSessions.get(socket);
    if (existing) {
      if (existing !== declared) {
        throw new IpcProtocolError(IPCErrorCode.SessionMismatch, `Socket is already bound to session '${existing}'`);
      }
      return { sessionId: existing, issuedAt: new Date().toISOString() };
    }
    const currentOwner = this.sessionOwners.get(declared);
    if (currentOwner && currentOwner !== socket) {
      throw new IpcProtocolError(IPCErrorCode.SessionInUse, `Session '${declared}' is already claimed by another socket`);
    }

    this.boundSessions.set(socket, declared);
    this.sessionOwners.set(declared, socket);
    return { sessionId: declared, issuedAt: new Date().toISOString() };
  }

  private resolveBoundSession(socket: net.Socket | undefined, claimedSessionId?: string): string {
    const bound = socket ? this.boundSessions.get(socket) : undefined;
    if (!bound) {
      throw new IpcProtocolError(IPCErrorCode.Unauthenticated, "Socket has not completed the session:hello handshake");
    }
    if (claimedSessionId && claimedSessionId !== bound) {
      throw new IpcProtocolError(IPCErrorCode.SessionMismatch, `Requested sessionId '${claimedSessionId}' does not match the authenticated session '${bound}'`);
    }
    return bound;
  }

  private executeWithStreaming(payload: WorkspaceExecutePayload, sessionId: string, socket?: net.Socket): Promise<unknown> {
    const opId = `wsop_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    if (socket) {
      this.operationOwners.set(opId, socket);
      this.emitToolEvent(socket, opId, sessionId, payload.command, "start");
    }
    return Promise.resolve().then(async () => {
      const runtime = this.runtimeInstance;
      if (!runtime || typeof runtime.executeAuthorizedWorkspace !== "function") {
        throw new IpcProtocolError(IPCErrorCode.RuntimeNotInitialized, "Runtime does not support workspace execution");
      }
      const result = await runtime.executeAuthorizedWorkspace(payload, sessionId, {
        opId,
        onOutput: (stream: "stdout" | "stderr", chunk: string, totalBytes: number) => {
          if (!socket) return;
          this.emitToolEvent(socket, opId, sessionId, payload.command, "progress", { stream, chunk, totalBytes });
        },
        onCancel: () => {
          if (!socket) return;
          this.emitToolEvent(socket, opId, sessionId, payload.command, "cancel", { message: "Operation cancelled" });
        },
      });
      if (socket) {
        // A cancelled operation terminates with the `cancel` phase (not `result`)
        // so a client can distinguish it from a successful run by phase alone.
        // The contract stays "start → progress* → exactly one terminal phase".
        if (result && typeof result === "object" && (result as { cancelled?: boolean }).cancelled) {
          this.emitToolEvent(socket, opId, sessionId, payload.command, "cancel", {
            message: "Operation cancelled",
            result,
          });
        } else {
          this.emitToolEvent(socket, opId, sessionId, payload.command, "result", { result });
        }
      }
      return result;
    }).catch((error) => {
      if (socket) {
        this.emitToolEvent(socket, opId, sessionId, payload.command, "error", { message: error instanceof Error ? error.message : String(error) });
      }
      throw error;
    }).finally(() => {
      if (socket) {
        this.operationOwners.delete(opId);
      }
    });
  }

  private emitToolEvent(socket: net.Socket, opId: string, sessionId: string, command: string, phase: IPCToolEventData["phase"], extra: Record<string, unknown> = {}): void {
    const event: IPCEvent = {
      type: "tool:event",
      data: {
        phase,
        opId,
        sessionId,
        command,
        ...extra,
      },
      timestamp: Date.now(),
    };
    this.transport.send(event, socket);
  }
}
