/**
 * Tests for pendingExportRepository — SQLite queue for offline export sync
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database — use vi.hoisted to avoid factory hoisting issue
const { mockDb } = vi.hoisted(() => {
    const mockDb = {
        execute: vi.fn().mockResolvedValue(undefined),
        select: vi.fn().mockResolvedValue([]),
    };
    return { mockDb };
});
vi.mock('../../../utils/database', () => ({
    getDatabase: vi.fn().mockResolvedValue(mockDb),
}));
vi.mock('../../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
    enqueue,
    dequeueAll,
    markCompleted,
    markFailed,
    getPendingCount,
    getFailedCount,
    purgeFailed,
    type PendingExportItem,
} from '../../../utils/repositories/pendingExportRepository';

describe('pendingExportRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: queue size under limit
        mockDb.select.mockResolvedValue([{ count: 0 }]);
    });

    const sampleItem: PendingExportItem = {
        module: 'amfe',
        documentId: 'doc-1',
        revisionLevel: 'A',
        exportFormat: 'xlsx',
        filename: 'AMFE - Test - Rev A (2026-03-10).xlsx',
        fileData: new Uint8Array([1, 2, 3]),
        targetDir: 'Y:\\TEST\\AMFE',
    };

    describe('enqueue', () => {
        it('should insert an export item into pending_exports', async () => {
            await enqueue(sampleItem);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO pending_exports'),
                expect.arrayContaining(['amfe', 'doc-1', 'A', 'xlsx']),
            );
        });

        it('should check for queue overflow after insert', async () => {
            await enqueue(sampleItem);
            // At least 2 calls: INSERT + SELECT COUNT for purgeExcess
            expect(mockDb.select).toHaveBeenCalled();
        });
    });

    describe('dequeueAll', () => {
        it('should return mapped items from rows', async () => {
            mockDb.select.mockResolvedValueOnce([{
                id: 1,
                module: 'amfe',
                document_id: 'doc-1',
                revision_level: 'A',
                export_format: 'xlsx',
                filename: 'test.xlsx',
                file_data: new Uint8Array([1]),
                target_dir: 'Y:\\TEST',
                created_at: '2026-03-10',
                retry_count: 0,
                last_error: null,
            }]);

            const items = await dequeueAll();
            expect(items).toHaveLength(1);
            expect(items[0].module).toBe('amfe');
            expect(items[0].documentId).toBe('doc-1');
            expect(items[0].filename).toBe('test.xlsx');
        });

        it('should only return items with retry_count < max', async () => {
            await dequeueAll();
            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringContaining('retry_count < ?'),
                [3],
            );
        });

        it('should return empty array when no pending items', async () => {
            mockDb.select.mockResolvedValueOnce([]);
            const items = await dequeueAll();
            expect(items).toEqual([]);
        });
    });

    describe('markCompleted', () => {
        it('should delete the item by id', async () => {
            await markCompleted(42);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM pending_exports WHERE id = ?'),
                [42],
            );
        });
    });

    describe('markFailed', () => {
        it('should increment retry_count and set last_error', async () => {
            await markFailed(42, 'write error');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('retry_count = retry_count + 1'),
                ['write error', 42],
            );
        });
    });

    describe('getPendingCount', () => {
        it('should return count of items under max retries', async () => {
            mockDb.select.mockResolvedValueOnce([{ count: 5 }]);
            const count = await getPendingCount();
            expect(count).toBe(5);
        });

        it('should return 0 when no rows', async () => {
            mockDb.select.mockResolvedValueOnce([]);
            const count = await getPendingCount();
            expect(count).toBe(0);
        });
    });

    describe('getFailedCount', () => {
        it('should return count of items at or above max retries', async () => {
            mockDb.select.mockResolvedValueOnce([{ count: 2 }]);
            const count = await getFailedCount();
            expect(count).toBe(2);
        });
    });

    describe('purgeFailed', () => {
        it('should delete items at or above max retries', async () => {
            mockDb.select.mockResolvedValueOnce([{ count: 3 }]);
            const purged = await purgeFailed();
            expect(purged).toBe(3);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM pending_exports WHERE retry_count >= ?'),
                [3],
            );
        });

        it('should not delete when no failed items', async () => {
            mockDb.select.mockResolvedValueOnce([{ count: 0 }]);
            const purged = await purgeFailed();
            expect(purged).toBe(0);
            expect(mockDb.execute).not.toHaveBeenCalled();
        });
    });
});
