import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

describe("CLI review-status workflow", () => {
  it("summarizes the status of a project directory via the CLI", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "aer-review-status-"));

    try {
      writeFileSync(join(projectRoot, "README.md"), "# Demo project\n");
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify({ name: "demo-project", private: true }, null, 2),
      );
      mkdirSync(join(projectRoot, "src"), { recursive: true });

      const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
      const output = execFileSync(
        process.execPath,
        [tsxCli, "packages/cli/src/index.ts", "review-status", projectRoot],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: process.env,
        },
      );

      expect(output).toContain("Project review:");
      expect(output).toContain("README: present");
      expect(output).toContain("package.json: present");
      expect(output).toContain("src/: present");
      expect(output).toContain("Assessment:");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
