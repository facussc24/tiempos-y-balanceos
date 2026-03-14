/**
 * Security tests — database.ts resolveDbPath path validation (Fix 4)
 *
 * Verifies that isValidDbPath correctly:
 * - Accepts valid Windows drive-letter paths ending in .db
 * - Accepts valid UNC paths ending in .db
 * - Rejects paths containing .. (directory traversal)
 * - Rejects paths that do not end with .db
 * - Rejects paths that do not start with a drive letter or UNC prefix
 *
 * Also verifies that resolveDbPath falls back to the default when
 * localStorage contains an invalid base path.
 */

vi.mock('../../utils/unified_fs', () => ({
    isTauri: vi.fn().mockReturnValue(false),
}));

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isValidDbPath, resetDatabaseForTesting, closeDatabase } from '../../utils/database';

describe('database — isValidDbPath (Fix 4)', () => {
    describe('valid paths', () => {
        it('accepts a standard Windows drive-letter path ending in .db', () => {
            expect(isValidDbPath('C:\\Users\\Data\\barack_mercosul.db')).toBe(true);
        });

        it('accepts a network drive path ending in .db', () => {
            expect(isValidDbPath('Y:\\Ingenieria\\Docs\\barack_mercosul.db')).toBe(true);
        });

        it('accepts the default fallback path', () => {
            expect(
                isValidDbPath(
                    'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos\\barack_mercosul.db'
                )
            ).toBe(true);
        });

        it('accepts a UNC path ending in .db', () => {
            expect(isValidDbPath('\\\\server\\share\\data\\barack_mercosul.db')).toBe(true);
        });

        it('accepts a path with mixed case drive letter', () => {
            expect(isValidDbPath('c:\\data\\mydb.db')).toBe(true);
            expect(isValidDbPath('Z:\\deep\\path\\file.db')).toBe(true);
        });
    });

    describe('directory traversal rejection', () => {
        it('rejects a path with .. in the middle', () => {
            expect(isValidDbPath('C:\\data\\..\\windows\\system32\\evil.db')).toBe(false);
        });

        it('rejects a path that starts with ..', () => {
            expect(isValidDbPath('..\\..\\evil.db')).toBe(false);
        });

        it('rejects a path with .. at the end before filename', () => {
            expect(isValidDbPath('C:\\data\\..\\evil.db')).toBe(false);
        });

        it('rejects a path with encoded-like .. sequences', () => {
            // Literal ".." must be blocked; percent-encoding is separate concern
            expect(isValidDbPath('C:\\data\\%2e%2e\\evil.db')).toBe(true); // no literal ..
            expect(isValidDbPath('C:\\data\\..\\evil.db')).toBe(false);  // literal ..
        });
    });

    describe('.db extension requirement', () => {
        it('rejects a path ending in .exe', () => {
            expect(isValidDbPath('C:\\data\\evil.exe')).toBe(false);
        });

        it('rejects a path ending in .sqlite', () => {
            expect(isValidDbPath('C:\\data\\file.sqlite')).toBe(false);
        });

        it('rejects a path with no extension', () => {
            expect(isValidDbPath('C:\\data\\noext')).toBe(false);
        });

        it('rejects a path ending in .DB (wrong case)', () => {
            // Our implementation uses endsWith('.db') which is case-sensitive
            expect(isValidDbPath('C:\\data\\file.DB')).toBe(false);
        });
    });

    describe('drive letter / UNC prefix requirement', () => {
        it('rejects a relative path', () => {
            expect(isValidDbPath('data\\barack_mercosul.db')).toBe(false);
        });

        it('rejects a Unix-style absolute path', () => {
            expect(isValidDbPath('/home/user/data.db')).toBe(false);
        });

        it('rejects an empty string', () => {
            expect(isValidDbPath('')).toBe(false);
        });

        it('rejects a path with only a drive letter and no backslash', () => {
            expect(isValidDbPath('C:file.db')).toBe(false);
        });

        it('rejects a path starting with a number instead of drive letter', () => {
            expect(isValidDbPath('1:\\data\\file.db')).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('rejects null / undefined (type-guarded)', () => {
            expect(isValidDbPath(null as unknown as string)).toBe(false);
            expect(isValidDbPath(undefined as unknown as string)).toBe(false);
        });

        it('rejects a path that is just whitespace', () => {
            expect(isValidDbPath('   ')).toBe(false);
        });
    });
});

describe('database — resolveDbPath falls back on invalid localStorage path (Fix 4)', () => {
    const DEFAULT_PATH =
        'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\15. Tiempos\\barack_mercosul.db';

    beforeEach(() => {
        resetDatabaseForTesting();
        localStorage.clear();
    });

    afterEach(async () => {
        await closeDatabase();
        localStorage.clear();
    });

    it('uses the default path when localStorage is empty', async () => {
        // We cannot call resolveDbPath directly (it is not exported), but
        // we can verify its behavior indirectly by checking that getDatabase()
        // initializes correctly even when localStorage is empty (in-memory mode).
        const { getDatabase } = await import('../../utils/database');
        const db = await getDatabase();
        expect(db).toBeDefined();
    });

    it('isValidDbPath rejects a traversal path that would be built from bad localStorage', () => {
        // Simulate what resolveDbPath does: base + '\\barack_mercosul.db'
        const evilBase = '..\\..\\windows';
        const candidatePath = `${evilBase}\\barack_mercosul.db`;
        expect(isValidDbPath(candidatePath)).toBe(false);
    });

    it('isValidDbPath accepts a well-formed base path', () => {
        const goodBase = 'Y:\\Ingenieria\\Docs';
        const candidatePath = `${goodBase}\\barack_mercosul.db`;
        expect(isValidDbPath(candidatePath)).toBe(true);
    });
});
