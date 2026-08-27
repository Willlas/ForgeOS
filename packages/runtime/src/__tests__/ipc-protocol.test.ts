import { describe, expect, it } from "vitest";
import {
  generateRequestId,
  IPCCommand,
  IPCErrorCode,
  type IPCRequest,
  type ToolApprovalRequest,
  type IPCToolCall,
  type IPCToolResult,
} from "../ipc-protocol.js";

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
});
