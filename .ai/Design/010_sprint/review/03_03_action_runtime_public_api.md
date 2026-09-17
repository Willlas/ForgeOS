# Action 03_03 — Complete the Runtime public API

## Objective
Bring `packages/runtime/src/index.ts` into compliance with Design §"Public
Interfaces", which requires exporting the Runtime class **plus** EventBus,
Workspace, Knowledge, Metrics, Scheduler, Logging, configuration types, and
provider interfaces. Today these subsystems are compiled and shipped but **not**
re-exported, forcing consumers to deep-import `@aer/runtime-lib/dist/core/...`.

## Backlog reference
- **Severity:** High
- **Blocks Design 04?** **Yes** — D04 §"Components to Modify" requires the
  Runtime Metrics subsystem to "expose data in a format consumable by the
  persistence layer." If `Metrics` and `Logging` are not exported, D04 must widen
  the API first.

## Why it matters
Design lines 46–47 define the Runtime public surface. The current barrel
(`packages/runtime/src/index.ts`, 167 lines) re-exports dispatcher, engine,
worker, context, cancellation, workflow, agent, agent-team, shared-context, IPC,
and runtime-core symbols — but omits:

| Required subsystem | File present | Exported? |
|--------------------|--------------|-----------|
| EventBus | `core/eventbus.ts` | No |
| Workspace | `core/workspace.ts` | No |
| Knowledge | `core/knowledge.ts` | No |
| Metrics | `core/metrics.ts` | No |
| Scheduler | `core/scheduler.ts` | No |
| Logging | `core/logging.ts` | No |
| WorkGraphEngine | `core/workgraph.ts` | No |
| Configuration types | `config/index.ts`, `config/models.ts` | No |
| Provider interfaces | `core/types/provider.ts`, `providers/` | No |
| AgentExecutionCoordinator | `agent-execution-coordinator.ts` | No |

## Prerequisites
None. Independent of other actions.

## Steps
1. **Enumerate symbols before exporting — do not guess names.** Read each file
   below and list its exported declarations (classes, functions, enums,
   interfaces, types):
   - `packages/runtime/src/core/eventbus.ts`
   - `packages/runtime/src/core/workspace.ts`
   - `packages/runtime/src/core/knowledge.ts`
   - `packages/runtime/src/core/metrics.ts`
   - `packages/runtime/src/core/scheduler.ts`
   - `packages/runtime/src/core/logging.ts`
   - `packages/runtime/src/core/workgraph.ts`
   - `packages/runtime/src/config/index.ts`
   - `packages/runtime/src/config/models.ts`
   - `packages/runtime/src/core/types/provider.ts`
   - `packages/runtime/src/providers/index.ts`
   - `packages/runtime/src/providers/registry.ts`
   - `packages/runtime/src/agent-execution-coordinator.ts`
2. For each file, classify each symbol as a **value** (class/function/enum/const)
   or a **type** (interface/type).
3. Append grouped export blocks to `packages/runtime/src/index.ts`, matching the
   existing style:
   - `export { ValueA, ValueB } from "./core/eventbus.js";`
   - `export type { TypeA, TypeB } from "./core/eventbus.js";`
   - **Always use the `.js` extension** in specifiers (required by `NodeNext`).
   - Keep value and type exports in separate statements (the barrel already
     follows this convention).
4. Place a section header comment before each new group (e.g.
   `// Core Subsystem exports`) consistent with the existing
   `// Runtime Core exports` style.
5. Decide on `AgentExecutionCoordinator`: export it only if it is intended for
   external use; otherwise leave it internal and note the decision.

## Files
- `packages/runtime/src/index.ts` (the barrel — primary edit target)
- The source files listed in step 1 (read-only, to enumerate symbols)

## Constraints
- **No guessed symbol names** — every export must trace to a real declaration.
- Export only the **public** API; do not re-export internal helpers, test
  utilities, or private implementation details.
- Do **not** change subsystem source files to "make them exportable" — they are
  already shipped in `dist/`; this action only widens the barrel.
- Follow the existing barrel formatting exactly (`.js` specifiers, grouped
  value/type blocks).

## Verification
- `npm run build` (runtime workspace) completes with no diagnostics.
- Each Design-required symbol resolves through the package entry. Verify with a
  scratch type-check import, e.g. add a temporary
  `import { EventBus, Workspace, Knowledge, Metrics, Scheduler, Logging } from "@aer/runtime-lib";`
  in a throwaway file and confirm `tsc` resolves it, then delete the file.
- `node -e "import('@aer/runtime-lib').then(m => console.log(Object.keys(m).filter(k => /EventBus|Workspace|Knowledge|Metrics|Scheduler|Log/.test(k))))"`
  lists the newly exported symbols.
