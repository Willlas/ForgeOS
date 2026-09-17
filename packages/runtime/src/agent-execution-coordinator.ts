/**
 * AgentExecutionCoordinator - Coordinates agent execution requests with the existing runtime.
 *
 * This coordinator bridges the Agent abstraction with the existing execution runtime components,
 * enabling agents to create execution requests that are processed by the existing infrastructure.
 *
 * @module runtime/agent-execution-coordinator
 */

import { AgentRegistry } from "./agent-registry.js";

// ============================================================================
// Execution Request Types
// ============================================================================

export interface ExecutionRequest {
  /** Unique identifier for the execution request */
  id: string;
  
  /** The agent that initiated the request */
  agentId: string;
  
  /** The task or prompt to execute */
  prompt: string;
  
  /** Required capabilities for execution */
  requiredCapabilities?: string[];
}

export interface ExecutionResult {
  /** Unique identifier for the execution */
  id: string;
  
  /** Agent that executed the task */
  agentId: string;
  
  /** Result content */
  content: string;
  
  /** Tokens used */
  tokensUsed: number;
  
  /** Execution duration in ms */
  durationMs: number;
  
  /** Whether execution was successful */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// AgentExecutionCoordinator Class
// ============================================================================

/**
 * Coordinates agent execution requests with the existing runtime infrastructure.
 *
 * This class provides a bridge between the Agent abstraction and the existing
 * execution infrastructure, enabling agents to make execution requests that are
 * processed through the standard runtime components.
 */
export class AgentExecutionCoordinator {
  private _agentRegistry: AgentRegistry;

  constructor(agentRegistry?: AgentRegistry) {
    this._agentRegistry = agentRegistry || getAgentRegistry();
  }

  // ========================================================================
  // Execution Methods
  // ========================================================================

  /**
   * Executes a prompt using the agent system.
   * 
   * This method transforms an execution request into a workgraph execution
   * using the existing runtime infrastructure.
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Validate that the agent exists and is ready
      const agent = this._agentRegistry.get(request.agentId);
      if (!agent) {
        throw new Error(`Agent "${request.agentId}" not found`);
      }

      if (agent.state === AgentState.Error || agent.state === AgentState.Stopped) {
        throw new Error(`Agent "${request.agentId}" is not in a runnable state`);
      }

      // Execute using the agent's generate method directly
      const result = await agent.generate(request.prompt);
      
      return {
        id: request.id,
        agentId: request.agentId,
        content: result.content,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        id: request.id,
        agentId: request.agentId,
        content: "",
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Executes a prompt using an available agent based on capabilities.
   */
  async executeWithCapability(
    prompt: string, 
    requiredCapabilities: string[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Find an available agent that can handle the required capabilities
      const candidates = this._agentRegistry.findAvailable(requiredCapabilities);
      
      if (candidates.length === 0) {
        throw new Error(`No available agent found with capabilities: [${requiredCapabilities.join(", ")}]`);
      }

      // Use the first available agent
      const agent = candidates[0];
      
      // Execute using the agent directly
      const result = await agent.generate(prompt);
      
      return {
        id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agentId: agent.id,
        content: result.content,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        agentId: "unknown",
        content: "",
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
        success: false,
        error: errorMessage
      };
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /** Gets the current agent registry */
  get agentRegistry(): AgentRegistry {
    return this._agentRegistry;
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let _coordinatorInstance: AgentExecutionCoordinator | null = null;

/** Gets or creates the global agent execution coordinator singleton. */
export function getAgentExecutionCoordinator(): AgentExecutionCoordinator {
  if (!_coordinatorInstance) {
    _coordinatorInstance = new AgentExecutionCoordinator();
  }
  return _coordinatorInstance;
}

/** Resets the singleton (useful for testing). */
export function resetAgentExecutionCoordinator(): void {
  _coordinatorInstance = null;
}

// ============================================================================
// Helper Imports
// ============================================================================

import { AgentState } from "./agent.js";
import { getAgentRegistry } from "./agent-registry.js";
