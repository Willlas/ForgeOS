/**
 * IPC Server Handler
 * Runs inside the daemon process, receives IPC messages, dispatches to Runtime methods, returns responses.
 */

import { EventEmitter } from "events";
import { IpcTransport, getIpcSocketPath } from "./ipc-transport.js";
import {
  IPCCommand,
  IPCRequest,
  IPCResponse,
  IPCErrorCode,
} from "./ipc-protocol.js";

export class IpcServer extends EventEmitter {
  private transport: IpcTransport;
  private handlers = new Map<IPCCommand, (payload?: unknown) => Promise<unknown>>();
  private runtimeInstance: any = null;
  private socketPath: string;

  constructor(socketPath?: string) {
    super();
    this.transport = new IpcTransport();
    this.socketPath = socketPath || getIpcSocketPath();
    this.transport.on("message", (msg) => this.handleMessage(msg));
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
  private async dispatchRequest(command: IPCCommand, payload?: unknown): Promise<unknown> {
    if (!this.runtimeInstance) {
      throw new Error("Runtime not initialized");
    }
    const rt = this.runtimeInstance;

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
        // If no specific key, query all knowledge items
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
      case IPCCommand.WorkspaceRead:
        if (typeof payload !== "object" || payload === null || !("rootPath" in payload) || !("relativePath" in payload)) {
          throw new Error("WorkspaceRead requires rootPath and relativePath");
        }
        return rt.readAuthorizedWorkspace(payload);
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
    this.transport.close();
  }

  private async handleMessage(msg: unknown): Promise<void> {
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
        result = await this.dispatchRequest(request.command, request.payload);
      }
      response = {
        id: request.id,
        success: true,
        data: result,
        timestamp: Date.now(),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      response = {
        id: request.id,
        success: false,
        error: { code: IPCErrorCode.InternalError, message: errorMsg },
        timestamp: Date.now(),
      };
    }

    this.transport.send(response);
  }
}
