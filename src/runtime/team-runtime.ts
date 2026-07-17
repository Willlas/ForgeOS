import { 
    AgentTeamsRuntime, 
    bootstrapAgentTeams,
} from "@cline/core";
import Models from "../config/models.js";

export interface TeamRuntimeResult {
    teamId: string;
    teamName: string;
}

/**
 * Crea y configura un AgentTeamsRuntime completo con mailbox, tasks, outcomes.
 * Este runtime permite coordinación avanzada entre agentes.
 */
export function createTeamRuntime() {
    // Crear el runtime del equipo
    const teamRuntime = new AgentTeamsRuntime({
        teamName: "multi-agent-team",
        leadAgentId: "architect",
    });

    // Configurar bootstrap para el lead agent (Architect)
    const bootstrapResult = bootstrapAgentTeams({
        runtime: teamRuntime,
        teammateConfigProvider: async (teammateId: string) => {
            if (teammateId === "worker") {
                return {
                    agentId: teammateId,
                    config: {
                        providerId: Models.worker.providerId,
                        modelId: Models.worker.modelId,
                        baseUrl: Models.worker.baseUrl,
                        systemPrompt: `Eres un desarrollador de software expert. Tu función es:
1. RECIBIR tareas del architect
2. IMPLEMENTAR siguiendo las instrucciones
3. CONFIRMAR la implementación`,
                    },
                };
            }
            return null;
        },
        includeLeadSpawnTool: true,
        includeLeadManagementTools: true,
    });

    return {
        teamRuntime,
        bootstrapResult,
    };
}