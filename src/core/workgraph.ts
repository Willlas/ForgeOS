/**
 * Work Graph Engine - Manages the executable engineering state of the repository.
 *
 * The Work Graph represents all pending, active, and completed engineering work.
 * It provides graph algorithms for dependency resolution, cycle detection, and
 * priority scoring to feed the scheduler.
 *
 * @module core/workgraph
 */

import {
  generateNodeId,
  createWorkNode,
  createWorkGraph,
  WorkNodeState,
  WorkNodeType,
  WorkGraphLifecycleState,
} from "./types/work-graph.js";

import type {
  WorkNode,
  WorkGraph,
  WorkNodeFilter,
  WorkGraphQueryResult,
  PriorityScore,
  PriorityScoringConfig,
  AddNodeResult,
  NodeRemovedResult,
} from "./types/work-graph.js";

// Re-export for convenience
export {
  generateNodeId,
  createWorkNode,
  createWorkGraph,
  WorkNodeState,
  WorkNodeType,
  WorkGraphLifecycleState,
} from "./types/work-graph.js";

export type {
  WorkNode,
  WorkGraph,
  WorkNodeFilter,
  WorkGraphQueryResult,
  PriorityScore,
  PriorityScoringConfig,
  AddNodeResult,
  NodeRemovedResult,
} from "./types/work-graph.js";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_NODE_TRANSITIONS: Record<WorkNodeState, Set<WorkNodeState>> = {
  [WorkNodeState.Planned]: new Set([WorkNodeState.Ready, WorkNodeState.Cancelled]),
  [WorkNodeState.Ready]: new Set([WorkNodeState.Running, WorkNodeState.Cancelled, WorkNodeState.Waiting]),
  [WorkNodeState.Running]: new Set([WorkNodeState.Completed, WorkNodeState.Failed, WorkNodeState.Blocked, WorkNodeState.Waiting]),
  [WorkNodeState.Waiting]: new Set([WorkNodeState.Ready, WorkNodeState.Cancelled]),
  [WorkNodeState.Blocked]: new Set([WorkNodeState.Ready, WorkNodeState.Cancelled]),
  [WorkNodeState.Review]: new Set([WorkNodeState.Completed, WorkNodeState.Failed, WorkNodeState.Cancelled]),
  [WorkNodeState.Completed]: new Set([WorkNodeState.Archived]),
  [WorkNodeState.Cancelled]: new Set([WorkNodeState.Archived]),
  [WorkNodeState.Failed]: new Set([WorkNodeState.Ready, WorkNodeState.Cancelled]),
  [WorkNodeState.Archived]: new Set(),
};

// WorkGraphEngine
// ============================================================================

/**
 * Engine for managing the Work Graph - node creation, dependency resolution,
 * graph traversal, and priority scoring.
 */
export class WorkGraphEngine {
  private graph: WorkGraph;
  private allowedTransitions: Record<WorkNodeState, Set<WorkNodeState>>;
  private scoringConfig: PriorityScoringConfig;

  constructor(options?: {
    graph?: WorkGraph;
    allowedTransitions?: Record<WorkNodeState, Set<WorkNodeState>>;
    scoringConfig?: PriorityScoringConfig;
  }) {
    this.graph = options?.graph ?? createWorkGraph("default", "default");
    this.allowedTransitions = options?.allowedTransitions ?? DEFAULT_NODE_TRANSITIONS;
    this.scoringConfig = options?.scoringConfig ?? {
      basePriorityWeight: 1.0,
      maxDependencyBoost: 2.0,
      blockingPenalty: 0.5,
      recencyHalfLifeMs: 3_600_000,
    };
  }

  // ========================================================================
  // Graph Accessors
  // ========================================================================

  getGraph(): WorkGraph {
    return this.graph;
  }

  getNode(nodeId: string): WorkNode | undefined {
    return this.graph.nodes.get(nodeId);
  }

  getAllNodes(): WorkNode[] {
    return Array.from(this.graph.nodes.values());
  }

  getNodesByState(state: WorkNodeState): WorkNode[] {
    return this.getAllNodes().filter((n) => n.state === state);
  }

  isRunning(): boolean {
    return this.graph.state === "active";
  }

  // ========================================================================
  // Graph Lifecycle
  // ========================================================================

  activate(): void {
    if (this.graph.state !== WorkGraphLifecycleState.Creating) {
      throw new Error(`Cannot activate graph in state: ${this.graph.state}`);
    }
    this.graph.state = WorkGraphLifecycleState.Active;
    this.graph.updatedAt = new Date().toISOString();

    // Transition all planned nodes without dependencies to ready
    for (const node of this.graph.nodes.values()) {
      if (node.state === WorkNodeState.Planned && node.dependencies.length === 0) {
        node.state = WorkNodeState.Ready;
        node.updatedAt = new Date().toISOString();
      }
    }
  }

  pause(): void {
    if (this.graph.state !== WorkGraphLifecycleState.Active) {
      throw new Error(`Cannot pause graph in state: ${this.graph.state}`);
    }
    this.graph.state = WorkGraphLifecycleState.Paused;
    this.graph.updatedAt = new Date().toISOString();
  }

  resume(): void {
    if (this.graph.state !== WorkGraphLifecycleState.Paused) {
      throw new Error(`Cannot resume graph in state: ${this.graph.state}`);
    }
    this.graph.state = WorkGraphLifecycleState.Active;
    this.graph.updatedAt = new Date().toISOString();

    // Transition waiting nodes with satisfied dependencies to ready
    for (const node of this.graph.nodes.values()) {
      if (node.state === WorkNodeState.Waiting) {
        const canReady = this.canTransitionTo(node.id, WorkNodeState.Ready);
        if (canReady) {
          node.state = WorkNodeState.Ready;
          node.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  complete(): void {
    const incompleteNodes = this.getAllNodes().filter(
      (n) => n.state !== WorkNodeState.Completed && n.state !== WorkNodeState.Cancelled && n.state !== WorkNodeState.Archived
    );
    if (incompleteNodes.length > 0) {
      throw new Error(`Cannot complete graph: ${incompleteNodes.length} nodes still active`);
    }
    this.graph.state = WorkGraphLifecycleState.Complete;
    this.graph.updatedAt = new Date().toISOString();
  }

  abandon(): void {
    this.graph.state = WorkGraphLifecycleState.Abandoned;
    this.graph.updatedAt = new Date().toISOString();
  }

  // ========================================================================
  // Node Management
  // ========================================================================

  addNode(
    title: string,
    description: string,
    type: WorkNodeType,
    options?: {
      priority?: number;
      dependencies?: string[];
      requiredCapabilities?: string[];
      estimatedCost?: number;
      estimatedTokens?: number;
      estimatedTimeMs?: number;
      metadata?: Record<string, unknown>;
    }
  ): AddNodeResult {
    if (this.graph.state === WorkGraphLifecycleState.Complete || this.graph.state === WorkGraphLifecycleState.Abandoned) {
      return { success: false, error: "invalid_dependency", details: `Cannot add nodes to ${this.graph.state} graph` };
    }

    const nodeId = generateNodeId({ prefix: type.split("_")[0].substring(0, 4) });

    if (this.graph.nodes.has(nodeId)) {
      return { success: false, error: "node_exists", details: `Node ${nodeId} already exists` };
    }

    // Validate dependencies exist
    for (const depId of options?.dependencies ?? []) {
      if (!this.graph.nodes.has(depId)) {
        return { success: false, error: "invalid_dependency", details: `Dependency ${depId} does not exist` };
      }
    }

    // Check for circular dependencies
    const newNode = createWorkNode(title, description, type, options);
    if (this.wouldCreateCycle(nodeId, options?.dependencies ?? [])) {
      return { success: false, error: "circular_dependency", details: `Adding ${nodeId} would create a cycle` };
    }

    // Add node and update adjacency
    this.graph.nodes.set(nodeId, newNode);
    this.ensureDependentsEntry(nodeId);

    for (const depId of options?.dependencies ?? []) {
      if (!this.graph.dependents.has(depId)) {
        this.graph.dependents.set(depId, new Set());
      }
      this.graph.dependents.get(depId)!.add(nodeId);
    }

    // Transition to Ready if no dependencies
    if (!(options?.dependencies ?? options?.dependencies)?.length) {
      newNode.state = WorkNodeState.Ready;
    }

    newNode.updatedAt = new Date().toISOString();
    this.graph.updatedAt = new Date().toISOString();

    return { success: true, node: newNode, unblockedNodes: [] };
  }

  removeNode(nodeId: string): NodeRemovedResult | { success: false; error: string; details: string } {
    const node = this.graph.nodes.get(nodeId);
    if (!node) {
      return { success: false, error: "invalid_dependency", details: `Node ${nodeId} not found` };
    }

    const affectedNodes: string[] = [];

    // Find direct dependents
    const dependents = this.graph.dependents.get(nodeId);
    if (dependents) {
      for (const childId of dependents) {
        const child = this.graph.nodes.get(childId);
        if (child && child.state !== WorkNodeState.Completed && child.state !== WorkNodeState.Cancelled) {
          affectedNodes.push(childId);
        }
      }
    }

    // Remove node from graph and update adjacency
    this.graph.nodes.delete(nodeId);
    for (const [, deps] of this.graph.dependents) {
      deps.delete(nodeId);
    }

    return { success: true, nodeId, affectedNodes };
  }

  // ========================================================================
  // State Transitions
  // ========================================================================

  transitionNode(nodeId: string, newState: WorkNodeState): boolean {
    const node = this.graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const currentState = node.state;
    if (currentState === newState) {
      return false;
    }

    const allowed = this.allowedTransitions[currentState];
    if (!allowed || !allowed.has(newState)) {
      throw new Error(
        `Invalid transition: ${currentState} -> ${newState} for node ${nodeId}`
      );
    }

    node.state = newState;
    node.updatedAt = new Date().toISOString();

    // Update timestamps based on state
    if (newState === WorkNodeState.Running) {
      node.startedAt = new Date().toISOString();
    } else if (newState === WorkNodeState.Completed || newState === WorkNodeState.Cancelled) {
      node.completedAt = new Date().toISOString();
    }

    // Check if any dependents can transition to Ready
    this.checkDependentTransitions(nodeId);

    return true;
  }

  canTransitionTo(nodeId: string, newState: WorkNodeState): boolean {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return false;
    const allowed = this.allowedTransitions[node.state];
    return !!allowed && allowed.has(newState);
  }

  // ========================================================================
  // Dependency Management
  // ========================================================================

  getDependents(nodeId: string): string[] {
    const dependents = this.graph.dependents.get(nodeId);
    return dependents ? Array.from(dependents) : [];
  }

  getDependencies(nodeId: string): string[] {
    const node = this.graph.nodes.get(nodeId);
    return node ? [...node.dependencies] : [];
  }

  getScheduledNodes(): WorkNode[] {
    return this.getAllNodes().filter((n) => n.state === WorkNodeState.Ready);
  }

  getRunningNodes(): WorkNode[] {
    return this.getAllNodes().filter((n) => n.state === WorkNodeState.Running);
  }

  areDependenciesSatisfied(nodeId: string): boolean {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return false;

    for (const depId of node.dependencies) {
      const dep = this.graph.nodes.get(depId);
      if (!dep || dep.state !== WorkNodeState.Completed) {
        return false;
      }
    }
    return true;
  }

  // ========================================================================
  // Graph Algorithms
  // ========================================================================

  /**
   * Topological sort of nodes using Kahn's algorithm.
   * Returns nodes in order such that all dependencies come before dependents.
   */
  topologicalSort(): WorkNode[] {
    const nodes = this.getAllNodes();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      inDegree.set(node.id, node.dependencies.length);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: WorkNode[] = [];
    while (queue.length > 0) {
      // Sort by priority within same level for deterministic output
      queue.sort((a, b) => {
        const na = this.graph.nodes.get(a)!;
        const nb = this.graph.nodes.get(b)!;
        return nb.priority - na.priority;
      });

      const currentId = queue.shift()!;
      const currentNode = this.graph.nodes.get(currentId)!;
      result.push(currentNode);

      for (const dependentId of this.getDependents(currentId)) {
        const newDegree = inDegree.get(dependentId)! - 1;
        inDegree.set(dependentId, newDegree);
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    if (result.length !== nodes.length) {
      throw new Error("Cycle detected in work graph - cannot perform topological sort");
    }

    return result;
  }

  /**
   * Detects cycles in the work graph using DFS.
   * Returns null if no cycle exists, or an array of node IDs forming the cycle.
   */
  detectCycle(): string[] | null {
    const nodes = this.getAllNodes();
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const parent = new Map<string, string | null>();

    const dfs = (nodeId: string): string[] | null => {
      visited.add(nodeId);
      inStack.add(nodeId);

      for (const depId of this.getDependents(nodeId)) {
        if (!visited.has(depId)) {
          parent.set(depId, nodeId);
          const cycle = dfs(depId);
          if (cycle) return cycle;
        } else if (inStack.has(depId)) {
          // Cycle found - reconstruct it
          const cyclePath = [depId];
          let current = nodeId;
          while (current !== depId) {
            cyclePath.push(current);
            const next = parent.get(current);
            if (!next) break;
            current = next;
          }
          cyclePath.push(depId);
          return cyclePath.reverse();
        }
      }

      inStack.delete(nodeId);
      return null;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = dfs(node.id);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * Checks if adding a node with given dependencies would create a cycle.
   */

  /**
   * Returns all transitive dependents of a node.
   */
  getTransitiveDependents(nodeId: string): Set<string> {
    const result = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const depId of this.getDependents(current)) {
        if (!result.has(depId)) {
          result.add(depId);
          queue.push(depId);
        }
      }
    }

    return result;
  }

  /**
   * Returns all transitive dependencies of a node.
   */
  getTransitiveDependencies(nodeId: string): Set<string> {
    const result = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = this.graph.nodes.get(current);
      if (!node) continue;

      for (const depId of node.dependencies) {
        if (!result.has(depId)) {
          result.add(depId);
          queue.push(depId);
        }
      }
    }

    return result;
  }

  /**
   * Critical path analysis - finds the longest path through the graph.
   * Uses estimatedTimeMs as edge weights.
   */
  criticalPath(): { nodeId: string; cumulativeTimeMs: number }[] {
    const sorted = this.topologicalSort();
    const earliestStart = new Map<string, number>();
    const result: { nodeId: string; cumulativeTimeMs: number }[] = [];

    for (const node of sorted) {
      let es = 0;
      for (const depId of node.dependencies) {
        const depEnd = (earliestStart.get(depId) ?? 0) + (this.graph.nodes.get(depId)?.estimatedTimeMs ?? 0);
        es = Math.max(es, depEnd);
      }
      earliestStart.set(node.id, es);

      const endTime = es + node.estimatedTimeMs;
      result.push({ nodeId: node.id, cumulativeTimeMs: endTime });
    }

    return result.sort((a, b) => b.cumulativeTimeMs - a.cumulativeTimeMs);
  }

  // ========================================================================
  // Priority Scoring
  // ============================================================================

  /**
   * Computes priority score for all ready nodes.
   */
  scoreReadyNodes(): Array<{ nodeId: string; score: PriorityScore }> {
    const ready = this.getScheduledNodes();
    return ready.map((node) => ({
      nodeId: node.id,
      score: this.scoreNode(node),
    }));
  }

  /**
   * Computes priority score for a single node.
   */
  scoreNode(node: WorkNode): PriorityScore {
    const now = Date.now();
    const createdMs = now - new Date(node.createdAt).getTime();

    // Dependency boost: nodes with more dependents that are not completed get boosted
    const dependents = this.getDependents(node.id);
    const unsatisfiedDependents = dependents.filter(
      (depId) => {
        const dep = this.graph.nodes.get(depId);
        return dep && dep.state !== WorkNodeState.Completed && dep.state !== WorkNodeState.Cancelled;
      }
    );
    const dependencyBoost = Math.min(this.scoringConfig.maxDependencyBoost, unsatisfiedDependents.length * 0.5);

    // Blocking decay: waiting/blocked nodes get penalized
    let blockingDecay = 0;
    if (node.state === WorkNodeState.Waiting || node.state === WorkNodeState.Blocked) {
      blockingDecay = this.scoringConfig.blockingPenalty;
    }

    // Recency bonus: newer ready nodes get slight bonus that decays over time
    const halfLifeFactor = Math.pow(0.5, createdMs / this.scoringConfig.recencyHalfLifeMs);
    const recencyBonus = 0.5 * halfLifeFactor;

    const totalScore =
      this.scoringConfig.basePriorityWeight * node.priority +
      dependencyBoost -
      blockingDecay +
      recencyBonus;

    return {
      basePriority: node.priority,
      dependencyBoost,
      blockingDecay,
      recencyBonus,
      totalScore,
    };
  }

  // ========================================================================
  // Queries
  // ========================================================================

  filterNodes(filter: WorkNodeFilter): WorkGraphQueryResult {
    let nodes = this.getAllNodes();

    if (filter.types) {
      nodes = nodes.filter((n) => filter.types!.includes(n.type));
    }

    if (filter.states) {
      nodes = nodes.filter((n) => filter.states!.includes(n.state));
    }

    if (filter.priorityMin !== undefined) {
      nodes = nodes.filter((n) => n.priority >= filter.priorityMin!);
    }

    if (filter.priorityMax !== undefined) {
      nodes = nodes.filter((n) => n.priority <= filter.priorityMax!);
    }

    if (filter.capability) {
      nodes = nodes.filter((n) => n.requiredCapabilities.includes(filter.capability!));
    }

    if (filter.hasDependencies !== undefined) {
      nodes = nodes.filter((n) =>
        filter.hasDependencies ! ? n.dependencies.length > 0 : n.dependencies.length === 0
      );
    }

    if (filter.isBlocked) {
      nodes = nodes.filter((n) => n.state === WorkNodeState.Blocked);
    }

    if (filter.assignedToWorker) {
      nodes = nodes.filter((n) => n.assignedWorkerId === filter.assignedToWorker);
    }

    return {
      nodes,
      totalCount: this.getAllNodes().length,
      offset: 0,
      limit: nodes.length,
    };
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  getStatistics(): {
    total: number;
    byState: Record<WorkNodeState, number>;
    byType: Record<WorkNodeType, number>;
    readyCount: number;
    runningCount: number;
    completedCount: number;
    blockedCount: number;
    totalEstimatedCost: number;
    totalEstimatedTokens: number;
    totalEstimatedTimeMs: number;
    avgPriority: number;
  } {
    const nodes = this.getAllNodes();
    const byState: Record<WorkNodeState, number> = {} as any;
    const byType: Record<WorkNodeType, number> = {} as any;

    for (const state of Object.values(WorkNodeState)) {
      byState[state] = 0;
    }
    for (const type of Object.values(WorkNodeType)) {
      byType[type] = 0;
    }

    let totalCost = 0;
    let totalTokens = 0;
    let totalTime = 0;
    let totalPriority = 0;

    for (const node of nodes) {
      byState[node.state]++;
      byType[node.type]++;
      totalCost += node.estimatedCost;
      totalTokens += node.estimatedTokens;
      totalTime += node.estimatedTimeMs;
      totalPriority += node.priority;
    }

    return {
      total: nodes.length,
      byState,
      byType,
      readyCount: byState[WorkNodeState.Ready] ?? 0,
      runningCount: byState[WorkNodeState.Running] ?? 0,
      completedCount: byState[WorkNodeState.Completed] ?? 0,
      blockedCount: byState[WorkNodeState.Blocked] ?? 0,
      totalEstimatedCost: totalCost,
      totalEstimatedTokens: totalTokens,
      totalEstimatedTimeMs: totalTime,
      avgPriority: nodes.length > 0 ? totalPriority / nodes.length : 0,
    };
  }

  // ========================================================================
  // Serialization
  // ========================================================================

  serialize(): string {
    const data = {
      ...this.graph,
      // Convert Maps to arrays for JSON serialization
      nodes: Array.from(this.graph.nodes.entries()).map(([id, node]) => [id, node]),
      dependents: Array.from(this.graph.dependents.entries()).map(([id, deps]) => [id, Array.from(deps)]),
    };
    return JSON.stringify(data, (_key, value) => {
      if (value instanceof Map) {
        return { __type: "Map", entries: Array.from(value.entries()) };
      }
      if (value instanceof Set) {
        return { __type: "Set", values: Array.from(value) };
      }
      return value;
    }, 2);
  }

  static deserialize(json: string): WorkGraphEngine {
    const data = JSON.parse(json);

    // Restore Maps and Sets
    const nodes = new Map<string, WorkNode>(data.nodes.map(([id, node]: [string, WorkNode]) => [id, node]));
    const dependents = new Map<string, Set<string>>();

    for (const [id, deps] of data.dependents) {
      dependents.set(id, new Set(deps));
    }

    const graph: WorkGraph = {
      ...data,
      nodes,
      dependents,
    };

    return new WorkGraphEngine({ graph });
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private ensureDependentsEntry(nodeId: string): void {
    if (!this.graph.dependents.has(nodeId)) {
      this.graph.dependents.set(nodeId, new Set());
    }
  }

  private checkDependentTransitions(completedNodeId: string): void {
    const dependents = this.getDependents(completedNodeId);

    for (const depId of dependents) {
      const node = this.graph.nodes.get(depId);
      if (!node || node.state !== WorkNodeState.Waiting && node.state !== WorkNodeState.Planned) continue;

      if (this.areDependenciesSatisfied(depId)) {
        const canReady = this.canTransitionTo(depId, WorkNodeState.Ready);
        if (canReady) {
          node.state = WorkNodeState.Ready;
          node.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  private wouldCreateCycle(_nodeId: string, dependencies: string[]): boolean {
    // A cycle would be created if any transitive dependent of a dependency is the node itself
    // Since the node doesn't exist in the graph yet, we check if any dependency
    // transitively depends on another node that the new node would depend on
    const visited = new Set<string>();
    const check = (targetId: string): boolean => {
      if (dependencies.includes(targetId)) return true;
      if (visited.has(targetId)) return false;
      visited.add(targetId);

      for (const depId of this.getDependents(targetId)) {
        if (check(depId)) return true;
      }
      return false;
    };

    for (const depId of dependencies) {
      // Check the dependency's dependents recursively
      const dep = this.graph.nodes.get(depId);
      if (!dep) continue;
      for (const dependentId of this.getDependents(depId)) {
        if (check(dependentId)) return true;
      }
    }
    return false;
  }
}

// ============================================================================
// Export all types and classes
// ============================================================================

export { WorkGraphEngine as default };