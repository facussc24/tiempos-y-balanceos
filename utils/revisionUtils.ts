/**
 * Revision Utilities
 *
 * Pure functions for revision level management.
 * No external dependencies — safe for testing and reuse.
 *
 * @module revisionUtils
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevisionEntry {
    revisionLevel: string;
    previousLevel: string;
    description: string;
    revisedBy: string;
    date: string; // ISO
}

export type DocumentModule = 'amfe' | 'cp' | 'ho' | 'pfd' | 'solicitud';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the next revision level in sequence.
 * 'A' → 'B', 'Z' → 'AA', 'AA' → 'AB', 'AZ' → 'BA', etc.
 */
export function getNextRevisionLevel(current: string): string {
    const upper = current.toUpperCase();
    if (upper.length === 0) return 'A';

    const chars = upper.split('');
    let carry = true;

    for (let i = chars.length - 1; i >= 0 && carry; i--) {
        const code = chars[i].charCodeAt(0);
        if (code < 90) { // < 'Z'
            chars[i] = String.fromCharCode(code + 1);
            carry = false;
        } else {
            chars[i] = 'A';
            // carry remains true
        }
    }

    if (carry) {
        chars.unshift('A');
    }

    return chars.join('');
}

/**
 * Convert a revision level to a numeric value for comparison.
 * A=1, B=2, ..., Z=26, AA=27, AB=28, ...
 */
export function parseRevisionLevel(level: string): number {
    const upper = level.toUpperCase();
    if (upper.length === 0) return 0;

    let value = 0;
    for (let i = 0; i < upper.length; i++) {
        value = value * 26 + (upper.charCodeAt(i) - 64); // 'A' = 65, so 65-64=1
    }
    return value;
}

/**
 * True if revision `a` is newer (higher) than revision `b`.
 */
export function isNewerRevision(a: string, b: string): boolean {
    return parseRevisionLevel(a) > parseRevisionLevel(b);
}

/**
 * Format a revision level for display: "Rev. B"
 */
export function formatRevisionLabel(level: string): string {
    return `Rev. ${level.toUpperCase()}`;
}
