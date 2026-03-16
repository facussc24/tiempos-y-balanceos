/**
 * Tests for created_at preservation in INSERT OR REPLACE operations
 * and saveLibrary atomicity with transaction wrapping.
 *
 * Verifies fixes for:
 * - P1-1: INSERT OR REPLACE destroying created_at (amfe, cp, ho repositories)
 * - P1-10: saveLibrary not wrapped in transaction (amfe library)
 */

vi.mock('../../utils/database', () => {
    const mockDb = {
        select: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 }),
    };
    return { getDatabase: vi.fn().mockResolvedValue(mockDb) };
});

vi.mock('../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/crypto', () => ({
    generateChecksum: vi.fn().mockResolvedValue('checksum-abc'),
}));

vi.mock('../../modules/amfe/amfeLibraryTypes', () => ({
    buildSearchableText: vi.fn().mockReturnValue('search text'),
}));

import { saveAmfeDocument, saveLibrary, saveLibraryOperation } from '../../utils/repositories/amfeRepository';
import { saveCpDocument } from '../../utils/repositories/cpRepository';
import { saveHoDocument } from '../../utils/repositories/hoRepository';
import { getDatabase } from '../../utils/database';
import type { DbAdapter } from '../../utils/database';
import type { AmfeDocument } from '../../modules/amfe/amfeTypes';
import type { ControlPlanDocument } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';
import type { AmfeLibrary, AmfeLibraryOperation } from '../../modules/amfe/amfeLibraryTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMinimalAmfeDoc(): AmfeDocument {
    return {
        header: {
            organization: 'Test Org',
            location: 'Test Location',
            client: 'Test Client',
            modelYear: '2026',
            subject: 'Test Subject',
            startDate: '2026-01-01',
            revDate: '2026-02-01',
            team: 'Team A',
            amfeNumber: 'AMFE-001',
            responsible: 'John Doe',
            confidentiality: '',
            partNumber: 'PN-001',
            processResponsible: 'Jane Doe',
            revision: 'A',
            approvedBy: 'Boss',
            scope: 'Full', applicableParts: '',
        },
        operations: [],
    };
}

function createMinimalCpDoc(): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: 'CP-001',
            phase: 'production',
            partNumber: 'PN-001',
            latestChangeLevel: '',
            partName: 'Test Part',
            applicableParts: '',
            organization: 'Test Org',
            supplier: '',
            supplierCode: '',
            keyContactPhone: '',
            date: '2026-01-01',
            revision: 'A',
            responsible: 'John Doe',
            approvedBy: '',
            client: 'Test Client',
            coreTeam: '',
            customerEngApproval: '',
            customerQualityApproval: '',
            otherApproval: '',
            linkedAmfeProject: '',
        },
        items: [],
    };
}

function createMinimalHoDoc(): HoDocument {
    return {
        header: {
            formNumber: 'I-IN-002.4-R01',
            organization: 'Test Org',
            client: 'Test Client',
            partNumber: 'PN-001',
            partDescription: 'Test Part',
            applicableParts: '',
            linkedAmfeProject: '',
            linkedCpProject: '',
        },
        sheets: [],
    };
}

function createMinimalLibraryOp(id: string, name: string): AmfeLibraryOperation {
    return {
        id,
        opNumber: `OP-${id}`,
        name,
        workElements: [],
        lastModified: '2026-01-01T00:00:00.000Z',
        version: 1,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('created_at preservation in INSERT OR REPLACE', () => {
    let mockDb: { execute: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDb = await getDatabase() as unknown as typeof mockDb;
        mockDb.execute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
        mockDb.select.mockResolvedValue([]);
    });

    describe('saveAmfeDocument', () => {
        it('should include created_at with COALESCE in SQL', async () => {
            const doc = createMinimalAmfeDoc();
            await saveAmfeDocument('amfe-1', 'AMFE-001', 'Project A', doc);

            expect(mockDb.execute).toHaveBeenCalledTimes(1);
            const [sql] = mockDb.execute.mock.calls[0] as [string, unknown[]];

            // SQL must include created_at column
            expect(sql).toContain('created_at');
            // SQL must use COALESCE to preserve existing created_at
            expect(sql).toMatch(/COALESCE\s*\(\s*\(\s*SELECT\s+created_at\s+FROM\s+amfe_documents\s+WHERE\s+id\s*=\s*\?\s*\)\s*,\s*datetime\s*\(\s*'now'\s*\)\s*\)/i);
        });

        it('should pass the document id as COALESCE binding', async () => {
            const doc = createMinimalAmfeDoc();
            await saveAmfeDocument('amfe-1', 'AMFE-001', 'Project A', doc);

            const [, bindings] = mockDb.execute.mock.calls[0] as [string, unknown[]];
            // First binding is the row id
            expect(bindings[0]).toBe('amfe-1');
            // The id must also appear later in bindings for the COALESCE subquery
            const idOccurrences = bindings.filter(b => b === 'amfe-1');
            expect(idOccurrences.length).toBeGreaterThanOrEqual(2);
        });

        it('should preserve created_at across saves (new document gets datetime now)', async () => {
            const doc = createMinimalAmfeDoc();
            const result = await saveAmfeDocument('amfe-1', 'AMFE-001', 'Project A', doc);
            expect(result).toBe(true);

            // Second save should still pass — COALESCE will find the existing created_at
            const result2 = await saveAmfeDocument('amfe-1', 'AMFE-001', 'Project A', doc);
            expect(result2).toBe(true);

            // Both calls should use the same COALESCE pattern
            expect(mockDb.execute).toHaveBeenCalledTimes(2);
            const [sql1] = mockDb.execute.mock.calls[0] as [string, unknown[]];
            const [sql2] = mockDb.execute.mock.calls[1] as [string, unknown[]];
            expect(sql1).toBe(sql2);
        });
    });

    describe('saveCpDocument', () => {
        it('should include created_at with COALESCE in SQL', async () => {
            const doc = createMinimalCpDoc();
            await saveCpDocument('cp-1', 'Project A', doc);

            expect(mockDb.execute).toHaveBeenCalledTimes(1);
            const [sql] = mockDb.execute.mock.calls[0] as [string, unknown[]];

            expect(sql).toContain('created_at');
            expect(sql).toMatch(/COALESCE\s*\(\s*\(\s*SELECT\s+created_at\s+FROM\s+cp_documents\s+WHERE\s+id\s*=\s*\?\s*\)\s*,\s*datetime\s*\(\s*'now'\s*\)\s*\)/i);
        });

        it('should pass the document id as COALESCE binding', async () => {
            const doc = createMinimalCpDoc();
            await saveCpDocument('cp-1', 'Project A', doc);

            const [, bindings] = mockDb.execute.mock.calls[0] as [string, unknown[]];
            expect(bindings[0]).toBe('cp-1');
            const idOccurrences = bindings.filter(b => b === 'cp-1');
            expect(idOccurrences.length).toBeGreaterThanOrEqual(2);
        });

        it('should preserve created_at across saves', async () => {
            const doc = createMinimalCpDoc();
            const result = await saveCpDocument('cp-1', 'Project A', doc);
            expect(result).toBe(true);

            const result2 = await saveCpDocument('cp-1', 'Project A', doc);
            expect(result2).toBe(true);

            expect(mockDb.execute).toHaveBeenCalledTimes(2);
            const [sql1] = mockDb.execute.mock.calls[0] as [string, unknown[]];
            const [sql2] = mockDb.execute.mock.calls[1] as [string, unknown[]];
            expect(sql1).toBe(sql2);
        });
    });

    describe('saveHoDocument', () => {
        it('should include created_at with COALESCE in SQL', async () => {
            const doc = createMinimalHoDoc();
            await saveHoDocument('ho-1', doc);

            expect(mockDb.execute).toHaveBeenCalledTimes(1);
            const [sql] = mockDb.execute.mock.calls[0] as [string, unknown[]];

            expect(sql).toContain('created_at');
            expect(sql).toMatch(/COALESCE\s*\(\s*\(\s*SELECT\s+created_at\s+FROM\s+ho_documents\s+WHERE\s+id\s*=\s*\?\s*\)\s*,\s*datetime\s*\(\s*'now'\s*\)\s*\)/i);
        });

        it('should pass the document id as COALESCE binding', async () => {
            const doc = createMinimalHoDoc();
            await saveHoDocument('ho-1', doc);

            const [, bindings] = mockDb.execute.mock.calls[0] as [string, unknown[]];
            expect(bindings[0]).toBe('ho-1');
            const idOccurrences = bindings.filter(b => b === 'ho-1');
            expect(idOccurrences.length).toBeGreaterThanOrEqual(2);
        });

        it('should preserve created_at across saves', async () => {
            const doc = createMinimalHoDoc();
            const result = await saveHoDocument('ho-1', doc);
            expect(result).toBe(true);

            const result2 = await saveHoDocument('ho-1', doc);
            expect(result2).toBe(true);

            expect(mockDb.execute).toHaveBeenCalledTimes(2);
            const [sql1] = mockDb.execute.mock.calls[0] as [string, unknown[]];
            const [sql2] = mockDb.execute.mock.calls[1] as [string, unknown[]];
            expect(sql1).toBe(sql2);
        });
    });
});

describe('saveLibrary atomicity', () => {
    let mockDb: { execute: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDb = await getDatabase() as unknown as typeof mockDb;
        mockDb.execute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
        mockDb.select.mockResolvedValue([]);
    });

    it('should wrap DELETE + INSERTs in a transaction', async () => {
        const library: AmfeLibrary = {
            operations: [
                createMinimalLibraryOp('lib-1', 'Corte'),
                createMinimalLibraryOp('lib-2', 'Soldadura'),
            ],
            lastModified: '2026-01-01T00:00:00.000Z',
        };

        await saveLibrary(library);

        const calls = mockDb.execute.mock.calls.map((c: unknown[]) => (c[0] as string).trim());

        // First call: BEGIN TRANSACTION
        expect(calls[0]).toMatch(/^BEGIN\s+TRANSACTION$/i);
        // Second call: DELETE FROM amfe_library_operations
        expect(calls[1]).toMatch(/DELETE\s+FROM\s+amfe_library_operations/i);
        // Next calls: INSERT OR REPLACE for each operation
        expect(calls[2]).toMatch(/INSERT\s+OR\s+REPLACE\s+INTO\s+amfe_library_operations/i);
        expect(calls[3]).toMatch(/INSERT\s+OR\s+REPLACE\s+INTO\s+amfe_library_operations/i);
        // Last call: COMMIT
        expect(calls[4]).toMatch(/^COMMIT$/i);
    });

    it('should ROLLBACK if an INSERT fails mid-batch', async () => {
        const library: AmfeLibrary = {
            operations: [
                createMinimalLibraryOp('lib-1', 'Corte'),
                createMinimalLibraryOp('lib-2', 'Soldadura'),
                createMinimalLibraryOp('lib-3', 'Ensamble'),
            ],
            lastModified: '2026-01-01T00:00:00.000Z',
        };

        let insertCount = 0;
        mockDb.execute.mockImplementation(async (sql: string) => {
            const upper = sql.trim().toUpperCase();
            if (upper.startsWith('INSERT OR REPLACE INTO AMFE_LIBRARY')) {
                insertCount++;
                if (insertCount === 2) {
                    throw new Error('Simulated DB write failure');
                }
            }
            return { rowsAffected: 1, lastInsertId: 0 };
        });

        const result = await saveLibrary(library);
        expect(result).toBe(false);

        // Verify ROLLBACK was called
        const calls = mockDb.execute.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
        expect(calls.some((s: string) => s.toUpperCase() === 'ROLLBACK')).toBe(true);
        // Verify COMMIT was NOT called
        expect(calls.some((s: string) => s.toUpperCase() === 'COMMIT')).toBe(false);
    });

    it('should return true on successful save with empty library', async () => {
        const library: AmfeLibrary = {
            operations: [],
            lastModified: '2026-01-01T00:00:00.000Z',
        };

        const result = await saveLibrary(library);
        expect(result).toBe(true);

        const calls = mockDb.execute.mock.calls.map((c: unknown[]) => (c[0] as string).trim());
        expect(calls[0]).toMatch(/^BEGIN\s+TRANSACTION$/i);
        expect(calls[1]).toMatch(/DELETE\s+FROM\s+amfe_library_operations/i);
        expect(calls[2]).toMatch(/^COMMIT$/i);
    });
});
