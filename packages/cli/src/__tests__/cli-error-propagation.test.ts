import { describe, expect, it } from "vitest";
import { errorMessage } from "../index";
import { IPCErrorCode } from "@aer/runtime-lib";

// The daemon throws this exact string in
// packages/runtime/src/core/runtime.ts (applyAuthorizedWorkspace, the
// "Unknown or already-consumed approvalId" guard) for a reused approvalId,
// and the Sprint 12 validated run captured the rejection as
// `{ "code": 6, "message": "Unknown or already-consumed approvalId" }`
// (6 = IPCErrorCode.InternalError). The regression test must assert against
// this real text, not a guessed string.
const daemonRejection = {
  code: IPCErrorCode.InternalError,
  message: "Unknown or already-consumed approvalId",
};

describe("CLI error propagation (IpcClient rejections)", () => {
  it("surfaces the daemon's real message from a plain { code, message } rejection", () => {
    const printed = `Workspace apply failed: ${errorMessage(daemonRejection)}`;

    expect(printed).toBe(
      "Workspace apply failed: Unknown or already-consumed approvalId",
    );
    expect(printed).toContain("Unknown or already-consumed approvalId");
    expect(printed).not.toContain("[object Object]");
  });

  it("still extracts the message from genuine Error instances", () => {
    const rejection = new Error("Workspace apply failed: boom");
    expect(errorMessage(rejection)).toBe("Workspace apply failed: boom");
  });

  it("falls back to String() for non-object rejections without losing text", () => {
    expect(errorMessage("boom")).toBe("boom");
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
  });
});