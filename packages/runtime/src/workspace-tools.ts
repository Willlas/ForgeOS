import { promises as fs } from "node:fs";
import { spawn, execFile } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { IPCErrorCode } from "./ipc-protocol.js";

export type WorkspaceAccessMode = "read-only" | "read-write";
export type WorkspaceToolName = "list" | "read" | "search" | "execute" | "apply";

export interface WorkspaceAccessGrant {
  grantId?: string;
  sessionId?: string;
  rootPath: string;
  mode: WorkspaceAccessMode;
  tools: ReadonlyArray<WorkspaceToolName>;
  allowedCommands?: ReadonlyArray<string>;
  expiresAt?: string;
  approvalRequired?: boolean;
  approvalToken?: string;
  maxReadBytes?: number;
}

export interface WorkspaceEntry {
  path: string;
  type: "file" | "directory";
}

export interface WorkspaceReadPayload {
  rootPath: string;
  relativePath: string;
  mode?: WorkspaceAccessMode;
}

export interface WorkspaceCommandResult {
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** True when the operation was cancelled (client cancel, disconnect, or daemon stop). */
  cancelled: boolean;
}

/**
 * Cancellation contract for in-flight workspace operations. A token is
 * threaded from the IPC server (or a test) through `execute()`; cancelling it
 * kills the child process tree and resolves the operation with
 * `cancelled: true` instead of throwing.
 */
export interface CommandCancellation {
  /** True once `cancel()` has been called. */
  readonly cancelled: boolean;
  /** Request cancellation (idempotent). */
  cancel(): void;
  /** Register a one-shot callback invoked exactly once when cancellation fires. */
  onCancellation(handler: () => void): void;
}

/** Default in-memory implementation of {@link CommandCancellation}. */
export class CommandCancellationToken implements CommandCancellation {
  private _cancelled = false;
  private handler: (() => void) | null = null;

  get cancelled(): boolean {
    return this._cancelled;
  }

  cancel = (): void => {
    if (this._cancelled) return;
    this._cancelled = true;
    const handler = this.handler;
    this.handler = null;
    if (handler) handler();
  };

  onCancellation = (handler: () => void): void => {
    if (this._cancelled) {
      handler();
      return;
    }
    this.handler = handler;
  };
}

/** Options for `WorkspaceTools.execute` (timeout, output cap, streaming, cancellation). */
export interface WorkspaceExecuteOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  /** Stream captured output as it arrives (ordered, in emission order). */
  onOutput?: (stream: "stdout" | "stderr", chunk: string, totalBytes: number) => void;
  /** Invoked exactly once when the execution is cancelled. */
  onCancel?: () => void;
  /** Cancellation token; cancelling kills the child process tree. */
  cancellation?: CommandCancellation;
}

export interface WorkspaceApplyRequest {
  relativePath: string;
  content: string;
  expectedHash: string;
  approvalToken: string;
}

/**
 * A single proposed file mutation. `expectedHash` is the sha256 of the file
 * content the change is based on. It is required when previewing/approving/applying
 * so a concurrent modification is detected (hash conflict) instead of overwritten.
 */
export interface WorkspaceApplyChange {
  relativePath: string;
  content: string;
  expectedHash?: string;
}

/** Per-file outcome of an applied change. */
export interface WorkspaceFileWriteResult {
  relativePath: string;
  previousHash: string;
  newHash: string;
}

/**
 * Public approval binding presented to {@link WorkspaceTools.applyBatch}.
 * The token is a daemon-side secret: it is only present when the grant was
 * registered with an explicit `approvalToken`, and it must match exactly.
 */
export interface WorkspaceApplyApproval {
  sessionId?: string;
  grantId?: string;
  diffHash: string;
  token?: string;
}

/** Outcome of a batched apply, including rollback metadata. */
export interface WorkspaceApplyWriteResult {
  applied: boolean;
  files: WorkspaceFileWriteResult[];
  rolledBack: boolean;
  restored: string[];
  diffHash: string;
  /** Snapshot directory holding the pre-apply file contents (for recovery/audit). */
  snapshot?: string;
}

/** Per-file preview metadata (the current hash the change is based on). */
export interface WorkspacePreviewFileInfo {
  relativePath: string;
  expectedHash: string;
  size: number;
}

/** Outcome of {@link WorkspaceTools.preview}: baseline metadata plus the diff fingerprint to approve. */
export interface WorkspacePreviewResult {
  files: WorkspacePreviewFileInfo[];
  diffHash: string;
}

/** Outcome of {@link WorkspaceTools.rollback}: the relative paths restored from the snapshot. */
export interface WorkspaceRollbackResult {
  restored: string[];
  diffHash: string;
}

/** Internal resolved form of a proposed change (canonical path + baseline hash). */
interface ResolvedChange {
  relativePath: string;
  filePath: string;
  content: string;
  expectedHash: string;
  currentHash: string;
  currentBody: Buffer;
  size: number;
}

/**
 * Typed error for approved-change operations. Carries an {@link IPCErrorCode}
 * so the daemon serializes a stable code + optional details to clients, and so
 * rollback metadata can travel with a failed apply.
 */
export class WorkspaceApplyError extends Error {
  readonly code: number;
  readonly details?: unknown;

  constructor(message: string, code: IPCErrorCode = IPCErrorCode.InternalError, details?: unknown) {
    super(message);
    this.name = "WorkspaceApplyError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

/** sha256 hex digest of a string/Buffer body. */
function sha256(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Deterministic fingerprint of a proposed change set (order-insensitive).
 * Used to bind an approval token to the exact diff: any difference in path,
 * expected hash or content produces a different digest, so a token approved for
 * one diff cannot be replayed against a different one.
 */
export function computeApplyDiffHash(
  changes: Array<{ relativePath: string; expectedHash?: string; content: string }>,
): string {
  const normalized = [...changes]
    .map((change) => JSON.stringify({ p: change.relativePath, h: change.expectedHash, c: change.content }))
    .sort();
  return sha256(normalized.join("\u0000"));
}

export class WorkspaceTools {
  private readonly rootPath: string;
  private readonly grant: WorkspaceAccessGrant;
  private readonly maxReadBytes: number;

  private constructor(rootPath: string, grant: WorkspaceAccessGrant) {
    this.rootPath = rootPath;
    this.grant = grant;
    this.maxReadBytes = grant.maxReadBytes ?? 1_048_576;
  }

  static async create(grant: WorkspaceAccessGrant): Promise<WorkspaceTools> {
    if (!path.isAbsolute(grant.rootPath)) {
      throw new WorkspaceAccessError("Workspace root must be an absolute path");
    }
    if (grant.tools.length === 0) {
      throw new WorkspaceAccessError("Workspace grant must include at least one tool");
    }
    if (grant.expiresAt && Number.isNaN(Date.parse(grant.expiresAt))) {
      throw new WorkspaceAccessError("Workspace grant expiry must be a valid timestamp");
    }
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) {
      throw new WorkspaceAccessError("Workspace grant has expired");
    }
    if (grant.mode === "read-only" && grant.tools.some((tool) => tool === "execute" || tool === "apply")) {
      throw new WorkspaceAccessError("Read-only grants cannot include execute or apply tools");
    }
    if (grant.mode === "read-write" && grant.tools.includes("apply") && grant.approvalRequired !== true) {
      throw new WorkspaceAccessError("Read-write apply grants require explicit approval");
    }
    const rootPath = await fs.realpath(grant.rootPath);
    const allowedCommands = grant.allowedCommands
      ? grant.allowedCommands.map((command) => WorkspaceTools.normalizeCommand(command))
      : undefined;
    return new WorkspaceTools(rootPath, { ...grant, rootPath, allowedCommands });
  }

  getGrant(): WorkspaceAccessGrant {
    return {
      ...this.grant,
      tools: [...this.grant.tools],
      allowedCommands: this.grant.allowedCommands ? [...this.grant.allowedCommands] : undefined,
    };
  }

  async readFile(relativePath: string): Promise<{ path: string; content: string }> {
    return { path: relativePath, content: await this.read(relativePath) };
  }

  async list(relativePath = "."): Promise<WorkspaceEntry[]> {
    this.requireTool("list");
    const directoryPath = await this.resolveExistingPath(relativePath);
    const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
    return directoryEntries.map((entry) => ({
      path: path.relative(this.rootPath, path.join(directoryPath, entry.name)) || ".",
      type: entry.isDirectory() ? "directory" : "file",
    }));
  }

  async read(relativePath: string): Promise<string> {
    this.requireTool("read");
    const filePath = await this.resolveExistingPath(relativePath);
    const fileStat = await fs.stat(filePath);
    if (!fileStat.isFile()) throw new WorkspaceAccessError("Workspace path is not a file");
    if (fileStat.size > this.maxReadBytes) {
      throw new WorkspaceAccessError(`File exceeds read limit of ${this.maxReadBytes} bytes`);
    }
    return fs.readFile(filePath, "utf8");
  }

  async search(query: string): Promise<string[]> {
    this.requireTool("search");
    if (!query) throw new WorkspaceAccessError("Search query must not be empty");
    const matches: string[] = [];
    await this.searchDirectory(this.rootPath, query, matches);
    return matches;
  }

  async execute(command: string, args: string[] = [], options?: WorkspaceExecuteOptions): Promise<WorkspaceCommandResult> {
    this.requireTool("execute");
    if (this.grant.mode === "read-only") throw new WorkspaceAccessError("Read-only grants cannot execute commands");
    const resolvedCommand = await this.resolveExecutableCommand(command);
    const allowedCommands = (this.grant.allowedCommands ?? []).map((allowed) => WorkspaceTools.normalizeCommand(allowed));
    if (!allowedCommands.includes(resolvedCommand)) {
      throw new WorkspaceAccessError(`Command not granted: ${command}`);
    }
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const maxOutputBytes = options?.maxOutputBytes ?? 1_048_576;
    const cancellation = options?.cancellation;

    return new Promise((resolve, reject) => {
      const child = spawn(resolvedCommand, args, {
        cwd: this.rootPath,
        shell: false,
        windowsHide: true,
        env: {
          PATH: process.env.PATH ?? "",
          SystemRoot: process.env.SystemRoot ?? "",
          TEMP: process.env.TEMP ?? process.env.TMP ?? "",
          TMP: process.env.TMP ?? process.env.TEMP ?? "",
        },
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let cancelled = false;
      let outputBytes = 0;
      const append = (target: "stdout" | "stderr", chunk: Buffer): void => {
        if (outputBytes >= maxOutputBytes) return;
        const remaining = maxOutputBytes - outputBytes;
        const text = chunk.subarray(0, remaining).toString("utf8");
        outputBytes += Buffer.byteLength(text, "utf8");
        if (target === "stdout") stdout += text;
        else stderr += text;
        options?.onOutput?.(target, text, outputBytes);
      };
      const killProcessTree = (): void => {
        // child.kill() only signals the direct child; on Windows escalate with
        // taskkill /T so spawned grandchildren are not orphaned.
        if (process.platform === "win32" && child.pid !== undefined) {
          execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => { /* best-effort */ });
        }
        child.kill();
      };
      const requestCancel = (): void => {
        if (cancelled || timedOut) return;
        cancelled = true;
        options?.onCancel?.();
        killProcessTree();
      };
      if (cancellation) cancellation.onCancellation(requestCancel);
      const timer = setTimeout(() => {
        timedOut = true;
        killProcessTree();
      }, timeoutMs);
      child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
      child.on("error", reject);
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve({ command, args, exitCode, stdout, stderr, timedOut, cancelled });
      });
    });
  }

  async apply(request: WorkspaceApplyRequest): Promise<{ path: string; hash: string }> {
    this.requireTool("apply");
    if (this.grant.mode !== "read-write") throw new WorkspaceAccessError("Read-only grants cannot apply changes");
    if (this.grant.approvalRequired !== true || !this.grant.approvalToken || request.approvalToken !== this.grant.approvalToken) {
      throw new WorkspaceAccessError("Approved change token is required");
    }
    const filePath = await this.resolveExistingPath(request.relativePath);
    const currentContent = await fs.readFile(filePath);
    const currentHash = createHash("sha256").update(currentContent).digest("hex");
    if (currentHash !== request.expectedHash) throw new WorkspaceAccessError("Workspace file changed since approval");
    const nextHash = createHash("sha256").update(request.content).digest("hex");
    const temporaryPath = `${filePath}.aer-tmp-${process.pid}`;
    await fs.writeFile(temporaryPath, request.content, "utf8");
    try {
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
    return { path: request.relativePath, hash: nextHash };
  }

  /**
   * Preview a batch of changes without applying them. Resolves each change to
   * its baseline hash (the provided `expectedHash`, or the current content hash
   * when omitted) and returns a deterministic `diffHash` to bind the approval to.
   */
  async preview(changes: WorkspaceApplyChange[]): Promise<WorkspacePreviewResult> {
    this.requireTool("read");
    if (this.grant.mode !== "read-write") {
      throw new WorkspaceAccessError("Preview requires a read-write grant");
    }
    const resolved = await this.resolveChanges(changes);
    return {
      files: resolved.map((change) => ({
        relativePath: change.relativePath,
        expectedHash: change.expectedHash,
        size: change.size,
      })),
      diffHash: computeApplyDiffHash(resolved),
    };
  }

  /**
   * Apply a batch of changes using an explicit, session-bound approval.
   *
   * Safety model:
   *  - Every change must carry the `expectedHash` from {@link preview}; a mismatch
   *    with the current content is a hash conflict and rejects the batch.
   *  - The recomputed `diffHash` must equal the approved one (blocks replay of a
   *    different change set).
   *  - The approval token must equal the grant's secret token, and the session /
   *    grant binding must match the grant.
   *  - File contents are snapshotted before any write; on any failure the files
   *    already written are restored and the snapshot path is surfaced.
   */
  async applyBatch(changes: WorkspaceApplyChange[], approval: WorkspaceApplyApproval): Promise<WorkspaceApplyWriteResult> {
    this.requireTool("apply");
    if (this.grant.mode !== "read-write") {
      throw new WorkspaceApplyError("Read-only grants cannot apply changes", IPCErrorCode.ApprovalRequired);
    }
    if (approval === null || typeof approval !== "object" || typeof approval.diffHash !== "string") {
      throw new WorkspaceApplyError("An approval binding (diffHash) is required", IPCErrorCode.ApprovalRejected);
    }

    const resolved = await this.resolveChanges(changes);
    const diffHash = computeApplyDiffHash(resolved);
    if (diffHash !== approval.diffHash) {
      throw new WorkspaceApplyError("Approval diffHash does not match the requested change set", IPCErrorCode.ApprovalRejected);
    }
    if (this.grant.approvalRequired !== true) {
      throw new WorkspaceApplyError("This grant does not require an approval token", IPCErrorCode.ApprovalRejected);
    }
    if (typeof this.grant.approvalToken !== "string" || this.grant.approvalToken.length === 0) {
      throw new WorkspaceApplyError("This grant is missing an approval token", IPCErrorCode.ApprovalRejected);
    }
    if (this.grant.approvalToken !== approval.token) {
      throw new WorkspaceApplyError("Approval token is invalid", IPCErrorCode.ApprovalRejected);
    }
    if (this.grant.sessionId !== undefined && this.grant.sessionId !== approval.sessionId) {
      throw new WorkspaceApplyError("Approval session does not match the grant", IPCErrorCode.ApprovalRejected);
    }
    if (this.grant.grantId !== undefined && this.grant.grantId !== approval.grantId) {
      throw new WorkspaceApplyError("Approval grant does not match the granted scope", IPCErrorCode.ApprovalRejected);
    }

    const snapshot = await this.writeSnapshot(resolved);
    const results: WorkspaceFileWriteResult[] = [];
    const applied: ResolvedChange[] = [];
    try {
      for (const change of resolved) {
        if (change.currentHash !== change.expectedHash) {
          throw new WorkspaceApplyError(`Workspace file changed since approval: ${change.relativePath}`, IPCErrorCode.HashConflict);
        }
        const nextHash = sha256(change.content);
        const temporaryPath = `${change.filePath}.aer-tmp-${process.pid}`;
        await fs.writeFile(temporaryPath, change.content, "utf8");
        await fs.rename(temporaryPath, change.filePath);
        results.push({ relativePath: change.relativePath, previousHash: change.currentHash, newHash: nextHash });
        applied.push(change);
      }
    } catch (error) {
      const restored = await this.restoreOriginals(applied);
      if (error instanceof WorkspaceApplyError) {
        const existing = typeof error.details === "object" && error.details !== null ? (error.details as Record<string, unknown>) : {};
        throw new WorkspaceApplyError(error.message, error.code, { ...existing, rolledBack: applied.length > 0, restored, snapshot });
      }
      throw new WorkspaceApplyError(
        `Failed to apply changes and ${applied.length} file(s) were rolled back: ${error instanceof Error ? error.message : String(error)}`,
        IPCErrorCode.RollbackFailed,
        { rolledBack: applied.length > 0, restored, snapshot },
      );
    }

    return {
      applied: true,
      files: results,
      rolledBack: false,
      restored: [],
      diffHash,
      snapshot,
    };
  }

  /**
   * Roll back a previously applied batch by restoring the pre-apply contents
   * captured in the {@link WorkspaceApplyWriteResult.snapshot} directory.
   */
  async rollback(snapshotDir: string): Promise<WorkspaceRollbackResult> {
    this.requireTool("apply");
    if (this.grant.mode !== "read-write") {
      throw new WorkspaceAccessError("Read-only grants cannot roll back changes");
    }
    if (typeof snapshotDir !== "string" || snapshotDir.length === 0) {
      throw new WorkspaceAccessError("A snapshot directory is required to roll back");
    }
    const manifest = await this.readManifest(snapshotDir);
    const restored: string[] = [];
    for (const file of manifest.files) {
      const sourcePath = path.join(snapshotDir, file.relativePath);
      const body = await fs.readFile(sourcePath);
      if (sha256(body) !== file.previousHash) {
        throw new WorkspaceAccessError(`Snapshot integrity check failed for ${file.relativePath}`);
      }
      const targetPath = await this.resolveExistingPath(file.relativePath);
      await fs.writeFile(targetPath, body);
      restored.push(file.relativePath);
    }
    return { restored, diffHash: manifest.diffHash };
  }

  private static normalizeCommand(command: string): string {
    const normalized = command.trim();
    if (!normalized) return normalized;
    const real = path.normalize(normalized);
    return process.platform === "win32" ? real.toLowerCase() : real;
  }

  private async resolveExecutableCommand(command: string): Promise<string> {
    const trimmed = command.trim();
    if (!trimmed) {
      throw new WorkspaceAccessError("Command must not be empty");
    }

    const candidates = new Set<string>();
    if (path.isAbsolute(trimmed)) {
      candidates.add(trimmed);
    } else {
      for (const entry of (process.env.PATH ?? "").split(path.delimiter)) {
        if (!entry) continue;
        candidates.add(path.join(entry, trimmed));
      }
      candidates.add(trimmed);
    }

    for (const candidate of candidates) {
      try {
        const resolved = await fs.realpath(candidate);
        return WorkspaceTools.normalizeCommand(resolved);
      } catch {
        // Continue searching; the final candidate is kept for a transparent error.
      }
    }

    return WorkspaceTools.normalizeCommand(trimmed);
  }

  private async searchDirectory(directoryPath: string, query: string, matches: string[]): Promise<void> {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "bin" || entry.name === "obj") continue;
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await this.searchDirectory(entryPath, query, matches);
      } else if (entry.isFile()) {
        try {
          const content = await fs.readFile(entryPath, "utf8");
          if (content.includes(query)) matches.push(path.relative(this.rootPath, entryPath));
        } catch {
          // Ignore binary and unreadable files during a read-only search.
        }
      }
    }
  }

  private async resolveExistingPath(relativePath: string): Promise<string> {
    if (!relativePath || path.isAbsolute(relativePath)) {
      throw new WorkspaceAccessError("Only relative workspace paths are allowed");
    }
    const candidatePath = path.resolve(this.rootPath, relativePath);
    const candidateRelativePath = path.relative(this.rootPath, candidatePath);
    if (candidateRelativePath.startsWith(`..${path.sep}`) || path.isAbsolute(candidateRelativePath) || candidateRelativePath === "..") {
      throw new WorkspaceAccessError("Workspace path escapes the granted root");
    }
    const canonicalPath = await fs.realpath(candidatePath);
    const relativeToRoot = path.relative(this.rootPath, canonicalPath);
    if (relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot) || relativeToRoot === "..") {
      throw new WorkspaceAccessError("Workspace path escapes the granted root");
    }
    return canonicalPath;
  }

  private async resolveChanges(changes: WorkspaceApplyChange[]): Promise<ResolvedChange[]> {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new WorkspaceApplyError("At least one change is required", IPCErrorCode.InvalidPayload);
    }
    const resolved: ResolvedChange[] = [];
    const seen = new Set<string>();
    for (const change of changes) {
      if (change === null || typeof change !== "object") {
        throw new WorkspaceApplyError("Each change must be an object", IPCErrorCode.InvalidPayload);
      }
      if (typeof change.relativePath !== "string" || change.relativePath.length === 0) {
        throw new WorkspaceApplyError("Each change requires a relativePath", IPCErrorCode.InvalidPayload);
      }
      if (typeof change.content !== "string") {
        throw new WorkspaceApplyError("Each change requires a content value", IPCErrorCode.InvalidPayload);
      }
      const filePath = await this.resolveExistingPath(change.relativePath);
      const relativePath = path.relative(this.rootPath, filePath);
      if (seen.has(relativePath)) {
        throw new WorkspaceApplyError(`Duplicate change for path ${change.relativePath}`, IPCErrorCode.InvalidPayload);
      }
      seen.add(relativePath);
      const currentBody = await fs.readFile(filePath);
      const currentHash = sha256(currentBody);
      const expectedHash = typeof change.expectedHash === "string" && change.expectedHash.length > 0
        ? change.expectedHash
        : currentHash;
      if (expectedHash !== currentHash) {
        throw new WorkspaceApplyError(`Workspace file changed since preview: ${change.relativePath}`, IPCErrorCode.HashConflict);
      }
      resolved.push({
        relativePath,
        filePath,
        content: change.content,
        expectedHash,
        currentHash,
        currentBody,
        size: currentBody.length,
      });
    }
    return resolved;
  }

  private async restoreOriginals(changes: ResolvedChange[]): Promise<string[]> {
    const restored: string[] = [];
    for (const change of changes) {
      try {
        await fs.writeFile(change.filePath, change.currentBody);
        restored.push(change.relativePath);
      } catch {
        // A failed in-memory restore is still recoverable from the on-disk snapshot.
      }
    }
    return restored;
  }

  private async writeSnapshot(resolved: ResolvedChange[]): Promise<string> {
    const snapshotRoot = path.join(os.tmpdir(), "aer-workspace-snapshots");
    const id = createHash("sha256")
      .update(`${this.rootPath}|${computeApplyDiffHash(resolved)}|${Date.now()}|${process.pid}`)
      .digest("hex")
      .slice(0, 24);
    const snapshotDir = path.join(snapshotRoot, id);
    await fs.mkdir(snapshotDir, { recursive: true });
    for (const change of resolved) {
      const fileDir = path.dirname(path.join(snapshotDir, change.relativePath));
      await fs.mkdir(fileDir, { recursive: true });
      await fs.writeFile(path.join(snapshotDir, change.relativePath), change.currentBody);
    }
    const manifest = {
      rootPath: this.rootPath,
      createdAt: new Date().toISOString(),
      diffHash: computeApplyDiffHash(resolved),
      files: resolved.map((change) => ({
        relativePath: change.relativePath,
        previousHash: change.currentHash,
        newHash: sha256(change.content),
      })),
    };
    await fs.writeFile(path.join(snapshotDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    return snapshotDir;
  }

  private async readManifest(snapshotDir: string): Promise<{ diffHash: string; files: Array<{ relativePath: string; previousHash: string; newHash: string }> }> {
    let manifestJson: string;
    try {
      manifestJson = await fs.readFile(path.join(snapshotDir, "manifest.json"), "utf8");
    } catch {
      throw new WorkspaceAccessError("Snapshot manifest is missing or unreadable");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestJson);
    } catch {
      throw new WorkspaceAccessError("Snapshot manifest is malformed");
    }
    if (typeof parsed !== "object" || parsed === null || !("files" in parsed) || !Array.isArray((parsed as { files?: unknown }).files)) {
      throw new WorkspaceAccessError("Snapshot manifest is malformed");
    }
    return parsed as { diffHash: string; files: Array<{ relativePath: string; previousHash: string; newHash: string }> };
  }

  private requireTool(tool: WorkspaceToolName): void {
    if (this.grant.expiresAt && Date.parse(this.grant.expiresAt) <= Date.now()) {
      throw new WorkspaceAccessError("Workspace grant has expired");
    }
    if (!this.grant.tools.includes(tool)) {
      throw new WorkspaceAccessError(`Workspace tool not granted: ${tool}`);
    }
  }
}
