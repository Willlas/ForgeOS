import { AgentTeamsRuntime, type BootstrapAgentTeamsResult } from "@cline/core";
export interface TaskDelegationResult {
    taskId: string;
    outcome: string;
}
/**
 * Workflow avanzado usando AgentTeamsRuntime:
 * 1. Lead agent (Architect) crea una tarea
 * 2. Asigna la tarea a un teammate (Worker)
 * 3. Ejecuta la tarea y obtiene resultado
 *
 * API Fuentes:
 * - AgentTeamsRuntime.createTask: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts
 * - AgentTeamsRuntime.claimTask: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts
 * - AgentTeamsRuntime.completeTask: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts
 */
export declare function runTeamTaskWorkflow(teamRuntime: AgentTeamsRuntime, bootstrapResult: BootstrapAgentTeamsResult, taskTitle: string, taskDescription: string): Promise<TaskDelegationResult>;
//# sourceMappingURL=team-task-flow.d.ts.map