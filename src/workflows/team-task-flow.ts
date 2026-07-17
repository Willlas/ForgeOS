import { 
    AgentTeamsRuntime, 
} from "@cline/core";

// Type alias for the bootstrap result (actual type depends on SDK version)
type BootstrapResult = ReturnType<typeof import("@cline/core").bootstrapAgentTeams>;

export interface TaskDelegationResult {
    taskId: string;
    outcome: string;
}

/**
 * Workflow avanzado usando AgentTeamsRuntime:
 * 1. Lead agent (Architect) crea una tarea
 * 2. Asigna la tarea a un teammate (Worker)
 * 3. Ejecuta la tarea y obtiene resultado
 */
export async function runTeamTaskWorkflow(
    teamRuntime: AgentTeamsRuntime,
    bootstrapResult: BootstrapResult,
    taskTitle: string,
    taskDescription: string
): Promise<TaskDelegationResult> {
    console.log("\n=== INICIO TEAM TASK WORKFLOW ===");
    console.log(`Tarea: ${taskTitle}`);
    console.log(`Descripción: ${taskDescription}`);

    // Crear la tarea en el team
    const task = teamRuntime.createTask({
        title: taskTitle,
        description: taskDescription,
    });

    console.log(`Task ID: ${task.id}`);

    // Spawn un teammate worker si no existe
    const spawnTool = bootstrapResult.leadSpawnTool;
    if (spawnTool) {
        await spawnTool.execute({
            agentId: "worker",
            systemPrompt: "Eres un desarrollador de software expert.",
        });
    }

    // Asignar la tarea al worker
    const claimedTask = teamRuntime.claimTask(task.id, "worker");
    console.log(`Tarea asignada a: ${claimedTask.assignedTo}`);

    // Ejecutar la tarea
    const result = await teamRuntime.completeTask(
        task.id,
        "worker",
        `Implementación completada para: ${taskTitle}`
    );

    console.log(`Resultado: ${result.summary}`);
    console.log("=== FIN TEAM TASK WORKFLOW ===\n");

    return {
        taskId: task.id,
        outcome: result.summary ?? "No outcome summary available",
    };
}