vi.mock('../../../utils/database', () => {
    const mockDb = {
        select: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 }),
    };
    return { getDatabase: vi.fn().mockResolvedValue(mockDb) };
});

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/crypto', () => ({
    generateChecksum: vi.fn().mockResolvedValue('abc123'),
}));

import { listPfdDocuments, loadPfdDocument, savePfdDocument, deletePfdDocument } from '../../../utils/repositories/pfdRepository';
import { getDatabase } from '../../../utils/database';
import { createEmptyPfdDocument } from '../../../modules/pfd/pfdTypes';

describe('pfdRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listPfdDocuments', () => {
        it('should return empty array when no documents', async () => {
            const result = await listPfdDocuments();
            expect(result).toEqual([]);
        });

        it('should call select with correct SQL', async () => {
            await listPfdDocuments();
            const db = await getDatabase();
            expect(db.select).toHaveBeenCalledWith(expect.stringContaining('FROM pfd_documents'));
        });
    });

    describe('loadPfdDocument', () => {
        it('should return null when document not found', async () => {
            const result = await loadPfdDocument('nonexistent');
            expect(result).toBeNull();
        });

        it('should parse JSON data when found', async () => {
            const doc = createEmptyPfdDocument();
            const db = await getDatabase();
            (db.select as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ data: JSON.stringify(doc) }]);
            const result = await loadPfdDocument(doc.id);
            expect(result).not.toBeNull();
            expect(result!.id).toBe(doc.id);
        });
    });

    describe('savePfdDocument', () => {
        it('should return true on success', async () => {
            const doc = createEmptyPfdDocument();
            const result = await savePfdDocument(doc.id, doc);
            expect(result).toBe(true);
        });

        it('should call execute with INSERT OR REPLACE', async () => {
            const doc = createEmptyPfdDocument();
            await savePfdDocument(doc.id, doc);
            const db = await getDatabase();
            expect(db.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE'),
                expect.any(Array)
            );
        });
    });

    describe('deletePfdDocument', () => {
        it('should return true on success', async () => {
            const result = await deletePfdDocument('some-id');
            expect(result).toBe(true);
        });

        it('should call execute with DELETE', async () => {
            await deletePfdDocument('some-id');
            const db = await getDatabase();
            expect(db.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM pfd_documents'),
                ['some-id']
            );
        });
    });
});
