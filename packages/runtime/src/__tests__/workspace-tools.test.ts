import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkspaceAccessError, WorkspaceTools } from "../workspace-tools.js";
import { createHash } from "node:crypto";

let temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.map((rootPath) => rm(rootPath, { recursive: true, force: true })));
  temporaryRoots = [];
});

describe("WorkspaceTools", () => {
  it("lists, reads, and searches only within an explicit grant", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-"));
    temporaryRoots.push(rootPath);
    await mkdir(path.join(rootPath, "src"));
    await writeFile(path.join(rootPath, "src", "main.cs"), "hello workspace");

    const tools = await WorkspaceTools.create({
      rootPath,
      mode: "read-only",
      tools: ["list", "read", "search"],
    });

    expect(await tools.list(".")).toEqual([{ path: "src", type: "directory" }]);
    expect(await tools.read("src/main.cs")).toBe("hello workspace");
    expect(await tools.search("workspace")).toEqual([path.join("src", "main.cs")]);
  });

  it("rejects traversal and tools that were not granted", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-"));
    temporaryRoots.push(rootPath);
    await writeFile(path.join(rootPath, "inside.txt"), "inside");
    const tools = await WorkspaceTools.create({ rootPath, mode: "read-only", tools: ["read"] });

    await expect(tools.read("../outside.txt")).rejects.toBeInstanceOf(WorkspaceAccessError);
    await expect(tools.list(".")).rejects.toThrow("Workspace tool not granted: list");
  });

  it("requires an absolute root and at least one tool", async () => {
    await expect(WorkspaceTools.create({ rootPath: ".", mode: "read-only", tools: ["read"] }))
      .rejects.toThrow("absolute path");
    await expect(WorkspaceTools.create({ rootPath: process.cwd(), mode: "read-only", tools: [] }))
      .rejects.toThrow("at least one tool");
  });

  it("rejects expired and invalid grants", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-"));
    temporaryRoots.push(rootPath);
    const expiredAt = new Date(Date.now() - 1000).toISOString();

    await expect(WorkspaceTools.create({ rootPath, mode: "read-only", tools: ["read"], expiresAt: expiredAt }))
      .rejects.toThrow("expired");
    await expect(WorkspaceTools.create({ rootPath, mode: "read-only", tools: ["read"], expiresAt: "invalid" }))
      .rejects.toThrow("valid timestamp");
    await expect(WorkspaceTools.create({ rootPath, mode: "read-only", tools: ["execute"] }))
      .rejects.toThrow("Read-only grants");
    await expect(WorkspaceTools.create({ rootPath, mode: "read-write", tools: ["apply"] }))
      .rejects.toThrow("explicit approval");
  });

  it("executes only an allowlisted command without a shell", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-"));
    temporaryRoots.push(rootPath);
    const tools = await WorkspaceTools.create({
      rootPath,
      mode: "read-write",
      tools: ["execute"],
      allowedCommands: [process.execPath],
    });

    const result = await tools.execute(process.execPath, ["-e", "process.stdout.write('ok')"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("ok");
    expect(result.timedOut).toBe(false);
    await expect(tools.execute("not-allowed", [])).rejects.toThrow("Command not granted");
  });

  it("applies only an approved change matching the expected hash", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-"));
    temporaryRoots.push(rootPath);
    const filePath = path.join(rootPath, "README.md");
    const original = "before";
    await writeFile(filePath, original);
    const expectedHash = createHash("sha256").update(original).digest("hex");
    const tools = await WorkspaceTools.create({
      rootPath,
      mode: "read-write",
      tools: ["apply", "read"],
      approvalRequired: true,
      approvalToken: "approved-1",
    });

    await expect(tools.apply({ relativePath: "README.md", content: "after", expectedHash, approvalToken: "wrong" }))
      .rejects.toThrow("token");
    await expect(tools.apply({ relativePath: "README.md", content: "after", expectedHash: "wrong", approvalToken: "approved-1" }))
      .rejects.toThrow("changed since approval");
    const result = await tools.apply({ relativePath: "README.md", content: "after", expectedHash, approvalToken: "approved-1" });
    expect(result.hash).toBe(createHash("sha256").update("after").digest("hex"));
    expect(await tools.read("README.md")).toBe("after");
  });
});
