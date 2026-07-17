import { AgentTeam } from "@cline/core";
import Models from "../config/models.js";

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
export function createDelegateWorkflow() {
    const team = new AgentTeam();

    team.addAgent("architect", {
        providerId: Models.architect.providerId,
        modelId: Models.architect.modelId,
        baseUrl: Models.architect.baseUrl,
        systemPrompt: `Eres un arquitecto de software senior. Tu función es:
1. ANALIZAR el requerimiento dado por el usuario
2. PRODUCIR un plan claro y detallado de implementación
3. DELEGAR la implementación al worker con instrucciones precisas

REGLAS IMPORTANTES:
- NUNCA modifiques archivos directamente
- Solo diseñas, analizas y delegas
- Tu salida DEBE ser un plan estructurado
- Al final de tu respuesta, indica claramente el plan para el worker`,
    });

    team.addAgent("worker", {
        providerId: Models.worker.providerId,
        modelId: Models.worker.modelId,
        baseUrl: Models.worker.baseUrl,
        systemPrompt: `Eres un desarrollador de software expert. Tu función es:
1. RECIBIR el plan del architect
2. IMPLEMENTAR siguiendo EXACTAMENTE ese plan
3. CONFIRMAR la implementación

REGLAS IMPORTANTES:
- Sigues estrictamente el plan del architect
- No improvisas cambios al diseño
- Confirmas lo que has hecho`,
    });

    return team;
}

/**
 * Ejecuta el flujo completo de delegación
 */
export async function runDelegateWorkflow(
    team: AgentTeam,
    userRequest: string
): Promise<DelegateWorkflowResult> {
    console.log("\n=== INICIO WORKFLOW DELEGACIÓN ===");
    console.log(`Usuario: ${userRequest}`);

    // Paso 1: Architect produce el plan
    console.log("\n--- [1/2] Architect: Analizando requerimiento ---");
    const architectResult = await team.routeTo("architect", userRequest);
    const architectPlan = typeof architectResult === "string" ? architectResult : String(architectResult);

    console.log(`Architect plan (length): ${architectPlan.length} chars`);

    // Paso 2: Worker implementa según el plan
    console.log("\n--- [2/2] Worker: Implementando plan del architect ---");
    const workerPrompt = `Sigue este plan del architect para implementar:\n\n${architectPlan}\n\nPor favor confirma lo que harías.`;
    const workerResult = await team.routeTo("worker", workerPrompt);
    const workerImplementation = typeof workerResult === "string" ? workerResult : String(workerResult);

    console.log(`Worker implementation (length): ${workerImplementation.length} chars`);

    console.log("\n=== FIN WORKFLOW DELEGACIÓN ===\n");

    return {
        architectPlan,
        workerImplementation,
    };
}