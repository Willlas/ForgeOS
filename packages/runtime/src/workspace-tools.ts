import { promises as fs } from "node:fs";
import path from "node:path";

export type WorkspaceAccessMode = "read-only" | "read-write";

export interface WorkspaceAccessGrant {
  rootPath: string;
  mode: WorkspaceAccessMode;
  tools: ReadonlyArray<"list" | "read" | "search">;
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

export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
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
    const rootPath = await fs.realpath(grant.rootPath);
    return new WorkspaceTools(rootPath, { ...grant, rootPath });
  }

  getGrant(): WorkspaceAccessGrant {
    return { ...this.grant, tools: [...this.grant.tools] };
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

  private requireTool(tool: "list" | "read" | "search"): void {
    if (!this.grant.tools.includes(tool)) {
      throw new WorkspaceAccessError(`Workspace tool not granted: ${tool}`);
    }
  }
}
