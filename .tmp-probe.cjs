const fs = require("fs");
const files = [
  "packages/runtime/src/core/runtime.ts",
  "packages/runtime/src/ipc/ipc-server.ts",
  "packages/runtime/src/ipc/ipc-commands.ts",
  "packages/cli/src/ipc-modules/workspace-grant.ts",
];
const patterns = [
  "approvalRequired",
  "WorkspaceApprove",
  "WorkspaceApply",
  "SessionGrant",
  "approveAuthorizedWorkspace",
  "applyAuthorizedWorkspace",
];
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("MISSING " + f);
    continue;
  }
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (patterns.some((p) => l.includes(p))) console.log(f + ":" + (i + 1) + "  " + l.trim());
  });
}
