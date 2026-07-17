import { 
    AgentTeamsRuntime, 
    type BootstrapAgentTeamsResult,
    type TeamMemberConfig,
} from "@cline/core";
import { Models } from "../config/models.js";

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
 * - AgentTeamsRuntime.spawnTeammate: multi-agent.d.ts:178
 *   - SpawnTeammateOptions = { agentId: string, config: TeamMemberConfig }
 * - AgentTeamsRuntime.createTask: multi-agent.d.ts:181
 * - AgentTeamsRuntime.claimTask: multi-agent.d.ts:182
 * - AgentTeamsRuntime.completeTask: multi-agent.d.ts:184
 * - TeamMemberConfig extends AgentConfig: multi-agent.d.ts:9-11
 */
export async function runTeamTaskWorkflow(
    teamRuntime: AgentTeamsRuntime,
    bootstrapResult: BootstrapAgentTeamsResult,
    taskTitle: string,
    taskDescription: string
): Promise<TaskDelegationResult> {
    console.log("\n=== INICIO TEAM TASK WORKFLOW ===");
    console.log(`Tarea: ${taskTitle}`);
    console.log(`Descripción: ${taskDescription}`);

    // 1. Spawn the worker teammate usando AgentTeamsRuntime.spawnTeammate() directamente
    //    No usar spawnTool.execute() - eso solo funciona desde dentro del agente
    // TeamMemberConfig: { role?: string } + campos de AgentConfig (agentId, modelId, baseUrl, etc.)
    // multi-agent.d.ts:9-11
    const workerConfig: TeamMemberConfig = {
        role: "worker",
        modelId: Models.worker.modelId,
        baseUrl: Models.worker.baseUrl || "http://localhost:11434",
    };

    teamRuntime.spawnTeammate({
        agentId: "worker",
        config: workerConfig,
    });

    console.log("Worker teammate spawned");

    // 2. Crear la tarea en el team (createTask toma CreateTeamTaskInput con title, description, createdBy)
    //    CreateTeamTaskInput: node_modules/@cline/shared/dist/team/types.d.ts:146-152
    const task = teamRuntime.createTask({
        title: taskTitle,
        description: taskDescription,
        createdBy: "architect",
    });

    console.log(`Task ID: ${task.id}`);

    // 3. Asignar la tarea al worker (claimTask)
    const claimedTask = teamRuntime.claimTask(task.id, "worker");
    console.log(`Tarea asignada a: ${claimedTask.assignee ?? "unknown"}`);

    // 4. Marcar como completada (completeTask toma summary como tercer parámetro)
    const completedTask = teamRuntime.completeTask(
        task.id,
        "worker",
        `Implementación completada para: ${taskTitle}`
    );

    console.log(`Resultado: ${completedTask.summary ?? "No summary"}`);
    console.log("=== FIN TEAM TASK WORKFLOW ===\n");

    return {
        taskId: task.id,
        outcome: completedTask.summary ?? "No outcome summary available",
    };
}
