import { AgentTeamsRuntime, } from "@cline/core";
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
export async function runTeamTaskWorkflow(teamRuntime, bootstrapResult, taskTitle, taskDescription) {
    console.log("\n=== INICIO TEAM TASK WORKFLOW ===");
    console.log(`Tarea: ${taskTitle}`);
    console.log(`Descripción: ${taskDescription}`);
    // Crear la tarea en el team (createTask toma CreateTeamTaskInput)
    const task = teamRuntime.createTask({
        title: taskTitle,
        description: taskDescription,
    });
    console.log(`Task ID: ${task.id}`);
    // Spawn un teammate worker si no existe (usando spawnTeammate con TeamMemberConfig)
    const spawnTool = bootstrapResult.tools.find((t) => t.name === "team_spawn_teammate");
    if (spawnTool) {
        await spawnTool.execute({
            agentId: "worker",
            config: {
                providerId: "ollama",
                modelId: "llama3.1",
                baseUrl: "http://localhost:11434",
            },
        });
    }
    // Asignar la tarea al worker (claimTask)
    const claimedTask = teamRuntime.claimTask(task.id, "worker");
    console.log(`Tarea asignada a: ${claimedTask.assignee}`);
    // Ejecutar la tarea (completeTask)
    const completedTask = teamRuntime.completeTask(task.id, "worker", `Implementación completada para: ${taskTitle}`);
    console.log(`Resultado: ${completedTask.summary ?? "No summary"}`);
    console.log("=== FIN TEAM TASK WORKFLOW ===\n");
    return {
        taskId: task.id,
        outcome: completedTask.summary ?? "No outcome summary available",
    };
}
//# sourceMappingURL=team-task-flow.js.map