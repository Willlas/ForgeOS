# Multi-Agent Local Architecture

## Documento de Arquitectura - Sistema Multi-Agent con Cline SDK

---

## 1. Requisitos del Sistema

| Requisito | Detalle |
|-----------|---------|
| **Deployment** | 100% local |
| **Model Provider** | Ollama (`providerId: "ollama"`) |
| **Architect Agent** | `qwen3.6:27b` |
| **Worker Agent** | `qwen2.5-coder:7b` |
| **Restricción crítica** | Architect nunca modifica archivos |

---

## 2. Decision Técnica Crítica: ¿Agent Teams soporta modelos distintos por agente?

### Respuesta: SÍ - Soporte nativo

**Fuente:** `node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts`, línea 9:

```typescript
export interface TeamMemberConfig extends AgentConfig {
    role?: string;
}
```

`TeamMemberConfig` hereda de `AgentConfig` (definido en `@cline/shared`), que incluye:

```typescript
// Fuente: node_modules/@cline/shared/dist/agents/types.d.ts
export interface AgentConfig {
    providerId: string;      // → "ollama" para ambos
    modelId: string;         // → DIFERENTE por agente
    baseUrl?: string;        // → Misma URL de Ollama
    apiKey?: string;
    headers?: Record<string, string>;
    // ... + temperature, reasoningEffort, thinkingBudgetTokens, etc.
}
```

**Conclusión:** No se necesita extensión personalizada. Cada miembro del equipo se configura con su propio `modelId` dentro de `TeamMemberConfig`.

---

## 3. Arquitectura General

### Diagrama de Alto Nivel

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Aplicación Host                               │
│                    (node.js - controlador principal)                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      ClineCore                                 │  │
│  │          (Inicio, configuración, limpieza)                     │  │
│  │  Fuente: @cline/core - ClineCore class                        │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │                                                                  │  │
│  │  ┌──────────────────┐          ┌─────────────────────┐         │  │
│  │  │  AgentTeam       │          │  AgentTeamsRuntime  │         │  │
│  │  │  (simplificado)  │          │  (full runtime)     │         │  │
│  │  │                  │          │                     │         │  │
│  │  │  ┌────────────┐  │          │  ┌───────────────┐  │         │  │
│  │  │  │ architect  │  │──┐       │  │ lead (arch)   │  │         │  │
│  │  │  │ (qwen3.6:27b)│  │       │  │ (qwen3.6:27b) │  │         │  │
│  │  │  └────────────┘  │  │       │  └───────────────┘  │         │  │
│  │  │       │          │  │       │       │             │         │  │
│  │  │  ┌────────────┐  │  │       │  ┌───────────────┐  │         │  │
│  │  │  │  worker    │  │◄─┘       │  │  worker       │  │         │  │
│  │  │  │(qwen2.5-coder:7b)│       │  │(qwen2.5-coder:7b)│        │  │
│  │  │  └────────────┘  │          │  └───────────────┘  │         │  │
│  │  └──────────────────┘  │          └─────────────────────┘         │  │
│  │                                                                  │  │
│  └────────────────────────────────────────────────────────────────┐  │
│                                                                    │  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Ollama Provider                           │  │
│  │         (localhost:11434 - modelo bajo demanda)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Componentes Principales

### 4.1 ClineCore

**Fuente:** `@cline/core` - ver SDK_RESEARCH.md §3

```typescript
import { ClineCore } from "@cline/core";

const core = new ClineCore({
  // Configuración global del provider
  providerId: "ollama",
  baseUrl: "http://localhost:11434",
});
```

**Responsabilidad:** Inicialización, gestión de sesiones, limpieza.

### 4.2 AgentTeam (API Simplificada)

**Fuente:** `@cline/core` - `AgentTeam` class en `multi-agent.d.ts` línea 104

```typescript
import { createAgentTeam } from "@cline/core";

// Configuración de cada agente con SU PROPIO modelo
const team = createAgentTeam({
  architect: {
    providerId: "ollama",
    modelId: "qwen3.6:27b",
    baseUrl: "http://localhost:11434",
    systemPrompt: "Eres un arquitecto de software...",
    role: "architect",
  },
  worker: {
    providerId: "ollama",
    modelId: "qwen2.5-coder:7b",
    baseUrl: "http://localhost:11434",
    systemPrompt: "Eres un desarrollador de software...",
    role: "worker",
  },
});
```

**Clases clave:**
| Clase/Método | Fuente | Descripción |
|---|---|---|
| `AgentTeam` | `multi-agent.d.ts:104` | Gestiona agentes individuales |
| `createAgentTeam()` | `multi-agent.d.ts:123` | Factory para crear equipo |
| `addAgent(id, config)` | `multi-agent.d.ts:109` | Agregar agente al equipo |
| `routeTo(agentId, message)` | `multi-agent.d.ts:114` | Enviar mensaje a agente |
| `runParallel(tasks)` | `multi-agent.d.ts:116` | Ejecución paralela |
| `runSequential(tasks)` | `multi-agent.d.ts:117` | Ejecución secuencial |
| `runPipeline(...)` | `multi-agent.d.ts:118` | Pipeline con transformador |
| `getAgentIds()` | `multi-agent.d.ts:112` | Listar agentes |

### 4.3 AgentTeamsRuntime (API Completa)

**Fuente:** `@cline/core` - `AgentTeamsRuntime` class en `multi-agent.d.ts` línea 133

```typescript
import { AgentTeamsRuntime, TeamMessageType } from "@cline/core";

const runtime = new AgentTeamsRuntime({
  teamName: "multi-agent-system",
  leadAgentId: "architect", // Agente líder que orquesta
  missionLogIntervalSteps: 10,
  maxConcurrentRuns: 3,
  onTeamEvent: (event) => {
    if (event.type === TeamMessageType.TeamMessage) {
      console.log("Message:", event.message);
    }
  },
});

// Spawn teammate individual con modelo específico
runtime.spawnTeammate({
  agentId: "architect",
  config: {
    providerId: "ollama",
    modelId: "qwen3.6:27b",
    baseUrl: "http://localhost:11434",
  },
});

runtime.spawnTeammate({
  agentId: "worker",
  config: {
    providerId: "ollama",
    modelId: "qwen2.5-coder:7b",
    baseUrl: "http://localhost:11434",
  },
});

// Crear tarea y asignarla
const task = runtime.createTask({
  title: "Implementar feature X",
  assignee: "worker",
  dependsOn: ["task-arch-design"],
});

// Enviar mensaje al worker
runtime.routeToTeammate("worker", "Implementa esto...", { taskId: task.id });
```

**Métodos clave:**
| Método | Fuente | Descripción |
|---|---|---|
| `spawnTeammate()` | `multi-agent.d.ts:178` | Crear agente en equipo |
| `routeToTeammate()` | `multi-agent.d.ts:185` | Enviar mensaje a teammate |
| `createTask()` | `multi-agent.d.ts:181` | Crear tarea del equipo |
| `completeTask()` | `multi-agent.d.ts:184` | Marcar tarea completada |
| `sendMessage()` | `multi-agent.d.ts:208` | Mensaje de buzón |
| `getSnapshot()` | `multi-agent.d.ts:174` | Estado del equipo |
| `cleanup()` | `multi-agent.d.ts:219` | Limpieza |

### 4.4 AgentConfig (Configuración por agente)

**Fuente:** `@cline/shared` - `AgentConfig` en `agents/types.d.ts`

Campos relevantes para model config:

| Campo | Tipo | Descripción |
|---|---|---|
| `providerId` | `string` | Identificador del provider (ej. "ollama") |
| `modelId` | `string` | ID del modelo |
| `baseUrl` | `string \| undefined` | URL base del provider |
| `apiKey` | `string \| undefined` | API key |
| `headers` | `Record<string, string> \| undefined` | Headers adicionales |
| `temperature` | `number \| undefined` | Temperatura del modelo |
| `reasoningEffort` | `ReasoningEffort \| undefined` | Nivel de reasoning |
| `thinkingBudgetTokens` | `number \| undefined` | Budget de tokens para pensamiento |
| `contextWindow` | `number \| undefined` | Ventana de contexto |

---

## 5. Flujo del Sistema

### Flujo Principal de Arquitectura → Worker

```
┌──────────┐    1. "Analiza requisito"     ┌──────────┐
│  Human   │ ─────────────────────────────→│ Architect│
│          │                               │          │
│          │    2. "Plan de arquitectura"  │          │
│          │ ←─────────────────────────────│          │
│          │                               │          │
│          │    3. "Implementa:"           │          │
│          │ ─────────────────────────────→│          │
│          │                               │          │
│          │                               │          │
│          │    4. "Tarea asignada"        │          │
│          │ ←─────────────────────────────│          │
│          │                               │          │
│          │    5. "Código implementado"   │  Worker   │
│          │ ←─────────────────────────────│          │
│          │                               │          │
└──────────┘                               └──────────┘
```

### Secuencia Detallada

```
Paso | Componente        | Acción                                     | Fuente
----|-------------------|--------------------------------------------|------------------
 1  | Host              | Crear ClineCore con provider Ollama        | @cline/core
 2  | Host              | createAgentTeam({ architect, worker })     | multi-agent.d.ts
 3  | Host              | Architect tiene modelId: qwen3.6:27b      | TeamMemberConfig
 4  | Host              | Worker tiene modelId: qwen2.5-coder:7b    | TeamMemberConfig
 5  | Host              | Architect recibe requisito del usuario     | 
 6  | Architect         | Analiza requisito                          | AgentConfig.systemPrompt
 7  | Architect         | Genera plan de arquitectura                | 
 8  | Architect         | NO modifica archivos (constraint en prompt)| 
 9  | Architect         | Delegar a worker con tarea específica      | routeToTeammate()
10  | Worker            | Recibe instrucción del architect            |
11  | Worker            | Ejecuta tareas (write_to_file, etc.)       | AgentConfig.extensions
12  | Worker            | Retorna resultado al architect              |
13  | Architect         | Verifica y reporta al humano               |
```

---

## 6. Interfaces TypeScript

### 6.1 Configuración del Sistema

```typescript
interface SystemConfig {
  ollama: {
    baseUrl: string;           // "http://localhost:11434"
  };
  team: {
    name: string;              // Nombre del equipo
    leadAgentId: string;       // "architect"
  };
  agents: {
    architect: AgentModelConfig;
    worker: AgentModelConfig;
  };
}

interface AgentModelConfig {
  modelId: string;             // "qwen3.6:27b" | "qwen2.5-coder:7b"
  systemPrompt: string;        // System prompt del agente
  temperature?: number;        // Temperatura (opcional)
  reasoningEffort?: ReasoningEffort; // Opcional
}
```

### 6.2 Interfaces del SDK (derivadas de tipos oficiales)

```typescript
// Fuente: multi-agent.d.ts:9
interface TeamMemberConfig extends AgentConfig {
  role?: string;               // "architect" | "worker"
}

// Fuente: agents/types.d.ts
interface AgentConfig {
  providerId: string;
  modelId: string;
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  systemPrompt?: string;
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  thinkingBudgetTokens?: number;
  contextWindow?: number;
  // ... más campos
}

// Fuente: multi-agent.d.ts:12
interface AgentTask {
  agentId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// Fuente: multi-agent.d.ts:17
interface TaskResult {
  agentId: string;
  result: AgentResult;
  error?: Error;
  metadata?: Record<string, unknown>;
}
```

---

## 7. Patrón de Implementación

### Código base mínimo (sin extensiones necesarias)

```typescript
import { ClineCore } from "@cline/core";
import { createAgentTeam } from "@cline/core";

// 1. Provider global (Ollama)
const core = new ClineCore({
  providerId: "ollama",
  baseUrl: "http://localhost:11434",
});

// 2. Equipo con modelos diferenciados
const team = createAgentTeam({
  architect: {
    providerId: "ollama",
    modelId: "qwen3.6:27b",        // Modelo del arquitecto
    baseUrl: "http://localhost:11434",
    systemPrompt: `Eres un arquitecto de software senior.
NUNCA modifiques archivos. Solo diseñas y delegas.`,
    role: "architect",
  },
  worker: {
    providerId: "ollama",
    modelId: "qwen2.5-coder:7b",   // Modelo del trabajador
    baseUrl: "http://localhost:11434",
    systemPrompt: `Eres un desarrollador de software.
Puedes crear, modificar y eliminar archivos.`,
    role: "worker",
  },
});

// 3. Usar el equipo
async function procesarRequisito(requisito: string): Promise<void> {
  // Enviar al architect
  const archResult = await team.routeTo("architect", requisito);
  
  // Architect delega al worker
  const workerResult = await team.routeTo("worker", archResult.summary);
  
  console.log(workerResult.summary);
}
```

---

## 8. Decisiones Técnicas

### D1: ¿Usar Agent Teams o crear extensión personalizada?

**Decisión:** Usar Agent Teams nativo.

**Justificación:**
- `TeamMemberConfig extends AgentConfig` → cada miembro tiene su propio `modelId`.
- SDK_RESEARCH.md confirma soporte nativo (sección 8).
- No hay necesidad de extender el SDK.

### D2: ¿Architect como lead agent o Worker como lead?

**Decisión:** Architect como lead agent.

**Justificación:**
- El pattern humano real es: humano → arquitecto → trabajador.
- `leadAgentId: "architect"` en `AgentTeamsRuntimeOptions` (multi-agent.d.ts:93).
- Architect orquesta y delega, nunca ejecuta código.

### D3: ¿AgentTeam o AgentTeamsRuntime?

**Decisión:** Depende del caso de uso.

| Criterio | AgentTeam | AgentTeamsRuntime |
|----------|-----------|-------------------|
| Complejidad | Baja | Alta |
| Tareas/Mailbox/Outcomes | No | Sí |
| Persistencia | No | Sí (exportState/hydrateState) |
| Misión log | No | Sí |
| Ejecución simple | ✓ | ✓ |
| Producción enterprise | ✗ | ✓ |

**Recomendación para este proyecto:** `AgentTeam` es suficiente para MVP.

### D4: Constraint "Architect no modifica archivos"

**Implementación:** System prompt constraint.

```typescript
systemPrompt: `Eres un arquitecto de software senior.
REGlas:
1. NUNCA crees, modifiques ni elimines archivos.
2. Solo produces documentos de arquitectura, diagramas y delegación.
3. Si necesitas que se cree código, delega al worker agent.`
```

**Nota:** Esta son una recomendacion en el prompt del modelo, no hay un mecanismo tecnico para impedir que escriba archivos. La constraint es solo textual en el system prompt.

---

## 9. Ciclo de Vida de un Agent

### Fuente: SDK_RESEARCH.md §4-5

```
┌─────────────────┐
│  new ClineCore() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ createAgentTeam()│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Agent (spawned) │ → │ Sesión activa      │
│  (architect/     │     │ (recebe/envía msgs)│
│   worker)        │     └────────┬─────────┘
└────────┬────────┘              │
         │                       │
         ▼                       ▼
┌─────────────────┐      ┌──────────────────┐
│ routeTo() /     │      │ AgentResult       │
│ runPipeline()   │ ←────│ (summary, files)  │
└────────┬────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│ team.clear()/   │
│ abortAll()      │
└────────┬────────┘
         │
         ▼
    Agent destruido
```

---

## 10. Parte CLI vs SDK

### Disponible en SDK:

| Funcionalidad | Estado | Fuente |
|---|---|---|
| ClineCore | ✓ | @cline/core |
| AgentConfig | ✓ | @cline/shared |
| AgentTeam | ✓ | @cline/core |
| AgentTeamsRuntime | ✓ | @cline/core |
| TeamMemberConfig | ✓ | @cline/core |
| spawnTeammate | ✓ | @cline/core |
| routeToTeammate | ✓ | @cline/core |
| createAgentTeam factory | ✓ | @cline/core |
| createWorkerReviewerTeam | ✓ | @cline/core |
| Model config por agente | ✓ | TeamMemberConfig extends AgentConfig |

### NO disponible en SDK (solo CLI/VSCode):

| Funcionalidad | Razón | Fuente |
|---|---|---|
| VSCode UI integration | Solo extension de VSCode | README @cline/core |
| Browser tools | Depende de navegador | SDK_RESEARCH.md §10 |
| File system access (directo) | Requiere host permissions | SDK_RESEARCH.md §7 |
| Plugin marketplace | Funcionalidad de CLI/VSCode | SDK_RESEARCH.md §9 |

---

## 11. Resumen de Fuentes

| Documento | Ruta en node_modules |
|-----------|---------------------|
| ClineCore class | `@cline/core/dist/cline-core.d.ts` |
| AgentTeam class | `@cline/core/dist/extensions/tools/team/multi-agent.d.ts` |
| AgentConfig | `@cline/shared/dist/agents/types.d.ts` |
| TeamMemberConfig | `@cline/core/dist/extensions/tools/team/multi-agent.d.ts:9` |
| AgentEvent types | `@cline/shared/dist/agents/events.d.ts` |
| SessionRuntime | `@cline/core/dist/runtime/orchestration/session-runtime-orchestrator.d.ts` |
| Provider Config | `@cline/llms/dist/providers/` |

---

## 12. Conclusión

1. **Agent Teams soporta modelos distintos por agente de forma nativa.** No se necesita extensión.
2. Cada `TeamMemberConfig` puede tener su propio `modelId`.
3. La arquitectura propuesta es: **Humano → Architect (qwen3.6:27b) → Worker (qwen2.5-coder:7b)**.
4. El constraint "Architect no modifica archivos" se implementa via system prompt.
5. Para MVP, `createAgentTeam()` es suficiente. Para producción, `AgentTeamsRuntime`.