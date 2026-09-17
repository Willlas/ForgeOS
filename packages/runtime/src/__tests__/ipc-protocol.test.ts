import { describe, expect, it, vi } from "vitest";
import {
  generateRequestId,
  IPCCommand,
  IPCErrorCode,
  IpcProtocolError,
  type IPCRequest,
  type ToolApprovalRequest,
  type IPCToolCall,
  type IPCToolResult,
} from "../ipc-protocol.js";
import { IpcClient } from "../../../cli/src/ipc-client.js";
import { IpcServer } from "../ipc-server.js";
import { IpcTransport } from "../ipc-transport.js";

describe("IPC tool protocol", () => {
  it("preserves session metadata and tool call fields in a request envelope", () => {
    const toolCall: IPCToolCall = {
      id: "tool-1",
      sessionId: "session-1",
      tool: "workspace:read",
      input: { rootPath: "C:/project", relativePath: "README.md" },
    };
    const request: IPCRequest = {
      id: generateRequestId(),
      command: IPCCommand.WorkspaceRead,
      sessionId: toolCall.sessionId,
      payload: toolCall,
      timestamp: Date.now(),
    };

    expect(request.command).toBe("workspace:read");
    expect(request.sessionId).toBe("session-1");
    expect(request.payload).toEqual(toolCall);
  });

  it("models successful and failed tool results", () => {
    const success: IPCToolResult = {
      id: "tool-1",
      sessionId: "session-1",
      tool: "workspace:read",
      success: true,
      output: { content: "hello" },
    };
    const failure: IPCToolResult = {
      id: "tool-2",
      sessionId: "session-1",
      tool: "workspace:write",
      success: false,
      error: { code: IPCErrorCode.InvalidPayload, message: "approval required" },
    };

    expect(success.success).toBe(true);
    expect(failure.error?.code).toBe(IPCErrorCode.InvalidPayload);
  });

  it("associates approvals with the requesting session", () => {
    const approval: ToolApprovalRequest = {
      toolCallId: "tool-3",
      sessionId: "session-2",
      summary: "Apply approved source change",
      requestedAt: Date.now(),
    };

    expect(approval.sessionId).toBe("session-2");
    expect(approval.summary).toContain("source change");
  });

  it("binds a socket to a real session and rejects impersonation or session reuse", () => {
    const server = new IpcServer();
    const socketA = { writable: true } as any;
    const socketB = { writable: true } as any;

    const helloA = (server as any).bindSession(socketA, { declaredSessionId: "session-1" });
    expect(helloA.sessionId).toBe("session-1");
    expect((server as any).resolveBoundSession(socketA, "session-1")).toBe("session-1");

    expect(() => (server as any).resolveBoundSession(socketB, "session-1")).toThrow(IpcProtocolError);
    expect(() => (server as any).bindSession(socketB, { declaredSessionId: "session-1" })).toThrow(IpcProtocolError);

    expect(() => (server as any).bindSession(socketA, { declaredSessionId: "session-2" })).toThrow(IpcProtocolError);
    expect(() => (server as any).bindSession(socketB, { declaredSessionId: "" })).toThrow("session:hello requires a declaredSessionId");
  });

  it("sends the session hello handshake when the CLI client connects", async () => {
    const client = new IpcClient("\\\\.\\pipe\\aer-test", "cli-session-42");
    const transport = (client as any).transport;
    let handshakeRequest: any;
    const sendSpy = vi.spyOn(transport, "send").mockImplementation((msg: any) => {
      handshakeRequest = msg;
      setTimeout(() => {
        (client as any).handleMessage({
          id: msg.id,
          success: true,
          data: { sessionId: "cli-session-42", issuedAt: new Date().toISOString() },
          timestamp: Date.now(),
        });
      }, 0);
    });
    const connectSpy = vi.spyOn(transport, "connect").mockImplementation(async () => {
      Object.defineProperty(transport, "isConnected", { value: true, configurable: true });
    });

    await client.connect();

    expect(connectSpy).toHaveBeenCalledWith("\\\\.\\pipe\\aer-test");
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
      command: IPCCommand.SessionHello,
      payload: { declaredSessionId: "cli-session-42" },
      sessionId: "cli-session-42",
    }));
    expect(handshakeRequest).toMatchObject({
      command: IPCCommand.SessionHello,
      payload: { declaredSessionId: "cli-session-42" },
    });
  });

  it("rejects a missing Windows pipe without throwing an unhandled error event", async () => {
    const transport = new IpcTransport();
    transport.on("error", () => undefined);
    await expect(transport.connect("\\\\.\\pipe\\missing-aer-daemon")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
