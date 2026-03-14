/**
 * Tests for versionCheckService — detects newer versions on network
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../../utils/unified_fs', () => ({ isTauri: vi.fn(() => true) }));
vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/repositories/revisionRepository', () => ({
    getLatestRevisionLevel: vi.fn().mockResolvedValue('A'),
}));
vi.mock('../../utils/syncManifest', () => ({
    detectVersionConflicts: vi.fn().mockResolvedValue([]),
    buildManifestKey: vi.fn((mod: string, id: string) => `${mod}:${id}`),
}));

import {
    checkForNewerVersions,
    checkSingleDocument,
    type DocumentRegistry,
} from '../../utils/versionCheckService';
import { isTauri } from '../../utils/unified_fs';
import { getLatestRevisionLevel } from '../../utils/repositories/revisionRepository';
import { detectVersionConflicts } from '../../utils/syncManifest';

describe('versionCheckService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isTauri).mockReturnValue(true);
    });

    // ==========================================================================
    // checkForNewerVersions
    // ==========================================================================

    describe('checkForNewerVersions', () => {
        it('should return empty when no documents to check', async () => {
            const registry: DocumentRegistry = { amfe: [], cp: [], ho: [], pfd: [], solicitud: [] };
            const result = await checkForNewerVersions(registry);
            expect(result.conflicts).toHaveLength(0);
            expect(result.checkedCount).toBe(0);
        });

        it('should return empty in web mode', async () => {
            vi.mocked(isTauri).mockReturnValue(false);
            const registry: DocumentRegistry = { amfe: ['doc-1'], cp: [], ho: [], pfd: [], solicitud: [] };
            const result = await checkForNewerVersions(registry);
            expect(result.conflicts).toHaveLength(0);
        });

        it('should build local version map and call detectVersionConflicts', async () => {
            vi.mocked(getLatestRevisionLevel).mockResolvedValue('A');
            vi.mocked(detectVersionConflicts).mockResolvedValue([]);

            const registry: DocumentRegistry = {
                amfe: ['doc-1', 'doc-2'],
                cp: ['doc-3'],
                ho: [],
                pfd: [],
                solicitud: [],
            };

            const result = await checkForNewerVersions(registry);
            expect(result.checkedCount).toBe(3);
            expect(detectVersionConflicts).toHaveBeenCalledTimes(1);

            // Verify the map passed to detectVersionConflicts
            const mapArg = vi.mocked(detectVersionConflicts).mock.calls[0][0];
            expect(mapArg.size).toBe(3);
            expect(mapArg.get('amfe:doc-1')).toEqual({
                module: 'amfe', documentId: 'doc-1', revisionLevel: 'A',
            });
        });

        it('should return conflicts when detected', async () => {
            vi.mocked(getLatestRevisionLevel).mockResolvedValue('A');
            vi.mocked(detectVersionConflicts).mockResolvedValue([{
                module: 'amfe',
                documentId: 'doc-1',
                localRevision: 'A',
                remoteRevision: 'B',
                exportedBy: 'PC-OTHER',
                exportedAt: '2026-03-10T12:00:00Z',
            }]);

            const registry: DocumentRegistry = {
                amfe: ['doc-1'],
                cp: [],
                ho: [],
                pfd: [],
                solicitud: [],
            };

            const result = await checkForNewerVersions(registry);
            expect(result.conflicts).toHaveLength(1);
            expect(result.conflicts[0].remoteRevision).toBe('B');
        });

        it('should skip documents where getLatestRevisionLevel fails', async () => {
            vi.mocked(getLatestRevisionLevel)
                .mockRejectedValueOnce(new Error('not found'))
                .mockResolvedValueOnce('B');

            const registry: DocumentRegistry = {
                amfe: ['bad-doc', 'good-doc'],
                cp: [],
                ho: [],
                pfd: [],
                solicitud: [],
            };

            const result = await checkForNewerVersions(registry);
            expect(result.checkedCount).toBe(1); // Only the good one
        });

        it('should handle detectVersionConflicts failure gracefully', async () => {
            vi.mocked(getLatestRevisionLevel).mockResolvedValue('A');
            vi.mocked(detectVersionConflicts).mockRejectedValue(new Error('network error'));

            const registry: DocumentRegistry = {
                amfe: ['doc-1'],
                cp: [],
                ho: [],
                pfd: [],
                solicitud: [],
            };

            // Should not throw
            const result = await checkForNewerVersions(registry);
            expect(result.conflicts).toHaveLength(0);
        });
    });

    // ==========================================================================
    // checkSingleDocument
    // ==========================================================================

    describe('checkSingleDocument', () => {
        it('should return null when no conflict', async () => {
            vi.mocked(detectVersionConflicts).mockResolvedValue([]);
            const result = await checkSingleDocument('amfe', 'doc-1', 'A');
            expect(result).toBeNull();
        });

        it('should return conflict when remote is newer', async () => {
            vi.mocked(detectVersionConflicts).mockResolvedValue([{
                module: 'amfe',
                documentId: 'doc-1',
                localRevision: 'A',
                remoteRevision: 'C',
                exportedBy: 'PC-2',
                exportedAt: '2026-03-10T00:00:00Z',
            }]);

            const result = await checkSingleDocument('amfe', 'doc-1', 'A');
            expect(result).not.toBeNull();
            expect(result!.remoteRevision).toBe('C');
        });

        it('should return null in web mode', async () => {
            vi.mocked(isTauri).mockReturnValue(false);
            const result = await checkSingleDocument('amfe', 'doc-1', 'A');
            expect(result).toBeNull();
        });

        it('should return null when documentId is empty', async () => {
            const result = await checkSingleDocument('amfe', '', 'A');
            expect(result).toBeNull();
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(detectVersionConflicts).mockRejectedValue(new Error('fail'));
            const result = await checkSingleDocument('amfe', 'doc-1', 'A');
            expect(result).toBeNull();
        });
    });
});
