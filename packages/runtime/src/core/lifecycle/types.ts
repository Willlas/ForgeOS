/**
 * Lifecycle type definitions for daemon state management.
 *
 * This module is the dependency root for all lifecycle-related code.
 * It exports only types and the DEFAULT_BACKOFF_POLICY constant —
 * no runtime functions, no I/O, no imports from other lifecycle files.
 *
 * @module core/lifecycle/types
 */

// ============================================================================
// Lifecycle State Enum
// ============================================================================

/**
 * Daemon lifecycle states used by the state machine, shutdown handler,
 * and crash-recovery manager.
 *
 * Transitions (informative):
 *   Starting -> Running | Crashed
 *   Running  -> Stopping | Crashed
 *   Stopping -> (terminal)
 *   Crashed  -> Restarting | (terminal)
 *   Restarting -> Starting | Crashed (terminal after max retries)
 */
export enum LifecycleState {
  Starting = "starting",
  Running = "running",
  Stopping = "stopping",
  Crashed = "crashed",
  Restarting = "restarting",
}

// ============================================================================
// Shutdown Types
// ============================================================================

/**
 * Reasons the shutdown handler may be invoked.
 */
export type ShutdownReason =
  | "sigint"
  | "sigterm"
  | "uncaughtException"
  | "unhandledRejection"
  | "explicit"
  | "timeout"
  | "fatal";

/**
 * Context passed to the cleanup coordinator when shutdown begins.
 *
 * Every field is plain-serializable so the context can be logged
 * or snapshotted without special handling.
 */
export interface ShutdownContext {
  /** The trigger that initiated the shutdown. */
  reason: ShutdownReason;

  /** The original error if the shutdown was triggered by an exception. */
  error?: unknown;

  /** The lifecycle state the process was in when shutdown began. */
  state: LifecycleState;

  /** ISO-8601 timestamp when the shutdown was triggered. */
  triggeredAt: string;
}

// ============================================================================
// Backoff Policy
// ============================================================================

/**
 * Configuration for exponential backoff with optional jitter,
 * used by the crash-recovery manager to schedule restart attempts.
 */
export interface BackoffPolicy {
  /** Initial delay in milliseconds before the first retry. */
  initialDelayMs: number;

  /** Maximum cap on the computed delay in milliseconds. */
  maxDelayMs: number;

  /** Exponential base multiplier applied per attempt. */
  multiplier: number;

  /** Whether to add random jitter to avoid thundering-herd restarts. */
  jitter: boolean;
}

/**
 * Default backoff policy suitable for most daemon restart scenarios.
 */
export const DEFAULT_BACKOFF_POLICY: BackoffPolicy = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitter: true,
};

// ============================================================================
// Restart Decision
// ============================================================================

/**
 * Result of a crash-recovery decision.
 *
 * - `{ delayMs, attempt }` means "schedule a restart after delayMs; this is attempt N".
 * - `null` means "stop retrying — the daemon should remain in Crashed state".
 */
export type RestartDecision = { delayMs: number; attempt: number } | null;
