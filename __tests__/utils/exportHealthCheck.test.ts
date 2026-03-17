/**
 * Tests for exportHealthCheck — Validates and repairs export folder structure on Y:
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../utils/storageManager', () => ({
    isPathAccessible: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../utils/repositories/settingsRepository', () => ({
    getSetting: vi.fn(() => Promise.resolve(null)),
    setSetting: vi.fn(() => Promise.resolve()),
}));

const mockEnsureDir = vi.fn((_path?: string) => Promise.resolve());
const mockRename = vi.fn((_src?: string, _dst?: string) => Promise.resolve(true));
vi.mock('../../utils/unified_fs', () => ({
    isTauri: vi.fn(() => true),
    ensureDir: (path: string) => mockEnsureDir(path),
    exists: vi.fn(() => Promise.resolve(true)),
    rename: (src: string, dst: string) => mockRename(src, dst),
}));

import { isTauri } from '../../utils/unified_fs';
import { isPathAccessible } from '../../utils/storageManager';
import {
    validateExportStructure,
    repairExportStructure,
    runExportHealthCheck,
    validateAndRepair,
    type MissingFolder,
} from '../../utils/exportHealthCheck';

const BASE = 'Y:\\INGENIERIA';

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(isPathAccessible).mockResolvedValue(true);
    mockEnsureDir.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(true);
});

// ============================================================================
// validateExportStructure
// ============================================================================

describe('validateExportStructure', () => {
    it('returns healthy when all 6 module folders exist', async () => {
        const result = await validateExportStructure(BASE);

        expect(result.healthy).toBe(true);
        expect(result.accessible).toBe(true);
        expect(result.resolvedBasePath).toBe(BASE);
        expect(result.missing).toHaveLength(0);
        // isPathAccessible called: 2 for migration (legacy check + numbered check) + 6 module folders = 8
        expect(isPathAccessible).toHaveBeenCalledTimes(8);
    });

    it('reports missing folders', async () => {
        // Make 01_AMFE and 04_Diagramas_de_Flujo "missing"
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            if (path.includes('01_AMFE') || path.includes('04_Diagramas_de_Flujo')) {
                return false;
            }
            return true;
        });

        const result = await validateExportStructure(BASE);

        expect(result.healthy).toBe(false);
        expect(result.accessible).toBe(true);
        expect(result.missing).toHaveLength(2);
        expect(result.missing[0].module).toBe('amfe');
        expect(result.missing[0].folderName).toBe('01_AMFE');
        expect(result.missing[0].expectedPath).toBe('Y:\\INGENIERIA\\01_AMFE');
        expect(result.missing[1].module).toBe('pfd');
        expect(result.missing[1].folderName).toBe('04_Diagramas_de_Flujo');
    });

    it('reports all 6 folders missing', async () => {
        vi.mocked(isPathAccessible).mockResolvedValue(false);

        const result = await validateExportStructure(BASE);

        expect(result.healthy).toBe(false);
        expect(result.missing).toHaveLength(6);
        const names = result.missing.map(m => m.folderName);
        expect(names).toEqual([
            '01_AMFE',
            '02_Plan_de_Control',
            '03_Hojas_de_Operaciones',
            '04_Diagramas_de_Flujo',
            '05_Tiempos_y_Balanceos',
            '06_Solicitudes_de_Codigo',
        ]);
    });

    it('returns healthy=true and accessible=false in web mode', async () => {
        vi.mocked(isTauri).mockReturnValue(false);

        const result = await validateExportStructure();

        expect(result.healthy).toBe(true);
        expect(result.accessible).toBe(false);
        expect(result.resolvedBasePath).toBeNull();
    });

    it('returns inaccessible when no base path is reachable', async () => {
        vi.mocked(isPathAccessible).mockResolvedValue(false);

        // Don't pass basePath so it tries to resolve internally
        const result = await validateExportStructure();

        expect(result.healthy).toBe(false);
        expect(result.accessible).toBe(false);
        expect(result.resolvedBasePath).toBeNull();
        expect(result.message).toContain('No se puede acceder');
    });

    it('resolves UNC fallback when Y: is unavailable', async () => {
        // First 2 calls are path resolution: configured path (false), UNC (true)
        // Then 5 calls for module folders (all true)
        let callCount = 0;
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            callCount++;
            // Call 1: configured/default Y: path — not available
            if (path === BASE) return false;
            // Call 2: UNC fallback — available
            // Everything else: module folders — available
            return true;
        });

        const result = await validateExportStructure();

        expect(result.accessible).toBe(true);
        expect(result.resolvedBasePath).toBe('\\\\server\\compartido\\INGENIERIA');
        expect(result.healthy).toBe(true);
    });

    it('message includes missing folder names', async () => {
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            return !path.includes('03_Hojas_de_Operaciones');
        });

        const result = await validateExportStructure(BASE);

        expect(result.message).toContain('03_Hojas_de_Operaciones');
        expect(result.message).toContain('Faltan 1 carpeta(s)');
    });
});

// ============================================================================
// repairExportStructure
// ============================================================================

describe('repairExportStructure', () => {
    const missingTwo: MissingFolder[] = [
        { module: 'amfe', folderName: '01_AMFE', expectedPath: `${BASE}\\01_AMFE` },
        { module: 'cp', folderName: '02_Plan_de_Control', expectedPath: `${BASE}\\02_Plan_de_Control` },
    ];

    it('creates missing module folders + _Legacy subfolders', async () => {
        const result = await repairExportStructure(missingTwo, BASE);

        expect(result.created).toHaveLength(4); // 2 folders + 2 _Legacy
        expect(result.errors).toHaveLength(0);
        expect(mockEnsureDir).toHaveBeenCalledWith(`${BASE}\\01_AMFE`);
        expect(mockEnsureDir).toHaveBeenCalledWith(`${BASE}\\01_AMFE\\_Legacy`);
        expect(mockEnsureDir).toHaveBeenCalledWith(`${BASE}\\02_Plan_de_Control`);
        expect(mockEnsureDir).toHaveBeenCalledWith(`${BASE}\\02_Plan_de_Control\\_Legacy`);
    });

    it('returns empty result for empty missing list', async () => {
        const result = await repairExportStructure([], BASE);

        expect(result.created).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(mockEnsureDir).not.toHaveBeenCalled();
    });

    it('returns empty result in web mode', async () => {
        vi.mocked(isTauri).mockReturnValue(false);

        const result = await repairExportStructure(missingTwo, BASE);

        expect(result.created).toHaveLength(0);
        expect(mockEnsureDir).not.toHaveBeenCalled();
    });

    it('reports errors for individual folder failures', async () => {
        mockEnsureDir.mockImplementation(async (path?: string) => {
            if (path?.includes('01_AMFE') && !path.includes('_Legacy')) {
                throw new Error('Permission denied');
            }
        });

        const result = await repairExportStructure(missingTwo, BASE);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toBe(`${BASE}\\01_AMFE`);
        expect(result.errors[0].error).toContain('Permission denied');
        // 02_Plan_de_Control should still succeed
        expect(result.created).toContain(`${BASE}\\02_Plan_de_Control`);
    });

    it('continues creating remaining folders after one fails', async () => {
        const allFive: MissingFolder[] = [
            { module: 'amfe', folderName: '01_AMFE', expectedPath: `${BASE}\\01_AMFE` },
            { module: 'cp', folderName: '02_Plan_de_Control', expectedPath: `${BASE}\\02_Plan_de_Control` },
            { module: 'ho', folderName: '03_Hojas_de_Operaciones', expectedPath: `${BASE}\\03_Hojas_de_Operaciones` },
            { module: 'pfd', folderName: '04_Diagramas_de_Flujo', expectedPath: `${BASE}\\04_Diagramas_de_Flujo` },
            { module: 'tiempos', folderName: '05_Tiempos_y_Balanceos', expectedPath: `${BASE}\\05_Tiempos_y_Balanceos` },
        ];

        mockEnsureDir.mockImplementation(async (path?: string) => {
            if (path?.includes('03_Hojas') && !path.includes('_Legacy')) {
                throw new Error('Disk full');
            }
        });

        const result = await repairExportStructure(allFive, BASE);

        expect(result.errors).toHaveLength(1);
        // 4 folders succeed * 2 (folder + _Legacy) = 8 created
        expect(result.created).toHaveLength(8);
    });
});

// ============================================================================
// runExportHealthCheck (convenience wrapper)
// ============================================================================

describe('runExportHealthCheck', () => {
    it('delegates to validateExportStructure', async () => {
        const result = await runExportHealthCheck();
        expect(result.healthy).toBe(true);
    });
});

// ============================================================================
// validateAndRepair
// ============================================================================

describe('validateAndRepair', () => {
    it('returns empty result when structure is already healthy', async () => {
        const result = await validateAndRepair();

        expect(result.created).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
        expect(mockEnsureDir).not.toHaveBeenCalled();
    });

    it('repairs missing folders and returns created paths', async () => {
        // Make one folder missing
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            return !path.includes('05_Tiempos_y_Balanceos');
        });

        const result = await validateAndRepair();

        expect(result.created).toHaveLength(2); // folder + _Legacy
        expect(result.created).toContain(`${BASE}\\05_Tiempos_y_Balanceos`);
        expect(result.created).toContain(`${BASE}\\05_Tiempos_y_Balanceos\\_Legacy`);
    });

    it('returns error when network is inaccessible', async () => {
        vi.mocked(isPathAccessible).mockResolvedValue(false);

        const result = await validateAndRepair();

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain('Red no disponible');
        expect(mockEnsureDir).not.toHaveBeenCalled();
    });
});

// ============================================================================
// Legacy folder migration
// ============================================================================

import { logger } from '../../utils/logger';

describe('legacy folder migration', () => {
    it('renames "Solicitudes de Codigo" to "06_Solicitudes_de_Codigo" when only legacy exists', async () => {
        let renamed = false;
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            // Legacy unnumbered folder: exists only until renamed
            if (path === `${BASE}\\Solicitudes de Codigo`) return !renamed;
            // Numbered folder: exists only AFTER rename
            if (path === `${BASE}\\06_Solicitudes_de_Codigo`) return renamed;
            // All other module folders exist
            return true;
        });
        mockRename.mockImplementation(async () => { renamed = true; return true; });

        const result = await validateExportStructure(BASE);

        // rename should have been called
        expect(mockRename).toHaveBeenCalledWith(
            `${BASE}\\Solicitudes de Codigo`,
            `${BASE}\\06_Solicitudes_de_Codigo`,
        );
        expect(logger.info).toHaveBeenCalledWith(
            'ExportHealthCheck',
            expect.stringContaining('Migrated legacy folder'),
            expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
        );
        // After rename, all folders should exist
        expect(result.healthy).toBe(true);
        expect(result.missing).toHaveLength(0);
    });

    it('does not rename when numbered folder already exists (both present)', async () => {
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            // Both legacy AND numbered exist
            return true;
        });

        await validateExportStructure(BASE);

        // rename should NOT be called
        expect(mockRename).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'ExportHealthCheck',
            expect.stringContaining('Both legacy and numbered folders exist'),
            expect.any(Object),
        );
    });

    it('does nothing when legacy folder does not exist', async () => {
        // All accessible (all numbered folders exist, legacy does not)
        // isPathAccessible returns true for everything, but the migration checks
        // the legacy path specifically. Since all numbered folders exist, it would
        // also see the legacy path as accessible. We need a more targeted mock.
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            // Legacy folder does NOT exist
            if (path === `${BASE}\\Solicitudes de Codigo`) return false;
            return true;
        });

        await validateExportStructure(BASE);

        expect(mockRename).not.toHaveBeenCalled();
    });

    it('handles rename failure gracefully without blocking health check', async () => {
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            if (path === `${BASE}\\Solicitudes de Codigo`) return true;
            if (path === `${BASE}\\06_Solicitudes_de_Codigo`) return false;
            return true;
        });
        mockRename.mockResolvedValue(false);

        const result = await validateExportStructure(BASE);

        // Rename was attempted but failed
        expect(mockRename).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'ExportHealthCheck',
            expect.stringContaining('rename returned false'),
            expect.any(Object),
        );
        // 06_Solicitudes_de_Codigo should appear in missing (since rename failed and isPathAccessible returns false for it)
        expect(result.missing.find(m => m.module === 'solicitud')).toBeTruthy();
    });

    it('continues health check even if migration throws', async () => {
        vi.mocked(isPathAccessible).mockImplementation(async (path: string) => {
            if (path === `${BASE}\\Solicitudes de Codigo`) return true;
            if (path === `${BASE}\\06_Solicitudes_de_Codigo`) return false;
            return true;
        });
        mockRename.mockRejectedValue(new Error('Permission denied'));

        const result = await validateExportStructure(BASE);

        // Health check still completes
        expect(result.accessible).toBe(true);
        // 06_Solicitudes_de_Codigo is in missing list
        expect(result.missing.find(m => m.module === 'solicitud')).toBeTruthy();
        expect(logger.warn).toHaveBeenCalledWith(
            'ExportHealthCheck',
            expect.stringContaining('migration failed'),
            expect.any(Object),
        );
    });
});
