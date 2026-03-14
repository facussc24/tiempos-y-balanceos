/**
 * Tests for solicitudReconciliation.ts
 *
 * Covers: extractSolicitudNumber, scanServerFolders, reconcile, runReconciliation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted to avoid factory TDZ issues)
// ---------------------------------------------------------------------------

const {
    mockLogger,
    mockGetSolicitudBasePath,
    mockListSolicitudes,
    mockSetSetting,
} = vi.hoisted(() => ({
    mockLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    mockGetSolicitudBasePath: vi.fn(),
    mockListSolicitudes: vi.fn(),
    mockSetSetting: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
    logger: mockLogger,
}));

vi.mock('../../../modules/solicitud/solicitudServerManager', () => ({
    getSolicitudBasePath: (...args: unknown[]) => mockGetSolicitudBasePath(...args),
}));

vi.mock('../../../utils/repositories/solicitudRepository', () => ({
    listSolicitudes: (...args: unknown[]) => mockListSolicitudes(...args),
}));

vi.mock('../../../utils/repositories/settingsRepository', () => ({
    setSetting: (...args: unknown[]) => mockSetSetting(...args),
}));

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import {
    extractSolicitudNumber,
    scanServerFolders,
    reconcile,
    runReconciliation,
} from '../../../modules/solicitud/solicitudReconciliation';
import type { ServerFolderInfo } from '../../../modules/solicitud/solicitudReconciliation';
import type { SolicitudListItem } from '../../../modules/solicitud/solicitudTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbItem(overrides: Partial<SolicitudListItem> = {}): SolicitudListItem {
    return {
        id: '1',
        solicitud_number: 'SGC-001',
        tipo: 'producto',
        codigo: 'ABC-123',
        descripcion: 'Test',
        solicitante: 'Juan',
        area_departamento: 'Ingenieria',
        status: 'borrador',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        ...overrides,
    } as SolicitudListItem;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractSolicitudNumber', () => {
    it('extracts number before first underscore', () => {
        expect(extractSolicitudNumber('SGC-001_ABC-123_Cliente')).toBe('SGC-001');
    });

    it('extracts number with single underscore segment', () => {
        expect(extractSolicitudNumber('SGC-042_XYZ')).toBe('SGC-042');
    });

    it('returns full name if no underscore', () => {
        expect(extractSolicitudNumber('SGC-100')).toBe('SGC-100');
    });
});

describe('scanServerFolders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('always returns empty array (not supported in web mode)', async () => {
        const result = await scanServerFolders('Y:\\Base');
        expect(result).toEqual([]);
    });

    it('logs a debug message about web mode', async () => {
        await scanServerFolders('Y:\\Base');
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'Reconciliation',
            expect.stringContaining('web mode'),
        );
    });

    it('returns empty array regardless of the basePath argument', async () => {
        const result1 = await scanServerFolders('Y:\\SomePath');
        const result2 = await scanServerFolders('');
        const result3 = await scanServerFolders('Z:\\Other\\Path');
        expect(result1).toEqual([]);
        expect(result2).toEqual([]);
        expect(result3).toEqual([]);
    });
});

describe('reconcile', () => {
    it('detects matched items', () => {
        const serverFolders: ServerFolderInfo[] = [
            { folderName: 'SGC-001_ABC', solicitudNumber: 'SGC-001', tipo: 'producto', fullPath: 'Y:\\p\\SGC-001_ABC' },
        ];
        const dbItems = [makeDbItem({ solicitud_number: 'SGC-001' })];

        const result = reconcile(serverFolders, dbItems);
        expect(result.matched).toBe(1);
        expect(result.onlyOnServer).toHaveLength(0);
        expect(result.onlyInDb).toHaveLength(0);
    });

    it('detects folders only on server (no DB record)', () => {
        const serverFolders: ServerFolderInfo[] = [
            { folderName: 'SGC-099_UNKNOWN', solicitudNumber: 'SGC-099', tipo: 'producto', fullPath: 'Y:\\p\\SGC-099' },
        ];
        const dbItems: SolicitudListItem[] = [];

        const result = reconcile(serverFolders, dbItems);
        expect(result.onlyOnServer).toHaveLength(1);
        expect(result.onlyOnServer[0].solicitudNumber).toBe('SGC-099');
    });

    it('detects DB records without server folder', () => {
        const serverFolders: ServerFolderInfo[] = [];
        const dbItems = [makeDbItem({ solicitud_number: 'SGC-050', status: 'borrador' })];

        const result = reconcile(serverFolders, dbItems);
        expect(result.onlyInDb).toHaveLength(1);
        expect(result.onlyInDb[0].solicitud_number).toBe('SGC-050');
    });

    it('excludes obsoletas from onlyInDb', () => {
        const serverFolders: ServerFolderInfo[] = [];
        const dbItems = [
            makeDbItem({ solicitud_number: 'SGC-010', status: 'obsoleta' }),
            makeDbItem({ solicitud_number: 'SGC-020', status: 'borrador' }),
        ];

        const result = reconcile(serverFolders, dbItems);
        expect(result.onlyInDb).toHaveLength(1);
        expect(result.onlyInDb[0].solicitud_number).toBe('SGC-020');
    });

    it('handles all matched (no discrepancies)', () => {
        const serverFolders: ServerFolderInfo[] = [
            { folderName: 'SGC-001_A', solicitudNumber: 'SGC-001', tipo: 'producto', fullPath: 'Y:\\1' },
            { folderName: 'SGC-002_B', solicitudNumber: 'SGC-002', tipo: 'insumo', fullPath: 'Y:\\2' },
        ];
        const dbItems = [
            makeDbItem({ solicitud_number: 'SGC-001' }),
            makeDbItem({ solicitud_number: 'SGC-002' }),
        ];

        const result = reconcile(serverFolders, dbItems);
        expect(result.matched).toBe(2);
        expect(result.onlyOnServer).toHaveLength(0);
        expect(result.onlyInDb).toHaveLength(0);
    });

    it('handles mixed: some matched, some only on server, some only in db', () => {
        const serverFolders: ServerFolderInfo[] = [
            { folderName: 'SGC-001_A', solicitudNumber: 'SGC-001', tipo: 'producto', fullPath: 'Y:\\1' },
            { folderName: 'SGC-003_C', solicitudNumber: 'SGC-003', tipo: 'insumo', fullPath: 'Y:\\3' },
        ];
        const dbItems = [
            makeDbItem({ solicitud_number: 'SGC-001' }),
            makeDbItem({ solicitud_number: 'SGC-002', status: 'aprobada' }),
        ];

        const result = reconcile(serverFolders, dbItems);
        expect(result.matched).toBe(1);
        expect(result.onlyOnServer).toHaveLength(1);
        expect(result.onlyOnServer[0].solicitudNumber).toBe('SGC-003');
        expect(result.onlyInDb).toHaveLength(1);
        expect(result.onlyInDb[0].solicitud_number).toBe('SGC-002');
    });

    it('includes lastCheck as ISO string', () => {
        const result = reconcile([], []);
        expect(result.lastCheck).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

describe('runReconciliation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSolicitudBasePath.mockResolvedValue('Y:\\Ingenieria\\Solicitudes');
        mockListSolicitudes.mockResolvedValue([]);
        mockSetSetting.mockResolvedValue(undefined);
    });

    it('orchestrates scan + reconcile + save timestamp', async () => {
        mockListSolicitudes.mockResolvedValue([
            makeDbItem({ solicitud_number: 'SGC-001' }),
        ]);

        const result = await runReconciliation();

        expect(mockListSolicitudes).toHaveBeenCalled();
        expect(mockSetSetting).toHaveBeenCalledWith('lastReconciliationCheck', expect.any(String));
        // Server scan always returns [] in web mode, so all DB items appear in onlyInDb
        expect(result.onlyInDb).toHaveLength(1);
        expect(result.onlyOnServer).toHaveLength(0);
        expect(result.matched).toBe(0);
    });

    it('returns onlyOnServer=[] always (server scan not available in web mode)', async () => {
        mockListSolicitudes.mockResolvedValue([
            makeDbItem({ solicitud_number: 'SGC-001' }),
        ]);

        const result = await runReconciliation();
        expect(result.onlyOnServer).toHaveLength(0);
    });

    it('saves timestamp in settings', async () => {
        await runReconciliation();
        expect(mockSetSetting).toHaveBeenCalledTimes(1);
        const [key, value] = mockSetSetting.mock.calls[0];
        expect(key).toBe('lastReconciliationCheck');
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('returns correct result when db is empty', async () => {
        mockListSolicitudes.mockResolvedValue([]);

        const result = await runReconciliation();
        expect(result.matched).toBe(0);
        expect(result.onlyOnServer).toHaveLength(0);
        expect(result.onlyInDb).toHaveLength(0);
    });
});
