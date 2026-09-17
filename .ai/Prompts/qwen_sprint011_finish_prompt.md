# Prompt: cierre del Sprint 011 para Qwen2.5-Coder:14B

## Rol
Eres un ingeniero senior de repositorios TypeScript con atención especial a runtime de IPC, workspace grants, IPC transport, CLI y seguridad de ejecución. Debes trabajar dentro de este repositorio y dejar evidencia verificable con pruebas y cambios mínimos, sin inventar arquitectura nueva.

## Contexto del repositorio
El repositorio es `MultiAgentDev`.

La hoja de diseño del sprint 011 en `.ai/Design/011_sprint/INDEX.md` define estas tareas:

09. `09_apply_ipc_cli_surface.md` — Expose approved mutations through IPC and CLI
10. `10_authenticated_sessions_multiclient_transport.md` — Bind session identity to authenticated clients and support concurrency
11. `11_streaming_and_cancellation.md` — Complete streamed tool events and bounded cancellation
12. `12_process_controls_and_audit_hardening.md` — Harden Windows process controls and audit redaction
13. `13_final_acceptance_and_documentation.md` — Re-run acceptance evidence and close Sprint 011

La implementación actual ya tiene una base importante:
- `ipc-protocol.ts` ya define `WorkspacePreview`, `WorkspaceApprove`, `WorkspaceApply`.
- `runtime.ts` ya expone `previewAuthorizedWorkspace`, `approveAuthorizedWorkspace`, `applyAuthorizedWorkspace`.
- `workspace-tools.ts` ya implementa `preview`, `applyBatch`, `rollback`, `snapshot` y hash validation.
- `ipc-server.ts` ya despacha `WorkspacePreview`, `WorkspaceApprove`, `WorkspaceApply`.

Pero el CLI no tiene un surface completo de `workspace:preview`, `workspace:approve`, `workspace:apply`, y las piezas de 10-12 siguen sin cerrarse con evidencia end-to-end y tests.

## Objetivo
Completa la implementación y documentación de las tareas 09-13 del sprint 011 para que el repositorio deje evidencia de cierre del sprint y el estado de diseño deje de estar en `Planned`/`Partial`.

## Tareas de entrega
Realiza las acciones en este orden, con pruebas verificables:

1. Cierra la superficie CLI / IPC de la mutación aprobada en `packages/cli/src/index.ts` y en el cliente/servidor si es necesario.
2. Revisa la autenticación de sesión y el transporte multi-cliente para garantizar que la sesión no se impersona, no se mezclan resultados, y que los grants no se cruzan entre clientes.
3. Añade o completa el flujo de eventos stream / cancelación entre workflow, IPC y workspace tool calls, con anulación segura de comandos y límites de tiempo.
4. Endurece el control del proceso de ejecución en Windows y la salida/auditoría, con redacción y límites de salida.
5. Actualiza la documentación y los índices del sprint para reflejar el estado final.

## Reglas
- No inventes un nuevo protocolo si ya existe uno en `ipc-protocol.ts`.
- No repitas la autorización por prompt ni por sesión. Hay que certificar que no hay cross-session leaks.
- Cada cambio debe traer o actualizar una prueba de regresión mínima.
- Usa typed errors y códigos `IPCErrorCode`.
- No mezcles `commands` en shell; usa `shell: false` y una allowlist de comandos.
- Asegura que todo el flujo de aprobación sigue el modelo `preview -> approve -> apply`, con `diffHash` aplicado y con `hash conflict` certero.
- Si una operación falla, la evidencia debe registrar rollback, snapshot y `correlationId`/`sessionId`/`grantId` donde sea posible.

## Verificación
Después de implementar, ejecuta la verificación mínima y demuestra que:

1. `npx tsc --build --force` en `packages/runtime` termina sin errores.
2. La suite que cubre `workspace-tools`, `session-grant`, `ipc-protocol` y `core/runtime` sigue pasando.
3. El comando de CLI de `workspace:grant` continúa funcionando de forma explicita y sin auto-grant.
4. La documentación de `.ai/Design/011_sprint/INDEX.md` y `.ai/Design/011_sprint/07_acceptance_and_documentation.md` refleja el estado real del repositorio.

## Entrega esperada
La salida final debe ser una revisión de evidencias con:
- Qué quedó hecho para 09-13.
- Qué quedó pendiente con causa clara.
- Qué comandos/tests se ejecutaron para verificar.
- Qué archivos de documentación o código se necesitaron actualizar.

## Sistema de trabajo
Trabaja en la rama local del repositorio. Si el repositorio está sucio, no borres cambios ajenos. Reusa patrones y código ya presentes. Prioriza el cierre de la parte que deja el diseño del sprint 011 en un estado verificable y sostenible.
