import { describe, expect, it } from "vitest";
import {
  WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS,
  WORKSPACE_APPROVAL_MAX_TTL_SECONDS,
  Runtime,
} from "../core/runtime.js";
import {
  getSessionGrantManager,
  resetSessionGrantManager,
} from "../session-grant-manager.js";

const sessionId = "test-session-uuid";
const rootPath = "C:/work/project";

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

describe("Workspace Approval TTL Constants", () => {
  it("exports WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS as 300", () => {
    expect(WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS).toBe(300);
  });

  it("exports WORKSPACE_APPROVAL_MAX_TTL_SECONDS as 3600", () => {
    expect(WORKSPACE_APPROVAL_MAX_TTL_SECONDS).toBe(3600);
  });
});

describe("approveAuthorizedWorkspace TTL behaviour", () => {
  it("applies the default TTL when expiresInSeconds is omitted", async () => {
    grantApplyAccess();
    const runtime = new Runtime();

    const result = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123" },
      sessionId,
    );

    const ttlMs = Date.parse(result.expiresAt) - Date.parse(result.createdAt);
    expect(ttlMs).toBe(WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS * 1000);
  });

  it("respects a valid custom TTL below the hard cap", async () => {
    grantApplyAccess();
    const runtime = new Runtime();

    const result = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123", expiresInSeconds: 60 },
      sessionId,
    );

    const ttlMs = Date.parse(result.expiresAt) - Date.parse(result.createdAt);
    expect(ttlMs).toBe(60 * 1000);
  });

  it("clamps the TTL to the hard cap when expiresInSeconds exceeds the max", async () => {
    grantApplyAccess();
    const runtime = new Runtime();

    const result = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "abc123", expiresInSeconds: 99_999 },
      sessionId,
    );

    const ttlMs = Date.parse(result.expiresAt) - Date.parse(result.createdAt);
    expect(ttlMs).toBe(WORKSPACE_APPROVAL_MAX_TTL_SECONDS * 1000);
  });

  it("returns a unique approvalId for each approval", async () => {
    grantApplyAccess();
    const runtime = new Runtime();

    const first = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "hash1" },
      sessionId,
    );
    const second = await runtime.approveAuthorizedWorkspace(
      { rootPath, diffHash: "hash2" },
      sessionId,
    );

    expect(first.approvalId).not.toBe(second.approvalId);
    expect(first.approvalId).toMatch(/^wsa_/);
    expect(second.approvalId).toMatch(/^wsa_/);
  });

  it("rejects approval when the session has no 'apply' grant", async () => {
    resetSessionGrantManager();
    const manager = getSessionGrantManager();
    manager.registerGrant(sessionId, {
      rootPath,
      mode: "read-only",
      tools: ["read"],
    });
    const runtime = new Runtime();

    await expect(
      runtime.approveAuthorizedWorkspace(
        { rootPath, diffHash: "abc123" },
        sessionId,
      ),
    ).rejects.toThrow("Workspace tool 'apply' is not granted");
  });

  it("rejects approval when diffHash is empty", async () => {
    grantApplyAccess();
    const runtime = new Runtime();

    await expect(
      runtime.approveAuthorizedWorkspace({ rootPath, diffHash: "" }, sessionId),
    ).rejects.toThrow("non-empty diffHash");
  });
});
