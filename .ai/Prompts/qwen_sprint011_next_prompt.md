# Prompt: siguiente bloque del Sprint 011 para Qwen2.5-Coder:14B

## Rol
Eres un ingeniero senior de TypeScript y de repositorios de runtime/IPC. Tu misión es cerrar la siguiente evidencia del sprint 011 sin inventar una arquitectura nueva y sin borrar cambios ajenos.

## Contexto
El repositorio ya contiene una implementación parcial de la superficie de mutación aprobada (`preview -> approve -> apply`) en runtime e IPC:

- `packages/runtime/src/ipc-protocol.ts` define los comandos `WorkspacePreview`, `WorkspaceApprove`, `WorkspaceApply`.
- `packages/runtime/src/ipc-server.ts` despacha esos comandos.
- `packages/runtime/src/core/runtime.ts` expone las funciones `previewAuthorizedWorkspace`, `approveAuthorizedWorkspace`, `applyAuthorizedWorkspace`.
- `packages/runtime/src/workspace-tools.ts` implementa la validación del `diffHash`, `approvalToken`, el handshake de sesión/grant y el rollback con snapshot.
- `packages/cli/src/index.ts` ya ofrece los comandos de CLI `workspace:preview`, `workspace:approve`, `workspace:apply`.

La documentación de diseño del sprint, sin embargo, sigue marcando estas tareas como presencia de cierre pendiente o no autorizada:

- `10_authenticated_sessions_multiclient_transport.md`: autenticación de identidad de sesión, aislamiento entre clientes y transporte concurrente.
- `11_streaming_and_cancellation.md`: eventos de stream y cancelación acotada.
- `12_process_controls_and_audit_hardening.md`: endurecimiento de ejecución, hardening de proceso Windows y auditoría redaccionada.
- `13_final_acceptance_and_documentation.md`: cierre formal con evidencia final.

## Objetivo del bloque
Cierra el siguiente bloque lógico de trabajo: `10 -> 11 -> 12 -> 13`.

## Qué debes hacer exactamente

### 1) Autenticación de sesión y transporte multi-cliente
Revisa las rutas de conexión, el transporte IPC y el modo en que la sesión se identifica.

Objetivo:
- Hacer que la identidad de sesión sea autenticada por el daemon/transport, no aceptada por “self-assertion” del cliente.
- Hacer que múltiples clientes concurrentes no se mezclen en grants, resultados o eventos.
- Definir un patrón de limpieza de desconexión para no dejar grants o sesiones huérfanas.

Entrega esperada:
- Un flujo con `sessionId` real en la conexión o un handshake de autenticación consistente.
- Rechazo de sessionIds que no correspondan con la identidad autenticada.
- Pruebas sobre aislamiento de grants, resultados y eventos bajo concurrencia.

### 2) Streaming y cancelación
Completa el flujo de eventos de workspace tool para mostrar progreso y permitir cancelación controlada.

Objetivo:
- Emitir eventos ordenados y correlacionados para `start`, `progress`, `result`, `error` y `cancel`.
- Hacer que la cancelación se comporte de forma idempotente.
- Garantizar terminación de procesos y timeouts acotados en Windows.

Entrega esperada:
- Implementación muy pequeña y verificable en `ipc-protocol.ts`, `ipc-server.ts`, `ipc-transport.ts` o en el runtime.
- Pruebas de evento, cancelación, EOF, timeout y desconexión.

### 3) Process controls y audit hardening
Revisa el path y el entorno de la ejecución de comandos para cerrar huecos de shell, arg smuggling y output fuga.

Objetivo:
- Mantener `shell: false` y allowlist de comandos.
- Contener `cwd` en el root raíz con normalización y evitar alias por symlinks/junctions.
- Limitar la salida y redactar auditoría.

Entrega esperada:
- Un conjunto de comprobaciones o hardening mínimo que deje documentado el razonamiento.
- Especificación de qué se debe filtrar o redigir en los eventos/logs.

### 4) Cierre formal con documentación
Actualiza los documentos de diseño/revisión para indicar el estado real que queda y el cierre.

Entrega esperada:
- El índice del sprint 011 debe reflejar el nuevo status real.
- El documento de aceptación debe dejar la evidencia con la base ya implementada y el estado restante.

## Reglas de implementación
- No toques el flujo de mutación ya implementado (`preview -> approve -> apply`) salvo para integrarlo con el transporte o la sesión.
- No inventes nuevas entidades si el repositorio ya tiene `WorkspaceApplyError`, `IPCErrorCode`, `SessionGrantManager`, `IPCCommand`, `IpcServer`, `IpcTransport` y `WorkspaceTools`.
- Reusa los nombres y estructuras existentes en el código.
- Mantén la semántica del `diffHash`, el `approvalId`, la sesión y el `grantId`.
- Usa un enfoque mínimo y verificable: si hubiese que introducir un event stream o un cancel token, que se haga con el mismo patrón del repositorio y no con una nueva disciplina de eventos.

## Verificación mínima
Después del cambio, verifica con estas pruebas o evidencias:

1. `npx tsc --build --force` en `packages/runtime` o `npm run build` del workspace.
2. `vitest` o un test relevante de `workspace-tools`, `ipc-protocol`, `session-grant-manager` y `runtime`.
3. Comprobar que la documentación del sprint no dice `Planned` para la parte de implementación ya realizada, y que el cierre formal no se exagera.

## Entrega final esperada
La respuesta final debe contener:
- Qué bloque se ha atendido: sesión autenticada, streaming/cancelación, process hardening, redacción y documentación.
- Qué archivo(s) del runtime/IPC/CLI se han tocado.
- Qué verificación se ejecutó.
- Qué evidencia queda pendiente para cerrar el sprint 011 de manera honesta.
