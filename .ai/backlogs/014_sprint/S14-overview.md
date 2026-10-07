# Sprint 14 — CLI Validation, Hardening & Regression Coverage

> Status: planned
> Goal: make the `grant → preview → approve → apply` CLI path verifiably safe by adding deterministic, process-level regression coverage — no new product features.

## Executive summary

Sprint 13 delivered a working `grant → preview → approve → apply` flow and error-propagation cleanup, but its safety-critical semantics (single-use `approvalId`, TTL clamp, session/rootPath/diffHash binding) currently have **zero** test coverage, and the CLI still leaks `[object Object]` on some failure paths (`index.ts:75,89`).

Sprint 14 closes that gap with six tightly-scoped epics that:

1. Provide a shared, timeout-capped CLI test **harness** (E1) so every later matrix row is deterministic and non-hanging.
2. Standardize the **error contract and exit codes** across all failure paths (E2).
3. Prove the **approval-lifecycle** invariants at both the runtime and CLI layers (E3) — including the headline "duplicate `approvalId`" regression.
4. Pin **provider/daemon status** behavior at the process level with deterministic reachability control (E4).
5. Bundle the operator **smoke path** into one reproducible command, `npm run smoke:cli` (E5).
6. Promote the draft operator test plan into a permanent, executable **runbook** and update repo docs (E6).

**Critical path:** E1 → E2 → E3. E4 and E5 are parallelizable once E1 lands. E6 is last (docs describe verified behavior only).

## Scope

In scope:
- CLI validation-matrix coverage (happy path, daemon-down, duplicate `approvalId`, read-only misuse, provider-unreachable, malformed args).
- Deterministic error handling, stderr messages, and exit-code consistency.
- Approval-lifecycle enforcement (TTL, single-use, binding) proven by tests.
- Provider/daemon status validation with no live Ollama dependency.
- One reproducible operator smoke command.
- Operator-facing docs/runbook + repo-state updates.

Out of scope (hard boundary):
- New product features, new commands, new provider backends.
- GUI / VS Code work, CI pipeline infrastructure, IPC protocol changes.
- Changing the CLI `--ttl` default (60s) or the approval algorithm/record shape.

## Prioritized epic list

| # | Epic | File | Priority | Critical path | Deps |
|---|------|------|----------|---------------|------|
| S14-E1 | CLI validation matrix & test foundations | `S14-E1-cli-validation-matrix.md` | P0 | yes | — |
| S14-E2 | Error contract & exit codes | `S14-E2-error-contract-and-exit-codes.md` | P0 | yes | — |
| S14-E3 | Approval-lifecycle enforcement | `S14-E3-approval-lifecycle.md` | P0 | yes | E1 (CLI tasks) |
| S14-E4 | Provider & daemon status | `S14-E4-provider-and-daemon-status.md` | P1 | no | E1 |
| S14-E5 | Operator smoke automation | `S14-E5-operator-smoke-automation.md` | P1 | no | E1, E2, E3, E4 |
| S14-E6 | Docs & operator runbook | `S14-E6-docs-and-runbook.md` | P2 | no | E2, E3, E4, E5 |

## Dependency map

```
                 E1.1 harness ─────────────┬──────────────────────┐
                 E1.2 vitest timeout       │                      │
                                          ▼                      │
   E2.1 describeFailure ─ E2.2 exit codes │                      │
                    └── E2.4 helper tests │                      │
   E2.3 TTL constants (independent)       │                      │
                                          ▼                      ▼
                  E3.1 runtime suite ─ E3.2 CLI approval ─ E3.3 read-only misuse
                  E4.1 probe URL   ─ E4.2 status matrix ─ E4.3 daemon-down rows
                  E5.1 malformed   ─ E5.2 serialization guard ─ E5.3 smoke:cli
                                                              └──────────► E6.1 runbook ─ E6.2 repo docs
```

## High-level implementation order

1. **E1** (E1.1 ∥ E1.2) — foundation; unblocks every process-level test.
2. **E2** (E2.1 → {E2.2, E2.4}; E2.3 parallel) — stabilize stderr/exit codes before tests pin them.
3. **E3** (E3.1 ∥ E3.2 → E3.3) — semantic core; duplicate-`approvalId` is the headline proof.
4. **E4 + E5.1 + E5.2** in parallel — all build on E1/E2 — then **E5.3** wires the smoke script.
5. **E6** — docs last, describing only verified behavior.

## Sprint exit criteria

- Every row of `.ai/backlogs/014_sprint/README.md` §1 is either a green automated test or a documented manual checklist item in `docs/cli-operator-test-plan.md`.
- `npm run build` clean; `npm test` green (all pre-sprint tests still pass).
- `npm run smoke:cli` exits 0 on a clean machine, bounded time, no live Ollama required.
- No new product scope introduced beyond the verified CLI path.
