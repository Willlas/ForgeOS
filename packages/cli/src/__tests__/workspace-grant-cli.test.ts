import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

describe("CLI workspace grant command", () => {
  it("exposes --yes in the command help and accepts the flag", () => {
    const tsxCli = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

    const output = execFileSync(
      process.execPath,
      [tsxCli, "packages/cli/src/index.ts", "workspace:grant", "--help"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
      },
    );

    expect(output).toContain("--yes");
    expect(output).toContain("Skip the read-write confirmation prompt");
  });
});
