/**
 * Tests for autoExportService — orchestrates export generation and writing to Y:
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/storageManager', () => ({
    isPathAccessible: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../utils/exportPathManager', () => ({
    getExportBasePath: vi.fn().mockResolvedValue('Y:\\INGENIERIA'),
    resolveExportBasePath: vi.fn().mockResolvedValue('Y:\\INGENIERIA'),
    UNC_EXPORT_FALLBACK: '\\\\server\\compartido\\INGENIERIA',
    extractDocMetadata: vi.fn(() => ({ client: 'FORD', piece: 'P-001', pieceName: 'Ranger' })),
    buildExportFileInfo: vi.fn((_mod, _meta, rev, ext, base) => ({
        dir: `${base}\\01_AMFE\\FORD\\P-001`,
        filename: `AMFE - Ranger - Rev ${rev} (2026-03-10).${ext}`,
        fullPath: `${base}\\01_AMFE\\FORD\\P-001\\AMFE - Ranger - Rev ${rev} (2026-03-10).${ext}`,
    })),
    ensureExportDirs: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../utils/repositories/pendingExportRepository', () => ({
    enqueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../utils/syncManifest', () => ({
    isDuplicateExport: vi.fn().mockResolvedValue(false),
    updateManifestEntry: vi.fn().mockResolvedValue(undefined),
}));

// Mock unified_fs (merges with the mock above)
vi.mock('../../utils/unified_fs', () => ({
    isTauri: vi.fn(() => true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    writeBinaryFile: vi.fn().mockResolvedValue(true),
}));

// Mock module-specific exports
vi.mock('../../modules/amfe/amfeExcelExport', () => ({
    generateAmfeCompletoBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));
vi.mock('../../modules/amfe/amfePdfExport', () => ({
    generateAmfePdfBuffer: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
}));
vi.mock('../../modules/solicitud/solicitudExcelExport', () => ({
    generateSolicitudExcelBuffer: vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9])),
}));
vi.mock('../../modules/solicitud/solicitudPdfExport', () => ({
    generateSolicitudPdfBuffer: vi.fn().mockResolvedValue(new Uint8Array([10, 11, 12])),
}));

import { autoExportOnRevision } from '../../utils/autoExportService';
import { isTauri } from '../../utils/unified_fs';
import { isPathAccessible } from '../../utils/storageManager';
import { resolveExportBasePath } from '../../utils/exportPathManager';
import { enqueue } from '../../utils/repositories/pendingExportRepository';
import { writeBinaryFile } from '../../utils/unified_fs';

describe('autoExportService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(isTauri).mockReturnValue(true);
        vi.mocked(isPathAccessible).mockResolvedValue(true);
        vi.mocked(resolveExportBasePath).mockResolvedValue('Y:\\INGENIERIA');
        vi.mocked(writeBinaryFile).mockResolvedValue(true);
    });

    const fakeAmfeDoc = { header: { client: 'FORD', subject: 'Ranger', partNumber: 'P-001' } };

    describe('autoExportOnRevision', () => {
        it('should write Excel + PDF when Y: is available', async () => {
            const result = await autoExportOnRevision('amfe', fakeAmfeDoc, 'A', 'doc-1');
            expect(result.success).toBe(true);
            expect(result.written).toBe(2); // xlsx + pdf
            expect(result.queued).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(writeBinaryFile).toHaveBeenCalledTimes(2);
        });

        it('should skip in web mode', async () => {
            vi.mocked(isTauri).mockReturnValue(false);
            const result = await autoExportOnRevision('amfe', fakeAmfeDoc, 'A');
            expect(result.success).toBe(false);
            expect(result.written).toBe(0);
            expect(writeBinaryFile).not.toHaveBeenCalled();
        });

        it('should queue all exports when Y: is completely unavailable', async () => {
            vi.mocked(resolveExportBasePath).mockResolvedValue(null);
            const result = await autoExportOnRevision('amfe', fakeAmfeDoc, 'A', 'doc-1');
            expect(result.queued).toBe(2);
            expect(result.written).toBe(0);
            expect(enqueue).toHaveBeenCalledTimes(2);
        });

        it('should queue individual exports that fail to write', async () => {
            vi.mocked(writeBinaryFile)
                .mockRejectedValueOnce(new Error('disk full'))
                .mockResolvedValueOnce(false);

            const result = await autoExportOnRevision('amfe', fakeAmfeDoc, 'A', 'doc-1');
            // First fails and gets queued, second succeeds
            expect(result.written).toBe(1);
            expect(result.queued).toBe(1);
            expect(result.errors.length).toBeGreaterThanOrEqual(1);
        });

        it('should not throw even on unexpected errors', async () => {
            vi.mocked(resolveExportBasePath).mockRejectedValue(new Error('catastrophic'));
            // Should not throw
            const result = await autoExportOnRevision('amfe', fakeAmfeDoc, 'A');
            expect(result.success).toBe(false);
        });

        it('should write Excel + PDF for solicitud module', async () => {
            const fakeSolicitudDoc = {
                id: 'sol-1',
                tipo: 'producto' as const,
                header: { solicitudNumber: 'SGC-001', revision: 'A', fechaSolicitud: '2026-03-10', solicitante: 'Test', areaDepartamento: 'Ingenieria', formNumber: 'F-ING-001' },
                producto: { codigo: 'ABC-123', descripcion: 'Test', cliente: 'FORD' },
                insumo: null,
                observaciones: '',
                status: 'borrador' as const,
                createdAt: '', updatedAt: '', serverFolderPath: null, attachments: [], lastServerSync: null,
            };
            const result = await autoExportOnRevision('solicitud', fakeSolicitudDoc, 'A', 'sol-1');
            expect(result.success).toBe(true);
            expect(result.written).toBe(2); // xlsx + pdf
            expect(writeBinaryFile).toHaveBeenCalledTimes(2);
        });

        it('should reuse buffer when write fails (no double generation)', async () => {
            const { generateAmfeCompletoBuffer } = await import('../../modules/amfe/amfeExcelExport');
            const { generateAmfePdfBuffer } = await import('../../modules/amfe/amfePdfExport');
            vi.mocked(generateAmfeCompletoBuffer).mockClear();
            vi.mocked(generateAmfePdfBuffer).mockClear();

            vi.mocked(writeBinaryFile)
                .mockRejectedValueOnce(new Error('disk full'))
                .mockRejectedValueOnce(new Error('disk full'));

            await autoExportOnRevision('amfe', fakeAmfeDoc, 'A', 'doc-1');
            // Each generator should be called exactly once (not twice)
            expect(generateAmfeCompletoBuffer).toHaveBeenCalledTimes(1);
            expect(generateAmfePdfBuffer).toHaveBeenCalledTimes(1);
            // Both should be queued
            expect(enqueue).toHaveBeenCalledTimes(2);
        });
    });
});
