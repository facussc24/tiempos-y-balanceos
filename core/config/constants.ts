/**
 * Centralized Application Constants
 * "Single Source of Truth" for business rules and physical constants.
 */

export const BUSINESS_RULES = {
    // Default OEE (Overall Equipment Effectiveness)
    DEFAULT_OEE_GLOBAL: 0.85, // 85%
    DEFAULT_OEE_SECTOR: 0.85,

    // Shift Configuration
    HOURS_PER_SHIFT: 8,
    SECONDS_IN_HOUR: 3600,
    SECONDS_IN_SHIFT: 8 * 3600,

    // Manual Operations Defaults
    DEFAULT_MANUAL_TIME_SECONDS: 15,
    MIN_MANUAL_TIME_SECONDS: 0.1, // Fastest possible human action
    MAX_MANUAL_TIME_SECONDS: 3600, // 1 hour max for a single op

    // Injection Molding Defaults
    DEFAULT_INJECTION_TIME: 20, // seconds
    DEFAULT_CURING_TIME: 120, // seconds

    // Balancing
    MAX_BALANCING_ITERATIONS: 1000,
    BALANCING_TIMEOUT_MS: 5000,

    // UI Limits
    MAX_FILENAME_LENGTH: 255,
};

export const UI_CONSTANTS = {
    DEFAULT_SECTOR_COLOR: '#3b82f6',
    TOAST_DURATION: 3000,
};
