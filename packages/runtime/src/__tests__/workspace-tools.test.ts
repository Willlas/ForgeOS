import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkspaceAccessError, WorkspaceTools } from "../workspace-tools.js";

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
});
