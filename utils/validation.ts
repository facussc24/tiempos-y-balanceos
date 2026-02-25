/**
 * Validation utilities for secure input handling
 */

import { parseNumberInput } from './formatting';

/**
 * Safely parses an integer with validation
 * @param value - String value to parse
 * @param options - Configuration options
 * @returns Validated integer
 */
export const parseIntegerInput = (
    value: string,
    options: {
        min?: number;
        max?: number;
        defaultValue?: number;
        allowNegative?: boolean;
        strict?: boolean;
    } = {}
): number => {
    const {
        min = -2147483648, // 32-bit int min
        max = 2147483647,  // 32-bit int max
        defaultValue = 0,
        allowNegative = true,
        strict = false
    } = options;

    if (!value || value.trim() === '') return defaultValue;

    // Use robust parsing from formatting utility (handles 1.000, 1,000, etc.)
    const parsedNumber = parseNumberInput(value, {
        min: min,
        max: max,
        defaultValue: NaN, // Use NaN to detect failure locally
        allowNegative: allowNegative,
        strict: strict
    });

    if (isNaN(parsedNumber)) {
        return defaultValue;
    }

    // Ensure strictly integer result
    return Math.floor(parsedNumber);
};

/**
 * Validates and parses a positive integer (common for counts, IDs, etc.)
 */
export const parsePositiveInt = (value: string, defaultValue: number = 0): number => {
    return parseIntegerInput(value, {
        min: 0,
        defaultValue,
        allowNegative: false
    });
};

/**
 * Validates and parses a percentage value (0-100)
 */
export const parsePercentage = (value: string, defaultValue: number = 0): number => {
    return parseNumberInput(value, {
        min: 0,
        max: 100,
        defaultValue,
        allowNegative: false
    });
};

/**
 * Validates and parses OEE value (0-1)
 */
export const parseOEEValue = (value: string, defaultValue: number = 0.85): number => {
    const percentage = parseNumberInput(value, {
        min: 0,
        max: 100,
        defaultValue: defaultValue * 100,
        allowNegative: false
    });
    return percentage / 100;
};

/**
 * Validates time input (seconds, must be positive)
 */
export const parseTimeSeconds = (value: string, defaultValue: number = 0): number => {
    return parseNumberInput(value, {
        min: 0,
        max: 86400, // 24 hours in seconds
        defaultValue,
        allowNegative: false
    });
};

/**
 * Validates demand/quantity input (must be positive integer)
 */
export const parseDemand = (value: string, defaultValue: number = 0): number => {
    return parseIntegerInput(value, {
        min: 0,
        max: 1000000, // Reasonable upper limit
        defaultValue,
        allowNegative: false
    });
};

/**
 * Validates and parses task time input (seconds)
 * Allows decimals, reasonable range 0.1-3600s (1 hour max per task)
 * Returns null for empty input (allows clearing the field)
 */
export const parseTaskTime = (value: string, defaultValue: number = 0): number | null => {
    // Allow empty string → null (UX: user can clear the field)
    if (!value || value.trim() === '') return null;

    const num = parseNumberInput(value, {
        min: 0.1,        // Minimum 0.1 seconds (very fast tasks)
        max: 3600,       // Maximum 1 hour per task
        defaultValue,
        allowNegative: false
    });

    return num;
};
