/**
 * IPC Transport Module
 * Cross-platform bidirectional communication using Node.js net module with Unix domain sockets / TCP fallback.
 */

import { EventEmitter } from "events";
import net from "net";
import path from "path";
import os from "os";
import fs from "fs";

export function getIpcSocketPath(): string {
  const custom = process.env.AER_IPC_SOCKET;
  if (custom) return custom;
  return path.join(os.tmpdir(), "aer-daemon.sock");
}

export class IpcTransport extends EventEmitter {
  private socket: net.Socket | null = null;
  private server: net.Server | null = null;
  private buffer = "";
  private connected = false;

  connect(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ path: address }, () => {
        this.connected = true;
        this.setupSocket(sock);
        resolve();
      });
      sock.on("error", (err) => {
        this.connected = false;
        reject(err);
      });
      this.socket = sock;
    });
  }

  listen(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(address, () => {});
      const srv = net.createServer((sock) => {
        this.socket = sock;
        this.connected = true;
        this.setupSocket(sock);
        this.emit("clientConnected");
        sock.on("end", () => {
          this.connected = false;
          this.emit("clientDisconnected");
        });
      });
      srv.on("error", reject);
      srv.listen(address, () => resolve());
      this.server = srv;
    });
  }

  send(data: unknown): void {
    if (!this.socket || !this.connected) return;
    const msg = JSON.stringify(data) + "\n";
    this.socket.write(msg);
  }

  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.connected = false;
  }

  get isConnected(): boolean { return this.connected; }

  private setupSocket(sock: net.Socket): void {
    sock.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try { this.emit("message", JSON.parse(line)); }
        catch { /* ignore malformed */ }
      }
    });
    sock.on("error", (err) => this.emit("error", err));
  }
}
