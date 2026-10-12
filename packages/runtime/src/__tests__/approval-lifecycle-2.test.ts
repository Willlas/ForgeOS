import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createRuntime,
} from "../core/runtime.js";
import {
  getSessionGrantManager,
  resetSessionGrantManager,
} from "../session-grant-manager.js";

const sessionId = "test-session-uuid";
const rootPath = "/work/project";

function grantApplyAccess() {
  resetSessionGrantManager();
  const manager = getSessionGrantManager();
  manager.registerGrant(sessionId, {
    rootPath,
    mode: "read-write",
    tools: ["apply"],
    approvalRequired: true,
  });
}

describe("Approval Lifecycle - Session Binding", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("rejects apply when session ID doesn't match the approval", async () => {
    grantApplyAccess();
    const runtime = createRuntime();
    
    // Get an approval
    const approval = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );
    
    // Try to apply with a different session ID (should fail)
    const differentSessionId = "different-session-uuid";
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath,
          approvalId: approval.approvalId,
          diffHash: "abc123",
        },
        differentSessionId,
      ),
    ).rejects.toThrow("Unknown or already-consumed approvalId");
  });
});

describe("Approval Lifecycle - Root Path Binding", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("rejects apply when rootPath doesn't match the approval", async () => {
    grantApplyAccess();
    const runtime = createRuntime();
    
    // Get an approval
    const approval = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );
    
    // Try to apply with a different root path (should fail)
    const differentRootPath = "/work/different-project";
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath: differentRootPath,
          approvalId: approval.approvalId,
          diffHash: "abc123",
        },
        sessionId,
      ),
    ).rejects.toThrow("Unknown or already-consumed approvalId");
  });
});

describe("Approval Lifecycle - Diff Hash Binding", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("rejects apply when diffHash doesn't match the approval", async () => {
    grantApplyAccess();
    const runtime = createRuntime();
    
    // Get an approval
    const approval = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );
    
    // Try to apply with a different diff hash (should fail)
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath,
          approvalId: approval.approvalId,
          diffHash: "different-hash",
        },
        sessionId,
      ),
    ).rejects.toThrow("Unknown or already-consumed approvalId");
  });
});