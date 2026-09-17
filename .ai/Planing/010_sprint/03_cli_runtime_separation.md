# 03 — CLI / Runtime Separation

## Objective
Split the CLI and Runtime into separate distributable units so the Runtime can be packaged, versioned, and deployed independently of the CLI.

## Why
The CLI and Runtime are currently bundled in a single npm package (`@aer/runtime`). The Runtime class, factory, all subsystems (EventBus, Workspace, Knowledge, Metrics, Scheduler), and the CLI bin entry point are exported from the same entry point. This coupling means:
- You cannot install the Runtime without pulling in the CLI
- You cannot version the Runtime independently of CLI changes
- The daemon process (Task 01) needs a clean Runtime dependency without CLI baggage
- Distribution targets differ: Runtime may need to ship as a library or service, CLI as a binary

## Components Involved
- `@aer/runtime` package (current monolithic package)
- `src/core/runtime.ts` — Runtime class
- `src/cli/index.ts` — CLI entry point
- All subsystems exported from the main package
- `package.json` — current bin, exports, and entry configuration

## Files Likely to Change
- `package.json` — Split into two packages or add separate entry points
- `src/core/runtime.ts` — Move to Runtime-only package
- `src/cli/index.ts` — Import Runtime as a dependency instead of sibling module
- All subsystem modules (EventBus, Workspace, Knowledge, Metrics, Scheduler, Logging)
- New file: `packages/runtime/package.json` (or equivalent structure)
- New file: `packages/cli/package.json` (or equivalent structure)
- Build configuration (tsconfig, bundler config) for multi-package setup

## Dependencies
- None inherently (this task is independent), but coordination with Task 01 and Task 02 is required to avoid duplicate refactoring of import paths

## Risks
- Monorepo setup adds complexity (workspaces, internal dependencies, build order)
- Import path changes across the entire codebase
- Existing tests may reference old module paths
- Circular dependency risks when splitting tightly coupled subsystems
- Publishing strategy changes (two packages to maintain vs one)

## Acceptance Criteria
- [ ] A standalone Runtime package exists that contains only Runtime + subsystems (no CLI code)
- [ ] A standalone CLI package exists that depends on the Runtime package
- [ ] Both packages can be built independently
- [ ] No CLI code is importable from the Runtime package
- [ ] No Runtime-only code is bundled into the CLI package distribution
- [ ] All existing functionality works with the new package structure

## Definition of Done
- Two distinct npm packages (or workspace entries) exist: one for Runtime, one for CLI
- The Runtime package has no dependency on the CLI
- The CLI package imports the Runtime as a dependency
- Both packages build successfully in isolation
- All tests pass with updated import paths
- `package.json` exports and bin fields correctly reference new package structure
