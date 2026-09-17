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
  if (process.platform === "win32") return "\\\\.\\pipe\\aer-daemon";
  return path.join(os.tmpdir(), "aer-daemon.sock");
}

/**
 * Multi-client IPC transport.
 *
 * - **Client mode** (`connect`): a single outbound socket (`outgoing`) carries
 *   all traffic. `send(data)` writes to it.
 * - **Server mode** (`listen`): many concurrent inbound sockets are tracked in
 *   `clients`, each with its own line buffer. `send(data, socket)` routes a
 *   frame to one specific client, which is how the server isolates concurrent
 *   sessions (sprint011 task 10).
 *
 * Emitted events:
 * - `message(data, socket)` — `socket` is the originating socket (the client's
 *   `outgoing` in client mode, an inbound client socket in server mode).
 * - `clientConnected(socket)` / `clientDisconnected(socket)` — server mode.
 * - `error(err, socket?)`.
 */
export class IpcTransport extends EventEmitter {
  /** The single outbound socket in client mode. */
  private outgoing: net.Socket | null = null;
  private server: net.Server | null = null;
  /** Inbound client sockets in server mode. */
  private clients = new Set<net.Socket>();
  /** Per-socket line buffer for safe, isolated frame parsing. */
  private buffers = new Map<net.Socket, string>();
  private connected = false;

  connect(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ path: address }, () => {
        this.connected = true;
        this.attach(sock);
        resolve();
      });
      sock.on("error", (err) => {
        this.connected = false;
        if (!sock.readable && !sock.writable) reject(err);
        this.emit("error", err, sock);
      });
      this.outgoing = sock;
    });
  }

  listen(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(address, () => {});
      const srv = net.createServer((sock) => {
        this.clients.add(sock);
        this.buffers.set(sock, "");
        this.attach(sock);
        this.emit("clientConnected", sock);
        const onGone = (): void => {
          if (!this.clients.delete(sock)) return;
          this.buffers.delete(sock);
          this.emit("clientDisconnected", sock);
        };
        sock.on("end", onGone);
        sock.on("close", onGone);
      });
      srv.on("error", reject);
      srv.listen(address, () => resolve());
      this.server = srv;
    });
  }

  /**
   * Send a frame. In client mode it goes to `outgoing`; in server mode pass
   * the target `socket` to route it to one client (isolates concurrent
   * sessions). A `null` target in server mode is a no-op (no broadcast).
   */
  send(data: unknown, socket?: net.Socket): void {
    const target = socket ?? this.outgoing;
    if (!target || !target.writable) return;
    target.write(JSON.stringify(data) + "\n");
  }

  close(): void {
    for (const sock of this.clients) sock.destroy();
    this.clients.clear();
    this.buffers.clear();
    if (this.outgoing) {
      this.outgoing.destroy();
      this.outgoing = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.connected = false;
  }

  /** True when the outbound client socket is connected (client mode). */
  get isConnected(): boolean { return this.connected; }

  /** Number of live inbound clients (server mode). */
  get connectedClientCount(): number { return this.clients.size; }

  /** Live inbound client sockets (server mode) — used by tests. */
  getConnectedSockets(): net.Socket[] { return [...this.clients]; }

  private attach(sock: net.Socket): void {
    sock.on("data", (chunk: Buffer) => {
      const buf = (this.buffers.get(sock) ?? "") + chunk.toString();
      const lines = buf.split("\n");
      const remainder = lines.pop() ?? "";
      this.buffers.set(sock, remainder);
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.emit("message", JSON.parse(line), sock);
        } catch {
          // Ignore malformed frames — a bad line must not poison the buffer.
        }
      }
    });
    sock.on("error", (err) => this.emit("error", err, sock));
  }
}
