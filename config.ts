/**
 * Application Configuration Module
 * 
 * Centralized configuration constants for the application.
 * This module consolidates previously scattered magic numbers
 * to improve maintainability and consistency.
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
 * Session lease duration in milliseconds.
 * How long a session lock is valid.
 * @default 90000 (90 seconds)
 */
export const LEASE_DURATION_MS = 90000;

/**
 * Maximum retry attempts for acquiring a lock.
 * @default 3
 */
export const LOCK_MAX_RETRIES = 3;

/**
 * Age in minutes after which orphan lock files are cleaned up.
 * @default 30 (30 minutes)
 */
export const ORPHAN_LOCK_AGE_MINUTES = 30;

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Maximum number of log entries to keep in memory.
 * @default 500
 */
export const MAX_LOG_ENTRIES = 500;

/**
 * Threshold at which log rotation begins (older entries dropped).
 * Should be less than MAX_LOG_ENTRIES.
 * @default 400
 */
export const LOG_ROTATION_THRESHOLD = 400;

// =============================================================================
// FILE SYSTEM
// =============================================================================

/**
 * Maximum length for generated filenames.
 * Leaves margin for timestamps and extensions.
 * @default 200
 */
export const MAX_FILENAME_LENGTH = 200;

// =============================================================================
// ENCRYPTION & SECURITY
// =============================================================================

/**
 * Passphrase session timeout in milliseconds.
 * How long the passphrase is cached in memory.
 * @default 1800000 (30 minutes)
 */
export const PASSPHRASE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * AES key length in bits.
 * @default 256
 */
export const ENCRYPTION_KEY_LENGTH = 256;

/**
 * Initialization Vector length in bytes for AES-GCM.
 * @default 12 (96 bits)
 */
export const ENCRYPTION_IV_LENGTH = 12;

/**
 * Salt length in bytes for key derivation.
 * @default 16 (128 bits)
 */
export const ENCRYPTION_SALT_LENGTH = 16;

// =============================================================================
// SIMULATION
// =============================================================================

/**
 * Threshold for high iteration count warning in Monte Carlo simulation.
 * @default 5000
 */
export const SIMULATION_HIGH_ITERATIONS_THRESHOLD = 5000;

/**
 * Maximum variability fallback percentage when stdDev is missing.
 * @default 0.30 (30%)
 */
export const SIMULATION_MAX_VARIABILITY_FALLBACK = 0.30;

/**
 * Default variability fallback percentage.
 * @default 0.10 (10%)
 */
export const SIMULATION_DEFAULT_VARIABILITY = 0.10;

/**
 * Batch size for Monte Carlo simulation processing.
 * @default 1000
 */
export const SIMULATION_BATCH_SIZE = 1000;

// =============================================================================
// UI & UX
// =============================================================================

/**
 * Auto-save debounce delay in milliseconds.
 * @default 2000 (2 seconds)
 */
export const AUTOSAVE_DEBOUNCE_MS = 2000;

/**
 * Toast notification default duration in milliseconds.
 * @default 5000 (5 seconds)
 */
export const TOAST_DURATION_MS = 5000;

// =============================================================================
// DEFAULTS
// =============================================================================

/**
 * Default OEE (Overall Equipment Effectiveness) value.
 * @default 0.85 (85%)
 */
export const DEFAULT_OEE = 0.85;

/**
 * Default daily demand for new projects.
 * @default 1000
 */
export const DEFAULT_DAILY_DEMAND = 1000;

/**
 * Default shift duration in minutes.
 * @default 480 (8 hours)
 */
export const DEFAULT_SHIFT_MINUTES = 480;
