import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createRuntime,
  WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS,
  WORKSPACE_APPROVAL_MAX_TTL_SECONDS,
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

function grantReadOnlyAccess() {
  resetSessionGrantManager();
  const manager = getSessionGrantManager();
  manager.registerGrant(sessionId, {
    rootPath,
    mode: "read-only",
    tools: ["read"],
  });
}

describe("Approval Lifecycle - Single-Use Enforcement", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("rejects approval when the same approvalId is used twice", async () => {
    grantApplyAccess();
    const runtime = createRuntime();
    
    // First approval
    const firstApproval = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );
    
    // Apply with first approval (should succeed)
    const applyResult = await runtime.applyAuthorizedWorkspace(
      {
        rootPath,
        approvalId: firstApproval.approvalId,
        diffHash: "abc123",
      },
      sessionId,
    );
    
    expect(applyResult.success).toBe(true);
    
    // Try to apply with same approvalId (should fail)
    await expect(
      runtime.applyAuthorizedWorkspace(
        {
          rootPath,
          approvalId: firstApproval.approvalId,
          diffHash: "abc123",
        },
        sessionId,
      ),
    ).rejects.toThrow("Unknown or already-consumed approvalId");
  });
});

describe("Approval Lifecycle - TTL Behavior", () => {
  beforeEach(() => {
    resetSessionGrantManager();
  });

  afterEach(() => {
    resetSessionGrantManager();
  });

  it("applies the default TTL when expiresInSeconds is omitted", async () => {
    grantApplyAccess();
    const runtime = createRuntime();

    const result = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );

    const ttlMs = Date.parse(result.expiresAt) - Date.parse(result.createdAt);
    expect(ttlMs).toBe(WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS * 1000);
  });

  it("respects a valid custom TTL below the hard cap", async () => {
    grantApplyAccess();
    const runtime = createRuntime();

    const result = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123", expiresInSeconds: 60 },
      sessionId,
    );

    const ttlMs = Date.parse(result.expiresAt) - Date.parse(result.createdAt);
    expect(ttlMs).toBe(60 * 1000);
  });

  it("clamps the TTL to the hard cap when expiresInSeconds exceeds the max", async () => {
    grantApplyAccess();
    const runtime = createRuntime();

    const result = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123", expiresInSeconds: 99_999 },
      sessionId,
    );

    const ttlMs = Date.parse(result.expiresAt) - Date.parse(result.createdAt);
    expect(ttlMs).toBe(WORKSPACE_APPROVAL_MAX_TTL_SECONDS * 1000);
  });
});