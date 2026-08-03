/**
 * IPC Client Wrapper
 * CLI-side interface for sending commands and receiving responses from daemon.
 */

import { EventEmitter } from "events";
import { IpcTransport, getIpcSocketPath,
  IPCCommand,
  IPCErrorCode,
  generateRequestId,
  getTimeoutForCommand,
} from "@aer/runtime-lib";
import type {
  IPCRequest,
  IPCResponse,
  IPCEvent,
  IPCError,
} from "@aer/runtime-lib";

export class IpcClient extends EventEmitter {
  private transport: IpcTransport;
  private pending = new Map<string, {
    resolve: (r: IPCResponse) => void;
    reject: (e: IPCError) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private socketPath: string;

  constructor(socketPath?: string) {
    super();
    this.transport = new IpcTransport();
    this.socketPath = socketPath || getIpcSocketPath();
    this.transport.on("message", (msg) => this.handleMessage(msg));
    this.transport.on("error", (err) => this.emit("error", err));
  }

  async connect(): Promise<void> {
    await this.transport.connect(this.socketPath);
  }

  async call(command: IPCCommand, payload?: unknown): Promise<IPCResponse> {
    if (!this.transport.isConnected) {
      return {
        id: "",
        success: false,
        error: { code: IPCErrorCode.ConnectionRefused, message: "Daemon not running" },
        timestamp: Date.now(),
      };
    }

    const id = generateRequestId();
    const timeout = getTimeoutForCommand(command);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject({ code: IPCErrorCode.Timeout, message: `Command ${command} timed out after ${timeout}ms` });
      }, timeout);

      this.pending.set(id, { resolve, reject, timer });

      const request: IPCRequest = {
        id,
        command,
        payload,
        timestamp: Date.now(),
        timeout,
      };
      this.transport.send(request);
    });
  }

  subscribe(eventType: string, handler: (data: unknown) => void): () => void {
    this.on("event:" + eventType, handler);
    return () => this.off("event:" + eventType, handler);
  }

  disconnect(): void {
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
    this.transport.close();
  }

  get connected(): boolean {
    return this.transport.isConnected;
  }

  private handleMessage(msg: unknown): void {
    // Check if it's a response to a pending request
    if (typeof msg === "object" && msg !== null && "id" in msg && "success" in msg) {
      const resp = msg as IPCResponse;
      const entry = this.pending.get(resp.id);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(resp.id);
        if (resp.success) {
          entry.resolve(resp);
        } else {
          entry.reject(resp.error || { code: IPCErrorCode.InternalError, message: "Unknown error" });
        }
        return;
      }
    }

    // Check if it's an async event
    if (typeof msg === "object" && msg !== null && "type" in msg) {
      const event = msg as IPCEvent;
      this.emit("event:" + event.type, event.data);
    }
  }
}
