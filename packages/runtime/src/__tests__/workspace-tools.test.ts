import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkspaceAccessError, WorkspaceTools, CommandCancellationToken } from "../workspace-tools.js";
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

  it("accepts an allowlisted command through a case-normalized path that resolves to the same executable", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-case-"));
    temporaryRoots.push(rootPath);
    const allowedCommand = process.platform === "win32" ? process.execPath.toLowerCase() : process.execPath;
    const commandVariant = process.platform === "win32" ? process.execPath.toUpperCase() : process.execPath;

    const tools = await WorkspaceTools.create({
      rootPath,
      mode: "read-write",
      tools: ["execute"],
      allowedCommands: [allowedCommand],
    });

    const result = await tools.execute(commandVariant, ["-e", "process.stdout.write('case-ok')"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("case-ok");
  });

  it("previews and applies a newly created file within the authorized workspace", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "aer-workspace-tools-new-file-"));
    temporaryRoots.push(rootPath);
    const relativePath = "docs/new-file.txt";
    const tools = await WorkspaceTools.create({
      rootPath,
      mode: "read-write",
      tools: ["read", "apply"],
      approvalRequired: true,
      approvalToken: "approved-new-file",
    });

    const preview = await tools.preview([{ relativePath, content: "hello from preview" }]);
    expect(preview.files[0].expectedHash).toBe(createHash("sha256").update("").digest("hex"));

    const result = await tools.applyBatch([{ relativePath, content: "hello from preview", expectedHash: preview.files[0].expectedHash }], {
      sessionId: "console-session",
      grantId: "grant-console",
      diffHash: preview.diffHash,
      token: "approved-new-file",
    });

    expect(result.applied).toBe(true);
    expect(await readFile(path.join(rootPath, relativePath), "utf8")).toBe("hello from preview");
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

  it("streams output in emission order with a cumulative byte total (EOF close)", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "wst-exec-stream-"));
    temporaryRoots.push(rootPath);
    const tools = await WorkspaceTools.create({ rootPath, mode: "read-write", tools: ["execute"], allowedCommands: [process.execPath] });
    const chunks: Array<{ stream: "stdout" | "stderr"; chunk: string; totalBytes: number }> = [];
    const result = await tools.execute(
      process.execPath,
      ["-e", "process.stdout.write('ab'); process.stderr.write('cd');"],
      { onOutput: (stream, chunk, totalBytes) => chunks.push({ stream, chunk, totalBytes }) },
    );
    // A clean EOF (child close) yields a resolved result with both streams captured.
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ab");
    expect(result.stderr).toContain("cd");
    expect(chunks.length).toBeGreaterThan(0);
    let running = 0;
    for (const entry of chunks) {
      running += Buffer.byteLength(entry.chunk, "utf8");
      expect(entry.totalBytes).toBe(running);
    }
  });

  it("cancels an in-flight command, terminating the child process and firing the cancel callback once", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "wst-exec-cancel-"));
    temporaryRoots.push(rootPath);
    const tools = await WorkspaceTools.create({ rootPath, mode: "read-write", tools: ["execute"], allowedCommands: [process.execPath] });
    const token = new CommandCancellationToken();
    let cancelCalls = 0;
    const promise = tools.execute(
      process.execPath,
      ["-e", "setTimeout(() => process.stdout.write('done'), 2000);"],
      {
        timeoutMs: 5000,
        cancellation: token,
        onCancel: () => {
          cancelCalls += 1;
        },
      },
    );
    token.cancel();
    token.cancel(); // idempotent: second cancel is a no-op
    const result = await promise;
    expect(result.cancelled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).not.toContain("done");
    expect(cancelCalls).toBe(1);
  });

  it("terminates a long-running command within the timeout bound", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "wst-exec-timeout-"));
    temporaryRoots.push(rootPath);
    const tools = await WorkspaceTools.create({ rootPath, mode: "read-write", tools: ["execute"], allowedCommands: [process.execPath] });
    const started = Date.now();
    const result = await tools.execute(
      process.execPath,
      ["-e", "setTimeout(() => process.stdout.write('done'), 5000);"],
      { timeoutMs: 300 },
    );
    expect(result.timedOut).toBe(true);
    expect(result.cancelled).toBe(false);
    expect(result.stdout).not.toContain("done");
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("caps captured output at maxOutputBytes", async () => {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "wst-exec-cap-"));
    temporaryRoots.push(rootPath);
    const tools = await WorkspaceTools.create({ rootPath, mode: "read-write", tools: ["execute"], allowedCommands: [process.execPath] });
    const payload = "x".repeat(4096);
    const result = await tools.execute(
      process.execPath,
      ["-e", `process.stdout.write(${JSON.stringify(payload)});`],
      { maxOutputBytes: 1024 },
    );
    expect(result.exitCode).toBe(0);
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(1024);
  });
});
