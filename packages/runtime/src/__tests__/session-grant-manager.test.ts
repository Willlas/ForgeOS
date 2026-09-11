import { describe, expect, it } from "vitest";
import { SessionGrantManager, WorkspaceAccessError } from "../session-grant-manager.js";

const clientA = "session_client_a";
const clientB = "session_client_b";
const root = "C:\\work\\project";

describe("SessionGrantManager", () => {
  it("rejects registrations missing sessionId, rootPath, or tools", () => {
    const manager = new SessionGrantManager();
    expect(() => manager.registerGrant("", { rootPath: root, mode: "read-only", tools: ["list"] }))
      .toThrow(WorkspaceAccessError);
    expect(() => manager.registerGrant(clientA, { rootPath: "", mode: "read-only", tools: ["list"] }))
      .toThrow("rootPath");
    expect(() => manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: [] }))
      .toThrow("workspace tool must be");
  });

  it("enforces mode/tool and approval constraints", () => {
    const manager = new SessionGrantManager();
    expect(() =>
      manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["list", "execute"] })
    ).toThrow("Read-only grants cannot include execute or apply");
    expect(() =>
      manager.registerGrant(clientA, { rootPath: root, mode: "read-write", tools: ["apply"] })
    ).toThrow("require explicit approval");
    expect(() =>
      manager.registerGrant(clientA, { rootPath: root, mode: "read-write", tools: ["apply"], approvalRequired: true })
    ).not.toThrow();
  });

  it("rejects invalid or already-expired expiration timestamps", () => {
    const manager = new SessionGrantManager();
    expect(() =>
      manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["list"], expiresAt: "not-a-date" })
    ).toThrow("valid ISO timestamp");
    expect(() =>
      manager.registerGrant(clientA, {
        rootPath: root, mode: "read-only", tools: ["list"],
        expiresAt: new Date(Date.now() - 5000).toISOString(),
      })
    ).toThrow("must be in the future");
  });

  it("isolates grants between two client sessions", () => {
    const manager = new SessionGrantManager();
    manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["read", "list"] });
    manager.registerGrant(clientB, { rootPath: root, mode: "read-only", tools: ["list"] });

    expect(manager.getGrant(clientA, root).tools).toEqual(["read", "list"]);
    expect(manager.getGrant(clientB, root).tools).toEqual(["list"]);
    expect(manager.listGrants(clientA).grants).toHaveLength(1);
    expect(manager.listGrants(clientB).grants).toHaveLength(1);

    const otherRoot = "C:\\work\\secret-project";
    manager.registerGrant(clientA, { rootPath: otherRoot, mode: "read-only", tools: ["read"] });
    expect(() => manager.getGrant(clientB, otherRoot)).toThrow(WorkspaceAccessError);
    expect(manager.listGrants(clientB).grants.some((g) => g.rootPath === otherRoot)).toBe(false);
    expect(manager.listGrants(clientA).grants).toHaveLength(2);
    expect(manager.hasGrant(clientB, otherRoot)).toBe(false);
    expect(manager.hasGrant(clientA, otherRoot)).toBe(true);
    expect(manager.listSessions()).toEqual(expect.arrayContaining([clientA, clientB]));
  });

  it("strips internal bookkeeping fields from resolved grants", () => {
    const manager = new SessionGrantManager();
    manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["list"] });
    const grant = manager.getGrant(clientA, root);
    expect("grantId" in grant).toBe(false);
    expect("registeredAt" in grant).toBe(false);
    expect(grant.rootPath).toBe(root);
    expect(grant.mode).toBe("read-only");
  });

  it("drops expired grants on read, listing, and pruning", async () => {
    const manager = new SessionGrantManager();
    const expiresAt = new Date(Date.now() + 200).toISOString();
    manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["list"], expiresAt });
    manager.registerGrant(clientA, { rootPath: "C:\\work\\other", mode: "read-only", tools: ["read"], expiresAt });
    expect(manager.hasGrant(clientA, root)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 300));
    // Reading an expired grant rejects it and listings hide expired entries...
    expect(() => manager.getGrant(clientA, root)).toThrow("expired");
    expect(manager.listGrants(clientA).grants).toHaveLength(0);
    // ...while pruneExpired removes the leftover record.
    expect(manager.pruneExpired()).toBe(1);
    expect(manager.getActiveGrantCount()).toBe(0);
  });

  it("revokes a single root or an entire session", () => {
    const manager = new SessionGrantManager();
    manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["list"] });
    manager.registerGrant(clientA, { rootPath: "C:\\work\\other", mode: "read-only", tools: ["read"] });
    manager.registerGrant(clientB, { rootPath: root, mode: "read-only", tools: ["list"] });
    expect(manager.getActiveGrantCount()).toBe(3);

    expect(manager.revokeGrant(clientA, root)).toBe(1);
    expect(manager.revokeGrant(clientA, root)).toBe(0);
    expect(manager.hasGrant(clientA, "C:\\work\\other")).toBe(true);
    expect(manager.hasGrant(clientB, root)).toBe(true);

    expect(manager.revokeGrant(clientA)).toBe(1);
    expect(manager.hasGrant(clientA, "C:\\work\\other")).toBe(false);
    expect(manager.getActiveGrantCount()).toBe(1);
  });

  it("keeps approval tokens out of audit listings and removes sessions cleanly", () => {
    const manager = new SessionGrantManager();
    manager.registerGrant(clientA, {
      rootPath: root,
      mode: "read-write",
      tools: ["apply"],
      approvalRequired: true,
      approvalToken: "top-secret-token-123",
    });

    const listing = JSON.stringify(manager.listGrants(clientA));
    expect(listing).not.toContain("top-secret-token-123");
    expect(manager.listGrants(clientA).grants[0]).toMatchObject({ rootPath: root, mode: "read-write", tools: ["apply"] });

    manager.removeSession(clientA);
    expect(manager.hasGrant(clientA, root)).toBe(false);
    expect(manager.getActiveGrantCount()).toBe(0);
  });

  it("normalizes root paths for case-insensitive Windows resolution", () => {
    const manager = new SessionGrantManager();
    manager.registerGrant(clientA, { rootPath: "C:\\Work\\Project", mode: "read-only", tools: ["list"] });
    expect(manager.getGrant(clientA, "c:/work/project").rootPath).toBe("C:\\Work\\Project");
    expect(manager.hasGrant(clientA, "C:/WORK/PROJECT")).toBe(true);
  });

  it("denies read, list, and search for a session with no registered grants (deny-by-default)", () => {
    const manager = new SessionGrantManager();
    const freshSession = "session_fresh_no_grants";
    // No grants registered at all for this session
    expect(() => manager.getGrant(freshSession, root)).toThrow(WorkspaceAccessError);
    expect(manager.hasGrant(freshSession, root)).toBe(false);
    expect(manager.listGrants(freshSession).grants).toHaveLength(0);
  });

  it("denies workspace operations immediately after all grants are revoked", () => {
    const manager = new SessionGrantManager();
    manager.registerGrant(clientA, { rootPath: root, mode: "read-only", tools: ["read", "list", "search"] });
    expect(manager.hasGrant(clientA, root)).toBe(true);

    // Revoke all grants for the session
    manager.revokeGrant(clientA);

    // All workspace operations should now be denied
    expect(() => manager.getGrant(clientA, root)).toThrow(WorkspaceAccessError);
    expect(manager.hasGrant(clientA, root)).toBe(false);
  });
});