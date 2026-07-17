import { 
    AgentTeamsRuntime, 
    bootstrapAgentTeams,
    createDelegatedAgentConfigProvider,
    type BootstrapAgentTeamsResult,
    type DelegatedAgentRuntimeConfig,
} from "@cline/core";
import Models from "../config/models.js";

export interface TeamRuntimeResult {
    teamId: string;
    teamName: string;
}

/**
 * Crea y configura un AgentTeamsRuntime completo con mailbox, tasks, outcomes.
 * Este runtime permite coordinación avanzada entre agentes.
 * 
 * API Fuentes:
 * - AgentTeamsRuntime constructor: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts:156
 * - bootstrapAgentTeams: node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts:32
 * - DelegatedAgentConfigProvider: node_modules/@cline/core/dist/extensions/tools/team/delegated-agent.d.ts:17-21
 * - createDelegatedAgentConfigProvider: node_modules/@cline/core/dist/extensions/tools/team/delegated-agent.d.ts:38
 */
export function createTeamRuntime() {
    // Crear el runtime del equipo (constructor toma AgentTeamsRuntimeOptions como único parámetro)
    // AgentTeamsRuntimeOptions: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts:92-99
    const teamRuntime = new AgentTeamsRuntime({
        teamName: "multi-agent-team",
        leadAgentId: "architect",
    });

    // Configurar teammate provider para el worker
    // createDelegatedAgentConfigProvider inicializa con DelegatedAgentRuntimeConfig
    // node_modules/@cline/core/dist/extensions/tools/team/delegated-agent.d.ts:38
    const delegatedAgentConfigProvider = createDelegatedAgentConfigProvider({
        providerId: Models.worker.providerId,
        modelId: Models.worker.modelId,
        baseUrl: Models.worker.baseUrl ?? "http://localhost:11434",
    });

    // Bootstrap para el lead agent (Architect)
    // BootstrapAgentTeamsOptions requiere runtime + teammateConfigProvider al menos
    // node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts:15-25
    const bootstrapResult: BootstrapAgentTeamsResult = bootstrapAgentTeams({
        runtime: teamRuntime,
        teammateConfigProvider: delegatedAgentConfigProvider,
        includeLeadSpawnTool: true,
        includeLeadManagementTools: true,
    });

    return {
        teamRuntime,
        bootstrapResult,
    };
}