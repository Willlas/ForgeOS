/**
 * SharedExecutionContext - Shared state between agents in a team.
 *
 * Provides:
 * - Key-value storage with versioning
 * - Event-driven updates
 * - Scoping (agent-level vs global)
 * - Snapshot/restore for rollback
 * - Query language for complex lookups
 *
 * @module runtime/shared-context
 */

// ============================================================================
// Shared Context Entry
// ============================================================================

export interface ContextEntry {
  /** Unique key */
  key: string;
  /** Value */
  value: unknown;
  /** Source agent ID (null for system entries) */
  sourceAgentId: string | null;
  /** Scope */
  scope: 'global' | 'agent';
  /** Monotonic version counter */
  version: number;
  /** Timestamp */
  timestamp: string;
}

// ============================================================================
// Context Event
// ============================================================================

export enum ContextEvent {
  EntryUpdated = "context:entry_updated",
  EntryRemoved = "context:entry_removed",
  SnapshotCreated = "context:snapshot_created",
  SnapshotRestored = "context:snapshot_restored",
  AgentJoined = "context:agent_joined",
  AgentLeft = "context:agent_left",
}

// ============================================================================
// Shared Execution Context
// ============================================================================

/**
 * Centralized shared state between all agents in a team.
 * Provides versioned key-value storage with event-driven updates and snapshot support.
 */
export class SharedExecutionContext {
  private _entries = new Map<string, ContextEntry>();
  private _agents = new Set<string>();
  private _version = 0;
  private _listeners = new Map<string, Array<(data: unknown) => void>>();
  private _snapshots: Snapshot[] = [];

  constructor(
    private _teamId: string,
    private _maxEntries: number = 1000
  ) {}

  // ======================================================================
  // Team Info
  // ======================================================================

  get teamId(): string { return this._teamId; }
  get entryCount(): number { return this._entries.size; }
  get agentCount(): number { return this._agents.size; }
  get currentVersion(): number { return this._version; }

  // ======================================================================
  // Agent Management
  // ======================================================================

  joinAgent(agentId: string): void {
    if (this._agents.has(agentId)) {
      return; // Already joined
    }
    this._agents.add(agentId);
    this._emit(ContextEvent.AgentJoined, { agentId });
  }

  leaveAgent(agentId: string): void {
    if (!this._agents.has(agentId)) {
      return;
    }
    this._agents.delete(agentId);
    this._emit(ContextEvent.AgentLeft, { agentId });
  }

  isAgentJoined(agentId: string): boolean {
    return this._agents.has(agentId);
  }

  getAgents(): string[] {
    return [...this._agents];
  }

  // ======================================================================
  // Key-Value Operations
  // ======================================================================

  set(
    key: string,
    value: unknown,
    sourceAgentId: string | null = null,
    scope: 'global' | 'agent' = 'global'
  ): ContextEntry {
    const existing = this._entries.get(key);

    if (existing && existing.sourceAgentId === sourceAgentId && existing.version > 0) {
      // Update existing entry
      const updated: ContextEntry = {
        ...existing,
        value,
        version: existing.version + 1,
        timestamp: new Date().toISOString(),
      };
      this._entries.set(key, updated);
      this._version++;
      this._emit(ContextEvent.EntryUpdated, updated);
      return updated;
    }

    // Create new entry
    const entry: ContextEntry = {
      key,
      value,
      sourceAgentId,
      scope,
      version: 1,
      timestamp: new Date().toISOString(),
    };

    this._enforceCapacity();
    this._entries.set(key, entry);
    this._version++;
    this._emit(ContextEvent.EntryUpdated, entry);
    return entry;
  }

  get<T = unknown>(key: string): T | null {
    const entry = this._entries.get(key);
    return entry ? (entry.value as T) : null;
  }

  has(key: string): boolean {
    return this._entries.has(key);
  }

  remove(key: string): boolean {
    const existed = this._entries.delete(key);
    if (existed) {
      this._emit(ContextEvent.EntryRemoved, { key });
    }
    return existed;
  }

  getAllByAgent(agentId: string): ContextEntry[] {
    return [...this._entries.values()].filter(
      (e) => e.sourceAgentId === agentId
    );
  }

  getAllGlobal(): ContextEntry[] {
    return [...this._entries.values()].filter((e) => e.scope === 'global');
  }

  // ======================================================================
  // Query Operations
  // ======================================================================

  query(predicate: (entry: ContextEntry) => boolean): ContextEntry[] {
    return [...this._entries.values()].filter(predicate);
  }

  findByKeyPrefix(prefix: string): ContextEntry[] {
    return this.query((e) => e.key.startsWith(prefix));
  }

  findByAgent(agentId: string): ContextEntry[] {
    return this.query((e) => e.sourceAgentId === agentId);
  }

  findRecent(limit: number = 10): ContextEntry[] {
    const entries = [...this._entries.values()];
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, limit);
  }

  // ======================================================================
  // Snapshots
  // ======================================================================

  createSnapshot(): Snapshot {
    const snapshot: Snapshot = {
      teamId: this._teamId,
      version: this._version,
      timestamp: new Date().toISOString(),
      entries: new Map(this._entries),
      agents: new Set(this._agents),
    };
    this._snapshots.push(snapshot);

    // Keep last 50 snapshots
    if (this._snapshots.length > 50) {
      this._snapshots = this._snapshots.slice(-50);
    }

    this._emit(ContextEvent.SnapshotCreated, snapshot);
    return snapshot;
  }

  restoreSnapshot(snapshot: Snapshot): void {
    this._entries = new Map(snapshot.entries);
    this._agents = new Set(snapshot.agents);
    this._version = snapshot.version;
    this._emit(ContextEvent.SnapshotRestored, snapshot);
  }

  getSnapshots(): Snapshot[] {
    return [...this._snapshots];
  }

  // ======================================================================
  // Utility
  // ======================================================================

  clear(): void {
    this._entries.clear();
    this._version++;
  }

  toJSON(): Record<string, unknown> {
    return {
      teamId: this._teamId,
      entryCount: this._entries.size,
      agentCount: this._agents.size,
      currentVersion: this._version,
      agents: [...this._agents],
      entries: [...this._entries.values()].map((e) => ({
        ...e,
        value: typeof e.value === 'object' ? '[Object]' : e.value,
      })),
    };
  }

  // ======================================================================
  // Internal
  // ======================================================================

  private _enforceCapacity(): void {
    if (this._entries.size < this._maxEntries) {
      return;
    }

    // Remove oldest entry
    const entries = [...this._entries.entries()];
    const [oldestKey] = entries[0];
    this._entries.delete(oldestKey);
  }

  private _emit(event: string, data: unknown): void {
    const handlers = this._listeners.get(event) ?? [];
    for (const handler of handlers) {
      try { handler(data); } catch { /* ignore */ }
    }
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    const handlers = this._listeners.get(event) ?? [];
    handlers.push(handler);
    this._listeners.set(event, handlers);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }
}

// ============================================================================
// Snapshot
// ============================================================================

export interface Snapshot {
  teamId: string;
  version: number;
  timestamp: string;
  entries: Map<string, ContextEntry>;
  agents: Set<string>;
}