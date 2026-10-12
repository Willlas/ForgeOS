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

describe("Approval Lifecycle - Expiry Checking", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("rejects apply when approval has expired", async () => {
    grantApplyAccess();
    const runtime = createRuntime();
    
    // Get an approval with a very short TTL
    const approval = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123", expiresInSeconds: 1 },
      sessionId,
    );
    
    // Wait for it to expire (slightly more than 1 second)
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Try to apply after expiry (should fail)
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath,
          approvalId: approval.approvalId,
          diffHash: "abc123",
        },
        sessionId,
      ),
    ).rejects.toThrow("Unknown or already-consumed approvalId");
  });
});

describe("Approval Lifecycle - Consume-on-Success", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("consumes the approval when apply succeeds", async () => {
    grantApplyAccess();
    const runtime = createRuntime();
    
    // Get an approval
    const approval = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );
    
    // Apply with the approval (should succeed and consume it)
    const applyResult = await runtime.applyAuthorizedWorkspace(
      {
        rootPath,
        approvalId: approval.approvalId,
        diffHash: "abc123",
      },
      sessionId,
    );
    
    expect(applyResult.success).toBe(true);
    
    // Try to apply the same approval again (should fail)
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath,
          approvalId: approval.approvalId,
          diffHash: "abc123",
        },
        sessionId,
      ),
    ).rejects.toThrow("Unknown or already-consumed approvalId");
  });
});

describe("Approval Lifecycle - Read-Only Grant Misuse", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("rejects approve when session has read-only grant", async () => {
    grantReadOnlyAccess();
    const runtime = createRuntime();
    
    await expect(
      runtime.approveAuthorizedWorkspace(
        { rootPath, diffHash: "abc123" },
        sessionId,
      ),
    ).rejects.toThrow("Workspace tool 'apply' is not granted");
  });

  it("rejects apply when session has read-only grant", async () => {
    grantReadOnlyAccess();
    const runtime = createRuntime();
    
    // Try to apply without approval (should fail at the start)
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath,
          approvalId: "some-id",
          diffHash: "abc123",
        },
        sessionId,
      ),
    ).rejects.toThrow("Workspace tool 'apply' is not granted");
  });
});