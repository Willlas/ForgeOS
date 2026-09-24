
# Sprint 14 — CLI Validation, Hardening, and Test-Plan Expansion

## Current Repository State & Sprint 13 Closure

Sprint 13 successfully stabilized the pre-MVP Aer Runtime CLI. The secure workspace interaction path (`grant` → `preview` → `approve` → `apply`) is validated, and the core daemon-backed flow is operational. Known risk defects, such as raw `[object Object]` output during IPC rejections, have been closed. The repository is currently on the `develop` branch. The project remains honestly pre-MVP, and the local Ollama provider is treated strictly as an experimental local prerequisite, not a guaranteed external service.

---

## Sprint 14 Enriched Plan & Test Strategy

**Objective:** Strengthen operator confidence in the validated CLI path by expanding regression coverage, defining a concrete validation matrix, and establishing a reproducible operator test plan.

**Scope:** Strictly limited to validation, hardening, and evidence collection for the existing `grant → preview → approve → apply` workflow. No new product features or provider backends will be added.

---

### 1. CLI Validation Matrix

This matrix defines the exact scenarios to be validated. Operators and automated tests should use these signals to determine pass/fail status.

| Scenario | Command(s) | Expected Exit Code | Expected stdout/stderr | Pass/Fail Signal |
| :--- | :--- | :--- | :--- | :--- |
| **Happy Path** | `aer status` → `aer workspace:grant ...` → `aer workspace:preview ...` → `aer workspace:approve ...` → `aer workspace:apply ...` | `0` | `status` prints daemon/provider state; `grant` outputs session ID; `preview` outputs `diffHash`; `approve` outputs `approvalId`; `apply` confirms file write. | File is written; exit code is `0`. |
| **Daemon Not Running** | `aer workspace:grant <root> ...` (while daemon is down) | `1` | stderr: `Daemon is not running. Start it first.` | No hang; deterministic exit `1`. |
| **Reused approvalId** | Rerun `aer workspace:apply <root> <approvalId> ...` | `1` | stderr: `Unknown or already-consumed approvalId` | No `[object Object]` in output; apply does not execute. |
| **Read-only Grant Misuse** | `aer workspace:preview <root> ...` (with read-only grant) | `1` | stderr: Clear message indicating `read-write` grant with `apply` scope is required. | Preview blocked; clear error message. |
| **Provider Unreachable** | `aer status` (while Ollama is down) | `0` | stdout: Provider line prints `unreachable`. | CLI remains responsive; status command still exits cleanly. |
| **Malformed Arguments** | `aer workspace:preview <root> -f notes.txt` (missing `-c`) | `1` | stderr: Clear validation message identifying missing required argument. | No silent failure; no object stringification. |

---

### 2. Operator Test Plan

A reproducible smoke suite for human operators to validate the CLI on a real workstation.

#### A. Initial Smoke Test (Happy Path)
1. Start the daemon (`aer start`).
2. Check status (`aer status`)—verify the daemon is running and the provider line is present.
3. Run a valid grant cycle (`aer workspace:grant <root> -m read-write -t list,read,search,apply --yes`).
4. Run preview (`aer workspace:preview <root> -f notes.txt -c "demo text"`).
5. Run approve (`aer workspace:approve <root> <diffHash> --yes`).
6. Run apply (`aer workspace:apply <root> <approvalId> -f notes.txt -c "demo text" --yes`).
7. Confirm the file was written to the workspace.

#### B. Failure Smoke Test
1. Rerun the `apply` step from Suite A with the exact same `approvalId`.
2. Verify the CLI surfaces the exact rejection message and exits cleanly.
3. Visually verify no `[object Object]` text appears in the output.
4. Stop the daemon and run an `aer status` or `workspace:grant` command. Verify it reports the daemon is down without hanging.

#### C. Recovery Check
1. Restart the daemon.
2. Re-register the grant and run the happy path again.
3. Confirm command sequences remain stable and state does not leak between sessions inappropriately.

---

### 3. Suggested Future Regression Checks

These checks should be codified to prevent silent regressions in the CLI's operational reliability:

* **Serialization Guard:** A test that specifically searches stdout/stderr for the string `[object Object]` and fails if found across all CLI commands.
* **Exit Code Contract:** A test ensuring `--yes` flagged commands in the happy path return `0`, and known failure paths return `1`.
* **Provider Decoupling:** A test verifying that `aer status` returns exit code `0` and prints `unreachable` when the local Ollama provider is absent, ensuring the daemon does not crash.
* **Single-Use Enforcement:** A test ensuring that an `approvalId` can only be used exactly once for `workspace:apply`.

---

### 4. Recommendations for Next Automation Targets

To build a reliable CI pipeline without depending on live external infrastructure, the following scenarios should be converted into automated Vitest regression tests first:

1. **`workspace:apply` Duplicate approvalId:** Spawn the CLI, run apply twice, assert stderr contains the exact rejection message and exit code is `1`. (Highest priority—prevents IPC serialization regressions).
2. **Daemon-Down Behavior:** Stop the daemon, spawn a workspace command, assert it exits `1` with the correct message without hanging (use a timeout).
3. **Malformed Payload Check:** Spawn `workspace:preview` with missing arguments, assert exit code `1` and clear stderr.
4. **Provider Unreachable Status:** Stop Ollama, run `aer status`, assert exit code `0` and stdout includes `unreachable`.

---

### 5. Acceptance Criteria for Sprint 14

* The CLI validation matrix is fully executable manually.
* The operator test plan is documented in the repository.
* The top automation targets are queued for implementation as Vitest regression suites.
* No new product scope or features have been introduced beyond the verified CLI path.