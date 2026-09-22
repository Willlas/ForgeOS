# Task 01: Capture the validated CLI workflow in plain English

> Epic: [03_usage-risk-docs.md](../03_usage-risk-docs/03_usage-risk-docs.md) — US-07: The validated console flow is documented
> Sprint 12 · Usage and risk documentation · documentation-only work

- **Action:** Verify the flow in a real run before documenting it: build the CLI (`npm run build` in `packages/cli`, or the root build), then execute `aer workspace:grant <root>` → `aer workspace:preview <root>` → `aer workspace:approve <root>` → `aer workspace:apply <root>` against a throwaway scratch directory (e.g. `.tmp/usage-check/`). Cross-check every command, argument, and flag against `packages/cli/src/index.ts` and `packages/cli/src/__tests__/workspace-grant-cli.test.ts`. Record the exact command and observed output of each step under a `## Findings` heading in this file, and document the flow in a new `## Usage — validated CLI flow` section in `README.md`: what each step does, what the user must supply (workspace root, confirmations, the single-use approvalId passed from approve to apply), and what a successful result looks like. If any step fails or differs from the expected behavior, document the actual behavior and log the discrepancy in `## Findings` — never the idealized version.
- **Target File/Location:** `c:\Proyects\MultiAgentDev\README.md` (new `## Usage — validated CLI flow` section) and this file (`## Findings`)
- **Verification:** The `## Findings` section contains one real-run entry (command + output) per step — grant, preview, approve, apply — and the README section describes exactly those four steps in order, with every command matching `packages/cli/src/index.ts` and every behavior claim backed by the recorded run or the test suite.

## Findings

Recorded 2026-09-21 (local time) on Windows (PowerShell), daemon running, `AER_SESSION_ID=usage-check-01`, scratch root `C:\Proyects\MultiAgentDev\.tmp\usage-check`. Commands were executed via the built CLI (`packages/cli/dist`) driven by `.tmp/cli-walkthrough.mjs`; the raw daemon error below was captured by the direct-IPC probe `.tmp/ipc-probe.mjs`.

Note: every CLI invocation prints a dotenv banner line on stdout (`◇ injected env (3) from .env ...`). That is loader noise, not part of the command's output; the JSON below is the command's actual output.

### Step 1 — grant

```
aer workspace:grant "C:\Proyects\MultiAgentDev\.tmp\usage-check" -m read-write -t list,read,search,apply --yes
```

Output (exit 0):

```json
{
  "session": "usage-check-01",
  "grantId": "grant_usage-ch_1790025413758_4",
  "registeredAt": "2026-09-21T21:16:53.758Z"
}
```

**Discrepancy (root cause of the earlier "intermittent" preview failures):** the default grant for `workspace:grant <root>` is **read-only** with tools `list,read,search` (see `packages/cli/src/index.ts`, `workspace:grant` handler). Under that default grant, `workspace:preview` for a file change fails with the daemon error `Workspace tool 'apply' is not granted for this session`. The grant must explicitly include `-m read-write -t list,read,search,apply` for the mutation flow to work. With a read-write grant, the interactive prompt `Grant READ-WRITE access to ...? (yes/no)` is shown unless `--yes` is passed.

### Step 2 — preview (nothing is written)

```
aer workspace:preview "C:\Proyects\MultiAgentDev\.tmp\usage-check" -f notes.txt -c "validated by usage-check on 2026-09-21"
```

stdout (exit 0):

```json
{
  "rootPath": "C:\\Proyects\\MultiAgentDev\\.tmp\\usage-check",
  "diffHash": "6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352",
  "files": [
    { "relativePath": "notes.txt", "expectedHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "size": 0 }
  ]
}
```

stderr: `Use this diffHash with workspace:approve: 6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352`

Notes: `expectedHash` is the sha256 of the empty string because the file does not exist yet; `size: 0`. Nothing was written to disk at this step.

### Step 3 — approve (produces the single-use approvalId)

```
aer workspace:approve "C:\Proyects\MultiAgentDev\.tmp\usage-check" 6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352 --yes
```

stdout (exit 0):

```json
{
  "approvalId": "wsa_usage-ch_1790025413941_4",
  "sessionId": "usage-check-01",
  "grantId": "grant_usage-ch_1790025413758_4",
  "rootPath": "C:\\Proyects\\MultiAgentDev\\.tmp\\usage-check",
  "diffHash": "6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352",
  "createdAt": "2026-09-21T21:16:53.941Z",
  "expiresAt": "2026-09-21T21:17:53.941Z"
}
```

stderr: `Use this approvalId with workspace:apply: wsa_usage-ch_1790025413941_4`

Notes: TTL defaults to 60 s (the `-t/--ttl` flag is capped at 300 s); the approval is bound to session + grant + diffHash.

### Step 4 — apply (consumes the approvalId, writes the file)

```
aer workspace:apply "C:\Proyects\MultiAgentDev\.tmp\usage-check" wsa_usage-ch_1790025413941_4 -f notes.txt -c "validated by usage-check on 2026-09-21" --yes
```

stdout (exit 0):

```json
{
  "rootPath": "C:\\Proyects\\MultiAgentDev\\.tmp\\usage-check",
  "applied": true,
  "rolledBack": false,
  "restored": [],
  "files": [
    { "relativePath": "notes.txt", "previousHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "newHash": "3830c5ad18bcb1ff651cfcafdc23595b279b1c44f240e3fe0b6df39478559821" }
  ],
  "diffHash": "6319f29f39da83c2cfc0f549821c58dc54643ef47dfbef3f8277002a160ea352"
}
```

Disk verification: `Get-Content .tmp\usage-check\notes.txt` → `validated by usage-check on 2026-09-21` (38 bytes).

### Negative case — reusing a consumed approvalId

Re-running step 4 with the same approvalId → exit 1:

```
Workspace apply failed: [object Object]
```

Raw daemon response, captured by `.tmp/ipc-probe.mjs` (same session, same payload):

```json
{ "code": 6, "message": "Unknown or already-consumed approvalId" }
```

**Discrepancy:** the CLI swallows the daemon's message — `IpcClient` rejects with a plain `{ code, message }` object and `index.ts` prints `String(error)`, so the user sees `[object Object]` instead of `Unknown or already-consumed approvalId`. This is a CLI display bug (the daemon-side error is clear).

### Other observations

- Grants are session-scoped: each `workspace:grant` call registers a fresh grantId (`..._1` → `..._4` across the run), and the most recent registration determines the permissions observed by subsequent `preview` calls.
- The "intermittent preview failures" seen in earlier sessions are fully explained by the default read-only grant (no `apply` tool); with the correct grant the full chain succeeded deterministically in two consecutive runs (one of them including the negative case).
- `--yes` is supported on `grant`, `approve`, and `apply`, and is required for unattended/scripted runs of the read-write grant and the approve/apply confirmations.
