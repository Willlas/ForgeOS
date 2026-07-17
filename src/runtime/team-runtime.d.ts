export interface TeamRuntimeResult {
    teamId: string;
    teamName: string;
}
/**
 * Crea y configura un AgentTeamsRuntime completo con mailbox, tasks, outcomes.
 * Este runtime permite coordinación avanzada entre agentes.
 *
 * API Fuentes:
 * - AgentTeamsRuntime constructor: node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts
 * - bootstrapAgentTeams: node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts
 * - DelegatedAgentConfigProvider: node_modules/@cline/core/dist/extensions/tools/team/delegated-agent.d.ts
 */
export declare function createTeamRuntime(): {
    teamRuntime: any;
    bootstrapResult: BootstrapAgentTeamsResult;
};
//# sourceMappingURL=team-runtime.d.ts.map