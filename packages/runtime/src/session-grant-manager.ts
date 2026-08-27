/**
 * Session Grant Manager - Per-session workspace access control.
 *
 * Enforces the acceptance criterion: "Two clients cannot cross-read grants or results."
 * Each IPC session must register a workspace grant before any workspace operation.
 */

import {
  WorkspaceAccessGrant,
  WorkspaceAccessError,
  WorkspaceAccessMode,
  WorkspaceToolName,
} from "./workspace-tools.js";

// ============================================================================
// Public Types
// ============================================================================

/** Audit-safe grant representation (excludes secrets like approvalToken). */
export interface SessionGrantInfo {
  grantId: string;
  sessionId: string;
  rootPath: string;
  mode: WorkspaceAccessMode;
  tools: WorkspaceToolName[];
  allowedCommands?: string[];
  expiresAt?: string;
  registeredAt: string;
}

/** Result of a successful grant registration. */
export interface SessionGrantResult {
  grantId: string;
  registeredAt: string;
  expiresAt?: string;
}

/** Payload for registering a new session grant via IPC. */
export interface SessionGrantRegisterPayload {
  rootPath: string;
  mode: WorkspaceAccessMode;
  tools: WorkspaceToolName[];
  allowedCommands?: string[];
  expiresAt?: string;
  approvalRequired?: boolean;
  approvalToken?: string;
  maxReadBytes?: number;
}

/** Payload for revoking a session grant. If rootPath omitted, all revoked. */
export interface SessionGrantRevokePayload {
  rootPath?: string;
}

/** Response for listing session grants (audit-safe). */
export interface SessionGrantListResponse {
  sessionId: string;
  grants: SessionGrantInfo[];
}

// ============================================================================
// Internal
// ============================================================================

interface SessionGrantRecord extends WorkspaceAccessGrant {
  grantId: string;
  registeredAt: string;
}

let grantCounter = 0;

function generateGrantId(sessionId: string): string {
  grantCounter += 1;
  return `grant_${sessionId.slice(0, 8)}_${Date.now()}_${grantCounter}`;
}

function normalizeRootPath(rootPath: string): string {
  return rootPath.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
}

// ============================================================================
// SessionGrantManager
// ============================================================================

export class SessionGrantManager {
  /** sessionId -> normalizedRootPath -> grant record */
  private grants: Map<string, Map<string, SessionGrantRecord>> = new Map();

  registerGrant(sessionId: string, grant: SessionGrantRegisterPayload): SessionGrantResult {
    if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
      throw new WorkspaceAccessError("sessionId is required for grant registration");
    }
    if (!grant.rootPath || typeof grant.rootPath !== "string") {
      throw new WorkspaceAccessError("rootPath is required for grant registration");
    }
    if (!grant.tools || grant.tools.length === 0) {
      throw new WorkspaceAccessError("At least one workspace tool must be granted");
    }
    if (grant.expiresAt) {
      const exp = Date.parse(grant.expiresAt);
      if (Number.isNaN(exp)) throw new WorkspaceAccessError("expiresAt must be a valid ISO timestamp");
      if (exp <= Date.now()) throw new WorkspaceAccessError("expiresAt must be in the future");
    }
    if (grant.mode === "read-only" && grant.tools.some((t) => t === "execute" || t === "apply")) {
      throw new WorkspaceAccessError("Read-only grants cannot include execute or apply tools");
    }
    if (grant.mode === "read-write" && grant.tools.includes("apply") && grant.approvalRequired !== true) {
      throw new WorkspaceAccessError("Read-write apply grants require explicit approval");
    }

    const grantId = generateGrantId(sessionId);
    const registeredAt = new Date().toISOString();
    const record: SessionGrantRecord = {
      ...grant,
      sessionId,
      grantId,
      registeredAt,
    };

    const key = normalizeRootPath(grant.rootPath);
    let sessionGrants = this.grants.get(sessionId);
    if (!sessionGrants) {
      sessionGrants = new Map();
      this.grants.set(sessionId, sessionGrants);
    }
    sessionGrants.set(key, record);

    return { grantId, registeredAt, expiresAt: grant.expiresAt };
  }

  getGrant(sessionId: string, rootPath: string): WorkspaceAccessGrant {
    if (!sessionId) throw new WorkspaceAccessError("sessionId is required to resolve a grant");
    const sessionGrants = this.grants.get(sessionId);
    if (!sessionGrants) throw new WorkspaceAccessError(`No grants registered for session: ${sessionId}`);
    const key = normalizeRootPath(rootPath);
    const record = sessionGrants.get(key);
    if (!record) throw new WorkspaceAccessError(`No grant found for rootPath '${rootPath}' in session '${sessionId}'`);
    if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
      sessionGrants.delete(key);
      throw new WorkspaceAccessError(`Grant for rootPath '${rootPath}' has expired`);
    }
    const { grantId, registeredAt, ...clean } = record;
    return clean;
  }

  hasGrant(sessionId: string, rootPath: string): boolean {
    try { this.getGrant(sessionId, rootPath); return true; } catch { return false; }
  }

  revokeGrant(sessionId: string, rootPath?: string): number {
    const sessionGrants = this.grants.get(sessionId);
    if (!sessionGrants) return 0;
    if (rootPath) {
      const key = normalizeRootPath(rootPath);
      const existed = sessionGrants.delete(key);
      if (sessionGrants.size === 0) this.grants.delete(sessionId);
      return existed ? 1 : 0;
    }
    const count = sessionGrants.size;
    this.grants.delete(sessionId);
    return count;
  }

  listGrants(sessionId: string): SessionGrantListResponse {
    const sessionGrants = this.grants.get(sessionId);
    const grants: SessionGrantInfo[] = [];
    if (sessionGrants) {
      for (const record of sessionGrants.values()) {
        if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) continue;
        grants.push({
          grantId: record.grantId,
          sessionId,
          rootPath: record.rootPath,
          mode: record.mode,
          tools: [...record.tools],
          allowedCommands: record.allowedCommands ? [...record.allowedCommands] : undefined,
          expiresAt: record.expiresAt,
          registeredAt: record.registeredAt,
        });
      }
    }
    return { sessionId, grants };
  }

  listSessions(): string[] {
    const sessions: string[] = [];
    for (const [sessionId, sessionGrants] of this.grants) {
      const hasActive = [...sessionGrants.values()].some(
        (r) => !r.expiresAt || Date.parse(r.expiresAt) > Date.now()
      );
      if (hasActive) sessions.push(sessionId);
    }
    return sessions;
  }

  removeSession(sessionId: string): void {
    this.grants.delete(sessionId);
  }

  clearAll(): void {
    this.grants.clear();
  }

  pruneExpired(): number {
    let removed = 0;
    const now = Date.now();
    for (const [sessionId, sessionGrants] of this.grants) {
      for (const [key, record] of sessionGrants) {
        if (record.expiresAt && Date.parse(record.expiresAt) <= now) {
          sessionGrants.delete(key);
          removed++;
        }
      }
      if (sessionGrants.size === 0) this.grants.delete(sessionId);
    }
    return removed;
  }

  getActiveGrantCount(): number {
    let count = 0;
    const now = Date.now();
    for (const sessionGrants of this.grants.values()) {
      for (const record of sessionGrants.values()) {
        if (!record.expiresAt || Date.parse(record.expiresAt) > now) count++;
      }
    }
    return count;
  }
}

// ============================================================================
// Singleton helper
// ============================================================================

let defaultManager: SessionGrantManager | null = null;

export function getSessionGrantManager(): SessionGrantManager {
  if (!defaultManager) {
    defaultManager = new SessionGrantManager();
  }
  return defaultManager;
}

export function resetSessionGrantManager(): void {
  defaultManager?.clearAll();
  defaultManager = null;
}