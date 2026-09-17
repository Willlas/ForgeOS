/**
 * State persistence layer — atomic snapshot writer for Runtime state.
 *
 * Writes a JSON-serializable snapshot (status, health, metrics) to disk
 * using temporary-file + rename so reads never see partial/corrupt data.
 * Importable from @aer/runtime-lib without pulling in CLI code.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Schema version for snapshot shape changes. Bump on every breaking edit. */
export const SNAPSHOT_SCHEMA_VERSION = 1;

/** Default filename stored inside the state directory. */
const STATE_FILENAME = "aer-daemon.state.json";

/** Serializable snapshot — plain JSON only, no Date/Map/Set instances. */
export interface RuntimeStateSnapshot {
  schemaVersion: number;
  pid: number;
  state: string;                 // RuntimeState enum value
  healthy: boolean;
  startedAt?: string;            // ISO timestamp
  capturedAt: string;            // ISO timestamp of this snapshot
  uptimeSeconds?: number;
  health?: object;               // serializable subset of RuntimeHealth
  metrics?: object;              // MetricsCollector.getSummary() shape
}

interface StateStoreOptions {
  stateDir?: string | undefined;
}

function resolveStateDir(options?: StateStoreOptions): string {
  if (options?.stateDir) return options.stateDir;
  const customDir = process.env.AER_STATE_DIR;
  if (customDir) return customDir;
  // Default: <repo>/.daemon  (runtime-lib lives under packages/runtime/src,
  // so go up three levels to reach the repo root).
  const projectRoot = path.join(__dirname, "..", "..", "..");
  return path.join(projectRoot, ".daemon");
}

/**
 * Compute the full snapshot file path.
 */
export function getSnapshotPath(options?: StateStoreOptions): string {
  return path.join(resolveStateDir(options), STATE_FILENAME);
}

/**
 * Write a snapshot atomically: serialize → tmp file → rename.
 * Rename is atomic on the same filesystem, so readers never see partial data.
 */
export function writeSnapshot(snapshot: RuntimeStateSnapshot, options?: StateStoreOptions): void {
  const snapPath = getSnapshotPath(options);
  const stateDir = path.dirname(snapPath);

  try {
    fs.mkdirSync(stateDir, { recursive: true });
  } catch {
    // Directory already exists — harmless.
  }

  const tmpPath = `${snapPath}.tmp`;
  try {
    const json = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(tmpPath, json, { flag: "w" });
    fs.renameSync(tmpPath, snapPath);
  } catch {
    // Best-effort cleanup of leftover temp file.
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore.
    }
    throw new Error(`Failed to write state snapshot at ${snapPath}`);
  }
}

/**
 * Read the current snapshot. Returns null if missing or unparseable.
 * Never throws on corrupt/partial files — atomic writes guarantee a clean
 * final file, but we tolerate garbage just in case.
 */
export function readSnapshot(options?: StateStoreOptions): RuntimeStateSnapshot | null {
  const snapPath = getSnapshotPath(options);

  // If the final file does not exist, return null immediately.
  if (!fs.existsSync(snapPath)) {
    // A leftover .tmp from a crashed write is NOT a valid snapshot — clean it up.
    try {
      fs.unlinkSync(`${snapPath}.tmp`);
    } catch {
      // No tmp file or already gone.
    }
    return null;
  }

  try {
    const raw = fs.readFileSync(snapPath, "utf-8");
    const parsed = JSON.parse(raw);
    // Basic sanity: must have the required shape fields.
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof (parsed as RuntimeStateSnapshot).schemaVersion !== "number") return null;
    if (typeof (parsed as RuntimeStateSnapshot).pid !== "number") return null;
    if (typeof (parsed as RuntimeStateSnapshot).state !== "string") return null;
    if (typeof (parsed as RuntimeStateSnapshot).healthy !== "boolean") return null;
    if (typeof (parsed as RuntimeStateSnapshot).capturedAt !== "string") return null;
    return parsed as RuntimeStateSnapshot;
  } catch {
    // Corrupt or unparseable file — treat as missing.
    return null;
  }
}

/**
 * Best-effort removal of the snapshot file (idempotent).
 */
export function removeSnapshot(options?: StateStoreOptions): void {
  try {
    const p = getSnapshotPath(options);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // Best effort — ignore errors.
  }
}

/**
 * Convenience: return the `capturedAt` timestamp from the latest snapshot,
 * or null if no valid snapshot exists.
 */
export function getLastHeartbeat(options?: StateStoreOptions): string | null {
  const snap = readSnapshot(options);
  return snap?.capturedAt ?? null;
}
