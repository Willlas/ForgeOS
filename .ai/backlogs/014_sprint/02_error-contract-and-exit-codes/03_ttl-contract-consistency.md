# S14-E2.3 — TTL Contract Consistency

> Sprint 14 | Epic: [S14-E2 — Error Contract & Exit-Code Hardening](../S14-E2-error-contract-and-exit-codes.md) | Priority: P0 | Critical path: yes
> Effort: S
> Note: the runtime is the source of truth for approval TTL (default 300s, cap 3600s). The CLI `--ttl` **default of 60s is NOT changed** — only the help text is fixed.

## Objective

Make the runtime the single source of truth for the workspace-approval TTL values by exporting both constants, and fix the CLI `--ttl` help text to state default 60s / cap 3600s with the cap value derived from the exported constant — without changing the CLI default of 60s.

## Implementation details

- Runtime (`packages/runtime/src/core/runtime.ts:171-172`): the two constants are currently `private static readonly`:
  - `WORKSPACE_APPROVAL_DEFAULT_TTL_SECONDS = 300`
  - `WORKSPACE_APPROVAL_MAX_TTL_SECONDS = 3600`
  Export both from the runtime package (`@aer/runtime-lib`) so the CLI can derive its help-text cap from a single source of truth.
  (Assumption: the `Runtime` class is already exported from `packages/runtime/src/index.ts:187`; the simplest route is to make these two `static readonly` members public and/or add named re-exports in `packages/runtime/src/index.ts`. The clamp at `runtime.ts:503-505` continues to use them — behavior unchanged.)
- CLI (`packages/cli/src/index.ts:558`): the `workspace:approve` `--ttl` option currently reads
  `.option('-t, --ttl <seconds>', 'Approval TTL in seconds (capped at 300)', '60')`.
  Fix the help text so it states **default 60s** and **cap 3600s**, with the cap (3600) derived from the exported `WORKSPACE_APPROVAL_MAX_TTL_SECONDS` (e.g. template it in). Keep the CLI default at `60`.
  (Note: the CLI default `60` is distinct from the runtime default `300`; only the cap is sourced from the runtime constant. The exact templating is an implementation detail.)

## Target files / modules

- `c:\Proyects\MultiAgentDev\packages\runtime\src\core\runtime.ts` — constants at lines 171-172; clamp at 503-505 (unchanged)
- `c:\Proyects\MultiAgentDev\packages\runtime\src\index.ts` — `@aer/runtime-lib` export surface (Runtime at line 187)
- `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts` — `--ttl` option help text (line 558)

## Dependencies

None — independent of S14-E2.1 / S14-E2.2 / S14-E2.4; can run in parallel.

## Expected outcome

`aer workspace:approve --help` shows default 60s / cap 3600s, with the cap coming from the exported runtime constant; the CLI default remains 60s.

## Acceptance criteria

- `aer workspace:approve --help` shows default 60s / cap 3600s, with the cap derived from the exported runtime constant.
- Both the default (300s) and cap (3600s) constants are exported from `@aer/runtime-lib`.
- The CLI `--ttl` default is still `60` (behavioral change is out of scope).
- `npm run build` is clean.

## Verification command

`npm run build` — clean; then print the help and confirm the TTL line, e.g. `node node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts workspace:approve --help` (or `npm run dev -- workspace:approve --help`) shows `default 60s / cap 3600s`.

## Effort estimate

S
