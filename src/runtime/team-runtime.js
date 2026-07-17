import { AgentTeamsRuntime, bootstrapAgentTeams, } from "@cline/core";
import { createDelegatedAgentConfigProvider } from "@cline/core";
import Models from "../config/models.js";
/**
 * Crea y configura un AgentTeamsRuntime completo con mailbox, tasks, outcomes.
 * Este runtime permite coordinación avanzada entre agentes.
 *
 * API Fuentes:
 * - AgentTeamsRuntime constructor: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts
 * - bootstrapAgentTeams: node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts
 * - DelegatedAgentConfigProvider: node_modules/@cline/core/dist/extensions/tools/team/delegated-agent.d.ts
 */
export function createTeamRuntime() {
    // Crear el runtime del equipo (constructor toma AgentTeamsRuntimeOptions)
    const teamRuntime = new AgentTeamsRuntime({
        teamName: "multi-agent-team",
        leadAgentId: "architect",
    });
    // Configurar teammate provider para el worker
    const teammateConfigProvider = {
        getRuntimeConfig: () => ({
            providerId: Models.worker.providerId,
            modelId: Models.worker.modelId,
            baseUrl: Models.worker.baseUrl,
            apiKey: "",
        }),
        getConnectionConfig: () => ({
            providerId: Models.worker.providerId,
            modelId: Models.worker.modelId,
            baseUrl: Models.worker.baseUrl,
            apiKey: "",
        }),
        updateConnectionDefaults: () => { },
    };
    // Bootstrap para el lead agent (Architect)
    const bootstrapResult = bootstrapAgentTeams({
        runtime: teamRuntime,
        teammateConfigProvider: teammateConfigProvider,
        includeLeadSpawnTool: true,
        includeLeadManagementTools: true,
    });
    return {
        teamRuntime,
        bootstrapResult,
    };
}
//# sourceMappingURL=team-runtime.js.map