/**
 * Tests for revisionRepository — mocks getDatabase.
 */

const mockSelect = vi.fn();
const mockExecute = vi.fn();

vi.mock('../../../utils/database', () => ({
    getDatabase: vi.fn().mockResolvedValue({
        select: (...args: unknown[]) => mockSelect(...args),
        execute: (...args: unknown[]) => mockExecute(...args),
    }),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
    saveRevision,
    listRevisions,
    loadRevisionSnapshot,
    getLatestRevisionLevel,
} from '../../../utils/repositories/revisionRepository';

describe('revisionRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 });
    });

    // -----------------------------------------------------------------------
    // saveRevision
    // -----------------------------------------------------------------------

    describe('saveRevision', () => {
        it('should insert a revision row and return true', async () => {
            const ok = await saveRevision('amfe', 'doc-1', 'B', 'Descripcion', 'Juan', '{"data":1}', 'chk123', 'A');
            expect(ok).toBe(true);
            expect(mockExecute).toHaveBeenCalledOnce();
            const sql: string = mockExecute.mock.calls[0][0];
            expect(sql).toContain('INSERT INTO document_revisions');
            const bindings = mockExecute.mock.calls[0][1];
            expect(bindings).toEqual(['amfe', 'doc-1', 'B', 'Descripcion', 'Juan', '{"data":1}', 'chk123', 'A']);
        });

        it('should default checksum to null and parentLevel to empty', async () => {
            await saveRevision('cp', 'doc-2', 'A', 'Initial', 'Maria', '{}');
            const bindings = mockExecute.mock.calls[0][1];
            expect(bindings[6]).toBeNull();   // snapshotChecksum
            expect(bindings[7]).toBe('');      // parentLevel
        });

        it('should return false on database error', async () => {
            mockExecute.mockRejectedValueOnce(new Error('DB error'));
            const ok = await saveRevision('ho', 'doc-3', 'A', 'Test', 'X', '{}');
            expect(ok).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // listRevisions
    // -----------------------------------------------------------------------

    describe('listRevisions', () => {
        it('should return mapped revision list items', async () => {
            mockSelect.mockResolvedValueOnce([
                { revision_level: 'B', description: 'Update', revised_by: 'Juan', parent_revision_level: 'A', created_at: '2026-01-02' },
                { revision_level: 'A', description: 'Initial', revised_by: 'Maria', parent_revision_level: '', created_at: '2026-01-01' },
            ]);

            const items = await listRevisions('amfe', 'doc-1');
            expect(items).toHaveLength(2);
            expect(items[0].revisionLevel).toBe('B');
            expect(items[0].revisedBy).toBe('Juan');
            expect(items[1].revisionLevel).toBe('A');
        });

        it('should query with correct module and docId', async () => {
            mockSelect.mockResolvedValueOnce([]);
            await listRevisions('cp', 'doc-99');
            expect(mockSelect.mock.calls[0][1]).toEqual(['cp', 'doc-99']);
        });

        it('should return empty array on error', async () => {
            mockSelect.mockRejectedValueOnce(new Error('DB error'));
            const items = await listRevisions('ho', 'doc-1');
            expect(items).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // loadRevisionSnapshot
    // -----------------------------------------------------------------------

    describe('loadRevisionSnapshot', () => {
        it('should return snapshot data when found', async () => {
            mockSelect.mockResolvedValueOnce([{ snapshot_data: '{"operations":[]}' }]);
            const snap = await loadRevisionSnapshot('amfe', 'doc-1', 'A');
            expect(snap).toBe('{"operations":[]}');
        });

        it('should return null when no rows match', async () => {
            mockSelect.mockResolvedValueOnce([]);
            const snap = await loadRevisionSnapshot('amfe', 'doc-1', 'Z');
            expect(snap).toBeNull();
        });

        it('should return null on error', async () => {
            mockSelect.mockRejectedValueOnce(new Error('DB error'));
            const snap = await loadRevisionSnapshot('cp', 'doc-1', 'A');
            expect(snap).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // getLatestRevisionLevel
    // -----------------------------------------------------------------------

    describe('getLatestRevisionLevel', () => {
        it('should return the latest level from the database', async () => {
            mockSelect.mockResolvedValueOnce([{ revision_level: 'C' }]);
            const level = await getLatestRevisionLevel('amfe', 'doc-1');
            expect(level).toBe('C');
        });

        it('should return A when no revisions exist', async () => {
            mockSelect.mockResolvedValueOnce([]);
            const level = await getLatestRevisionLevel('cp', 'doc-1');
            expect(level).toBe('A');
        });

        it('should return A on error', async () => {
            mockSelect.mockRejectedValueOnce(new Error('DB error'));
            const level = await getLatestRevisionLevel('ho', 'doc-1');
            expect(level).toBe('A');
        });
    });
});
