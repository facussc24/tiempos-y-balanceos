/**
 * Application Configuration Module
 *
 * Centralized configuration constants for concurrency, lock management,
 * and auto-save behavior.
 *
 * @module config
 */

// =============================================================================
// CONCURRENCY & LOCK MANAGEMENT
// =============================================================================

/**
 * Lock Time-To-Live in milliseconds.
 * How long a project lock remains valid before expiring.
 * @default 90000 (90 seconds)
 */
export const LOCK_TTL_MS = 90000;

/**
 * Lock heartbeat interval in milliseconds.
 * How often to refresh the lock to prevent expiration.
 * Should be less than TTL (recommended: TTL/3)
 * @default 30000 (30 seconds)
 */
export const LOCK_HEARTBEAT_MS = 30000;

/**
 * Maximum retry attempts for acquiring a lock.
 * @default 3
 */
export const LOCK_MAX_RETRIES = 3;

// =============================================================================
// UI & UX
// =============================================================================

/**
 * Auto-save debounce delay in milliseconds.
 * @default 2000 (2 seconds)
 */
export const AUTOSAVE_DEBOUNCE_MS = 2000;
