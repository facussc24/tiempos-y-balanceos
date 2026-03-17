/**
 * Tests for exportSyncWorker — background poller for flushing pending exports
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../utils/unified_fs', () => ({
    isTauri: vi.fn(() => true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/storageManager', () => ({
    isPathAccessible: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../utils/exportPathManager', () => ({
    getExportBasePath: vi.fn().mockResolvedValue('Y:\\INGENIERIA'),
    DEFAULT_EXPORT_BASE_PATH: 'Y:\\INGENIERIA',
    UNC_EXPORT_FALLBACK: '\\\\server\\compartido\\INGENIERIA',
}));
vi.mock('../../utils/repositories/pendingExportRepository', () => ({
    getPendingCount: vi.fn().mockResolvedValue(0),
    dequeueAll: vi.fn().mockResolvedValue([]),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
}));

import {
    startExportSyncWorker,
    stopExportSyncWorker,
    flushPendingExports,
    isWorkerRunning,
    rebaseTargetDir,
} from '../../utils/exportSyncWorker';
import { isTauri } from '../../utils/unified_fs';
import { isPathAccessible } from '../../utils/storageManager';
import { getPendingCount, dequeueAll, markCompleted, markFailed } from '../../utils/repositories/pendingExportRepository';
import { writeFile, ensureDir } from '../../utils/unified_fs';

describe('exportSyncWorker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.mocked(isTauri).mockReturnValue(true);
        vi.mocked(isPathAccessible).mockResolvedValue(true);
        vi.mocked(getPendingCount).mockResolvedValue(0);
        // Ensure worker is stopped
        stopExportSyncWorker();
    });

    afterEach(() => {
        stopExportSyncWorker();
        vi.useRealTimers();
    });

    describe('startExportSyncWorker / stopExportSyncWorker', () => {
        it('should start and report running', () => {
            startExportSyncWorker(60000);
            expect(isWorkerRunning()).toBe(true);
        });

        it('should stop and report not running', () => {
            startExportSyncWorker(60000);
            stopExportSyncWorker();
            expect(isWorkerRunning()).toBe(false);
        });

        it('should not start in web mode', () => {
            vi.mocked(isTauri).mockReturnValue(false);
            startExportSyncWorker(60000);
            expect(isWorkerRunning()).toBe(false);
        });

        it('should not start twice', () => {
            startExportSyncWorker(60000);
            startExportSyncWorker(60000);
            expect(isWorkerRunning()).toBe(true);
            // stopping once should be enough
            stopExportSyncWorker();
            expect(isWorkerRunning()).toBe(false);
        });
    });

    describe('flushPendingExports', () => {
        it('should skip when no pending items', async () => {
            vi.mocked(getPendingCount).mockResolvedValue(0);
            const result = await flushPendingExports();
            expect(result.flushed).toBe(0);
            expect(dequeueAll).not.toHaveBeenCalled();
        });

        it('should skip when Y: is not available', async () => {
            vi.mocked(getPendingCount).mockResolvedValue(3);
            vi.mocked(isPathAccessible).mockResolvedValue(false);
            const result = await flushPendingExports();
            expect(result.flushed).toBe(0);
            expect(dequeueAll).not.toHaveBeenCalled();
        });

        it('should flush pending items successfully', async () => {
            vi.mocked(getPendingCount).mockResolvedValue(2);
            vi.mocked(dequeueAll).mockResolvedValue([
                {
                    id: 1, module: 'amfe', documentId: 'doc-1', revisionLevel: 'A',
                    exportFormat: 'xlsx' as const, filename: 'test1.xlsx',
                    fileData: new Uint8Array([1]), targetDir: 'Y:\\INGENIERIA\\01_AMFE\\FORD\\P-001',
                },
                {
                    id: 2, module: 'amfe', documentId: 'doc-1', revisionLevel: 'A',
                    exportFormat: 'pdf' as const, filename: 'test1.pdf',
                    fileData: new Uint8Array([2]), targetDir: 'Y:\\INGENIERIA\\01_AMFE\\FORD\\P-001',
                },
            ]);

            const result = await flushPendingExports();
            expect(result.flushed).toBe(2);
            expect(result.errors).toHaveLength(0);
            expect(writeFile).toHaveBeenCalledTimes(2);
            expect(markCompleted).toHaveBeenCalledTimes(2);
        });

        it('should mark failed items when write fails', async () => {
            vi.mocked(getPendingCount).mockResolvedValue(1);
            vi.mocked(dequeueAll).mockResolvedValue([{
                id: 1, module: 'amfe', documentId: 'doc-1', revisionLevel: 'A',
                exportFormat: 'xlsx' as const, filename: 'test.xlsx',
                fileData: new Uint8Array([1]), targetDir: 'Y:\\INGENIERIA\\01_AMFE\\FORD\\P-001',
            }]);
            vi.mocked(writeFile).mockRejectedValueOnce(new Error('access denied'));

            const result = await flushPendingExports();
            expect(result.flushed).toBe(0);
            expect(result.errors).toHaveLength(1);
            expect(markFailed).toHaveBeenCalledWith(1, 'access denied');
        });

        it('should call callback on successful flush', async () => {
            const callback = vi.fn();
            startExportSyncWorker(60000, callback);

            vi.mocked(getPendingCount).mockResolvedValue(1);
            vi.mocked(dequeueAll).mockResolvedValue([{
                id: 1, module: 'amfe', documentId: 'doc-1', revisionLevel: 'A',
                exportFormat: 'xlsx' as const, filename: 'test.xlsx',
                fileData: new Uint8Array([1]), targetDir: 'Y:\\INGENIERIA\\01_AMFE\\FORD\\P-001',
            }]);

            await flushPendingExports();
            expect(callback).toHaveBeenCalledWith({ type: 'flushed', count: 1 });
        });

        it('should rebase targetDir when flushing via UNC path', async () => {
            // Simulate: items queued with Y: but only UNC available
            const { getExportBasePath } = await import('../../utils/exportPathManager');
            vi.mocked(getExportBasePath).mockResolvedValue('Y:\\INGENIERIA');
            vi.mocked(isPathAccessible)
                .mockResolvedValueOnce(false)   // Y: unavailable
                .mockResolvedValueOnce(true);    // UNC available

            vi.mocked(getPendingCount).mockResolvedValue(1);
            vi.mocked(dequeueAll).mockResolvedValue([{
                id: 1, module: 'amfe', documentId: 'doc-1', revisionLevel: 'A',
                exportFormat: 'xlsx' as const, filename: 'test.xlsx',
                fileData: new Uint8Array([1]),
                targetDir: 'Y:\\INGENIERIA\\01_AMFE\\FORD\\P-001',
            }]);

            await flushPendingExports();

            // Should have written to UNC path, not Y:
            expect(ensureDir).toHaveBeenCalledWith(
                '\\\\server\\compartido\\INGENIERIA\\01_AMFE\\FORD\\P-001'
            );
        });
    });

    // ==========================================================================
    // rebaseTargetDir
    // ==========================================================================

    describe('rebaseTargetDir', () => {
        const yBase = 'Y:\\INGENIERIA';
        const uncBase = '\\\\server\\compartido\\INGENIERIA';

        it('should rebase Y: path to UNC', () => {
            const original = `${yBase}\\01_AMFE\\FORD\\P-001`;
            const result = rebaseTargetDir(original, uncBase);
            expect(result).toBe(`${uncBase}\\01_AMFE\\FORD\\P-001`);
        });

        it('should rebase UNC path to Y:', () => {
            const original = `${uncBase}\\02_Plan_de_Control\\TOYOTA\\P-002`;
            const result = rebaseTargetDir(original, yBase);
            expect(result).toBe(`${yBase}\\02_Plan_de_Control\\TOYOTA\\P-002`);
        });

        it('should return original if path already uses available base', () => {
            const original = `${yBase}\\01_AMFE\\FORD\\P-001`;
            const result = rebaseTargetDir(original, yBase);
            expect(result).toBe(original);
        });

        it('should return original for custom/unknown base path', () => {
            const custom = 'D:\\CustomExports\\01_AMFE\\FORD\\P-001';
            const result = rebaseTargetDir(custom, uncBase);
            expect(result).toBe(custom);
        });

        it('should handle empty suffix after base', () => {
            const result = rebaseTargetDir(yBase, uncBase);
            expect(result).toBe(uncBase);
        });
    });
});
