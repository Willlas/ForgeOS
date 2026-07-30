# 03 — CLI / Runtime Separation Design

## Objective

Split the monolithic `@aer/runtime` npm package into two independent distributable units: a Runtime package containing the Runtime class and all subsystems, and a CLI package that depends on the Runtime package. This enables independent versioning, deployment, and packaging of each component.

## Existing Architecture

- Single npm package (`@aer/runtime`) defined in `package.json` at project root
- All source code lives under `src/` with no internal package boundaries
- `src/core/runtime.ts` defines the Runtime class alongside CLI entry point `src/cli/index.ts`
- Subsystems (EventBus, Workspace, Knowledge, Metrics, Scheduler, Logging) are exported from the same package entry point
- CLI bin entry point configured in root `package.json`
- Single `tsconfig.json` compiles all source files together

## Components to Reuse

- `src/core/runtime.ts` — Runtime class definition (moves to Runtime package)
- `src/cli/index.ts` — CLI entry point and command handlers (moves to CLI package)
- `src/core/eventbus.ts` — EventBus subsystem
- `src/core/workspace.ts` — Workspace subsystem
- `src/core/knowledge.ts` — Knowledge subsystem
- `src/core/metrics.ts` — Metrics subsystem
- `src/core/scheduler.ts` — Scheduler subsystem
- `src/config/` — Configuration modules
- `src/providers/` — Provider implementations
- `src/workflows/` — Workflow definitions

## Components to Create

- Root-level npm workspaces configuration
- `packages/runtime/package.json` — Runtime package manifest with exports for Runtime class and all subsystems, no CLI code
- `packages/cli/package.json` — CLI package manifest with dependency on Runtime package, bin entry point, no subsystem exports
- Root `package.json` updated to monorepo workspaces configuration
- TypeScript project references or separate tsconfig per package

## Components to Modify

- Root `package.json` — Replace single-package configuration with npm workspaces setup, remove direct bin definition
- `src/cli/index.ts` — Update import paths to import Runtime from the Runtime package instead of sibling module paths
- All files referencing core subsystems via sibling imports — Update to use Runtime package exports

## Public Interfaces

**Runtime Package (`@aer/runtime-runtime` or equivalent name):**
- Exports: Runtime class, EventBus, Workspace, Knowledge, Metrics, Scheduler, Logging, configuration types, provider interfaces
- Does not export: CLI command handlers, CLI argument parsing, terminal output utilities

**CLI Package (`@aer/runtime-cli` or equivalent name):**
- Binary entry point for CLI execution
- Depends on Runtime package as a regular dependency
- Does not re-export Runtime internals
- Exports nothing (CLI-only package)

## File Responsibilities

| File / Directory | Responsibility |
|------------------|----------------|
| Root `package.json` | Workspace orchestration, top-level scripts, shared dev dependencies |
| `packages/runtime/package.json` | Runtime package manifest: name, version, exports, dependencies (no CLI deps) |
| `packages/cli/package.json` | CLI package manifest: name, version, bin entry, dependency on Runtime package |
| `packages/runtime/tsconfig.json` | TypeScript configuration scoped to Runtime sources |
| `packages/cli/tsconfig.json` | TypeScript configuration scoped to CLI sources |
| Runtime package sources | Runtime class + all subsystems (EventBus, Workspace, Knowledge, Metrics, Scheduler) |
| CLI package sources | CLI entry point, command handlers, argument parsing |

## Dependencies

- **Upstream**: None (this task is independent)
- **Downstream**: Task 01 (daemon process), Task 02 (IPC layer) depend on the new package boundaries
- **Coordination**: Import path changes must be synchronized with Tasks 01 and 02 to avoid duplicate refactoring

## Implementation Order

1. Create root-level workspaces configuration in `package.json`
2. Create `packages/runtime/` directory structure with `package.json`
3. Create `packages/cli/` directory structure with `package.json` referencing Runtime package
4. Migrate Runtime class and subsystem source files into Runtime package scope
5. Migrate CLI source files into CLI package scope
6. Update all import paths in CLI package to reference Runtime package exports
7. Create per-package TypeScript configurations
8. Verify both packages build independently
9. Update test import paths
10. Verify existing functionality works with new structure

## Acceptance Criteria

- A standalone Runtime package exists containing only the Runtime class and subsystems (no CLI code)
- A standalone CLI package exists that depends on the Runtime package
- Both packages can be built independently
- No CLI code is importable from the Runtime package
- No Runtime-only code is bundled into the CLI package distribution
- All existing functionality works with the new package structure

## Definition of Done

- Two distinct npm workspace entries exist: one for Runtime, one for CLI
- The Runtime package has no dependency on the CLI
- The CLI package imports the Runtime as a dependency
- Both packages build successfully in isolation
- All tests pass with updated import paths
- `package.json` exports and bin fields correctly reference new package structure
