# Objective

Convert the validation findings between the **Design 04 (Persistent State Store)** contract and its current implementation into a structured, pass/fail gap-analysis document. Design 04 (`.ai/Design/010_sprint/04_persistent_state_store.md`) is the authoritative contract; the implemented code in `packages/runtime/src/persistence/` (`pid-manager.ts`, `state-store.ts`, `health-check.ts`), `packages/runtime/src/core/runtime.ts`, and `packages/cli/src/` (`index.ts`, `daemon.ts`, `daemon-entry.ts`) is the subject under evaluation. The seven action plans `04_01`…`04_07` (in this folder) define the work package; this document records compliance against each action and against the Design's Acceptance Criteria / Definition of Done.

No source code is changed by this document.

# Current State

The persistent-state-store work package was delivered across commits `84bb687` (state store + PID management + health check), `0d357a0` (`getSnapshot()` on Runtime), `9e68d8c` (health-check API exposed), and `026f9e4` (daemon PID refactor onto runtime-lib). It is functionally present and largely compliant against Design 04.

**Implemented and verified compliant:**

- **PID manager** (`packages/runtime/src/persistence/pid-manager.ts`): consolidated, single-source-of-truth module exporting `getPidFilePath`, `writePidFile`, `readPidFile`, `removePidFile`, `isPidAlive`, `isStale`, `validatePid`, `cleanupStale`. `writePidFile` uses atomic temp-file + `fs.renameSync`; temp path is per-process (`<path>.tmp.${process.pid}`) to avoid cross-writer collision.
- **State store** (`packages/runtime/src/persistence/state-store.ts`): `SNAPSHOT_SCHEMA_VERSION = 1`; `RuntimeStateSnapshot` interface with all required fields; atomic `writeSnapshot` (serialize → `<path>.tmp` → rename); `readSnapshot` never throws (returns `null` on missing/corrupt/shape-mismatch) and additionally cleans up an orphan `.tmp`; `removeSnapshot` (idempotent); `getLastHeartbeat`.
- **Runtime snapshot helper** (`packages/runtime/src/core/runtime.ts`, `getSnapshot()`): pure in-memory projection composing `getHealth()` + `getState()` + `getMetricsCollector().getSummary()` into a JSON-safe shape; imports the snapshot type via `import type` and the schema-version constant via a runtime import, avoiding a value-level cycle.
- **Health check** (`packages/runtime/src/persistence/health-check.ts`): offline `checkHealth()` implementing the full decision matrix (no PID + no snapshot → unknown; PID alive → up; PID dead → down + stalePidFile; snapshot-but-no-PID → down). Never throws; all I/O in try/catch → unknown with reason. Imports only read/probe functions from `./pid-manager.js` and `readSnapshot` from `./state-store.js`; no `@aer/cli` import.
- **Daemon lifecycle** (`packages/cli/src/daemon-entry.ts`): on start → `cleanupStale()` → `writePidFile(process.pid)` → initial `writeSnapshot(runtime.getSnapshot())`; heartbeat timer (`AER_STATE_HEARTBEAT_MS`, default 5 000 ms) re-writes the snapshot; clean shutdown (`shutdown()`, idempotent via `shutdownExecuted` guard) → clear heartbeat → final snapshot → `removePidFile()` → `removeSnapshot()`; fatal path → best-effort `state:"error"` snapshot + `removePidFile()`. `packages/cli/src/daemon.ts` imports the canonical PID functions from `@aer/runtime-lib` (the duplicated inline PID logic is gone).
- **Barrel exposure** (`packages/runtime/src/index.ts`): the full persistence surface — `PidManager` functions, `StateStore` functions + `RuntimeStateSnapshot` type, `checkHealth` + `HealthStatus`/`HealthCheckResult` types — is re-exported with `.js` specifiers, making it importable from `@aer/runtime-lib` without pulling CLI code.
- **Test suite** (`packages/runtime/src/persistence/__tests__/`): three files — `pid-manager.test.ts`, `state-store.test.ts`, `health-check.test.ts`. Every test uses an isolated `os.tmpdir()` subdir (parallel-safe, cleaned in afterEach). Coverage: PID write→read round-trip; `isPidAlive` (live/bogus/≤0); `isStale`/`cleanupStale` on dead vs live pid; `readPidFile` missing → -1; `validatePid` bounds (rejects ≤0 and ≥ 2²²); snapshot write→read deep-equal; atomic-write crash simulation (only `.tmp` present → `readSnapshot` returns `null`, no throw, cleans `.tmp`); corrupt/garbage file → `null`; shape-mismatch → `null`; `removeSnapshot` idempotent; `getLastHeartbeat`; all health branches (unknown/up/down/stalePidFile/snapshot-present/invalid-PID); `checkHealth` never-throws umbrella.

**Design 04 Acceptance Criteria — pass status:**

| #  | Criterion | Status |
|----|-----------|--------|
| AC1 | PID file written on daemon start, cleaned up on graceful shutdown | Pass |
| AC2 | CLI can determine if the daemon is running via PID file + process existence | Pass |
| AC3 | Runtime status persisted and queryable without a live IPC connection | **Partial** — module is queryable offline; the CLI `status` command does not consume it |
| AC4 | Health check returns accurate up/down state | Pass |
| AC5 | Stale PID files from crashes detected and handled automatically | Pass |
| AC6 | State updates use atomic operations to prevent corruption | Pass |

**Design 04 Definition of Done — gaps:** DoD item *"CLI `status` command works by reading persistent state (not in-memory objects)"* — only the first half is satisfied. There is no `globalRuntime` / in-memory read remaining (the CLI was already rewired to IPC in the Design-03 work), but the **complementary requirement — that `status` read the persistent snapshot as a fallback when the daemon is offline** — was not implemented (see 04_05). DoD *"Unit tests cover PID lifecycle, race conditions, and crash scenarios"* — Pass (PID lifecycle + crash/corrupt scenarios covered; "race conditions" covered structurally via per-process temp-file naming rather than by a concurrent-writer test).

# Per-Action Findings (04_01 → 04_07)

| Action | Status | Reason | Evidence |
|--------|--------|--------|----------|
| **04_01** PID manager module | **Pass** | All 8 functions exported; atomic write; dedup source established; re-exported from barrel. Duplicated inline PID logic removed in 04_06. | `pid-manager.ts` (full); barrel re-exports at `packages/runtime/src/index.ts` |
| **04_02** State store module | **Pass** | `SNAPSHOT_SCHEMA_VERSION = 1`; atomic `writeSnapshot`; `readSnapshot` field-validates + never throws; orphan `.tmp` cleanup; no `@aer/cli` import. | `state-store.ts` (full) |
| **04_03** Runtime snapshot helper | **Pass** | `getSnapshot()` is a pure in-memory projection; `import type` + constant-only runtime import avoids a value cycle; output is JSON-safe (ISO timestamps, plain objects). | `runtime.ts` `getSnapshot()` (~L412) |
| **04_04** Health check module | **Pass** | Full decision matrix; never throws; offline only (files + `process.kill(pid,0)`); no `@aer/cli` import. Down-vs-unknown distinction implemented as specified. | `health-check.ts` (full) |
| **04_05** Rewire CLI status | **Fail** | `status` handler is still the old IPC-only path: `isRunning()` then `client.call(IPCCommand.RuntimeStatus)`. It never calls `checkHealth()` / `readSnapshot()`. When the daemon is down it prints only `Daemon running: No` with no snapshot and no down/unknown reasoning. | `packages/cli/src/index.ts` status handler (L79-98) |
| **04_06** Wire daemon lifecycle | **Pass** | start/heartbeat/stop/fatal all wired; `removeSnapshot()` on clean shutdown (→ later status = unknown, not stale "stopped"); error snapshot survives a crash; `daemon.ts` uses `PidManager` imports (dedup complete). | `daemon-entry.ts` (full); `daemon.ts` (full) |
| **04_07** Test suite | **Pass** | Three test files, isolated temp dirs, cover round-trips, stale, atomic-crash sim, corrupt/shape-mismatch, all health branches, never-throws. (Optional hermetic daemon-integration test described in 04_07 was not added — minor.) | `packages/runtime/src/persistence/__tests__/*.test.ts` |

# Remaining Work

## Task 1 — Rewire CLI `status` to consume persistent state (implements 04_05)

- **Why it is needed:** AC3 and the DoD item "CLI `status` command works by reading persistent state." The current `status` handler (`packages/cli/src/index.ts` L79-98) is the pre-04_05 IPC-only path. It calls `isRunning()` and, only if that is true, `client.call(IPCCommand.RuntimeStatus)`. When the daemon is down it prints the bare line `Daemon running: No` and returns, discarding the on-disk snapshot that 04_02/04_04 went to some length to produce. This is exactly the offline-visibility gap 04_05 was scoped to close — the action's stated objective is "make CLI `status` read from the persistent state layer (via `checkHealth()`) … so status shows last-known state even when the daemon is offline." The module exists and is exported from `@aer/runtime-lib`; it is simply not called.
- **Expected outcome:** The `status` handler imports `checkHealth` from `@aer/runtime-lib` and calls it first (offline). Behavior per 04_05: `up` → additionally attempt IPC `RuntimeStatus` to enrich with live state (keep the existing rich path); `down` → surface `stalePidFile` and the last persisted snapshot (state, capturedAt, uptimeSeconds); `unknown` → report "never started or cleaned up." The `checkHealth()` call is wrapped in try/catch so the CLI never crashes. Persistent state is a **fallback**, not a replacement for live data — only the `status` command changes.
- **Components involved:** `packages/cli/src/index.ts` (status handler, L79-98); `@aer/runtime-lib` (`checkHealth`, already exported).
- **Dependencies:** None. 04_04 (`checkHealth`) is already complete and exported.
- **Estimated complexity:** Low.

## Task 2 — Minor cleanups (optional, non-blocking)

- **Redundant PID write:** `daemon.ts#startDaemon` writes the spawned child PID (`writePidFile(daemonProcess.pid)`, L47) and the child then re-writes the same value in `daemon-entry.ts` (L149). The second write is harmless but redundant; collapse to a single owner if the supervisor is expected to outlive the write.
- **`shutdownExecuted` declaration order:** the idempotency flag is declared with `let` *after* the `shutdown` function that reads it (`daemon-entry.ts`). It works today because the read happens at call time, but it is fragile; hoist the declaration above the function.
- **Hermetic daemon-integration test:** 04_07 describes an optional integration-style test for the 04_06 daemon write path (no real daemon spawn). Not added; desirable for regression protection of the lifecycle wiring.
- **Components involved:** `packages/cli/src/daemon.ts`, `packages/cli/src/daemon-entry.ts`, optionally a new test under `packages/runtime/src/persistence/__tests__/`.
- **Dependencies:** None.
- **Estimated complexity:** Low.

# Recommended Implementation Order

1. **Task 1** — Rewire CLI `status` (the one substantive gap; closes AC3 / the outstanding DoD item).
2. **Task 2** — Minor cleanups (optional; can follow at any time).

# Acceptance Criteria

Each criterion maps to Design 04 and is phrased to be measurable.

- [x] **AC1 — PID lifecycle:** A PID file is written when the daemon starts and cleaned up on graceful shutdown.
- [x] **AC2 — Liveness detection:** The CLI can determine if the daemon is running by checking the PID file plus process existence.
- [ ] **AC3 — Offline queryability:** Runtime status information is persisted and queryable without a live IPC connection — by external scripts (Pass) **and** by the CLI `status` command as an offline fallback (Fail; see Task 1).
- [x] **AC4 — Health check accuracy:** The health-check mechanism returns accurate up/down state.
- [x] **AC5 — Stale PID handling:** Stale PID files from crashes are detected and handled automatically (`cleanupStale()` on daemon start).
- [x] **AC6 — Atomic writes:** State updates use atomic operations (temp-file + rename) to prevent corruption.

# Definition of Done

- [x] A PID file exists at a known location when the daemon is running.
- [ ] The CLI `status` command works by reading persistent state (not in-memory objects). *Partially: no in-memory read remains, but the offline-snapshot fallback is not wired — see Task 1.*
- [x] External scripts can query Runtime health without using the CLI (`checkHealth` exported from `@aer/runtime-lib`).
- [x] Orphaned PID files are cleaned up automatically on next start (`cleanupStale()`).
- [x] Unit tests cover PID lifecycle, race conditions, and crash scenarios (per-process temp naming for the race structurally; crash/corrupt scenarios by test).
- [ ] Manual test: start daemon → verify PID file → kill process forcefully → verify orphan detection → restart daemon. *(Not exercised in this audit; structural support is present via `cleanupStale()` + stale detection.)*

# Risks

Architectural risks only.

- **Snapshot is the offline fallback, not a live view:** Persisted state can lag real-time Runtime state (bounded by `AER_STATE_HEARTBEAT_MS`). Any consumer (CLI `status` after Task 1, external scripts) must treat `capturedAt` age as a freshness signal, not assume currency.
- **`getSnapshot()` health projection vs periodic health check diverge:** `getSnapshot()` calls `getHealth()` (which probes all five subsystem flags), while the Runtime's own periodic `performHealthCheck()` probes a smaller subset (EventBus + Workspace only). Snapshots may therefore report a different component-health picture than the daemon's internal checker.
- **`process.kill(pid, 0)` liveness probe is best-effort cross-platform:** On Windows it does not signal in the POSIX sense; PID reuse by the OS can make a dead-but-recycled PID appear alive. `validatePid` bounds the value but cannot prevent reuse.
- **Single `.daemon` directory shared by PID + state:** Both modules resolve to `<repo>/.daemon` by default (overridable via `AER_DAEMON_PID_DIR` / `AER_STATE_DIR`). The two env overrides are independent, so misconfiguration can split the files and make `checkHealth()`'s decision matrix give misleading results.
- **Clean-shutdown removes the snapshot by design:** A graceful stop leaves no snapshot, so a later `status` reports "unknown" (intended). The fatal path, by contrast, leaves an `state:"error"` snapshot for post-mortem. The asymmetry is deliberate but must be understood by consumers.

# Out of Scope

- Rewriting or altering the Design 04 document or the `04_0x` action plans.
- Re-running or updating the Task 01 (daemon) or Task 02 (IPC) validation reports.
- IPC-layer concerns (concurrency, cross-platform transport, event push) — owned by the Design-02 / `02_ipc_remaining_work.md` work package.
- Crash-recovery / auto-restart logic — owned by Design 05 (`05_process_lifecycle_management.md`).
- Authentication, authorization, or encryption of any channel.
- Performance, load, or stress testing.
- Any source-code implementation. This is a validation/gap-analysis document for a separate implementing model.
