# Security Audit — Sprint 011 External Workspace Tool Access

**Branch:** `feature/main_implementation_core_cli_gui`
**Date:** 2026-09-02
**Auditor:** Automated (Cline) — read-only review, executable + CLI smoke tests
**Threat model:** Local CLI clients (agents/operators) sharing a single long-running `aer` daemon over a local IPC transport. Goal: two clients with different sessions must not cross-read each other's grants or results, and access must be deny-by-default.

---

## Verdict: **PARTIAL (conditional pass)**

| Acceptance criterion | Result |
|---|---|
| Is access denied without an explicit grant? | ✅ at the **daemon/IPC contract** (proven by raw IPC), ❌ at the **CLI surface** (CLI self-grants first) |
| Are reads confined to the granted canonical root? | ✅ Path traversal & symlink-escape denied |
| Are commands allowlisted and bounded? | ✅ `execute` is allowlisted + confirmed; read-only grants cannot execute |
| Are mutations approved, hashed and recoverable? | ⚠️ `apply` is gated behind an approval token, but is **not exposed** as its own IPC/CLI command |
| Are IPC sessions isolated and audited? | ⚠️ Grants are session-scoped (isolation holds), but **sessionId is self-asserted** and the transport is **single-connection** |

**Bottom line:** The daemon **does** enforce per-session grants and two CLI sessions **cannot read each other's grant list** — this was verified live. However, the CLI **automatically self-issues a read-only grant for whatever root the user names** before every `read`/`list`/`search`, so "no grant = no access" is **not meaningfully enforced from the CLI**. The authorization model is **self-service** (the client is its own grantor) rather than daemon-authorized. See **F-01 (HIGH)**.

---

## Scope & Method

**Read-only review.** No permissions were granted to, or modifications made on, the external inspection target. All grants used during testing were in-memory and **cleared by stopping the daemon** at the end.

**Targets read (code):**
- `packages/runtime/src/session-grant-manager.ts`
- `packages/runtime/src/workspace-tools.ts`
- `packages/runtime/src/core/runtime.ts`
- `packages/runtime/src/ipc-protocol.ts`, `ipc-transport.ts`, `ipc-server.ts`
- `packages/cli/src/index.ts`, `ipc-client.ts`, `daemon-entry.ts`

**Evidence gathered (all on this machine, `C:\Proyects\MultiAgentDev`):**
1. `npm run build` (`tsc --build`) → **clean, 0 errors**.
2. `npm test` → **26 files, 388 tests, all passing**.
3. CLI smoke tests against the read-only inspection target `C:\Proyects\DCExtractorX` (`README.md`):
   - **Session A** (`AER_SESSION_ID=sess_a`): `workspace:grant` (read-only) → `workspace:grants` (listed) → `workspace:read README.md` returned real content. ✅
   - **Session B** (`sess_b`): `workspace:grants` → `grants: []` (correct, no cross-list). But `workspace:read` / `list` / `search` **succeeded** and returned the same file data. ❌ (root cause = CLI self-grant, see F-01). Traversal read → **denied** ("Workspace path escapes the granted root"). ✅
   - **Fresh daemon + `sess_none`** (a session that registered **no** grant, `grants: []`): `workspace:read README.md` and `workspace:list` **both succeeded**. ❌ — confirms the CLI auto-grant defeats deny-by-default at the CLI layer.
   - **Raw IPC bypass** (connected directly as `rawtest_session`, **no grant**): `WorkspaceRead` → **DENIED** `No grants registered for session: rawtest_session`. ✅ — confirms the *daemon* enforces per-session grants.
   - **Concurrent test** (two clients connected simultaneously; `conc_a` granted, `conc_b` not): `conc_b` read → **DENIED** `No grants registered for session: conc_b`. ✅ — daemon-level session isolation holds under concurrency.
4. Daemon stopped, pid file removed, temp scripts deleted.

---

## Findings
