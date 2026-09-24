# Atomized Tasks — Epic 2: Provider status

> Source story: [02_provider-status.md](02_provider-status.md)
> Sprint: 13 (CLI reliability)
> Constraint: surface provider reachability on the CLI surface only; no daemon IPC change, no new provider backend.

## Atomized Tasks: US-03 — `aer status` reports provider state

### Task 5: Add a bounded Ollama reachability probe to the CLI
- **Action:** Add a small helper that probes `http://localhost:11434` with a bounded timeout (so a down/slow Ollama cannot hang the CLI). Reuse the repo's existing provider base-URL default where available, otherwise define the host/port locally in the CLI. The helper returns a reachable / unreachable result and never throws for a probe failure.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts` (or a small shared util imported by it); reference `c:\Proyects\MultiAgentDev\packages\runtime\src\providers\ollama-provider.ts` (default base URL at `:160`) only to confirm the `http://localhost:11434` default.
- **Verification:** The probe resolves within a bounded time for both reachable and unreachable targets; it never rejects on probe failure; `npm run build` stays green.

### Task 6: Render the provider-state line in `aer status`
- **Action:** In the `status` command action, after the existing `Daemon running` / `Runtime state` output, call the probe and print a deterministic Ollama provider line (reachable / unreachable at `http://localhost:11434`). Keep the daemon-not-running path clean (still prints `Daemon running: No` and exits normally).
- **Target File/Location:** `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts` (the `status` action, currently lines 98–120).
- **Verification:** With the daemon running, output contains `Daemon running: Yes`, `Runtime state: <state>`, and a new `Ollama provider: … (http://localhost:11434)` line; with the daemon down, output still starts with `Daemon running: No` and the command exits cleanly.

## Atomized Tasks: US-04 — The provider-state line is regression-protected

### Task 7: Add a test for the provider-state line
- **Action:** Add a test under `packages/cli/src/__tests__/` that asserts the status output contains an Ollama provider line with `localhost:11434` for both the reachable and unreachable branches. Mock the reachability probe (do not depend on a live Ollama) so the suite is green in CI and on machines without Ollama.
- **Target File/Location:** new file `c:\Proyects\MultiAgentDev\packages\cli\src\__tests__\status-provider-state.test.ts`; import the probe helper from `c:\Proyects\MultiAgentDev\packages\cli\src\index.ts` if extracted.
- **Verification:** The test passes under `vitest`; `npm test` exits 0; the test does not require a live Ollama or a running daemon.

### Task 8: Verify build and full CLI suite are green
- **Action:** Run the monorepo build and test suite to confirm the status change compiles and does not regress any existing test.
- **Target File/Location:** repository root (`npm run build`, `npm test`).
- **Verification:** `npm run build` exits 0; `npm test` exits 0 (no failing or skipped tests); `aer status` daemon-down behavior is unchanged from before.

## Final review

- [ ] `aer status` (daemon running) prints an Ollama provider line with `http://localhost:11434`.
- [ ] The probe is bounded and never hangs the CLI.
- [ ] A test covers both provider states without a live Ollama.
- [ ] `npm run build` and `npm test` are green.
