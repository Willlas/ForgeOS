/**
 * AgentRegistry - Central registry for managing agents within the Aer runtime.
 *
 * Provides:
 * - Agent registration, discovery, and lifecycle coordination
 * - Capability-based agent lookup
 * - Role-based agent routing
 * - Health monitoring and automatic degradation
 * - Team composition (AgentTeam abstraction)
 * - Integration with the existing WorkerRegistry for dispatcher compatibility
 *
 * @module runtime/agent-registry
 */

import { IWorker, WorkerStatus, TaskExecutionResult, WorkerHealthStatus } from "./core/types/provider.js";
import { Agent as IAgent, AgentConfig, AgentState } from "./agent.js";

// ============================================================================
// Agent Registry Configuration
// ============================================================================

export interface AgentRegistryConfig {
  /** Maximum number of agents allowed */
  maxAgents?: number;
  /** Auto-start agents on registration */
  autoStart?: boolean;
  /** Enable health monitoring */
  healthMonitoring?: boolean;
  /** Health check interval in ms */
  healthCheckIntervalMs?: number;
}

export function createDefaultAgentRegistryConfig(overrides?: Partial<AgentRegistryConfig>): AgentRegistryConfig {
  return {
    maxAgents: 50,
    autoStart: true,
    healthMonitoring: true,
    healthCheckIntervalMs: 30_000,
    ...overrides,
  };
}

// ============================================================================
// Agent Registration
// ============================================================================

export interface AgentRegistration {
  agent: IAgent;
  registeredAt: string;
  lastHealthCheck: string;
  healthy: boolean;
  isActive: boolean;
}

// ============================================================================
// Agent Team
// ============================================================================

export interface AgentTeam {
  /** Unique team identifier */
  id: string;
  /** Team name */
  name: string;
  /** Lead agent ID */
  leadAgentId?: string;
  /** Member agent IDs */
  memberIds: string[];
  /** Created timestamp */
  createdAt: string;
}

// ============================================================================
// Agent Registry Class
// ============================================================================

/**
 * Central registry for managing agents.
 *
 * Responsibilities:
 * - Lifecycle coordination of all registered agents
 * - Capability and role-based discovery
 * - Team composition management
 * - Health monitoring with automatic degradation
 */
export class AgentRegistry {
  private _agents = new Map<string, AgentRegistration>();
  private _capabilityIndex = new Map<string, Set<string>>();
  private _roleIndex = new Map<string, Set<string>>();
  private _teams = new Map<string, AgentTeam>();
  private _config: AgentRegistryConfig;
  private _healthTimer?: ReturnType<typeof setInterval>;

  constructor(config?: AgentRegistryConfig) {
    this._config = createDefaultAgentRegistryConfig(config);
  }

  // ========================================================================
  // Properties
  // ========================================================================

  get config(): AgentRegistryConfig { return { ...this._config }; }
  get size(): number { return this._agents.size; }
  get agents(): IAgent[] {
    return Array.from(this._agents.values()).map((r) => r.agent);
  }
  get healthyAgents(): IAgent[] {
    return Array.from(this._agents.values())
      .filter((r) => r.healthy && r.isActive)
      .map((r) => r.agent);
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /** Starts the registry and optional health monitoring. */
  async start(): Promise<void> {
    if (this._healthTimer) return;

    if (this._config.healthMonitoring && this._config.healthCheckIntervalMs! > 0) {
      this._healthTimer = setInterval(() => this._checkHealth(), this._config.healthCheckIntervalMs!) as unknown as ReturnType<typeof setInterval>;
    }

    // Auto-start registered agents
    if (this._config.autoStart) {
      for (const [, reg] of this._agents) {
        await (reg.agent as any).start();
      }
    }
  }

  /** Stops all agents and cleans up the registry. */
  async stop(): Promise<void> {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = undefined;
    }

    for (const [, reg] of this._agents) {
      await (reg.agent as any).stop();
    }
  }

  // ========================================================================
  // Agent Registration
  // ========================================================================

  /** Registers an agent with the registry. */
  async register(config: AgentConfig): Promise<IAgent> {
    if (this._agents.size >= (this._config.maxAgents ?? 50)) {
      throw new Error(`AgentRegistry: Maximum agent count (${this._config.maxAgents}) reached`);
    }

    // Check for duplicate ID
    if (this._agents.has(config.id)) {
      throw new Error(`AgentRegistry: Agent "${config.id}" already registered`);
    }

    const agent = new AgentClass(config);

    if (this._config.autoStart) {
      await (agent as any).start();
    }

    this._addAgent(agent);
    return agent;
  }

  /** Registers a pre-configured agent. */
  async registerAgent(agent: IAgent): Promise<void> {
    if (this._agents.has(agent.id)) {
      throw new Error(`AgentRegistry: Agent "${agent.id}" already registered`);
    }

    this._addAgent(agent);
  }

  /** Unregisters an agent and stops it. */
  async unregister(agentId: string): Promise<void> {
    const reg = this._agents.get(agentId);
    if (!reg) return;

    await (reg.agent as any).stop();
    this._removeAgent(agentId);
  }

  // ========================================================================
  // Agent Discovery
  // ========================================================================

  /** Gets an agent by ID. */
  get(agentId: string): IAgent | undefined {
    const reg = this._agents.get(agentId);
    return reg?.agent;
  }

  /** Checks if an agent is registered. */
  has(agentId: string): boolean {
    return this._agents.has(agentId);
  }

  /** Finds agents by role. */
  findByRole(role: string): IAgent[] {
    const ids = this._roleIndex.get(role);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => {
        const reg = this._agents.get(id);
        return (reg && reg.agent.state !== AgentState.Stopped && reg.agent.state !== AgentState.Error) ? reg.agent : null;
      })
      .filter((a): a is IAgent => a !== null);
  }

  /** Finds agents by capability. */
  findByCapability(capability: string): IAgent[] {
    const ids = this._capabilityIndex.get(capability);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => {
        const reg = this._agents.get(id);
        return (reg && reg.healthy && reg.agent.state !== AgentState.Stopped && reg.agent.state !== AgentState.Error) ? reg.agent : null;
      })
      .filter((a): a is IAgent => a !== null);
  }

  /** Finds all idle agents. */
  findAllIdle(): IAgent[] {
    return this.agents.filter((a) => a.state === AgentState.Idle);
  }

  /** Finds all healthy agents matching required capabilities. */
  findAvailable(requiredCapabilities: string[]): IAgent[] {
    const candidates = this.healthyAgents;
    if (requiredCapabilities.length === 0) return candidates;
    return candidates.filter((a) => a.canHandle(requiredCapabilities));
  }

  // ========================================================================
  // Team Management
  // ========================================================================

  /** Creates a team from registered agents. */
  createTeam(teamName: string, leadAgentId?: string, memberIds?: string[]): AgentTeam {
    const id = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Validate members exist
    const validMembers = (memberIds ?? []).filter((mid) => this._agents.has(mid));
    if (leadAgentId && !this._agents.has(leadAgentId)) {
      throw new Error(`AgentRegistry: Lead agent "${leadAgentId}" not registered`);
    }

    const team: AgentTeam = {
      id,
      name: teamName,
      leadAgentId,
      memberIds: validMembers.length > 0 ? validMembers : this.agents.map((a) => a.id),
      createdAt: new Date().toISOString(),
    };

    this._teams.set(id, team);
    return team;
  }

  /** Gets a team by ID. */
  getTeam(teamId: string): AgentTeam | undefined {
    return this._teams.get(teamId);
  }

  /** Removes a team. */
  removeTeam(teamId: string): void {
    this._teams.delete(teamId);
  }

  /** Lists all teams. */
  listTeams(): ReadonlyArray<AgentTeam> {
    return Array.from(this._teams.values());
  }

  // ========================================================================
  // Agent Operations
  // ========================================================================

  /** Pauses an agent. */
  pause(agentId: string): void {
    const reg = this._agents.get(agentId);
    if (reg && reg.agent.state === AgentState.Active) {
      (reg.agent as any).pause();
    }
  }

  /** Resumes a paused agent. */
  resume(agentId: string): void {
    const reg = this._agents.get(agentId);
    if (reg && reg.agent.state === AgentState.Paused) {
      (reg.agent as any).resume();
    }
  }

  /** Generates a response from the first available agent matching criteria. */
  async generate(prompt: string, requiredCapabilities?: string[], role?: string): Promise<{ agentId: string; content: string }> {
    const candidate = this._selectAgent(requiredCapabilities, role);
    if (!candidate) {
      throw new Error(`AgentRegistry: No available agent${requiredCapabilities ? ` for capabilities [${requiredCapabilities.join(", ")}]` : ''}`);
    }

    const result = await (candidate as any).generate(prompt);
    return { agentId: candidate.id, content: result.content };
  }

  // ========================================================================
  // Health Monitoring
  // ========================================================================

  /** Manually checks health of all agents. */
  async checkAllHealth(): Promise<void> {
    for (const [, reg] of this._agents) {
      reg.lastHealthCheck = new Date().toISOString();
      reg.healthy = await this._assessHealth(reg.agent);
    }
  }

  /** Gets health summary. */
  getHealthSummary(): { total: number; healthy: number; degraded: number } {
    const total = this._agents.size;
    const healthy = Array.from(this._agents.values()).filter((r) => r.healthy).length;
    return { total, healthy, degraded: total - healthy };
  }

  // ========================================================================
  // Integration with Dispatcher (IWorker compatibility)
  // ========================================================================

  /** Converts registry to a worker-like interface for dispatcher integration. */
  toWorkerProxy(): IWorker {
    const self = this;
    const healthyCount = Array.from(this._agents.values())
      .filter((r) => r.healthy && r.isActive).length;

    return {
      id: `agent-registry-proxy-${Date.now()}`,
      name: "AgentRegistryProxy",
      type: "agent-registry",
      get isOnline(): boolean { return self._agents.size > 0; },
      get status(): WorkerStatus { return healthyCount > 0 ? WorkerStatus.Ready : WorkerStatus.Offline; },
      get capabilities(): string[] { return ["agent-team", "multi-agent"]; },
      get maxConcurrency(): number { return healthyCount || 10; },
      get activeTasks(): number { return 0; },
      get remainingCapacity(): number { return this.maxConcurrency; },
      start: async () => {},
      stop: async () => {},
      canExecute: (caps: string[]): boolean => caps.every((c) => ["agent-team", "multi-agent"].includes(c)),
      execute: async (_node: unknown): Promise<TaskExecutionResult> => ({
        success: true,
        artifacts: [],
        knowledgeCaptured: [],
        metrics: { tokensUsed: 0, durationMs: 0 },
        durationMs: 0,
      }),
      cancel: async (): Promise<boolean> => true,
      healthCheck: async (): Promise<WorkerHealthStatus> => Promise.resolve({ status: "healthy" } as WorkerHealthStatus),
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private _addAgent(agent: IAgent): void {
    const reg: AgentRegistration = {
      agent,
      registeredAt: new Date().toISOString(),
      lastHealthCheck: new Date().toISOString(),
      healthy: true,
      isActive: agent.state !== AgentState.Stopped && agent.state !== AgentState.Error,
    };

    this._agents.set(agent.id, reg);

    // Update indexes
    if (agent.config.role) {
      const roleSet = this._roleIndex.get(agent.config.role) ?? new Set<string>();
      roleSet.add(agent.id);
      this._roleIndex.set(agent.config.role, roleSet);
    }

    for (const cap of agent.capabilities) {
      const capSet = this._capabilityIndex.get(cap.name) ?? new Set<string>();
      capSet.add(agent.id);
      this._capabilityIndex.set(cap.name, capSet);
    }
  }

  private _removeAgent(agentId: string): void {
    this._agents.delete(agentId);

    // Remove from role index
    for (const [role, ids] of this._roleIndex) {
      ids.delete(agentId);
      if (ids.size === 0) this._roleIndex.delete(role);
    }

    // Remove from capability index
    for (const [cap, ids] of this._capabilityIndex) {
      ids.delete(agentId);
      if (ids.size === 0) this._capabilityIndex.delete(cap);
    }
  }

  private _selectAgent(requiredCapabilities?: string[], role?: string): IAgent | undefined {
    let candidates = this.healthyAgents;

    // Filter by role if specified
    if (role) {
      candidates = candidates.filter((a) => a.config.role === role);
    }

    // Filter by capabilities if required
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      candidates = candidates.filter((a) => a.canHandle(requiredCapabilities));
    }

    return candidates.length > 0 ? candidates[0] : undefined;
  }

  private async _checkHealth(): Promise<void> {
    await this.checkAllHealth();
  }

  private async _assessHealth(agent: IAgent): Promise<boolean> {
    // Health based on state and metrics
    if (agent.state === AgentState.Error) return false;
    if (agent.state === AgentState.Stopped) return false;
    return true;
  }
}

// ============================================================================
// Helper class import alias
// ============================================================================

import { Agent as AgentClass } from "./agent.js";

// ============================================================================
// Singleton instance
// ============================================================================

let _instance: AgentRegistry | null = null;

/** Gets or creates the global agent registry singleton. */
export function getAgentRegistry(): AgentRegistry {
  if (!_instance) {
    _instance = new AgentRegistry();
  }
  return _instance;
}

/** Resets the singleton (useful for testing). */
export function resetAgentRegistry(): void {
  if (_instance) {
    _instance.stop().catch(() => {});
    _instance = null;
  }
}

/** Auto-registers default agents on module load. */
export function registerDefaultAgents(registry?: AgentRegistry): void {
  const reg = registry ?? getAgentRegistry();

  if (!registry) {
    reg.register({
      id: "architect",
      name: "Architect Agent",
      systemPrompt: "You are a senior software architect. Design systems and delegate implementation.",
      providerId: "ollama",
      modelId: "qwen3.6:27b",
      baseUrl: "http://localhost:11434",
      role: "architect",
      capabilities: [
        { name: "architecture", description: "System architecture design", version: "1.0" },
        { name: "delegation", description: "Task delegation to workers", version: "1.0" },
      ],
    }).catch(() => {});

    reg.register({
      id: "worker",
      name: "Worker Agent",
      systemPrompt: "You are a software developer. Implement code, create files, and execute tasks.",
      providerId: "ollama",
      modelId: "qwen2.5-coder:7b",
      baseUrl: "http://localhost:11434",
      role: "worker",
      capabilities: [
        { name: "coding", description: "Code generation and modification", version: "1.0" },
        { name: "file-system", description: "File creation and modification", version: "1.0" },
      ],
    }).catch(() => {});

    reg.register({
      id: "reviewer",
      name: "Reviewer Agent",
      systemPrompt: "You are a senior code reviewer. Review implementations for quality and correctness.",
      providerId: "ollama",
      modelId: "qwen3.6:27b",
      baseUrl: "http://localhost:11434",
      role: "reviewer",
      capabilities: [
        { name: "code-review", description: "Code review and analysis", version: "1.0" },
        { name: "quality-assurance", description: "Quality assurance checking", version: "1.0" },
      ],
    }).catch(() => {});
  }
}

// Auto-register on import (can be overridden by calling registerDefaultAgents explicitly)
registerDefaultAgents();