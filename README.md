# Aer Runtime

Aer is a modular runtime for autonomous engineering workflows, coordinating multiple agents and workers (multi-agent coordination is **experimental**) around a shared workspace with provider-backed execution (Ollama only, implemented and tested).

It is a TypeScript monorepo: `packages/runtime` contains the runtime core (agent/worker coordination — multi-agent is **experimental**, scheduler, dispatcher, provider layer, workflow engine — **experimental**), and `packages/cli` provides the `aer` CLI (grant → preview → approve → apply flow — **validated**) plus the `aer-daemon` process it communicates with over IPC.

The grant → preview → approve → apply flow for workspace operations is the validated core path, covered end-to-end by the test suite.

## Mission

Aer is a modular, provider-independent runtime that coordinates multiple agents and workers around a shared workspace (multi-agent coordination is **experimental** — see Maturity classification), so that developers can run autonomous engineering workflows with grant-controlled, auditable operations.
The `aer` CLI and `aer-daemon` are the runtime's execution surface; `prototype/` and `experiments/` are explorations, not product.
Aer is pre-MVP: the only validated path today is the CLI grant → preview → approve → apply flow.

## Current status

- **Status: pre-MVP** — the project is under active development and not yet at a minimum viable product
- Branch: `sprint12`
- Current focus: Sprint 12 — documentation alignment, product framing, and MVP definition
- Validated path (only verified workflow): grant → preview → approve → apply CLI flow

## MVP boundary

The MVP is deliberately narrow: the daemon-backed, CLI-driven workspace operations loop on top of the modular runtime.

**In scope**

- The `aer` CLI and `aer-daemon` over IPC as the sole operator surface (**validated**: the grant → preview → approve → apply loop)
- The grant → preview → approve → apply lifecycle with session-scoped grants and single-use approvals
- Grant-gated workspace tools (`list`, `read`, `search`, `execute`) backed by the runtime core (scheduler, dispatcher, workflow engine — **experimental**: implemented and tested, not a validated end-to-end path)
- The Ollama provider as the only implemented backend (**experimental**: implemented and tested, not part of the validated CLI flow), behind the provider-independent `IProvider` interface

**Intentionally out of scope**

- Additional provider backends (OpenAI, Anthropic) — interface types only, not implemented
- Multi-agent coordination as a validated end-to-end workflow — implemented and unit-tested, not yet a validated product path
- The VS Code extension and GUI — design-only work from Sprints 10–11, not MVP components

**Minimum value**

- A developer can start the daemon, register a session grant, and drive preview → approve → apply for workspace changes with an auditable trail; anything outside that loop is bonus, not MVP

## Maturity classification

For new contributors — what you can rely on, what is in flight, and what is still to be built:

Labels used throughout the docs: **validated** = the CLI grant → preview → approve → apply flow (the only verified product path, see `## Usage — validated CLI flow`); **experimental** = implemented and tested but not a validated end-to-end product path (includes the Stable tier); **planned** = designed or on the roadmap, not implemented.

- **Stable (implementation tier)** — runtime core, scheduler, dispatcher, execution runtime, single-agent runtime, provider abstraction, Ollama provider, `aer` CLI, `aer-daemon`. Implemented and covered by the test suite (**experimental** under the three-label scheme, except the CLI grant → preview → approve → apply loop, which is **validated** — the only product path that is).
- **Experimental (implemented, not yet validated)** — multi-agent coordination and the workflow engine (unit-tested, no validated end-to-end workflow), plus `prototype/`, `experiments/`, and the root `tests/` helper scripts (explorations, not product, not part of the pipeline).
- **Planned (designed or on the roadmap, not implemented)** — additional provider backends (OpenAI, Anthropic), the VS Code extension (Sprint 10), the GUI (Sprint 11).

Full, evidence-backed tables: `PROJECT_STATE.md` — `## Component Maturity Matrix` and `## Workstream Maturity Audit`.

## Project goals

- Build a provider-independent autonomous runtime
- Take multi-agent coordination from implemented to a validated end-to-end workflow
- Keep the `aer` CLI and daemon-backed workflow path simple and stable
- Keep the repository healthy, testable, and resumable by sprint

## Repository structure

- `packages/runtime/` — runtime engine, grants, workflow execution, session logic
- `packages/cli/` — command-line interface (`aer`), daemon process (`aer-daemon`) and IPC client
- `packages/.daemon/` — daemon runtime state (pid and state files)
- `.daemon/` — root-level daemon runtime state (pid file)
- `.ai/` — agent documentation and sprint backlogs
- `docs/` — roadmap, RFCs, ADRs and project records
- `templates/` — document templates (ADR, task, feature, experiment, research, commit)
- `tests/` — root-level verification scripts (DoD and health-check) — Experimental, not wired to the build/test pipeline
- `prototype/` — UI prototypes and examples — Experimental, not product
- `experiments/` — exploratory work and test fixtures — Experimental, not product
- `dist/` — build output
- `logs/` — runtime logs
- `.tmp/` — temporary scratch files
- `.vscode/` — VS Code editor configuration
- `.zcode/` — ZCode editor configuration

## Next milestone

Sprint 12 (documentation alignment and product framing) ends when:

- README, PROJECT_STATE and ROADMAP are consistent with the active branch
- A short, honest mission statement and an explicit, narrow MVP boundary exist
- Stable, experimental and planned work are clearly classified
- The next milestone is scoped with objective, scope, and exit criteria

## Usage — validated CLI flow

The only validated end-to-end flow is the four-step workspace-change loop: **grant → preview → approve → apply**. Every step talks to `aer-daemon` over IPC and is bound to the CLI session (`AER_SESSION_ID` environment variable, or a generated one).

**Prerequisites**

- Build: `npm run build` (root) — at minimum `packages/cli` must be built
- Daemon running: `aer start` (check with `aer status`)
- A workspace root — an absolute path to the directory you will operate on

**Step 1 — register a session grant**

```
aer workspace:grant <root> -m read-write -t list,read,search,apply --yes
```

- The default grant is **read-only** with tools `list,read,search`; a change flow must explicitly request read-write mode and the `apply` tool, or the later preview fails with `Workspace tool 'apply' is not granted for this session`
- Without `--yes`, read-write grants prompt `Grant READ-WRITE access to ...? (yes/no)`
- Success looks like: `{ "session": "...", "grantId": "grant_...", "registeredAt": "..." }`

**Step 2 — preview the change (nothing is written)**

```
aer workspace:preview <root> -f <relPath> -c "<new content>"
```

- `-f/--file` and `-c/--content` are repeatable, paired in order (one pair per file); `--hash <sha256>` pins the expected baseline of an existing file
- Success looks like: `{ "diffHash": "...", "files": [{ "relativePath": "...", "expectedHash": "...", "size": 0 }] }` plus a `Use this diffHash with workspace:approve: ...` line

**Step 3 — approve the preview (produces a single-use approvalId)**

```
aer workspace:approve <root> <diffHash> --yes
```

- The approval is bound to session + grant + diffHash; TTL is 60 s by default (`-t/--ttl`, capped at 300 s)
- Success looks like: `{ "approvalId": "wsa_...", "createdAt": "...", "expiresAt": "..." }` plus a `Use this approvalId with workspace:apply: ...` line

**Step 4 — apply the approved diff (consumes the approvalId)**

```
aer workspace:apply <root> <approvalId> -f <relPath> -c "<new content>" --yes
```

- The `-f`/`-c` pairs must match the approved diff
- Success looks like: `{ "applied": true, "rolledBack": false, "files": [{ "relativePath": "...", "previousHash": "...", "newHash": "..." }] }`, with the file actually written inside the workspace root
- The approvalId is **single-use**: reusing it fails with `Unknown or already-consumed approvalId` (exit 1)

**What the user must supply:** the workspace root, an explicit read-write grant including `apply` for any change, yes/no confirmations (or `--yes` for scripting), the `diffHash` passed from step 2 into step 3, and the `approvalId` passed from step 3 into step 4.

### Example — the verified run, copy-pasteable

The four commands below are the exact sequence from a real, validated run (scratch root `C:\Proyects\MultiAgentDev\.tmp\usage-check`, session `AER_SESSION_ID=usage-check-01`; full outputs recorded in `01_capture-validated-cli-workflow.md`). Substitute your own absolute path for `<root>`, and take the `diffHash`/`approvalId` values from **your** run's output (the recorded values shown here: `6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352` and `wsa_usage-ch_1790025413941_4`).

> Every CLI invocation also prints a dotenv loader line on stdout (`◇ injected env (3) from .env ...`). That is banner noise from the loader, not part of the command's output.

1. **Grant** a read-write session grant for the mutation flow. Without `--yes` this prompts `Grant READ-WRITE access to <root> for this CLI session? (yes/no)` — answer `yes`.
   ```
   aer workspace:grant <root> -m read-write -t list,read,search,apply --yes
   ```
   → `{ "session": "usage-check-01", "grantId": "grant_usage-ch_1790025413758_4", "registeredAt": "2026-09-21T21:16:53.758Z" }` (exit 0)

2. **Preview** the change — nothing is written to disk.
   ```
   aer workspace:preview <root> -f notes.txt -c "validated by usage-check on 2026-09-21"
   ```
   → stdout: `{ "rootPath": "...", "diffHash": "6319f29f…ea352", "files": [ { "relativePath": "notes.txt", "expectedHash": "e3b0c442…b855", "size": 0 } ] }`
   → stderr: `Use this diffHash with workspace:approve: 6319f29f…ea352` — **carry this `diffHash` into step 3**
   → *Unexpected detail kept from the run:* `notes.txt` did not exist yet, so `expectedHash` is the sha256 of the **empty string** (`e3b0c442…b855`) and `size` is `0`.

3. **Approve** the previewed diff — produces the **single-use `approvalId`** (bound to session + grant + diffHash; `expiresAt` is `createdAt` + 60 s by default). Without `--yes` this prompts `Approve applying changes to <root> (diffHash 6319f29f…)? (yes/no)` — answer `yes`.
   ```
   aer workspace:approve <root> 6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352 --yes
   ```
   → stdout: `{ "approvalId": "wsa_usage-ch_1790025413941_4", "sessionId": "usage-check-01", "grantId": "grant_usage-ch_1790025413758_4", "rootPath": "...", "diffHash": "6319f29f…ea352", "createdAt": "2026-09-21T21:16:53.941Z", "expiresAt": "2026-09-21T21:17:53.941Z" }`
   → stderr: `Use this approvalId with workspace:apply: wsa_usage-ch_1790025413941_4` — **carry this `approvalId` into step 4**

4. **Apply** the approved diff — consumes the `approvalId` and writes the file (the `-f`/`-c` pair must match the approved diff, i.e. be identical to step 2). Without `--yes` this prompts `Apply approved changes (approvalId wsa_...) to <root>? (yes/no)` — answer `yes`.
   ```
   aer workspace:apply <root> wsa_usage-ch_1790025413941_4 -f notes.txt -c "validated by usage-check on 2026-09-21" --yes
   ```
   → `{ "rootPath": "...", "applied": true, "rolledBack": false, "restored": [], "files": [ { "relativePath": "notes.txt", "previousHash": "e3b0c442…b855", "newHash": "3830c5ad…9821" } ], "diffHash": "6319f29f…ea352" }` (exit 0)
   → disk check: `notes.txt` now contains `validated by usage-check on 2026-09-21` (38 bytes)

5. **Expected failure — reusing the consumed `approvalId`** (re-running step 4 with the same id) exits 1. *Unexpected detail kept from the run:* the CLI prints `Workspace apply failed: [object Object]` (known CLI display bug — it stringifies a plain `{ code, message }` object); the actual daemon-side error is `Unknown or already-consumed approvalId`.
