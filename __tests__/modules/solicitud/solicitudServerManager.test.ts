/**
 * Tests for solicitudServerManager.ts (web-safe stubs)
 *
 * Covers: getSolicitudBasePath, buildFolderName, buildFolderPath,
 *         and all stub functions (returning false/null/[])
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SolicitudDocument } from '../../../modules/solicitud/solicitudTypes';
import { createEmptySolicitud, DEFAULT_SOLICITUD_BASE_PATH } from '../../../modules/solicitud/solicitudTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../utils/networkUtils', () => ({
    normalizePath: vi.fn((p: string) => p.replace(/\//g, '\\')),
    joinPath: vi.fn((...parts: string[]) => parts.join('\\')),
    classifyError: vi.fn(() => ({ code: 'UNKNOWN', userMessage: 'Error', retryable: false })),
    withSmartRetry: vi.fn(async (fn: () => Promise<any>) => fn()),
    getFilename: vi.fn((p: string) => p.split('\\').pop() || p.split('/').pop() || p),
}));

vi.mock('../../../utils/repositories/settingsRepository', () => ({
    loadAppSettings: vi.fn(),
}));

vi.mock('../../../utils/filenameSanitization', () => ({
    sanitizeFilename: vi.fn((name: string, _opts?: any) => name.replace(/[<>:"|?*]/g, '_')),
}));

vi.mock('../../../utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { normalizePath, joinPath } from '../../../utils/networkUtils';
import { loadAppSettings } from '../../../utils/repositories/settingsRepository';
import { sanitizeFilename } from '../../../utils/filenameSanitization';
import { logger } from '../../../utils/logger';
import {
    getSolicitudBasePath,
    isSolicitudServerAvailable,
    ensureBaseStructure,
    buildFolderName,
    buildFolderPath,
    ensureSolicitudFolder,
    moveSolicitudToObsoletos,
    syncSolicitudToServer,
    exportProcedureToServer,
} from '../../../modules/solicitud/solicitudServerManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProductoDoc(overrides?: Partial<SolicitudDocument>): SolicitudDocument {
    const base = createEmptySolicitud('producto');
    base.header.solicitudNumber = 'SGC-001';
    base.producto = { codigo: 'PROD-100', descripcion: 'Widget', cliente: 'AcmeCorp' };
    return { ...base, ...overrides };
}

function makeInsumoDoc(overrides?: Partial<SolicitudDocument>): SolicitudDocument {
    const base = createEmptySolicitud('insumo');
    base.header.solicitudNumber = 'SGC-002';
    base.insumo = { codigo: 'INS-200', descripcion: 'Tornillo', unidadMedida: 'un', requiereGeneracionInterna: false };
    return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
        solicitudBasePath: null,
    });
});

// ===========================================================================
// getSolicitudBasePath
// ===========================================================================

describe('getSolicitudBasePath', () => {
    it('returns the configured path from settings when present', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            solicitudBasePath: 'Y:\\Custom\\Path',
        });

        await getSolicitudBasePath();
        expect(normalizePath).toHaveBeenCalledWith('Y:\\Custom\\Path');
    });

    it('trims whitespace from configured path', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            solicitudBasePath: '  Y:\\Trimmed\\Path  ',
        });

        await getSolicitudBasePath();
        expect(normalizePath).toHaveBeenCalledWith('Y:\\Trimmed\\Path');
    });

    it('falls back to DEFAULT_SOLICITUD_BASE_PATH when setting is null', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            solicitudBasePath: null,
        });

        await getSolicitudBasePath();
        expect(normalizePath).toHaveBeenCalledWith(DEFAULT_SOLICITUD_BASE_PATH);
    });

    it('falls back to default when setting is empty string', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            solicitudBasePath: '   ',
        });

        await getSolicitudBasePath();
        expect(normalizePath).toHaveBeenCalledWith(DEFAULT_SOLICITUD_BASE_PATH);
    });

    it('falls back to default when loadAppSettings throws', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

        await getSolicitudBasePath();
        expect(normalizePath).toHaveBeenCalledWith(DEFAULT_SOLICITUD_BASE_PATH);
        expect(logger.warn).toHaveBeenCalledWith(
            'SolicitudServer',
            expect.stringContaining('Failed to load settings'),
            expect.objectContaining({ error: 'DB error' }),
        );
    });
});

// ===========================================================================
// isSolicitudServerAvailable (web-safe stub)
// ===========================================================================

describe('isSolicitudServerAvailable', () => {
    it('always returns false in web mode', async () => {
        const result = await isSolicitudServerAvailable();
        expect(result).toBe(false);
    });

    it('logs a debug message about web mode', async () => {
        await isSolicitudServerAvailable();
        expect(logger.debug).toHaveBeenCalledWith(
            'SolicitudServer',
            expect.stringContaining('web mode'),
        );
    });
});

// ===========================================================================
// ensureBaseStructure (web-safe stub)
// ===========================================================================

describe('ensureBaseStructure', () => {
    it('always returns false in web mode', async () => {
        const result = await ensureBaseStructure();
        expect(result).toBe(false);
    });

    it('logs a debug message about web mode', async () => {
        await ensureBaseStructure();
        expect(logger.debug).toHaveBeenCalledWith(
            'SolicitudServer',
            expect.stringContaining('web mode'),
        );
    });
});

// ===========================================================================
// buildFolderName
// ===========================================================================

describe('buildFolderName', () => {
    it('builds "{number}_{codigo}_{cliente}" for producto documents', () => {
        const doc = makeProductoDoc();
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            'SGC-001_PROD-100_AcmeCorp',
            { allowSpaces: false, maxLength: 100 },
        );
    });

    it('builds "{number}_{codigo}" for insumo documents', () => {
        const doc = makeInsumoDoc();
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            'SGC-002_INS-200',
            { allowSpaces: false, maxLength: 100 },
        );
    });

    it('uses "SIN-NUM" when solicitudNumber is empty', () => {
        const doc = makeProductoDoc();
        doc.header.solicitudNumber = '';
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            expect.stringContaining('SIN-NUM'),
            expect.any(Object),
        );
    });

    it('uses "SIN-COD" when produto.codigo is empty', () => {
        const doc = makeProductoDoc();
        doc.producto!.codigo = '';
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            expect.stringContaining('SIN-COD'),
            expect.any(Object),
        );
    });

    it('uses "SIN-CLIENTE" when produto.cliente is empty', () => {
        const doc = makeProductoDoc();
        doc.producto!.cliente = '';
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            expect.stringContaining('SIN-CLIENTE'),
            expect.any(Object),
        );
    });

    it('uses "SIN-COD" when insumo.codigo is empty', () => {
        const doc = makeInsumoDoc();
        doc.insumo!.codigo = '';
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            expect.stringContaining('SIN-COD'),
            expect.any(Object),
        );
    });

    it('uses "SIN-COD" when insumo is null', () => {
        const doc = makeInsumoDoc();
        doc.insumo = null;
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            'SGC-002_SIN-COD',
            expect.any(Object),
        );
    });

    it('falls through to insumo branch when produto is null for produto type', () => {
        const doc = makeProductoDoc();
        doc.producto = null;
        buildFolderName(doc);
        expect(sanitizeFilename).toHaveBeenCalledWith(
            'SGC-001_SIN-COD',
            expect.any(Object),
        );
    });
});

// ===========================================================================
// buildFolderPath
// ===========================================================================

describe('buildFolderPath', () => {
    it('returns basePath/Produtos/folderName for produto type', async () => {
        const doc = makeProductoDoc();
        await buildFolderPath(doc);

        expect(joinPath).toHaveBeenCalledWith(
            expect.any(String), // basePath
            'Productos',
            expect.any(String), // folder name from sanitizeFilename
        );
    });

    it('returns basePath/Insumos/folderName for insumo type', async () => {
        const doc = makeInsumoDoc();
        await buildFolderPath(doc);

        expect(joinPath).toHaveBeenCalledWith(
            expect.any(String),
            'Insumos',
            expect.any(String),
        );
    });

    it('uses the configured base path from settings', async () => {
        (loadAppSettings as ReturnType<typeof vi.fn>).mockResolvedValue({
            solicitudBasePath: 'Z:\\Custom',
        });

        const doc = makeProductoDoc();
        await buildFolderPath(doc);

        const joinPathCalls = (joinPath as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = joinPathCalls[joinPathCalls.length - 1];
        expect(lastCall[0]).toBe('Z:\\Custom');
    });
});

// ===========================================================================
// ensureSolicitudFolder (web-safe stub)
// ===========================================================================

describe('ensureSolicitudFolder', () => {
    it('always returns failure with descriptive error in web mode', async () => {
        const doc = makeProductoDoc();
        const result = await ensureSolicitudFolder(doc);

        expect(result.success).toBe(false);
        expect(result.error).toContain('modo web');
    });

    it('includes folderPath and adjuntosPath even on failure', async () => {
        const doc = makeProductoDoc();
        const result = await ensureSolicitudFolder(doc);

        expect(result.folderPath).toBeTruthy();
        expect(result.adjuntosPath).toContain('adjuntos');
    });
});

// ===========================================================================
// moveSolicitudToObsoletos (web-safe stub)
// ===========================================================================

describe('moveSolicitudToObsoletos', () => {
    it('always returns false in web mode', async () => {
        const doc = makeProductoDoc();
        const result = await moveSolicitudToObsoletos(doc);
        expect(result).toBe(false);
    });

    it('logs a debug message about web mode', async () => {
        const doc = makeProductoDoc();
        await moveSolicitudToObsoletos(doc);
        expect(logger.debug).toHaveBeenCalledWith(
            'SolicitudServer',
            expect.stringContaining('web mode'),
            expect.any(Object),
        );
    });
});

// ===========================================================================
// syncSolicitudToServer (web-safe stub)
// ===========================================================================

describe('syncSolicitudToServer', () => {
    it('always returns failure with descriptive error in web mode', async () => {
        const doc = makeProductoDoc();
        const result = await syncSolicitudToServer(doc);

        expect(result.success).toBe(false);
        expect(result.folderPath).toBeNull();
        expect(result.pdfCopied).toBe(false);
        expect(result.error).toContain('modo web');
    });

    it('accepts optional pdfBytes without throwing', async () => {
        const doc = makeProductoDoc();
        const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
        const result = await syncSolicitudToServer(doc, pdfBytes);

        expect(result.success).toBe(false);
        expect(result.pdfCopied).toBe(false);
    });

    it('logs a debug message with doc info', async () => {
        const doc = makeProductoDoc();
        await syncSolicitudToServer(doc);
        expect(logger.debug).toHaveBeenCalledWith(
            'SolicitudServer',
            expect.stringContaining('web mode'),
            expect.objectContaining({ docId: doc.id }),
        );
    });
});

// ===========================================================================
// exportProcedureToServer (web-safe stub)
// ===========================================================================

describe('exportProcedureToServer', () => {
    it('always returns false in web mode', async () => {
        const result = await exportProcedureToServer();
        expect(result).toBe(false);
    });

    it('logs a debug message about web mode', async () => {
        await exportProcedureToServer();
        expect(logger.debug).toHaveBeenCalledWith(
            'SolicitudServer',
            expect.stringContaining('web mode'),
        );
    });
});
