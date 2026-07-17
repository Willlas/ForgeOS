import { AgentTeam } from "@cline/core";
/**
 * Workflow: Architect diseña → Worker implementa
 *
 * Este workflow demuestra la patrón de delegación multi-agent:
 * 1. Architect analiza y produce un plan de implementación
 * 2. El resultado se pasa al Worker como instrucción
 * 3. Worker ejecuta la implementación según el plan del Architect
 */
export interface DelegateWorkflowResult {
    architectPlan: string;
    workerImplementation: string;
}
/**
 * Crea y configura el workflow de delegación
 */
export declare function createDelegateWorkflow(): any;
/**
 * Ejecuta el flujo completo de delegación
 */
export declare function runDelegateWorkflow(team: AgentTeam, userRequest: string): Promise<DelegateWorkflowResult>;
//# sourceMappingURL=delegate.d.ts.map