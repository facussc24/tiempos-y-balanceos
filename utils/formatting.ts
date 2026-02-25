import { logger } from './logger';

export const formatNumber = (num: number, decimals: number = 2): string => {
    if (num === null || num === undefined || !isFinite(num) || isNaN(num)) return "—";
    return new Intl.NumberFormat("es-AR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
};

/**
 * Safely parses numeric input with validation and range checking
 * @param value - String value to parse
 * @param options - Optional configuration for min/max values and default
 * @returns Validated number or default value
 * @throws Error if value is invalid and strict mode is enabled
 */
export const parseNumberInput = (
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
        min = -1e10,
        max = 1e10,
        defaultValue = 0,
        allowNegative = true,
        strict = false
    } = options;

    if (!value || value.trim() === '') return defaultValue;

    // Clean and validate string
    const clean = value.trim();

    // Security: Validate format before parsing
    // Only allow digits, dots, commas, minus sign, plus sign, e/E (scientific), and whitespace
    if (!/^-?[\d\s.,eE+]+$/.test(clean)) {
        if (strict) throw new Error(`Invalid number format: ${value}`);
        logger.warn('Formatting', `Invalid number format detected: "${value}", using default`);
        return defaultValue;
    }

    let normalized: string;

    // Heuristic 1: If it contains a comma, assume LATAM/EU format (e.g., 1.500,50 or 1,5)
    if (clean.includes(',')) {
        // Remove all dots (thousands) then replace comma with dot
        normalized = clean.replace(/\./g, '').replace(',', '.');
    } else {
        // Heuristic 2: No comma - standard format
        normalized = clean;
    }

    // Parse the number
    const parsed = parseFloat(normalized);

    // Validation checks
    if (isNaN(parsed)) {
        if (strict) throw new Error(`Cannot parse as number: ${value}`);
        logger.warn('Formatting', `NaN detected for input: "${value}", using default`);
        return defaultValue;
    }

    if (!isFinite(parsed)) {
        if (strict) throw new Error(`Infinity not allowed: ${value}`);
        logger.warn('Formatting', `Infinity detected for input: "${value}", using default`);
        return defaultValue;
    }

    // Check negative values
    if (!allowNegative && parsed < 0) {
        if (strict) throw new Error(`Negative values not allowed: ${value}`);
        logger.warn('Formatting', `Negative value detected: "${value}", using absolute value`);
        return Math.abs(parsed);
    }

    // Range validation
    if (parsed < min) {
        if (strict) throw new Error(`Value ${parsed} below minimum ${min}`);
        logger.warn('Formatting', `Value ${parsed} below minimum ${min}, clamping`);
        return min;
    }

    if (parsed > max) {
        if (strict) throw new Error(`Value ${parsed} above maximum ${max}`);
        logger.warn('Formatting', `Value ${parsed} above maximum ${max}, clamping`);
        return max;
    }

    return parsed;
};

export const parseTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
};

export const formatTime = (minutes: number): string => {
    const h = Math.floor((minutes % (24 * 60)) / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
