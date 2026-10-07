# S14-E2.2 — Exit-Code Contract

> Sprint 14 | Epic: [S14-E2 — Error Contract & Exit-Code Hardening](../S14-E2-error-contract-and-exit-codes.md) | Priority: P0 | Critical path: yes
> Effort: S
> Note: the one intentional behavior change in this sprint — `config:list` and `workflows:*` daemon-down paths move from stdout/exit 0 to stderr/exit 1. Call it out in the commit message and the S14-E6 runbook.

## Objective

Make the CLI failure exit-code contract consistent: `config:list` failure and `workflows:list` / `workflows:start` daemon-down must fail with exit code 1 and print the message to **stderr**, matching the existing `workspace:list` convention (stderr + `process.exitCode = 1`).

## Implementation details

- `config:list` (`packages/cli/src/index.ts`, command at line 201):
  - daemon-down branch (line 205, currently `console.log('Daemon is not running. Start it first.')` then `return`) → set `process.exitCode = 1`.
  - fetch-failed branch (line 217, currently `console.log('Failed to retrieve configuration.')`) → set `process.exitCode = 1`.
  - (Assumption / for full parity: the IPC `catch` at line 220 also lacks an exit code. The Epic 2 source scopes S14-E2.2 to the two failure branches above, and S14-E2.1 re-routes that catch's message. Setting it to exit 1 as well is consistent but is not explicitly required by the source — flag in review.)
- `workflows:list` (`packages/cli/src/index.ts`, command at line 178) and `workflows:start` (command at line 189):
  - daemon-down message (line 182 and line 194 respectively, currently `console.log('Daemon is not running. Start it first.')`) → move to **stderr** via `console.error(...)` and set `process.exitCode = 1`, for parity with `workspace:list` (line 352).
- Do not change the success-path stdout of these commands.

## Target files / modules

- `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts` — `config:list` (line 201), `workflows:list` (line 178), `workflows:start` (line 189)
- Reference (do not modify): `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts:352` — `workspace:list` exit-1/stderr convention to match

## Dependencies

S14-E2.1 (per the epic, S14-E2.2 depends on S14-E2.1).

## Expected outcome

- `config:list` failure (daemon-down and fetch-failed) → exit 1.
- `workflows:list` / `workflows:start` daemon-down → stderr `Daemon is not running. Start it first.` + exit 1.

## Acceptance criteria

- `config:list` failure (daemon-down and fetch-failed) → exit 1.
- `workflows:list` / `workflows:start` daemon-down → stderr `Daemon is not running. Start it first.` + exit 1 (parity with `workspace:list`, line 352).
- The intentional behavior change is called out in the commit message and the S14-E6 runbook.
- `npm run build` is clean.

## Verification command

`npm run build && npm test` — build clean; existing suite (incl. `status-provider-state.test.ts`) still green. Manual spot-check with the daemon stopped: run `config:list` and `workflows:list`, observe the message on **stderr** and a non-zero (1) exit code (`echo $?` in bash / `$LASTEXITCODE` in PowerShell). (Process-level spawn assertions for these rows land in S14-E3 / S14-E5.)

## Effort estimate

S
