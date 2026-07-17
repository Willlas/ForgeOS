# Roadmap - Multi-Agent Local System

## Fase 3: Implementación Incremental

### Principios
- Cada commit es pequeño y compilable
- Después de cada fase: compilar → ejecutar → verificar
- Solo continuar cuando la fase anterior funciona

---

## Commit 1: Estructura base + Agent individual con Ollama

**Objetivo:** Verificar que el SDK puede importar y crear un Agent básico.

**Cambios:**
- Mantener `src/index.ts` actual como punto de partida
- Añadir `.env` para configuración

**Archivo `.env`:**
```env
OLLAMA_BASE_URL=http://localhost:11434
ARCHITECT_MODEL=qwen3.6:27b
WORKER_MODEL=qwen2.5-coder:7b
```

**Verificación:**
- `npm run dev` → debe compilar sin errores
- Verificar que `@cline/sdk` se importa correctamente

---

## Commit 2: Configuración centralizada

**Objetivo:** Extraer config a módulo separado.

**Archivos nuevos:**
- `src/config/index.ts` - Carga dotenv + constantes
- `src/config/models.ts` - Mapeo de modelos por agente

**Cambios en `src/index.ts`:**
- Importar config desde módulos
- Crear Agent individual como proof-of-concept

---

## Commit 3: Segundo agente (Worker) con modelo diferente

**Objetivo:** Demostrar que se pueden tener dos agentes con modelos distintos.

**Cambios:**
- `src/index.ts` crea dos instancias de Agent con diferentes `modelId`
- No hay equipo todavía, solo instancias independientes

---

## Commit 4: Integración AgentTeam

**Objetivo:** Usar `createAgentTeam` del SDK para crear el equipo.

**Cambios:**
- Importar `createAgentTeam` desde `@cline/core`
- Configurar architect y worker con sus modelos respectivos
- Probar `routeTo` entre agentes

---

## Commit 5: Flujo completo Architect → Worker

**Objetivo:** Implementar el flujo de delegación completo.

**Cambios:**
- `src/workflows/architect.ts` - Lógica del architect
- `src/workflows/worker.ts` - Lógica del worker
- `src/index.ts` - Orquesta el flujo completo

---

## Commit 6: AgentTeamsRuntime (opcional, para producción)

**Objetivo:** Migrar a runtime completo con mailbox, tasks, outcomes.

**Depende de:** Si Commit 5 funciona sin este, se pospone.

---

## Compilación y Verificación por Fase

| Fase | Comando | Criterio Éxito |
|------|---------|----------------|
| 1 | `npx tsc --noEmit` | Sin errores TypeScript |
| 2 | `npm run dev` | Script ejecuta sin crash |
| 3 | `npx tsc --noEmit && npm run dev` | Compila + ejecuta |