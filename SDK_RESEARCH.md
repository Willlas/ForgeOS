# Cline SDK Research Document

## Fuente de la Investigación

Todas las afirmaciones en este documento se basan en:

1. **README oficiales** en `node_modules/@cline/*/README.md`
2. **Tipos TypeScript** en `node_modules/@cline/*/dist/*.d.ts`
3. **Investigación de subagentes** que leyeron los ficheros fuente `.d.ts` y fuentes relacionadas

---

## 1. Arquitectura General

### Paquetes del SDK

El SDK de Cline se compone de 5 paquetes principales:

| Paquete | Responsabilidad |
|---------|----------------|
| `@cline/sdk` | Entry-point principal, re-exporta `@cline/core` |
| `@cline/core` | Orquestación stateful, session lifecycle, default tools, storage, hub transport |
| `@cline/agents` | Agent loop stateless, tool execution |
| `@cline/llms` | Model y provider layer, handler creation, model catalogs |
| `@cline/shared` | Shared cross-package primitives (tipos, session config, logging) |

### Relación entre paquetes

```
@cline/sdk
    └── @cline/core
            ├── @cline/agents      (agent loop)
            ├── @cline/llms        (providers/models)
            └── @cline/shared      (tipos compartidos)
```

### Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Aplicación Host                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   ClineCore                                 │
│         (session lifecycle, orchestration)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ RuntimeHost  │  │ SessionSvc   │  │ TeamRuntime      │  │
│  │ (Local/Hub)  │  │              │  │ (multi-agent)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Agent / AgentRuntime                │   │
│  │            (agent loop, tool execution)              │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Default Tools                       │   │
│  │  (applyPatch, editor, shell, search, webFetch...)    │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Providers   │  │  Models      │  │   Auth           │  │
│  │ (LLM layer)  │  │ (catalogs)   │  │ (OAuth/API key)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Fuentes:**
- `node_modules/@cline/core/README.md`
- `node_modules/@cline/agents/README.md`
- `node_modules/@cline/llms/README.md`
- `node_modules/@cline/shared/README.md`

---

## 2. Clases Importantes

### ClineCore (`node_modules/@cline/core/dist/ClineCore.d.ts`)

La clase principal de entrada del SDK.

```typescript
export declare class ClineCore {
    readonly clientName: string | undefined;
    readonly runtimeAddress: string | undefined;
    readonly automation: ClineCoreAutomationApi;
    readonly settings: ClineCoreSettingsApi;
    readonly featureFlags: FeatureFlagsService;
    readonly pendingPrompts: PendingPromptsServiceApi;
    
    // Factory
    static create(options?: ClineCoreOptions): Promise<ClineCore>;
    
    // Session lifecycle
    start(input: StartSessionInput): Promise<StartSessionResult>;
    send(sessionId, request): Promise<ChatTurnResult>;
    abort(sessionId): void;
    stop(sessionId): void;
    get(sessionId): SessionInfo;
    list(limit?: number): SessionHistoryRecord[];
    delete(sessionId): boolean;
    update(sessionId, metadata): void;
    readMessages(sessionId): AgentMessage[];
    restore(input): RestoreResult;
    compareCheckpoint(input): CompareCheckpointResult;
    
    // Model management
    getAccumulatedUsage(sessionId): UsageSummary;
    updateSessionModel(sessionId, modelConfig): void;
    updateSessionConnection(sessionId, connectionConfig): void;
    
    // Subscription
    subscribe(listener, options): () => void;
    
    // Cleanup
    dispose(): void;
}
```

**Fuentes:**
- `node_modules/@cline/core/dist/ClineCore.d.ts` (líneas 18-299)
- `node_modules/@cline/core/README.md` (líneas 29-52)

### Agent / AgentRuntime (`node_modules/@cline/agents/dist/agent-runtime.d.ts`)

El agent loop stateless.

```typescript
export declare class AgentRuntime {
    constructor(config: AgentRuntimeConfig);
    
    // Start a run
    run(input: AgentRunInput): Promise<AgentRunResult>;
    continue(input?: AgentRunInput): Promise<AgentRunResult>;
    abort(reason?: unknown): void;
    
    // Session control
    subscribe(listener): () => void;
    restore(messages): void;
    snapshot(): AgentRuntimeStateSnapshot;
}

// Alias para AgentRuntime
export declare const Agent: typeof AgentRuntime;

// Factories
export declare function createAgent(config): AgentRuntime;
export declare function createAgentRuntime(config): AgentRuntime;
```

**Config types:**
```typescript
// Forma simple (provider form)
interface AgentRuntimeConfigWithProvider {
    providerId: string;       // "anthropic", "openai", "ollama", etc.
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    options?: GatewayProviderSettings["options"];
    // ... de BaseAgentRuntimeConfig:
    systemPrompt?: string;
    tools?: AgentTool[];
    hooks?: AgentRuntimeHooks;
    plugins?: AgentRuntimePlugin[];
    initialMessages?: AgentMessage[];
}

// Forma avanzada (model form)
interface AgentRuntimeConfigWithModel {
    model: AgentModel;        // pre-construido
    systemPrompt?: string;
    tools?: AgentTool[];
    hooks?: AgentRuntimeHooks;
    plugins?: AgentRuntimePlugin[];
    initialMessages?: AgentMessage[];
}

type AgentRuntimeConfig = AgentRuntimeConfigWithModel | AgentRuntimeConfigWithProvider;
```

**Fuentes:**
- `node_modules/@cline/agents/dist/agent-runtime.d.ts` (líneas 1-107)
- `node_modules/@cline/agents/README.md` (líneas 38-98)

### AgentTeamsRuntime (`node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts`)

Runtime para coordinación multi-agent.

```typescript
export declare class AgentTeamsRuntime {
    // Team management
    getTeamId(): string;
    getTeamName(): string;
    spawnTeammate(options): TeamMemberSnapshot;
    shutdownTeammate(agentId, reason): void;
    updateTeammateConnections(overrides): void;
    
    // Task management
    createTask(input): TeamTask;
    claimTask(taskId, agentId): TeamTask;
    completeTask(taskId, agentId, summary): TeamTask;
    listTasks(): TeamTask[];
    
    // Run management
    startTeammateRun(agentId, message, options): TeamRunRecord;
    cancelRun(runId, reason): TeamRunRecord;
    awaitRun(runId, pollIntervalMs): Promise<TeamRunRecord>;
    awaitAllRuns(pollIntervalMs): Promise<TeamRunRecord[]>;
    listRuns(options): TeamRunRecord[];
    
    // Communication
    sendMessage(fromAgentId, toAgentId, subject, body, taskId?): TeamMailboxMessage;
    broadcast(fromAgentId, subject, body, options?): TeamMailboxMessage[];
    
    // Mission log
    appendMissionLog(input): MissionLogEntry;
    
    // Outcomes
    createOutcome(input): TeamOutcome;
    attachOutcomeFragment(input): TeamOutcomeFragment;
    finalizeOutcome(outcomeId): TeamOutcome;
    
    // State persistence
    getSnapshot(): TeamRuntimeSnapshot;
    exportState(): TeamRuntimeState;
    hydrateState(state): void;
    
    cleanup(): void;
}
```

**Fuentes:**
- `node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts` (líneas 133-230)

### AgentTeam (`node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts`)

Colección simple de agentes para routing.

```typescript
export declare class AgentTeam {
    addAgent(id, config): void;
    removeAgent(id): boolean;
    getAgent(id): SessionRuntime | undefined;
    routeTo(agentId, message): Promise<AgentResult>;
    runParallel(tasks): Promise<TaskResult[]>;
    runSequential(tasks): Promise<TaskResult[]>;
    runPipeline(pipeline, initialMessage, transformer?): Promise<TaskResult[]>;
    abortAll(): void;
}
```

**Fuentes:**
- `node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts` (líneas 104-123)

---

## 3. API Pública

### Inicio básico con ClineCore

```typescript
import { ClineCore } from "@cline/core";

const cline = await ClineCore.create({ clientName: "my-app" });

const result = await cline.start({
    config: {
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY ?? "",
        cwd: process.cwd(),
        mode: "act",
        enableTools: true,
        systemPrompt: "You are a concise assistant.",
    },
    prompt: "Summarize this project.",
    interactive: false,
});

// Suscribirse a eventos
result.subscribe((event) => {
    console.log(event);
});

console.log(result.result?.text);
await cline.dispose();
```

**Fuente:** `node_modules/@cline/core/README.md` (líneas 29-52)

### Inicio con Agent standalone

```typescript
import { Agent, createBuiltinTools } from "@cline/core";

const tools = createBuiltinTools({ cwd: process.cwd() });

const agent = new Agent({
    providerId: "anthropic",
    modelId: "claude-sonnet-4-6",
    apiKey: process.env.ANTHROPIC_API_KEY,
    systemPrompt: "You are a concise assistant.",
    tools,
});

const result = await agent.run("What's the weather in San Francisco?");
console.log(result.outputText);
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 38-65)

### Creación de herramientas personalizadas

```typescript
import { createTool, type AgentTool } from "@cline/shared";

const getWeather: AgentTool<{ city: string }, { forecast: string }> = createTool("get_weather",
    {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
    },
    async ({ city }, context) => {
        return { forecast: `sunny in ${city}` };
    }
);
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 102-129)

### Hooks del Agent

```typescript
const agent = new Agent({
    providerId,
    modelId,
    apiKey,
    tools: [getWeather],
    hooks: {
        beforeModel({ request }) {
            return { options: { temperature: 0.2 } };
        },
        beforeTool({ tool, input }) {
            if (tool.name === "get_weather") {
                return { skip: true, reason: "city required" };
            }
            return undefined;
        },
        afterRun({ result }) {
            console.log("done", result.usage);
        },
    },
});
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 176-204)

### Plugins

```typescript
import type { AgentRuntimePlugin } from "@cline/shared";

const loggingPlugin: AgentRuntimePlugin = {
    name: "logging",
    setup({ agentId }) {
        return {
            hooks: {
                afterTool({ tool, result }) {
                    console.log(agentId, tool.name, result.isError);
                    return undefined;
                },
            },
        };
    },
};

const agent = new Agent({
    providerId,
    modelId,
    apiKey,
    plugins: [loggingPlugin],
});
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 241-268)

### Teams con SubAgents

```typescript
import {
    bootstrapAgentTeams,
    createAgentTeamsTools,
    createSpawnAgentTool,
    AgentTeamsRuntime,
} from "@cline/core";

// Crear runtime del equipo
const teamRuntime = new AgentTeamsRuntime({
    teamName: "my-team",
    leadAgentId: "lead",
});

// Bootstrap para el lead agent
const bootstrapResult = bootstrapAgentTeams({
    runtime: teamRuntime,
    teammateConfigProvider: ...,
    includeLeadSpawnTool: true,
    includeLeadManagementTools: true,
});

// Crear tools del equipo para los teammates
const teamTools = createAgentTeamsTools({
    runtime: teamRuntime,
    requesterId: "teammate",
    teammateConfigProvider: ...,
    allowSpawn: true,
});

// Spawn agent (desde el lead)
const spawnTool = createSpawnAgentTool(...);
```

**Fuente:** 
- `node_modules/@cline/core/dist/index.d.ts` (línea 28)
- `node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts` (líneas 1-35)
- `node_modules/@cline/agents/README.md` (líneas 270-284)

### Provider con Ollama

```typescript
import { createHandler } from "@cline/llms";

const handler = createHandler({
    providerId: "ollama",
    modelId: "llama3.1",
    baseUrl: "http://localhost:11434",
    // Ollama no requiere apiKey por defecto
});

for await (const chunk of handler.createMessage("You are helpful.", [
    { role: "user", content: [{ type: "text", text: "Hello" }] },
])) {
    console.log(chunk);
}
```

**Fuente:** 
- `node_modules/@cline/llms/README.md` (líneas 20-36)
- `node_modules/@cline/llms/dist/providers/builtins.d.ts` (línea 12 - OLLAMA_DEFAULT_CONTEXT_WINDOW = 32768)

---

## 4. Ejemplos Mínimos

### Ejemplo 1: Agent simple sin ClineCore

```typescript
import { Agent } from "@cline/agents";

const agent = new Agent({
    providerId: "anthropic",
    modelId: "claude-sonnet-4-6",
    apiKey: process.env.ANTHROPIC_API_KEY,
    systemPrompt: "You are a helpful assistant.",
});

const result = await agent.run("Hello, who are you?");
console.log(result.outputText);
```

### Ejemplo 2: Agent con herramientas custom

```typescript
import { Agent } from "@cline/agents";
import { createTool } from "@cline/shared";

const addTool = createTool(
    "add",
    {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
    },
    async ({ a, b }) => ({ result: a + b })
);

const agent = new Agent({
    providerId: "openai",
    modelId: "gpt-5",
    apiKey: process.env.OPENAI_API_KEY,
    tools: [addTool],
});

const result = await agent.run("¿Cuánto es 2 + 3?");
```

### Ejemplo 3: ClineCore con herramientas builtin

```typescript
import { ClineCore, createBuiltinTools } from "@cline/core";

const cline = await ClineCore.create({ clientName: "my-app" });

const tools = createBuiltinTools({ cwd: process.cwd() });

const result = await cline.start({
    config: {
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY,
        cwd: process.cwd(),
        mode: "act",
        enableTools: true,
        systemPrompt: "You are a coding assistant.",
    },
    prompt: "Create a README for this project.",
});

result.subscribe((event) => {
    if (event.type === "assistant-text-delta") {
        process.stdout.write(event.text);
    }
});
```

### Ejemplo 4: Equipo multi-agent simple

```typescript
import { ClineCore, bootstrapAgentTeams, createSpawnAgentTool } from "@cline/core";

const cline = await ClineCore.create({ clientName: "my-app" });

const result = await cline.start({
    config: {
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY,
        mode: "act",
        enableTools: true,
        enableSpawnAgent: true,       // Activar spawn de sub-agents
        enableAgentTeams: true,       // Activar teams
    },
    prompt: "Analyze the codebase and create a report.",
});
```

---

## 5. Ciclo de Vida de un Agent

### Fases del ciclo de vida

```
1. CREACIÓN
   ├── new Agent(config) o ClineCore.create(options)
   └── inicialización interna (ensureInitialized / initialize)

2. CONFIGURACIÓN
   ├── Se construye el AgentModel vía @cline/llms si se usa provider form
   ├── Se registran los hooks (registerHooks)
   └── Se ejecutan los plugins (setup callbacks)

3. EJECUCIÓN (run)
   ├── beforeRun hooks
   ├── generateAssistantMessage (mensaje inicial si es necesario)
   ├── consumePendingUserMessage
   ├── prepareTurnForModelRequest
   │   └── beforeModel hooks (transformar request antes de enviar)
   ├── executeToolCalls (bucle iterativo)
   │   ├── beforeTool hooks
   │   ├── executePreparedTool
   │   └── afterTool hooks
   ├── updateUsage
   ├── emit events (assistant-text-delta, tool-use, etc.)
   └── finishRun → afterRun hooks

4. FINALIZACIÓN
   ├── Status: "completed" | "aborted" | "error"
   ├── AgentRunResult con outputText, messages, usage, status
   └── liberación de recursos (abortController, etc.)

5. RESTAURACIÓN (opcional)
   └── agent.restore(messages) → reemplaza la conversación
```

**Fuentes:**
- `node_modules/@cline/agents/dist/agent-runtime.d.ts` (líneas 43-91 - métodos del clase)
- `node_modules/@cline/agents/README.md` (líneas 160-204)

---

## 6. Cómo crear un Agent

### Método A: new Agent() + constructor con provider form

```typescript
import { Agent } from "@cline/agents";

const agent = new Agent({
    providerId: "anthropic",      // string del provider
    modelId: "claude-sonnet-4-6", // string del modelo
    apiKey: "...",                // API key
    systemPrompt: "...",          // system prompt opcional
    tools: [...],                 // AgentTool[] opcional
    hooks: {...},                 // AgentRuntimeHooks opcional
    plugins: [...],               // AgentRuntimePlugin[] opcional
});
```

### Método B: AgentRuntimeConfigWithModel (avanzado)

```typescript
import { Agent } from "@cline/agents";
import { createGateway } from "@cline/llms";

const gateway = createGateway({ providerConfigs: [...] });
const model = gateway.createAgentModel({ providerId, modelId });

const agent = new Agent({
    model,                        // AgentModel pre-construido
    systemPrompt: "...",
    tools: [...],
});
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 67-98)

---

## 7. Cómo crear un ClineCore

```typescript
import { ClineCore } from "@cline/core";

const cline = await ClineCore.create({
    clientName: "my-app",         // nombre de la aplicación (opcional)
    // Opciones adicionales según el transport mode:
    // - backendMode: "local" | "hub" | "remote"
    // - hub options...
    // - remote options...
});

// Start session
const session = await cline.start({
    config: {
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        apiKey: process.env.ANTHROPIC_API_KEY,
        cwd: process.cwd(),
        mode: "act",
        enableTools: true,
    },
    prompt: "Hello",
});

// Cleanup
await cline.dispose();
```

**Fuentes:**
- `node_modules/@cline/core/dist/ClineCore.d.ts` (líneas 53-54)
- `node_modules/@cline/core/README.md` (líneas 29-52)

---

## 8. Cómo funcionan los Teams

### Conceptos clave

1. **AgentTeamsRuntime**: Coordina múltiples agentes con mailbox, task management, y outcome tracking
2. **AgentTeam**: Colección simple de agentes para routing directo
3. **Spawn Agent Tool**: Permite que un agente lead agent cree sub-agentes
4. **Configured Agent**: Agente delegado con configuración propia

### Mecanismo de spawn

```typescript
// El lead agent puede spawn teammate mediante la tool team_spawn_teammate
// Esto crea:
// 1. Un nuevo agente con su propio config
// 2. Una entrada en el mailbox del lead agent
// 3. Un track en AgentTeamsRuntime

const teammate = teamRuntime.spawnTeammate({
    agentId: "worker-1",
    config: {
        providerId: "anthropic",
        modelId: "claude-sonnet-4-6",
        systemPrompt: "You are a code reviewer.",
    },
});
```

### Mecanismo de task delegation

```typescript
// El lead puede asignar tareas a teammates:
teamRuntime.createTask({
    title: "Review PR #42",
    description: "Check the code quality of PR #42",
    assignee: "worker-1",
});

// Y ejecutar sobre esa tarea:
const result = await teamRuntime.routeTo("worker-1", "Please review this code.");
```

### Tool names disponibles del team (TEAM_TOOL_NAMES):

```typescript
readonly [
    "team_spawn_teammate",
    "team_shutdown_teammate",
    "team_status",
    "team_task",
    "team_run_task",
    "team_cancel_run",
    "team_list_runs",
    "team_await_runs",
    "team_send_message",
    "team_broadcast",
    "team_read_mailbox",
    "team_mission_log",
    "team_cleanup",
    "team_create_outcome",
    "team_attach_outcome_fragment",
    "team_review_outcome_fragment",
    "team_finalize_outcome",
    "team_list_outcomes"
]
```

**Fuente:** `node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts` (línea 31)

---

## 9. Cómo funcionan los SubAgents

### Mecanismo de SubAgent

Los sub-agents se crean mediante el tool `spawn_agent` que se habilita con:

```typescript
config.enableSpawnAgent: true  // en el start config
```

Cuando un agente hace tool call a `spawn_agent`:
1. Se crea un nuevo `AgentRuntime` internamente
2. Se conecta al mailbox del team
3. El lead agent puede monitorear su estado

### Contexto de SubAgents en eventos

```typescript
// Los hooks exportan tipos para tracking:
type SubAgentStartContext = {
    agentId: string;
    config: TeamMemberConfig;
};

type SubAgentEndContext = {
    agentId: string;
    result?: AgentResult;
    error?: Error;
};
```

**Fuente:** `node_modules/@cline/core/dist/index.d.ts` (línea 28)

---

## 10. Partes disponibles solo en CLI

### Análisis de las diferencias CLI vs SDK

Basado en la documentación, **no existe una separación explícita "CLI-only"** en el SDK. Sin embargo:

### Funcionalidades que requieren VS Code / IDE integration (NO disponibles en SDK puro):

1. **MCP (Model Context Protocol) integration**: Las herramientas MCP se registran desde archivos de configuración del IDE
   - `resolveMcpServerRegistrations`, `registerMcpServersFromSettingsFile`
   - `loadMcpSettingsFile`, `updateMcpSettingsFile`
   
   **Fuente:** `node_modules/@cline/core/dist/index.d.ts` (línea 27)

2. **Workspace management**: La detección y gestión de workspace es específica del IDE host
   - `generateWorkspaceInfo`, `buildWorkspaceMetadata`
   - `InMemoryWorkspaceManager`, `WorkspaceManager`

   **Fuente:** `node_modules/@cline/core/dist/index.d.ts` (líneas 80-84)

3. **Desktop tool approval**: System tray notifications para aprobación de herramientas
   - `requestDesktopToolApproval`
   
   **Fuente:** `node_modules/@cline/core/dist/index.d.ts` (línea 50)

4. **OAuth local server**: Para providers con OAuth se usa un servidor local que depende del browser
   - `startLocalOAuthServer`, `LocalOAuthServer`
   
   **Fuente:** `node_modules/@cline/core/dist/auth/server.d.ts`

### Partes disponibles en CLI / Runtime standalone:

1. ✅ **Agent loop** (`@cline/agents`) - runtime-agnostic
2. ✅ **Provider handlers** (`@cline/llms`) - multi-platform (browser, node, runtime)
3. ✅ **Tool execution** (shell, file operations) - disponible en Node
4. ✅ **Session persistence** (SQLite stores) - disponible programáticamente
5. ✅ **Teams / SubAgents** - disponibles via `@cline/core`

---

## 11. Partes disponibles en SDK

### API pública completa del SDK:

| Categoría | Disponible en SDK | Notas |
|-----------|------------------|-------|
| ClineCore | ✅ | Entry-point principal |
| Agent/AgentRuntime | ✅ | Via `@cline/agents` o re-exportado por `@cline/core` |
| Providers (LLM handlers) | ✅ | 14+ providers built-in via `@cline/llms` |
| Model catalogs | ✅ | `getLiveModelsCatalog`, `getProviderConfig` |
| Agent Teams | ✅ | `AgentTeamsRuntime`, `AgentTeam` |
| SubAgents / Spawn | ✅ | `createSpawnAgentTool`, `bootstrapAgentTeams` |
| Session management | ✅ | `ClineCore.start()`, `restore()`, `readMessages()` |
| Session persistence (SQLite) | ✅ | `SqliteSessionStore`, `SqliteTeamStore` |
| Default tools | ✅ | `createBuiltinTools()`, 9+ default tools |
| Hooks (AgentRuntimeHooks) | ✅ | beforeModel, afterModel, beforeTool, afterTool, etc. |
| Plugins | ✅ | AgentRuntimePlugin interface |
| Storage abstractions | ✅ | SessionStore, ArtifactStore, TeamStore interfaces |
| Auth (OAuth/API key) | ✅ | Multiple auth mechanisms |
| Cron/Automation | ✅ | Cron service y specs disponibles en `@cline/core/cron/` |
| Hub transport | ✅ | `HubRuntimeHost`, `RemoteRuntimeHost` |
| Checkpoints | ✅ | Session checkpointing y restoration |
| Feature flags | ✅ | `FeatureFlagsService` |
| Telemetry | ✅ | `TelemetryService`, OpenTelemetry integration |
| Context compaction | ✅ | `createContextCompactionPrepareTurn` |
| Settings management | ✅ | `CoreSettingsService`, `createCoreSettingsService` |
| Provider settings | ✅ | `ProviderSettingsManager` |
| Local provider registry | ✅ | `getLocalProviderModels`, `addLocalProvider` |

---

## 12. Partes que NO funcionan todavía

### Estado experimental del SDK

**Todos los paquetes están marcados como `[experimental]`**:
- `@cline/sdk`: versión `0.0.64` (prerelease)
- README de `@cline/agents`: "[experimental] @cline/agents"
- README de `@cline/core`: "[experimental] @cline/core"
- README de `@cline/llms`: "[experimental] @cline/llms"

### Posibles limitaciones (basadas en análisis del código):

1. **Ollama**: 
   - Tiene soporte específico (`OLLAMA_DEFAULT_CONTEXT_WINDOW = 32768`)
   - Pero la compatibilidad exacta con modelos puede variar según el modelo específico

2. **Providers de pago/enterprise**:
   - OCA (Oracle Cloud AI) requiere OAuth setup especial
   - OpenAI Codex requiere saved OAuth credentials en `~/.cline/data/settings/providers.json`

3. **MCP servers**:
   - Requieren archivos de configuración externos (`loadMcpSettingsFile`)
   - La autorización OAuth de MCP servers requiere interacción manual del usuario

4. **Hub/Remote transport**:
   - Dependen de infraestructura externa (CLINE_CLOUD_URL)
   - Pueden requerir cuenta activa en el servicio Cline Cloud

**Fuentes:**
- `node_modules/@cline/sdk/package.json` (versión 0.0.64)
- `node_modules/@cline/agents/README.md` (línea 1 - "[experimental]")
- `node_modules/@cline/core/dist/index.d.ts` (línea 66 - mcpServerOAuthState)
- `node_modules/@cline/core/README.md` (línea 136 - OAuth credentials path)

---

## 13. Resumen de Provedores Disponibles

### Lista completa de provedores built-in:

| Provider ID | Family | Protocol | Auth Type | Default Model |
|-------------|--------|----------|-----------|---------------|
| `cline` | cline | oca | OAuth (device) | auto |
| `openai` | openai | openai | API key | gpt-5 |
| `openai-codex` | openai-codex | openai | OAuth | codex-mini |
| `anthropic` | anthropic | anthropic | API key | claude-sonnet-4-6 |
| `claude-code` | claude-code | claude-code | cline auth | auto |
| `gemini` | google | gemini | API key | gemini-2.5-pro |
| `vertex` | vertex | vertex | GCP auth | gemini-2.5-pro |
| `bedrock` | bedrock | bedrock | AWS creds | claude-sonnet-4-6 |
| `mistral` | mistral | openai | API key | mistral-large |
| `dify` | dify | dify | API key | auto |
| `ollama` | ollama | openai | (none) | - |
| `sap-ai-core` | sap-ai-core | sap | API key | - |
| `openai-compatible` | openai-compatible | openai | API key + baseUrl | user-defined |

**Fuentes:**
- `node_modules/@cline/llms/dist/providers/builtins.d.ts` (BUILTIN_SPECS)
- `node_modules/@cline/core/dist/services/llms/provider-settings.d.ts` (ProviderSettingsSchema)

---

## 14. Tipos Compartidos Principales (`@cline/shared`)

### AgentTool

```typescript
interface AgentTool<TInput = any, TOutput = any> {
    name: string;
    description: string;
    inputSchema: z.ZodType<TInput>;
    execute(input: TInput, context: AgentToolContext): Promise<TOutput>;
}
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 102-129)

### AgentMessage

```typescript
interface AgentMessage {
    role: "user" | "assistant" | "tool";
    content: ContentBlock[];
}
```

**Fuente:** `node_modules/@cline/shared/README.md` (mención en tipos compartidos)

### AgentRuntimeEvent

Cubre: run/turn boundaries, assistant text/reasoning deltas, tool lifecycle, usage updates, completion/failure.

**Fuente:** `node_modules/@cline/agents/README.md` (línea 157-158)

### AgentRuntimeHooks

```typescript
interface AgentRuntimeHooks {
    beforeModel({ request }): AgentBeforeModelResult | undefined;
    afterModel({ response }): void | undefined;
    beforeTool({ tool, input }): AgentBeforeToolResult | undefined;
    afterTool({ tool, result }): AgentAfterToolResult | undefined;
    beforeRun({ messages }): void | undefined;
    afterRun({ result }): void | undefined;
    onEvent(event): void | undefined;
}
```

**Fuente:** `node_modules/@cline/agents/README.md` (líneas 176-204)

### AgentMode

```typescript
type AgentMode = "act" | "plan" | "code" | "debug" | ...;
// (valores específicos en SessionPromptConfig)
```

**Fuente:** `node_modules/@cline/shared/README.md` (línea 21)

### ToolPolicy

```typescript
interface ToolPolicy {
    toolName: string;
    allowed: boolean;
}
```

**Fuente:** `node_modules/@cline/shared/README.md` (línea 24)

### SessionPromptConfig

```typescript
interface SessionPromptConfig {
    mode?: AgentMode;
    // ... configuración del prompt de sesión
}
```

**Fuente:** `node_modules/@cline/shared/README.md` (línea 22)

### SessionWorkspaceConfig

```typescript
interface SessionWorkspaceConfig {
    workspaceFolders?: string[];
    // ... configuración del workspace
}
```

**Fuente:** `node_modules/@cline/shared/README.md` (línea 23)

### SessionExecutionConfig

```typescript
interface SessionExecutionConfig {
    toolPolicy?: Map<string, boolean>;
    // ... configuración de ejecución
}
```

**Fuente:** `node_modules/@cline/shared/README.md` (línea 24)

---

## 15. Tipos de Core Configuration (`@cline/core`)

### CoreModelConfig

```typescript
interface CoreModelConfig {
    providerId: string;
    modelId: string;
    apiKey?: string;
    accessToken?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    contextWindow?: number;
    maxTokens?: number;
    // ... configuración de modelo
}
```

**Fuente:** `node_modules/@cline/core/dist/types/config.d.ts` (CoreModelConfig)

### CoreSessionConfig

```typescript
interface CoreSessionConfig {
    model: CoreModelConfig;
    mode: AgentMode;
    systemPrompt?: string;
    workspaceFolders?: string[];
    toolPolicy?: Map<string, boolean>;
    // ... configuración de sesión
}
```

**Fuente:** `node_modules/@cline/core/dist/types/config.d.ts` (CoreSessionConfig)

### CoreCompactionConfig

```typescript
interface CoreCompactionConfig {
    strategy: "summarize" | "truncate" | "context-window";
    // ... configuración de compaction
}
```

**Fuente:** `node_modules/@cline/core/dist/types/config.d.ts` (CoreCompactionConfig)

### CoreRuntimeFeatures

```typescript
interface CoreRuntimeFeatures {
    supportsTools?: boolean;
    supportsSpawnAgent?: boolean;
    supportsAgentTeams?: boolean;
    supportsCron?: boolean;
    // ... capacidades del runtime
}
```

**Fuente:** `node_modules/@cline/core/dist/types/config.d.ts` (CoreRuntimeFeatures)

---

## 16. Default Tools disponibles

### Lista de herramientas builtin:

| Tool Name | Descripción |
|-----------|-------------|
| `apply_patch` | Aplica diffs/patches a archivos |
| `ask_question` | Preguntar al usuario |
| `edit_file` / `editor` | Editar archivos con operaciones específicas |
| `read_files` | Leer archivos |
| `search_codebase` | Buscar en el codebase |
| `run_commands` | Ejecutar comandos de shell |
| `skills` | Ejecutar skills |
| `submit_and_exit` | Submit y salir |
| `web_fetch` | Obtener contenido web |
| `shell` | Herramienta de shell |

**Fuente:** `node_modules/@cline/core/dist/extensions/tools/index.d.ts` (línea 8, línea 14)

### Tool Presets:

```typescript
enum ToolPresetName {
    "all",
    "headless",
    "acp",
    // ...
}

enum ToolPolicyPresetName {
    // ...
}
```

**Fuente:** `node_modules/@cline/core/dist/extensions/tools/index.d.ts` (línea 12)

---

## 17. Storage Abstractions

### SessionStore

```typescript
interface SessionStore {
    createSession(data): Promise<string>;
    getSession(sessionId): Promise<SessionRow | null>;
    updateSession(sessionId, data): Promise<void>;
    deleteSession(sessionId): Promise<boolean>;
    listSessions(options?): Promise<SessionRow[]>;
}
```

### ArtifactStore

```typescript
interface ArtifactStore {
    saveArtifact(sessionId, artifact): Promise<void>;
    getArtifacts(sessionId): Promise<Artifact[]>;
    deleteArtifacts(sessionId): Promise<void>;
}
```

### TeamStore

```typescript
interface TeamStore {
    saveTeamState(teamId, state): Promise<void>;
    getTeamState(teamId): Promise<TeamRuntimeState | null>;
    deleteTeamState(teamId): Promise<void>;
}
```

**Fuente:** `node_modules/@cline/core/dist/types/storage.d.ts` (interfaces)

### Implementaciones concretas:

- **SqliteSessionStore**: Implementación SQLite para sesiones (`node_modules/@cline/core/dist/services/storage/sqlite-session-store.d.ts`)
- **SqliteTeamStore**: Implementación SQLite para teams (`node_modules/@cline/core/dist/services/storage/team-store.d.ts`)
- **FileTeamPersistenceStore**: Store basado en archivos (`node_modules/@cline/core/dist/session/stores/team-persistence-store.d.ts`)

---

## 18. Cron/Automation

El SDK incluye un sistema de cron completo:

```typescript
// Directorios disponibles en @cline/core:
// - cron/service/
// - cron/specs/
// - cron/runner/
// - cron/schedule/
// - cron/events/
// - cron/reports/
```

Permite programar tareas periódicas dentro del agente.

---

## 19. Hub/Remote Transport

### RuntimeHost types:

```typescript
interface RuntimeHost {
    startSession(input): Promise<StartSessionResult>;
    runTurn(sessionId, request): Promise<ChatTurnResult>;
    abort(sessionId): void;
    stopSession(sessionId): void;
    getSession(sessionId): Promise<SessionInfo>;
    deleteSession(sessionId): Promise<boolean>;
    updateSession(sessionId, data): Promise<void>;
    readSessionMessages(sessionId): Promise<AgentMessage[]>;
    dispatchHookEvent(event): Promise<void>;
    dispose(): Promise<void>;
}
```

### Implementaciones:

- **LocalRuntimeHost**: Ejecuta localmente (`node_modules/@cline/core/dist/runtime/host/local-runtime-host.d.ts`)
- **HubRuntimeHost**: Se conecta a Cline Cloud Hub (`node_modules/@cline/core/dist/hub/runtime-host/hub-runtime-host.d.ts`)
- **RemoteRuntimeHost**: Se conecta a un remote host (`node_modules/@cline/core/dist/hub/runtime-host/remote-runtime-host.d.ts`)

---

## 20. Autenticación

### Métodos de autenticación soportados:

| Método | Providers | Descripción |
|--------|-----------|-------------|
| API Key | La mayoría | `apiKey` en config del provider |
| OAuth (device flow) | cline, openai-codex | `startLocalOAuthServer()` para recibir el callback |
| OAuth (OCA) | oracle-ai | Oracle Cloud Auth |
| GCP credentials | vertex | Google Application Default Credentials |
| AWS credentials | bedrock | AWS SDK credentials |

### Archivos de auth en el SDK:

- `auth/cline.d.ts` - Cline device auth
- `auth/codex.d.ts` - OpenAI Codex OAuth
- `auth/oca.d.ts` - Oracle Cloud Auth
- `auth/provider-auth-registry.d.ts` - Registry de auth handlers
- `auth/server.d.ts` - Local OAuth server
- `auth/types.d.ts` - Tipos de auth

---

## 21. Session Versioning y Checkpoints

### Versioning Service:

```typescript
export { SessionVersioningService, SessionVersioningError } from "./session/session-versioning-service";
```

### Checkpoint operations:

```typescript
// Create/restore checkpoints
findCheckpointForRun(sessionId): Promise<CheckpointEntry | null>;
readSessionCheckpointHistory(sessionId): Promise<CheckpointEntry[]>;

// Compare checkpoints
compareCheckpointToWorkspace(input): Promise<CompareCheckpointResult>;
createCheckpointComparePlan(input): CheckpointComparePlan;
```

**Fuente:** `node_modules/@cline/core/dist/index.d.ts` (líneas 85-86)

---

## 21. Telemetry

### Servicios de telemetry disponibles:

```typescript
// Core telemetry events:
CORE_TELEMETRY_EVENTS // lista de eventos
captureAgentCreated()
captureAgentTeamCreated()
captureCompactionExecuted()
captureConversationTurnEvent()
captureProviderApiError()
captureToolUsage()
captureAuthStarted()
captureAuthSucceeded()
captureAuthFailed()
identifyAccount()
// ... y muchos más

// OpenTelemetry integration:
createOpenTelemetryTelemetryService(options)
OpenTelemetryProvider
TelemetryLoggerSink
```

**Fuente:** `node_modules/@cline/core/dist/index.d.ts` (líneas 74-78)

---

## 22. Resumen de Import Paths

### Desde @cline/sdk (re-exporta @cline/core):

```typescript
import { ClineCore, Agent, createBuiltinTools } from "@cline/sdk";
// O equivalentemente:
import { ClineCore, Agent, createBuiltinTools } from "@cline/core";
```

### Desde @cline/agents:

```typescript
import { Agent, AgentRuntime, createAgent, createAgentRuntime } from "@cline/agents";
import type { AgentTool, AgentRuntimeHooks, AgentRuntimeEvent, AgentMessage } from "@cline/shared";
```

### Desde @cline/llms:

```typescript
import { createHandler, createGateway } from "@cline/llms";
import { BUILTIN_SPECS, OLLAMA_DEFAULT_CONTEXT_WINDOW } from "@cline/llms/providers/builtins";
import type { ProviderConfig, ProviderSettings } from "@cline/llms";
import { getLiveModelsCatalog } from "@cline/core/services/llms/provider-defaults";
```

---

## 23. Conclusiones

### Lo que funciona bien:

1. ✅ **Agent loop** - API limpia y bien documentada en `@cline/agents`
2. ✅ **Provider system** - 14+ providers built-in con soporte para OAuth, API keys, etc.
3. ✅ **Session management** - CRUD completo of sessions con persistencia SQLite
4. ✅ **Teams / SubAgents** - Completos pero requieren ClineCore
5. ✅ **Default tools** - 9+ herramientas builtin disponibles
6. ✅ **Hooks y Plugins** - Sistema de extensión robusto

### Lo que tiene limitaciones:

1. ⚠️ **Experimental** - Todo el SDK está en estado experimental (versión 0.0.x)
2. ⚠️ **MCP** - Requiere configuración externa de archivos
3. ⚠️ **OAuth** - Depende de servidor local y browser
4. ⚠️ **Hub/Remote** - Dependen de infraestructura Cline Cloud
5. ⚠️ **Ollama** - Soporte básico pero compatible con todos los modelos locales

### Lo que NO está disponible en el SDK (solo VS Code extension):

1. ❌ **UI components** - No hay componentes UI en el SDK
2. ❌ **Workspace detection** - Depende del host IDE
3. ❌ **Desktop notifications** - Requiere VS Code API
4. ❌ **Browser-based auth flows** - Requieren interacción del usuario

---

## 24. Construir Nuestro Propio Core + CLI + GUI para Gestionar Agentes y Modelos

### 24.1. Objetivo

Crear una alternativa independiente a la extensión de VS Code de Cline que permita:
- Gestionar agentes, providers y modelos desde línea de comandos (CLI)
- Gestionar sesiones de agentes (crear, listar, abortar, detener, borrar)
- Gestionar equipos multi-agent (spawn, tareas, comunicación)
- Visualizar el estado de ejecución en tiempo real
- Configurar modelos y providers de forma persistente
- Funcionar como una extensión alternativa para VS Code

### 24.2. Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────────┐
│                    Nuestra Aplicación                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   CLI (yargs)│  │   GUI        │  │   VS Code Extension  │  │
│  │   (Node.js)  │  │   (Tauri/    │  │   (VSCode API + SDK) │  │
│  │              │  │    Electron) │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                      │              │
│         ▼                  ▼                      ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Frontend Layer (3 opciones)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Core Management API (Node.js standalone)        │   │
│  │                                                          │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────┐  │   │
│  │  │ ClineCore      │  │ AgentTeams     │  │ Agent     │  │   │
│  │  │ (sessions)     │  │ Runtime        │  │ Runtime   │  │   │
│  │  └────────────────┘  └────────────────┘  └───────────┘  │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────┐  │   │
│  │  │ Provider       │  │ Model          │  │ Tool      │  │   │
│  │  │ Settings       │  │ Catalog        │  │ Policy    │  │   │
│  │  └────────────────┘  └────────────────┘  └───────────┘  │   │
│  │  ┌────────────────┐  ┌────────────────┐                  │   │
│  │  │ SQLite Store   │  │ Auth           │                  │   │
│  │  │ (sessions,     │  │ Manager        │                  │   │
│  │  │  teams)        │  └────────────────┘                  │   │
│  │  └────────────────┘                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              @cline/llms (Provider Layer)                │   │
│  │         14+ providers: Ollama, Anthropic, OpenAI...      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 24.3. Componentes Clave que Podemos Reutilizar del SDK

| Componente | ¿Lo podemos usar? | Paquete | Fuente |
|-----------|------------------|---------|--------|
| Agent loop (stateless) | ✅ Totalmente | `@cline/agents` | `agent-runtime.d.ts` |
| AgentRuntime config | ✅ Con provider form | `@cline/agents` | `AgentRuntimeConfigWithProvider` |
| Provider handlers | ✅ Totalmente | `@cline/llms` | `createHandler()`, `createGateway()` |
| Builtin tools (shell, file ops) | ✅ En Node | `@cline/core` | `createBuiltinTools()` |
| Session persistence (SQLite) | ✅ Programático | `@cline/core` | `SqliteSessionStore` |
| Team runtime (multi-agent) | ✅ Con limitaciones | `@cline/core` | `AgentTeamsRuntime` |
| Model catalogs | ✅ Catalogs públicos | `@cline/llms` | `getLiveModelsCatalog()` |
| Hooks system | ✅ Totalmente | `@cline/agents` | `AgentRuntimeHooks` |
| Plugin system | ✅ Totalmente | `@cline/agents` | `AgentRuntimePlugin` |
| Team tools schemas | ✅ Solo lectura | `@cline/shared` | `TeamSpawnTeammateInputSchema` etc. |

### 24.4. Componentes que NO Podemos Reutilizar (vscode-specific)

| Componente | ¿Por qué no? | Alternativa |
|-----------|---------------|-------------|
| VS Code UI components | Dependen de `vscode` runtime | Crear nuestra propia UI |
| VS Code workspace detection | API exclusiva de VS Code | Usar `fs` + `path` nativos |
| VS Code task/run APIs | API exclusiva de VS Code | No necesario para core |
| Desktop notifications (tray) | Dependen de VS Code | Usar `electron-notifications` o `node-notifier` |
| MCP server registration en settings | Requiere `.vscode/settings.json` | Crear propio archivo de config |

### 24.5. Proyecto Referencia: Nuestro Directorio Actual

**Ruta del proyecto**: `c:\Proyects\MultiAgentDev\` (este directorio)

```
MultiAgentDev/
├── package.json          # Dependencias: @cline/sdk, @cline/core, etc.
├── tsconfig.json         # Configuración TypeScript
├── src/
│   ├── index.ts                    # Entry-point principal
│   ├── config/
│   │   ├── models.js               # Configuración de modelos (Architect + Worker)
│   │   └── providers.js            # Configuración de providers
│   └── workflows/
│       └── team-task-flow.ts       # Workflow multi-agent con AgentTeamsRuntime
└── SDK_RESEARCH.md                 # Este documento
```

### 24.6. Estructura Propuesta para Nuestro Core + CLI + GUI

```
MultiAgentDev/
├── package.json                    # + nuevas dependencias
├── tsconfig.json
├── src/
│   ├── index.ts                               # Entry-point principal (existente)
│   ├── cli/                                   # [NUEVO] CLI con yargs/picocolors
│   │   ├── index.ts                           # Punto de entrada CLI
│   │   ├── commands/
│   │   │   ├── agents.ts                      # agent create/list/abort/stop/delete
│   │   │   ├── sessions.ts                    # session CRUD
│   │   │   ├── models.ts                      # model list/catalog/update
│   │   │   ├── providers.ts                   # provider config
│   │   │   ├── teams.ts                       # team spawn/teammate/task/run
│   │   │   └── checkpoints.ts                 # checkpoint create/restore/list
│   │   └── utils.ts                           # Helpers CLI (colores, formatters)
│   │
│   ├── core/                                  # [NUEVO] Core management layer
│   │   ├── manager.ts                         # Single entry point para todo el SDK
│   │   ├── session-manager.ts                 # Wrapper sobre ClineCore.session*
│   │   ├── team-manager.ts                    # Wrapper sobre AgentTeamsRuntime
│   │   ├── provider-settings.ts               # Persistencia de providers en JSON/YAML
│   │   └── model-catalog.ts                   # Wrapper sobre getLiveModelsCatalog
│   │
│   ├── storage/                               # [NUEVO] Storage abstraction
│   │   ├── sqlite-store.ts                    # Wrapper sobre SqliteSessionStore
│   │   ├── json-config.ts                     # Config de providers en archivo JSON
│   │   └── team-store.ts                      # Wrapper sobre SqliteTeamStore
│   │
│   ├── config/                                # [EXISTENTE]
│   │   ├── models.js                          # Modelos por defecto
│   │   └── providers.js                       # Providers por defecto
│   │
│   ├── workflows/                             # [EXISTENTE]
│   │   ├── team-task-flow.ts                  # Workflow multi-agent (existente)
│   │   └── agent-lifecycle.ts                 # [NUEVO] Ejemplos de ciclo de vida
│   │
│   └── gui/                                   # [NUEVO] GUI (si se elige Tauri/Electron)
│       ├── main.ts                            # Main process (Electron) o src-tauri (Tauri)
│       ├── preload.ts                         # Preload script
│       └── renderer/                          # Frontend (React/Vue/Svelte + CSS)
│           ├── App.tsx
│           ├── components/
│           │   ├── AgentList.tsx
│           │   ├── SessionViewer.tsx
│           │   ├── ModelConfig.tsx
│           │   ├── TeamManager.tsx
│           │   └── ChatView.tsx
│           └── styles/
│
├── extensions/                                # [NUEVO] VS Code extension (si se crea)
│   └── vscode-extension/
│       ├── package.json                       # vsce manifest
│       ├── src/
│       │   ├── extension.ts                   # Punto de entrada de la extensión
│       │   ├── agent-panel.ts                 # Panel lateral con lista de agentes
│       │   ├── session-view.ts                # View para ver sesiones en detalle
│       │   └── chat-view.tsx                  # Panel de chat tipo Cline
│       └── images/
│
├── .env                                       # Variables de entorno (API keys)
├── .agentconfig.json                          # [NUEVO] Config global de agents
├── SDK_RESEARCH.md                            # Este documento
└── README.md                                  # Docs del proyecto
```

### 24.7. CLI Commands Propuestos

```bash
# Agent management
ma agent list                  # Listar todos los agentes creados
ma agent create --name worker --model qwen2.5-coder:7b --provider ollama
ma agent delete worker
ma agent info worker           # Info detallada del agente

# Session management
ma session list                # Listar sesiones
ma session create --agent worker --prompt "..."
ma session stop <id>
ma session abort <id>
ma session show <id>          # Mostrar historial de mensajes
ma session messages <id>      # Ver mensajes raw (AgentMessage[])
ma session delete <id>

# Model management
ma model list                  # Listar modelos disponibles (del catalog)
ma model list --provider ollama  # Modelos locales Ollama
ma model info <modelId>       # Info detallada de un modelo
ma provider list              # Listar providers configurados
ma provider add --id anthropic --key $ANTHROPIC_API_KEY
ma provider update --id openai --key $OPENAI_API_KEY

# Team management
ma team create --name my-team --lead architect
ma team spawn <teamId> --agent worker --model qwen2.5-coder:7b
ma team list                 # Listar equipos activos
ma team status <teamId>      # Estado del equipo y sus miembros
ma team task create <teamId> --title "Fix bug" --assignee worker
ma team task complete <teamId> <taskId> --summary "Done"
ma team list-runs <teamId>   # Listar runs activos

# Checkpoint management
ma checkpoint create <sessionId>
ma checkpoint list <sessionId>
ma checkpoint restore <sessionId> <checkpointId>

# Utility
ma status                     # Estado general del sistema
ma reset                      # Resetear todo el estado
```

### 24.8. GUI/Panel Propuesto (Tauri o Electron)

La GUI permitiría:
- Ver lista de agentes configurados con su modelo actual
- Crear nuevos agentes rápidamente
- Gestionar sesiones (crear, listar, ver mensajes, borrar)
- Configurar providers y API keys
- Gestionar equipos multi-agent (spawn, tareas, runs)
- Ver logs en tiempo real
- Ver métricas de uso (tokens, costo)

### 24.9. VS Code Extension: Evaluación de Dificultad

#### Opción A: Extensión standalone que usa el Core existente

**Dificultad**: Media-Alta (~300-500 horas de trabajo)

**Ventajas:**
- Reutiliza todo el core ya implementado (`src/core/`)
- La extensión sería solo una capa ligera sobre el SDK
- Código compartible con CLI y GUI

**Desventajas:**
- VS Code extension API tiene limitaciones (webview sandbox, etc.)
- Depende de la estructura interna de Cline que puede cambiar

**Componentes necesarios de la extensión:**
1. **Agent Panel** (tipo sidebar de Cline) - ~80 horas
2. **Session Chat View** - ~60 horas
3. **Model Configuration UI** - ~40 horas
4. **Provider Settings UI** - ~40 horas
5. **Team Manager UI** - ~60 horas
6. **Integration con ClineCore** (llamadas al core desde webview) - ~80 horas
7. **Activation/Deactivation lifecycle** - ~20 horas
8. **Package.json manifest + icons** - ~10 horas
9. **Testing + Debugging** - ~50 horas

**Total estimado**: ~400 horas de trabajo

#### Opción B: Integración con la extensión existente de Cline

**Dificultad**: Baja-Media (~50-100 horas)

**Descripción:** Crear un "sidecar" o complemento que se integre con la extensión existente de Cline, usando directamente los exports del SDK sin re-implementar nada.

#### Opción C: VS Code Extension como producto final completo

**Dificultad**: Alta (~500-800 horas)

Equivalente a crear un clon funcional de la extensión de Cline pero con nuestro propio UI/UX.

**Componentes adicionales requeridos:**
1. Todo lo de Opción A +:
2. **File browser integrado** - ~40 horas
3. **Code diff viewer** - ~60 horas
4. **Terminal integration** - ~80 horas
5. **MCP server management UI** - ~40 horas
6. **Settings page completa** - ~40 horas
7. **Command palette integration** - ~20 horas
8. **Context menus** - ~20 horas
9. **Inline editing** - ~80 horas (muy complejo)

### 24.10. Comparativa: Extensión VS Code vs CLI Standalone vs GUI (Tauri/Electron)

| Criterio | CLI Standalone | VS Code Extension | Tauri/Electron GUI |
|----------|---------------|-------------------|-------------------|
| Complejidad inicial | Baja | Media-Alta | Alta |
| Reusabilidad del core | ✅ 100% | ⚠️ 70% (UI pierde) | ⚠️ 85% (UI pierde) |
| UX | Baja (terminal) | Alta (IDE native) | Alta (app desktop) |
| Integración con IDE | ❌ Ninguna | ✅ Total (VS Code API) | ⚠️ Parcial (LSP/stdio) |
| Mantenimiento | Fácil | Medio (breaking VS Code APIs) | Medio |
| Distribución | npm package | VS Code Marketplace | Standalone installer |
| Mercado objetivo | Devs CLI | Usuarios VS Code | Usuarios desktop |
| Tiempo estimado MVP | 2-3 semanas | 6-10 semanas | 8-12 semanas |

### 24.11. Recomendación

**Fase 1 (prioritaria)**: CLI standalone con core management layer
- Usar `@cline/agents` directamente + `@cline/core` para sessions y teams
- CLI con `yargs` o `clack` (mejor UX)
- Config persistence en JSON (~20 horas)

**Fase 2**: VS Code Extension (si se necesita integración con IDE)
- Basada en el core existente de Fase 1
- Panel lateral con webview que usa AgentTeamsRuntime + ClineCore
- No intentar replicar toda la funcionalidad de Cline sino enfocarse en: agent/session/team management

**Fase 3**: GUI Tauri/Electron (si se quiere app independiente)
- Reutiliza todo el core de Fase 1
- Frontend React + Tauri para mínimo overhead

### 24.12. Dificultad Real de Crear la GUI como Extensión VS Code

**Respuesta directa a la pregunta del usuario:**

Crear una GUI como extensión de VS Code es **factible pero con limitaciones importantes**:

1. **Lo fácil (60% del trabajo)**:
   - El SDK ya expone todo lo que necesitamos: `ClineCore`, `AgentTeamsRuntime`, `Agent`
   - Los workflows existentes (`team-task-flow.ts`) demuestran que el core funciona
   - La extensión sería principalmente UI (webviews + package.json)

2. **Lo difícil (40% del trabajo)**:
   - VS Code webview API tiene restricciones CSP (no puedes import JS directamente)
   - Hay que comunicar entre webview y extension host (vscode.postMessage)
   - Debugging de extensiones VS Code es complejo
   - La extensión debe ser compatible con múltiples versiones de VS Code

3. **Comparación real**:
   - Si ya sabes TypeScript: ~6-10 semanas para un MVP funcional
   - Si NO sabes crear extensiones VS Code: ~12-16 semanas (curva de aprendizaje)
   - La parte más difícil es el `ChatView` tipo Cline con streaming en tiempo real

4. **Alternativa mejor**: Primero hacer la CLI (~3 semanas), luego decidir si vale la pena la extensión VS Code.

---

## 25. Ruta del Proyecto Actual como Referencia

| Componente | Ruta Actual | Propósito |
|-----------|------------|-----------|
| Entry-point principal | `src/index.ts` | Muestra Individual agents + AgentTeam workflow |
| Config de modelos | `src/config/models.ts` | Define Architect y Worker models |
| Workflow team | `src/workflows/team-task-flow.ts` | Muestra AgentTeamsRuntime spawn/createTask/claimTask/completeTask |
| SDK packages | `node_modules/@cline/*/` | SDK instalado via npm |
| Este documento | `SDK_RESEARCH.md` | Investigación completa del SDK |

**Cómo funciona nuestro proyecto actualmente:**

```typescript
// 1. Importamos desde el SDK directamente:
import { ClineCore, bootstrapAgentTeams, AgentTeamsRuntime } from "@cline/core";
import { Agent } from "@cline/agents";  // O @cline/sdk que re-exporta

// 2. Creamos agents individuales:
const agent = new Agent({ providerId, modelId, apiKey });

// 3. Creamos un equipo multi-agent:
const teamRuntime = new AgentTeamsRuntime({ teamName: "my-team" });
const bootstrapResult = bootstrapAgentTeams({ runtime: teamRuntime, ... });

// 4. Usamos el runtime directamente (no via tools):
teamRuntime.spawnTeammate({ agentId: "worker", config: workerConfig });
teamRuntime.createTask({ title, description, createdBy });
teamRuntime.claimTask(taskId, agentId);
teamRuntime.completeTask(taskId, agentId, summary);
```

**Esto demuestra que el core ya funciona y puede usarse como base para nuestro propio sistema.**

---

## Referencias Cruzadas por Fichero

| Concepto | Fichero Fuente | Líneas |
|----------|---------------|--------|
| ClineCore class | `node_modules/@cline/core/dist/ClineCore.d.ts` | 1-299 |
| Agent/AgentRuntime | `node_modules/@cline/agents/dist/agent-runtime.d.ts` | 1-107 |
| AgentTeam / AgentTeamsRuntime | `node_modules/@cline/core/dist/extensions/tools/team/multi-agent.d.ts` | 1-230 |
| Team tools | `node_modules/@cline/core/dist/extensions/tools/team/team-tools.d.ts` | 1-35 |
| Provider builtins | `node_modules/@cline/llms/dist/providers/builtins.d.ts` | 1-38 |
| Default tools | `node_modules/@cline/core/dist/extensions/tools/index.d.ts` | 1-60 |
| SDK index types | `node_modules/@cline/core/dist/index.d.ts` | 1-124 |
| ClineCore README | `node_modules/@cline/core/README.md` | 1-110 |
| Agents README | `node_modules/@cline/agents/README.md` | 1-310 |
| LLMS README | `node_modules/@cline/llms/README.md` | 1-227 |
| Shared README | `node_modules/@cline/shared/README.md` | 1-47 |
| package.json local | `package.json` (proyecto) | 1-22 |