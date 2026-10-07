# S14-E4 — Provider & Daemon Status Validation

> Sprint 14 | Priority: P1 | Critical path: no | Plan: `S14-overview.md`

## Goal

Pin the operator surface of `aer status` (daemon up/down × provider up/down) at the process level, with deterministic provider reachability control so CI never needs a live Ollama.

## Why this matters

`probeOllamaReachability` (2s cap) and `formatProviderStatus` are unit-tested with a mocked `fetch`, but nothing validates the real `aer status` process: daemon-down must print `Daemon running: No` + a provider line and exit 0 (the "Provider Unreachable / Daemon Not Running" matrix row), and `OLLAMA_BASE_URL` is a hard-coded constant, so "unreachable" can't be asserted deterministically in CI. `aer status` is the operator's first command in any workflow; its behavior is currently only verified at the unit level.

## Scope

- `AER_OLLAMA_BASE_URL` env override for the probe URL (default unchanged).
- Process-level status matrix test (3 rows).
- Daemon-down matrix rows for `workspace:grant`/`preview`/`apply`.

## Out of scope

- New providers, provider config commands, JSON status output, health endpoints.
- Changing the probe timeout (2s) or the status output format.

## Dependencies

E1.1 harness (E4.2, E4.3); E4.1 is independent.

## Risks / Assumptions

- Ephemeral `http.createServer` on 127.0.0.1 port 0 inside the test: assume no network restrictions on localhost in CI; the server must be closed in `afterAll`.
- Assume the probe uses global `fetch` (Node 18+); if it switches to an injected client, E4.1's override path must stay functional.
- Windows: port-0 ephemeral allocation and `127.0.0.1:9` (discard port) both work; assume so.

## Acceptance criteria

- `AER_OLLAMA_BASE_URL` unset → probe targets `http://localhost:11434` (unit-pinned; default behavior unchanged).
- `AER_OLLAMA_BASE_URL=http://127.0.0.1:9` → `aer status` prints `Ollama provider: unreachable (http://127.0.0.1:9)` within the 2s cap.
- All 3 status matrix rows green without a live Ollama; each uses `assertNoObjectLeak`.
- Daemon-down `workspace:grant`/`preview`/`apply` → exit 1 + `Daemon is not running. Start it first.`

## Proposed tasks

### S14-E4.1 — Deterministic probe-URL override (XS)

- `packages/cli/src/index.ts`: `OLLAMA_BASE_URL` (line 112) → `process.env.AER_OLLAMA_BASE_URL ?? "http://localhost:11434"`. Default behavior unchanged; no new CLI flag.

**Verify:** `status-provider-state.test.ts` updated to assert the default when the env var is unset; `npm test` green.

### S14-E4.2 — Status matrix process test (M)

New `packages/cli/src/__tests__/status-cli-matrix.test.ts`, using the E1 harness and per-case env:

1. Daemon down + provider unreachable (env → closed port) → exit 0, stdout contains `Daemon running: No` and `Ollama provider: unreachable`.
2. Daemon down + provider reachable: start an ephemeral `http.createServer` on 127.0.0.1 port 0 in-test, point `AER_OLLAMA_BASE_URL` at it → stdout contains `Ollama provider: reachable`.
3. Daemon up: `ensureDaemonUp()` → `aer status` → exit 0, `Daemon running: Yes`; teardown `ensureDaemonDown()`.

**Verify:** all 3 rows green; each with `assertNoObjectLeak`; no live Ollama required.

### S14-E4.3 — Daemon-down matrix rows for workspace commands (S)

- With the daemon down, `workspace:grant`, `workspace:preview`, `workspace:apply` each → **exit 1** + `Daemon is not running. Start it first.` (current behavior, now pinned as a regression).
- `assertNoObjectLeak` on each.

**Verify:** rows green; matches the "Daemon Not Running" row of the 014 README §1 matrix.

## Suggested implementation order

E4.1 → E4.2; E4.3 parallel with E4.2.

## Test strategy / Validation approach

- Process-level, no live Ollama: reachability is controlled solely by the env override (closed port = down; ephemeral server = up).
- Bounded: 2s probe cap (existing) + harness hard-kill + vitest 30s budget.
- These rows close 014 README §4 target #2 (daemon-down behavior) and #4 (provider-unreachable status).

## Evidence from the repo

| Claim | Location |
|---|---|
| Hard-coded provider URL | `packages/cli/src/index.ts:112` |
| Probe (2s cap) + formatter + status usage | `index.ts:123–159` (probe 123, formatter 140, status 172) |
| Existing unit test (mocked `fetch`) | `packages/cli/src/__tests__/status-provider-state.test.ts` |
| Daemon-down convention (stderr + exit 1) | `index.ts:352, 368, 387, 431, 463, 481` |
| Matrix rows: provider unreachable, daemon down | `.ai/backlogs/014_sprint/README.md` §1 |

## Notes for implementation

- Keep `formatProviderStatus` pure — the env override happens at the constant, not inside the formatter.
- The ephemeral-server test must close the server in `afterAll` to avoid port leaks between runs.
