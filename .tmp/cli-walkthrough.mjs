// Drives the `aer workspace` CLI end-to-end (grant -> preview -> approve -> apply)
// against the running daemon and prints each step's exact stdout/stderr + exit code.
import { spawnSync } from "node:child_process";

const session = process.env.AER_SESSION_ID || "usage-check-01";
const root = "C:\\Proyects\\MultiAgentDev\\.tmp\\usage-check";
const content = "validated by usage-check on 2026-09-21";
const cli = "packages/cli/dist/index.js";

function run(args, stdin) {
  const res = spawnSync("node", [cli, ...args], {
    cwd: "C:\\Proyects\\MultiAgentDev",
    env: { ...process.env, AER_SESSION_ID: session },
    input: stdin,
    encoding: "utf8",
    timeout: 30000,
  });
  return { exitCode: res.status, stdout: (res.stdout || "").trim(), stderr: (res.stderr || "").trim() };
}

function show(label, r) {
  console.log(`\n===== ${label} =====`);
  console.log(`[exit code] ${r.exitCode}`);
  console.log(`[stdout]`);
  console.log(r.stdout || "(empty)");
  if (r.stderr) {
    console.log(`[stderr]`);
    console.log(r.stderr);
  }
}

const step1 = run(["workspace:grant", root, "-m", "read-write", "-t", "list,read,search,apply", "--yes"]);
show("STEP 1: aer workspace:grant -m read-write -t list,read,search,apply --yes", step1);

const step2 = run(["workspace:preview", root, "-f", "notes.txt", "-c", content]);
show("STEP 2: aer workspace:preview", step2);
const diffHash = (step2.stdout.match(/"diffHash"\s*:\s*"([0-9a-f]+)"/) || [])[1];
if (!diffHash) {
  console.error("FATAL: could not extract diffHash from preview output");
  process.exit(1);
}
console.log(`(captured diffHash: ${diffHash})`);

const step3 = run(["workspace:approve", root, diffHash, "--yes"]);
show("STEP 3: aer workspace:approve", step3);
const approvalId = (step3.stdout.match(/"approvalId"\s*:\s*"([^"]+)"/) || [])[1];
if (!approvalId) {
  console.error("FATAL: could not extract approvalId from approve output");
  process.exit(1);
}
console.log(`(captured approvalId: ${approvalId})`);

const step4 = run(["workspace:apply", root, approvalId, "-f", "notes.txt", "-c", content, "--yes"]);
show("STEP 4: aer workspace:apply (approvalId, -f notes.txt, -c <content>, --yes)", step4);

// Negative checks: reusing the single-use approvalId must fail.
const step5 = run(["workspace:apply", root, approvalId, "-f", "notes.txt", "-c", content, "--yes"]);
show("NEGATIVE: re-apply with consumed approvalId (must fail)", step5);
