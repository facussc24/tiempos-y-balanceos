/**
 * Tests for revisionUtils — pure functions, no mocks needed.
 */

import {
    getNextRevisionLevel,
    parseRevisionLevel,
    isNewerRevision,
    formatRevisionLabel,
} from '../../utils/revisionUtils';

// ---------------------------------------------------------------------------
// getNextRevisionLevel
// ---------------------------------------------------------------------------

describe('getNextRevisionLevel', () => {
    it('should advance A to B', () => {
        expect(getNextRevisionLevel('A')).toBe('B');
    });

    it('should advance B to C', () => {
        expect(getNextRevisionLevel('B')).toBe('C');
    });

    it('should advance Y to Z', () => {
        expect(getNextRevisionLevel('Y')).toBe('Z');
    });

    it('should advance Z to AA', () => {
        expect(getNextRevisionLevel('Z')).toBe('AA');
    });

    it('should advance AA to AB', () => {
        expect(getNextRevisionLevel('AA')).toBe('AB');
    });

    it('should advance AZ to BA', () => {
        expect(getNextRevisionLevel('AZ')).toBe('BA');
    });

    it('should advance ZZ to AAA', () => {
        expect(getNextRevisionLevel('ZZ')).toBe('AAA');
    });

    it('should handle lowercase input', () => {
        expect(getNextRevisionLevel('a')).toBe('B');
    });

    it('should return A for empty string', () => {
        expect(getNextRevisionLevel('')).toBe('A');
    });

    it('should advance BA to BB', () => {
        expect(getNextRevisionLevel('BA')).toBe('BB');
    });
});

// ---------------------------------------------------------------------------
// parseRevisionLevel
// ---------------------------------------------------------------------------

describe('parseRevisionLevel', () => {
    it('should parse A as 1', () => {
        expect(parseRevisionLevel('A')).toBe(1);
    });

    it('should parse B as 2', () => {
        expect(parseRevisionLevel('B')).toBe(2);
    });

    it('should parse Z as 26', () => {
        expect(parseRevisionLevel('Z')).toBe(26);
    });

    it('should parse AA as 27', () => {
        expect(parseRevisionLevel('AA')).toBe(27);
    });

    it('should parse AB as 28', () => {
        expect(parseRevisionLevel('AB')).toBe(28);
    });

    it('should parse AZ as 52', () => {
        expect(parseRevisionLevel('AZ')).toBe(52);
    });

    it('should parse BA as 53', () => {
        expect(parseRevisionLevel('BA')).toBe(53);
    });

    it('should return 0 for empty string', () => {
        expect(parseRevisionLevel('')).toBe(0);
    });

    it('should handle lowercase', () => {
        expect(parseRevisionLevel('a')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// isNewerRevision
// ---------------------------------------------------------------------------

describe('isNewerRevision', () => {
    it('should return true when B > A', () => {
        expect(isNewerRevision('B', 'A')).toBe(true);
    });

    it('should return false when A > B', () => {
        expect(isNewerRevision('A', 'B')).toBe(false);
    });

    it('should return false when equal', () => {
        expect(isNewerRevision('A', 'A')).toBe(false);
    });

    it('should return true when AA > Z', () => {
        expect(isNewerRevision('AA', 'Z')).toBe(true);
    });

    it('should return true when BA > AZ', () => {
        expect(isNewerRevision('BA', 'AZ')).toBe(true);
    });

    it('should handle lowercase', () => {
        expect(isNewerRevision('b', 'a')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// formatRevisionLabel
// ---------------------------------------------------------------------------

describe('formatRevisionLabel', () => {
    it('should format single letter', () => {
        expect(formatRevisionLabel('A')).toBe('Rev. A');
    });

    it('should format double letter', () => {
        expect(formatRevisionLabel('AA')).toBe('Rev. AA');
    });

    it('should uppercase lowercase input', () => {
        expect(formatRevisionLabel('b')).toBe('Rev. B');
    });
});
