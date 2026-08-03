/**
 * Workspace - Repository abstraction layer for the Runtime.
 *
 * The Workspace provides a clean interface over the repository filesystem.
 * All file operations flow through the Workspace, enabling:
 * - Deterministic path resolution
 * - Content-addressable storage
 * - Snapshot and restore capabilities
 * - File watching and change detection
 * - Diff generation for artifacts
 *
 * @module core/workspace
 */

// ============================================================================
// File Operations
// ============================================================================

/**
 * Result of reading a file from the workspace.
 */
export interface FileReadResult {
  success: boolean;
  content?: string;
  error?: string;
  path: string;
}

/**
 * Result of writing a file to the workspace.
 */
export interface FileWriteResult {
  success: boolean;
  path: string;
  bytesWritten: number;
  error?: string;
}

/**
 * Metadata about a workspace file.
 */
export interface FileMetadata {
  /** Relative path in workspace */
  path: string;

  /** File size in bytes */
  size: number;

  /** Last modified timestamp */
  modifiedAt: string;

  /** Content hash (SHA-256) */
  hash?: string;

  /** Is the file tracked by the workspace? */
  tracked: boolean;

  /** Is the file excluded by workspace config? */
  excluded: boolean;
}

// ============================================================================
// Workspace Configuration
// ============================================================================

/**
 * Configuration for the workspace.
 */
export interface WorkspaceConfig {
  /** Root directory of the workspace */
  rootPath: string;

  /** Directories to include (relative to root) */
  includes: string[];

  /** Directories to exclude (relative to root) */
  excludes: string[];

  /** Maximum file size for content addressing (bytes) */
  maxContentAddressedSize: number;

  /** Enable file watching */
  watchEnabled: boolean;

  /** Watch debounce interval (ms) */
  watchDebounceMs: number;

  /** Number of snapshots to retain */
  snapshotRetention: number;

  /** Enable indexing */
  indexEnabled: boolean;
}

/**
 * Default workspace configuration.
 */
export const DEFAULT_WORKSPACE_CONFIG: Omit<WorkspaceConfig, "rootPath"> = {
  includes: ["src", "docs", "tests", "config"],
  excludes: [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.min.js",
    "*.map",
    ".next",
    "__pycache__",
  ],
  maxContentAddressedSize: 1_048_576, // 1MB
  watchEnabled: true,
  watchDebounceMs: 300,
  snapshotRetention: 10,
  indexEnabled: true,
};

// ============================================================================
// Snapshot System
// ============================================================================

/**
 * A point-in-time snapshot of the workspace.
 */
export interface WorkspaceSnapshot {
  /** Unique snapshot identifier */
  id: string;

  /** Human-readable label */
  label: string;

  /** Timestamp of creation */
  createdAt: string;

  /** Files included in the snapshot */
  files: SnapshotFile[];

  /** Total size of all files (bytes) */
  totalSize: number;

  /** Number of files */
  fileCount: number;

  /** Metadata about the snapshot */
  metadata: Record<string, unknown>;
}

/**
 * A single file in a workspace snapshot.
 */
export interface SnapshotFile {
  /** Relative path in workspace */
  path: string;

  /** Content as base64 encoded string */
  contentBase64: string;

  /** File size */
  size: number;

  /** Content hash */
  hash: string;
}

// ============================================================================
// Index System
// ============================================================================

/**
 * Full-text and structural index of the workspace.
 */
export interface WorkspaceIndex {
  /** Version of the index format */
  version: number;

  /** Last indexed timestamp */
  lastIndexedAt: string;

  /** Total files indexed */
  fileCount: number;

  /** Total characters indexed */
  totalCharacters: number;

  /** File paths indexed */
  files: string[];

  /** Type-based index (file extension -> list of paths) */
  byType: Record<string, string[]>;

  /** Directory-based index (directory -> list of paths) */
  byDirectory: Record<string, string[]>;

  /** Keyword-based index (word -> set of file paths) */
  byKeyword: Record<string, Set<string>>;
}

/**
 * Default index version.
 */
export const INDEX_VERSION = 1;

// ============================================================================
// Change Detection
// ============================================================================

/**
 * A change detected in the workspace.
 */
export interface WorkspaceChange {
  /** Type of change */
  type: "added" | "modified" | "deleted" | "moved";

  /** File path (before move for "moved" changes) */
  oldPath?: string;

  /** File path (after move for "moved" changes) */
  newPath?: string;

  /** File hash before change */
  oldHash?: string;

  /** File hash after change */
  newHash?: string;

  /** Timestamp of change */
  timestamp: string;
}

/**
 * A diff between two versions of a file or directory.
 */
export interface WorkspaceDiff {
  /** Base path being compared */
  basePath: string;

  /** Lines added */
  additions: number;

  /** Lines removed */
  deletions: number;

  /** Unified diff text */
  unifiedDiff?: string;

  /** Changed files */
  changedFiles: DiffFile[];
}

/**
 * A single file diff.
 */
export interface DiffFile {
  /** File path */
  path: string;

  /** Lines added */
  additions: number;

  /** Lines removed */
  deletions: number;

  /** Hunk headers */
  hunks?: string[];
}

// ============================================================================
// Workspace Event Types
// ============================================================================

export enum WorkspaceEventType {
  FileAdded = "workspace.file_added",
  FileModified = "workspace.file_modified",
  FileDeleted = "workspace.file_deleted",
  SnapshotCreated = "workspace.snapshot_created",
  SnapshotRestored = "workspace.snapshot_restored",
  IndexUpdated = "workspace.index_updated",
  WorkspaceLoaded = "workspace.loaded",
  WorkspaceError = "workspace.error",
}

// ============================================================================
// Workspace Implementation
// ============================================================================

/**
 * Manages the repository workspace.
 * Provides file operations, snapshots, indexing, and change detection.
 */
export class Workspace {
  private config: WorkspaceConfig;
  private snapshots: Map<string, WorkspaceSnapshot>;
  private index: WorkspaceIndex | null;
  private changeLog: WorkspaceChange[];
  private maxChangeLogSize: number;

  constructor(config: WorkspaceConfig) {
    this.config = config;

    // Normalize includes and excludes
    this.config.includes = this.config.includes.map((p) => p.trim());
    this.config.excludes = this.config.excludes.map((p) => p.trim());

    this.snapshots = new Map();
    this.index = null;
    this.changeLog = [];
    this.maxChangeLogSize = 10_000;
  }

  /**
   * Get the workspace root path.
   */
  getRootPath(): string {
    return this.config.rootPath;
  }

  /**
   * Get workspace configuration.
   */
  getConfig(): WorkspaceConfig {
    return { ...this.config };
  }

  // --- File Operations ---

  /**
   * Resolve a relative path within the workspace.
   */
  resolve(relativePath: string): string {
    const normalized = relativePath.replace(/^\.?\//, "");
    return `${this.config.rootPath}/${normalized}`;
  }

  /**
   * Check if a relative path is within workspace includes/excludes.
   */
  isIncluded(relativePath: string): boolean {
    // Check excludes first
    for (const exclude of this.config.excludes) {
      if (relativePath.includes(exclude)) {
        return false;
      }
    }

    // Check includes
    if (this.config.includes.length === 0) {
      return true;
    }

    return this.config.includes.some((include) =>
      relativePath.startsWith(include)
    );
  }

  /**
   * Read a file from the workspace.
   */
  async readFile(relativePath: string): Promise<FileReadResult> {
    if (!this.isIncluded(relativePath)) {
      return { success: false, error: "File excluded by workspace config", path: relativePath };
    }

    try {
      const fs = await import("fs");
      const fullPath = this.resolve(relativePath);
      const content = fs.readFileSync(fullPath, "utf-8");
      return { success: true, content, path: relativePath };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error, path: relativePath };
    }
  }

  /**
   * Write a file to the workspace.
   */
  async writeFile(relativePath: string, content: string): Promise<FileWriteResult> {
    try {
      const fs = await import("fs");
      const pathModule = await import("path");
      const fullPath = this.resolve(relativePath);

      // Create directory if needed
      const dir = pathModule.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });

      // Write file
      fs.writeFileSync(fullPath, content, "utf-8");
      const bytesWritten = Buffer.byteLength(content, "utf-8");

      // Record change
      this.recordChange({
        type: fullPath.endsWith(".temp") ? "modified" : "added",
        newPath: relativePath,
        timestamp: new Date().toISOString(),
      });

      // Invalidate index if used
      if (this.index) {
        this.index = null;
      }

      return { success: true, path: relativePath, bytesWritten };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, path: relativePath, bytesWritten: 0, error };
    }
  }

  /**
   * Delete a file from the workspace.
   */
  async deleteFile(relativePath: string): Promise<boolean> {
    try {
      const fs = await import("fs");
      const fullPath = this.resolve(relativePath);

      if (!fs.existsSync(fullPath)) {
        return false;
      }

      fs.unlinkSync(fullPath);

      // Record change
      this.recordChange({
        type: "deleted",
        oldPath: relativePath,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch {
      return false;
    }
  }

  // --- Snapshots ---

  /**
   * Create a point-in-time snapshot of the workspace.
   */
  async createSnapshot(label?: string): Promise<WorkspaceSnapshot> {
    const id = `snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const files: SnapshotFile[] = [];
    let totalSize = 0;

    // This is a simplified snapshot - in production would use filesystem walking
    for (const include of this.config.includes) {
      try {
        const fs = await import("fs");
        const fullPath = `${this.config.rootPath}/${include}`;

        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const simpleHash = content.split("").reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
          }, 0);

          files.push({
            path: include,
            contentBase64: Buffer.from(content).toString("base64"),
            size: Buffer.byteLength(content),
            hash: simpleHash.toString(36),
          });

          totalSize += Buffer.byteLength(content);
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    const snapshot: WorkspaceSnapshot = {
      id,
      label: label ?? `Snapshot ${this.snapshots.size + 1}`,
      createdAt: new Date().toISOString(),
      files,
      totalSize,
      fileCount: files.length,
      metadata: {},
    };

    this.snapshots.set(id, snapshot);

    // Evict oldest if over retention limit
    while (this.snapshots.size > this.config.snapshotRetention) {
      const firstKey = this.snapshots.keys().next().value;
      if (firstKey) this.snapshots.delete(firstKey);
    }

    return snapshot;
  }

  /**
   * Restore a workspace from a snapshot.
   */
  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return false;
    }

    try {
      const fs = await import("fs");
      for (const file of snapshot.files) {
        const fullPath = `${this.config.rootPath}/${file.path}`;
        const dir = require("path").dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, Buffer.from(file.contentBase64, "base64"), "utf-8");
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all snapshot IDs.
   */
  getSnapshotIds(): string[] {
    return [...this.snapshots.keys()];
  }

  /**
   * Get a specific snapshot by ID.
   */
  getSnapshot(id: string): WorkspaceSnapshot | undefined {
    return this.snapshots.get(id);
  }

  // --- Indexing ---

  /**
   * Build a full-text index of the workspace.
   */
  async buildIndex(): Promise<WorkspaceIndex> {
    this.index = {
      version: INDEX_VERSION,
      lastIndexedAt: new Date().toISOString(),
      fileCount: 0,
      totalCharacters: 0,
      files: [],
      byType: {},
      byDirectory: {},
      byKeyword: {},
    };

    // Simplified indexing - in production would walk the filesystem
    for (const include of this.config.includes) {
      try {
        const fs = await import("fs");
        const fullPath = `${this.config.rootPath}/${include}`;

        if (fs.existsSync(fullPath)) {
          this.index.files.push(include);

          // Index by directory
          const dir = include.split("/")[0] || include;
          if (!this.index.byDirectory[dir]) {
            this.index.byDirectory[dir] = [];
          }
          this.index.byDirectory[dir].push(include);

          // Index by type (extension)
          const ext = include.split(".").pop() || "none";
          if (!this.index.byType[ext]) {
            this.index.byType[ext] = [];
          }
          this.index.byType[ext].push(include);
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    this.index.fileCount = this.index.files.length;

    return this.index;
  }

  /**
   * Get the current index (or null if not built).
   */
  getIndex(): WorkspaceIndex | null {
    return this.index;
  }

  // --- Change Detection ---

  /**
   * Record a file change.
   */
  private recordChange(change: WorkspaceChange): void {
    this.changeLog.push(change);

    // Evict oldest if over capacity
    while (this.changeLog.length > this.maxChangeLogSize) {
      this.changeLog.shift();
    }
  }

  /**
   * Get recent changes.
   */
  getRecentChanges(count?: number): WorkspaceChange[] {
    const n = count ?? this.changeLog.length;
    return [...this.changeLog].slice(-n);
  }

  /**
   * Get all changes of a specific type.
   */
  getChangesByType(type: WorkspaceChange["type"]): WorkspaceChange[] {
    return this.changeLog.filter((c) => c.type === type);
  }

  // --- Utilities ---

  /**
   * Get metadata for a file.
   */
  async getFileMetadata(relativePath: string): Promise<FileMetadata | null> {
    try {
      const fs = await import("fs");
      const fullPath = this.resolve(relativePath);

      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const stat = fs.statSync(fullPath);
      return {
        path: relativePath,
        size: stat.size,
        modifiedAt: stat.mtimeMs.toString(),
        tracked: this.isIncluded(relativePath),
        excluded: !this.isIncluded(relativePath),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get workspace health summary.
   */
  getHealth(): {
    isHealthy: boolean;
    snapshotCount: number;
    indexBuilt: boolean;
    changeLogSize: number;
    includedCount: number;
    excludedCount: number;
  } {
    return {
      isHealthy: true,
      snapshotCount: this.snapshots.size,
      indexBuilt: this.index !== null,
      changeLogSize: this.changeLog.length,
      includedCount: this.config.includes.length,
      excludedCount: this.config.excludes.length,
    };
  }
}

// ============================================================================
// Workspace Factory
// ============================================================================

/**
 * Create a workspace from configuration.
 */
export function createWorkspace(rootPath: string, partialConfig?: Partial<Omit<WorkspaceConfig, "rootPath">>): Workspace {
  const config: WorkspaceConfig = {
    rootPath,
    ...DEFAULT_WORKSPACE_CONFIG,
    ...partialConfig,
  };

  return new Workspace(config);
}

/**
 * Create a default workspace from the current working directory.
 */
export function createDefaultWorkspace(): Workspace {
  const cwd = process.cwd();
  return createWorkspace(cwd);
}