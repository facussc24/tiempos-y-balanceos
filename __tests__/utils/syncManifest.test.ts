/**
 * Tests for syncManifest — manifest read/write, duplicate detection, version conflicts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../utils/unified_fs', () => ({
    isTauri: vi.fn(() => true),
    readTextFile: vi.fn().mockResolvedValue(null),
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
    UNC_EXPORT_FALLBACK: '\\\\server\\compartido\\INGENIERIA',
    buildManifestPath: vi.fn((base: string) => `${base}\\_sync_manifest.json`),
}));
vi.mock('../../utils/revisionUtils', () => ({
    isNewerRevision: vi.fn((a: string, b: string) => {
        // Simple mock: single char comparison
        return a > b;
    }),
}));

import {
    readManifest,
    writeManifest,
    updateManifestEntry,
    isDuplicateExport,
    detectVersionConflicts,
    getManifestEntry,
    buildManifestKey,
    type SyncManifest,
    type SyncManifestEntry,
} from '../../utils/syncManifest';
import { isTauri } from '../../utils/unified_fs';
import { isPathAccessible } from '../../utils/storageManager';
import { readTextFile, writeFile } from '../../utils/unified_fs';

describe('syncManifest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isTauri).mockReturnValue(true);
        vi.mocked(isPathAccessible).mockResolvedValue(true);
    });

    // ==========================================================================
    // buildManifestKey
    // ==========================================================================

    describe('buildManifestKey', () => {
        it('should build key from module and documentId', () => {
            expect(buildManifestKey('amfe', 'doc-123')).toBe('amfe:doc-123');
        });

        it('should handle different modules', () => {
            expect(buildManifestKey('cp', 'doc-456')).toBe('cp:doc-456');
            expect(buildManifestKey('ho', 'doc-789')).toBe('ho:doc-789');
        });
    });

    // ==========================================================================
    // readManifest
    // ==========================================================================

    describe('readManifest', () => {
        it('should return empty manifest when file does not exist', async () => {
            vi.mocked(readTextFile).mockRejectedValue(new Error('not found'));
            const manifest = await readManifest('Y:\\INGENIERIA');
            expect(manifest.version).toBe(1);
            expect(Object.keys(manifest.entries)).toHaveLength(0);
        });

        it('should return empty manifest in web mode', async () => {
            vi.mocked(isTauri).mockReturnValue(false);
            const manifest = await readManifest();
            expect(Object.keys(manifest.entries)).toHaveLength(0);
        });

        it('should parse valid manifest file', async () => {
            const stored: SyncManifest = {
                version: 1,
                lastUpdated: '2026-03-10T12:00:00Z',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe',
                        documentId: 'doc-1',
                        client: 'FORD',
                        piece: 'P-001',
                        pieceName: 'Ranger',
                        revisionLevel: 'B',
                        filenames: ['AMFE - Ranger - Rev B.xlsx'],
                        exportedAt: '2026-03-10T12:00:00Z',
                        exportedBy: 'PC-FABRICA',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(stored));

            const manifest = await readManifest('Y:\\INGENIERIA');
            expect(manifest.entries['amfe:doc-1'].revisionLevel).toBe('B');
            expect(manifest.entries['amfe:doc-1'].exportedBy).toBe('PC-FABRICA');
        });

        it('should return empty manifest for invalid JSON', async () => {
            vi.mocked(readTextFile).mockResolvedValue('not json');
            const manifest = await readManifest('Y:\\INGENIERIA');
            expect(Object.keys(manifest.entries)).toHaveLength(0);
        });

        it('should return empty manifest for invalid version', async () => {
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({ version: 2, entries: {} }));
            const manifest = await readManifest('Y:\\INGENIERIA');
            expect(Object.keys(manifest.entries)).toHaveLength(0);
        });

        it('should return empty manifest when Y: is not accessible', async () => {
            vi.mocked(isPathAccessible).mockResolvedValue(false);
            const manifest = await readManifest();
            expect(Object.keys(manifest.entries)).toHaveLength(0);
        });
    });

    // ==========================================================================
    // writeManifest
    // ==========================================================================

    describe('writeManifest', () => {
        it('should write manifest to disk', async () => {
            const manifest: SyncManifest = {
                version: 1,
                lastUpdated: '',
                entries: {},
            };

            const result = await writeManifest(manifest, 'Y:\\INGENIERIA');
            expect(result).toBe(true);
            expect(writeFile).toHaveBeenCalledTimes(1);

            // Verify the written content is valid JSON
            const writtenData = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
            const content = new TextDecoder().decode(writtenData);
            const parsed = JSON.parse(content);
            expect(parsed.version).toBe(1);
        });

        it('should return false in web mode', async () => {
            vi.mocked(isTauri).mockReturnValue(false);
            const result = await writeManifest({ version: 1, lastUpdated: '', entries: {} });
            expect(result).toBe(false);
        });

        it('should return false when path is not accessible', async () => {
            vi.mocked(isPathAccessible).mockResolvedValue(false);
            const result = await writeManifest({ version: 1, lastUpdated: '', entries: {} });
            expect(result).toBe(false);
        });
    });

    // ==========================================================================
    // updateManifestEntry
    // ==========================================================================

    describe('updateManifestEntry', () => {
        it('should create new entry in empty manifest', async () => {
            // readTextFile throws (no file) → empty manifest → update → write
            vi.mocked(readTextFile).mockRejectedValue(new Error('not found'));

            const result = await updateManifestEntry(
                'amfe', 'doc-1', 'FORD', 'P-001', 'Ranger', 'A',
                ['AMFE - Ranger - Rev A.xlsx', 'AMFE - Ranger - Rev A.pdf'],
                'Y:\\INGENIERIA',
            );

            expect(result).toBe(true);
            expect(writeFile).toHaveBeenCalledTimes(1);

            // Parse what was written
            const writtenData = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
            const content = new TextDecoder().decode(writtenData);
            const manifest = JSON.parse(content) as SyncManifest;

            expect(manifest.entries['amfe:doc-1']).toBeDefined();
            expect(manifest.entries['amfe:doc-1'].revisionLevel).toBe('A');
            expect(manifest.entries['amfe:doc-1'].filenames).toHaveLength(2);
        });

        it('should update existing entry', async () => {
            const existing: SyncManifest = {
                version: 1,
                lastUpdated: '2026-03-09T00:00:00Z',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe',
                        documentId: 'doc-1',
                        client: 'FORD',
                        piece: 'P-001',
                        pieceName: 'Ranger',
                        revisionLevel: 'A',
                        filenames: ['old.xlsx'],
                        exportedAt: '2026-03-09T00:00:00Z',
                        exportedBy: 'PC-OLD',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(existing));

            await updateManifestEntry(
                'amfe', 'doc-1', 'FORD', 'P-001', 'Ranger', 'B',
                ['AMFE - Ranger - Rev B.xlsx', 'AMFE - Ranger - Rev B.pdf'],
                'Y:\\INGENIERIA',
            );

            const writtenData = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
            const content = new TextDecoder().decode(writtenData);
            const manifest = JSON.parse(content) as SyncManifest;

            expect(manifest.entries['amfe:doc-1'].revisionLevel).toBe('B');
        });

        it('should skip when documentId is empty', async () => {
            const result = await updateManifestEntry(
                'amfe', '', 'FORD', 'P-001', 'Ranger', 'A', ['file.xlsx'],
            );
            expect(result).toBe(false);
            expect(writeFile).not.toHaveBeenCalled();
        });

        it('should preserve other entries when updating', async () => {
            const existing: SyncManifest = {
                version: 1,
                lastUpdated: '2026-03-09T00:00:00Z',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'A',
                        filenames: ['old.xlsx'], exportedAt: '2026-03-09T00:00:00Z', exportedBy: 'PC1',
                    },
                    'cp:doc-2': {
                        module: 'cp', documentId: 'doc-2', client: 'TOYOTA',
                        piece: 'P-002', pieceName: 'Hilux', revisionLevel: 'C',
                        filenames: ['cp.xlsx'], exportedAt: '2026-03-09T00:00:00Z', exportedBy: 'PC2',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(existing));

            await updateManifestEntry(
                'amfe', 'doc-1', 'FORD', 'P-001', 'Ranger', 'B',
                ['new.xlsx'], 'Y:\\INGENIERIA',
            );

            const writtenData = vi.mocked(writeFile).mock.calls[0][1] as Uint8Array;
            const content = new TextDecoder().decode(writtenData);
            const manifest = JSON.parse(content) as SyncManifest;

            // doc-1 updated
            expect(manifest.entries['amfe:doc-1'].revisionLevel).toBe('B');
            // doc-2 preserved
            expect(manifest.entries['cp:doc-2'].revisionLevel).toBe('C');
        });
    });

    // ==========================================================================
    // isDuplicateExport
    // ==========================================================================

    describe('isDuplicateExport', () => {
        it('should return false when manifest is empty', async () => {
            vi.mocked(readTextFile).mockRejectedValue(new Error('not found'));
            const result = await isDuplicateExport('amfe', 'doc-1', 'A');
            expect(result).toBe(false);
        });

        it('should return false when document not in manifest', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '', entries: {},
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));
            const result = await isDuplicateExport('amfe', 'doc-1', 'A');
            expect(result).toBe(false);
        });

        it('should return true when same revision exists', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'A',
                        filenames: ['f.xlsx'], exportedAt: '', exportedBy: 'PC',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));
            const result = await isDuplicateExport('amfe', 'doc-1', 'A');
            expect(result).toBe(true);
        });

        it('should return false when different revision', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'A',
                        filenames: ['f.xlsx'], exportedAt: '', exportedBy: 'PC',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));
            const result = await isDuplicateExport('amfe', 'doc-1', 'B');
            expect(result).toBe(false);
        });

        it('should return false when documentId is empty', async () => {
            const result = await isDuplicateExport('amfe', '', 'A');
            expect(result).toBe(false);
        });
    });

    // ==========================================================================
    // detectVersionConflicts
    // ==========================================================================

    describe('detectVersionConflicts', () => {
        it('should return empty when no local versions', async () => {
            const conflicts = await detectVersionConflicts(new Map());
            expect(conflicts).toHaveLength(0);
        });

        it('should return empty in web mode', async () => {
            vi.mocked(isTauri).mockReturnValue(false);
            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'A' }],
            ]);
            const conflicts = await detectVersionConflicts(local);
            expect(conflicts).toHaveLength(0);
        });

        it('should detect newer version on network', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'B',
                        filenames: ['f.xlsx'], exportedAt: '2026-03-10T10:00:00Z',
                        exportedBy: 'PC-FABRICA',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));

            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'A' }],
            ]);

            const conflicts = await detectVersionConflicts(local, 'Y:\\INGENIERIA');
            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].localRevision).toBe('A');
            expect(conflicts[0].remoteRevision).toBe('B');
            expect(conflicts[0].exportedBy).toBe('PC-FABRICA');
        });

        it('should not flag when local is same version', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'A',
                        filenames: ['f.xlsx'], exportedAt: '', exportedBy: 'PC',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));

            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'A' }],
            ]);

            const conflicts = await detectVersionConflicts(local, 'Y:\\INGENIERIA');
            expect(conflicts).toHaveLength(0);
        });

        it('should not flag when local is newer', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'A',
                        filenames: ['f.xlsx'], exportedAt: '', exportedBy: 'PC',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));

            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'B' }],
            ]);

            const conflicts = await detectVersionConflicts(local, 'Y:\\INGENIERIA');
            expect(conflicts).toHaveLength(0);
        });

        it('should skip documents not in manifest', async () => {
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
                version: 1, lastUpdated: '', entries: {},
            }));

            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'A' }],
            ]);

            const conflicts = await detectVersionConflicts(local, 'Y:\\INGENIERIA');
            expect(conflicts).toHaveLength(0);
        });

        it('should detect multiple conflicts', async () => {
            const manifest: SyncManifest = {
                version: 1, lastUpdated: '',
                entries: {
                    'amfe:doc-1': {
                        module: 'amfe', documentId: 'doc-1', client: 'FORD',
                        piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'C',
                        filenames: [], exportedAt: '', exportedBy: 'PC2',
                    },
                    'cp:doc-2': {
                        module: 'cp', documentId: 'doc-2', client: 'TOYOTA',
                        piece: 'P-002', pieceName: 'Hilux', revisionLevel: 'B',
                        filenames: [], exportedAt: '', exportedBy: 'PC3',
                    },
                },
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(manifest));

            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'A' }],
                ['cp:doc-2', { module: 'cp' as const, documentId: 'doc-2', revisionLevel: 'A' }],
            ]);

            const conflicts = await detectVersionConflicts(local, 'Y:\\INGENIERIA');
            expect(conflicts).toHaveLength(2);
        });

        it('should return empty when Y: is unavailable', async () => {
            vi.mocked(isPathAccessible).mockResolvedValue(false);
            const local = new Map([
                ['amfe:doc-1', { module: 'amfe' as const, documentId: 'doc-1', revisionLevel: 'A' }],
            ]);
            const conflicts = await detectVersionConflicts(local);
            expect(conflicts).toHaveLength(0);
        });
    });

    // ==========================================================================
    // getManifestEntry
    // ==========================================================================

    describe('getManifestEntry', () => {
        it('should return entry when found', async () => {
            const entry: SyncManifestEntry = {
                module: 'amfe', documentId: 'doc-1', client: 'FORD',
                piece: 'P-001', pieceName: 'Ranger', revisionLevel: 'B',
                filenames: ['f.xlsx'], exportedAt: '2026-03-10T00:00:00Z', exportedBy: 'PC',
            };
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
                version: 1, lastUpdated: '', entries: { 'amfe:doc-1': entry },
            }));

            const result = await getManifestEntry('amfe', 'doc-1', 'Y:\\INGENIERIA');
            expect(result).toEqual(entry);
        });

        it('should return null when not found', async () => {
            vi.mocked(readTextFile).mockResolvedValue(JSON.stringify({
                version: 1, lastUpdated: '', entries: {},
            }));
            const result = await getManifestEntry('amfe', 'doc-1', 'Y:\\INGENIERIA');
            expect(result).toBeNull();
        });

        it('should return null when path unavailable', async () => {
            vi.mocked(isPathAccessible).mockResolvedValue(false);
            const result = await getManifestEntry('amfe', 'doc-1');
            expect(result).toBeNull();
        });
    });
});
