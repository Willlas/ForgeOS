/**
 * Pure exponential-backoff calculator for crash-recovery restart scheduling.
 *
 * This module exports side-effect-free functions that compute the delay
 * (in milliseconds) before each retry attempt. The only non-determinism
 * comes from `Math.random()` when jitter is enabled.
 *
 * @module core/lifecycle/backoff
 */

import { BackoffPolicy, DEFAULT_BACKOFF_POLICY } from "./types.js";

// ============================================================================
// Sanitization Helpers
// ============================================================================

/**
 * Validate and clamp a single numeric policy field to safe bounds.
 * If the value is missing, non-finite, or negative, fall back to the
 * corresponding field in {@link DEFAULT_BACKOFF_POLICY}.
 */
function clampField(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

/**
 * Build a fully-sanitized policy from the input.
 * Every field is checked independently so a partially-bad policy still works.
 */
function sanitizePolicy(policy: BackoffPolicy): BackoffPolicy {
  return {
    initialDelayMs: clampField(policy.initialDelayMs, DEFAULT_BACKOFF_POLICY.initialDelayMs),
    maxDelayMs: clampField(policy.maxDelayMs, DEFAULT_BACKOFF_POLICY.maxDelayMs),
    multiplier: clampField(policy.multiplier, DEFAULT_BACKOFF_POLICY.multiplier),
    jitter: typeof policy.jitter === "boolean" ? policy.jitter : DEFAULT_BACKOFF_POLICY.jitter,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute the exponential-backoff delay for a given 1-based attempt number.
 *
 * Formula (mirrors dispatcher.ts retry logic):
 *   base = initialDelayMs × multiplier^(attempt - 1)
 *   clamped = min(base, maxDelayMs)
 *   jitter ? random(0, clamped) : clamped
 *
 * @param attempt  - The 1-based retry attempt number (normalized: values < 1 become 1).
 * @param policy   - Backoff configuration. Falls back to defaults for any bad field.
 * @returns Delay in milliseconds before the next restart attempt.
 */
export function computeBackoffDelay(
  attempt: number,
  policy: BackoffPolicy = DEFAULT_BACKOFF_POLICY,
): number {
  // Normalize attempt so it is always >= 1.
  const safeAttempt = Math.max(1, Math.floor(attempt));

  // Sanitize every policy field independently.
  const p = sanitizePolicy(policy);

  // Compute exponential backoff and clamp to max.
  const baseDelay = p.initialDelayMs * Math.pow(p.multiplier, safeAttempt - 1);
  const clamped = Math.min(baseDelay, p.maxDelayMs);

  if (p.jitter) {
    // Full jitter: uniform random in [0, clamped].
    return Math.random() * clamped;
  }

  return clamped;
}

/**
 * Decide whether the given attempt number is still within the retry budget.
 *
 * @param attempt     - The current (1-based) attempt number.
 * @param maxRetries  - The maximum number of allowed retries.
 * @returns `true` if the attempt is still within bounds; otherwise `false`.
 */
export function shouldRetry(attempt: number, maxRetries: number): boolean {
  return attempt <= maxRetries;
}
