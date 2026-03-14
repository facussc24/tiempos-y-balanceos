/**
 * Tests for exportPathManager — path building, metadata extraction, sanitization
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    buildExportDir,
    buildExportFilename,
    buildExportFileInfo,
    buildManifestPath,
    extractDocMetadata,
    getDocDisplayName,
    sanitizePathSegment,
    sanitizeFileName,
    MODULE_FOLDER_NAMES,
    DEFAULT_EXPORT_BASE_PATH,
    UNC_EXPORT_FALLBACK,
    LEGACY_FOLDER_NAME,
    SYNC_MANIFEST_FILENAME,
    type ExportDocModule,
} from '../../utils/exportPathManager';

// Mock dependencies
vi.mock('../../utils/unified_fs', () => ({ isTauri: () => false }));
vi.mock('../../utils/repositories/settingsRepository', () => ({
    getSetting: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('exportPathManager', () => {
    // ==========================================================================
    // Constants
    // ==========================================================================

    describe('constants', () => {
        it('should have correct default export base path', () => {
            expect(DEFAULT_EXPORT_BASE_PATH).toBe('Y:\\INGENIERIA');
        });

        it('should have correct UNC fallback', () => {
            expect(UNC_EXPORT_FALLBACK).toBe('\\\\server\\compartido\\INGENIERIA');
        });

        it('should have folder names for all modules', () => {
            const modules: ExportDocModule[] = ['amfe', 'cp', 'ho', 'pfd', 'tiempos', 'solicitud'];
            for (const mod of modules) {
                expect(MODULE_FOLDER_NAMES[mod]).toBeTruthy();
            }
        });

        it('should have numbered folder names for priority ordering', () => {
            expect(MODULE_FOLDER_NAMES.amfe).toBe('01_AMFE');
            expect(MODULE_FOLDER_NAMES.cp).toBe('02_Plan_de_Control');
            expect(MODULE_FOLDER_NAMES.ho).toBe('03_Hojas_de_Operaciones');
            expect(MODULE_FOLDER_NAMES.pfd).toBe('04_Diagramas_de_Flujo');
            expect(MODULE_FOLDER_NAMES.tiempos).toBe('05_Tiempos_y_Balanceos');
            expect(MODULE_FOLDER_NAMES.solicitud).toBe('06_Solicitudes_de_Codigo');
        });

        it('should have legacy folder name', () => {
            expect(LEGACY_FOLDER_NAME).toBe('_Legacy');
        });

        it('should have sync manifest filename', () => {
            expect(SYNC_MANIFEST_FILENAME).toBe('_sync_manifest.json');
        });
    });

    // ==========================================================================
    // sanitizePathSegment
    // ==========================================================================

    describe('sanitizePathSegment', () => {
        it('should uppercase and replace spaces with underscores', () => {
            expect(sanitizePathSegment('ford motor')).toBe('FORD_MOTOR');
        });

        it('should remove invalid path characters', () => {
            expect(sanitizePathSegment('Ford<>:"/|?*\\')).toBe('FORD');
        });

        it('should collapse multiple underscores', () => {
            expect(sanitizePathSegment('a   b')).toBe('A_B');
        });

        it('should return empty for empty input', () => {
            expect(sanitizePathSegment('')).toBe('');
        });

        it('should trim leading/trailing underscores', () => {
            expect(sanitizePathSegment(' test ')).toBe('TEST');
        });
    });

    // ==========================================================================
    // sanitizeFileName
    // ==========================================================================

    describe('sanitizeFileName', () => {
        it('should preserve mixed case and spaces', () => {
            expect(sanitizeFileName('Asiento Conductor')).toBe('Asiento Conductor');
        });

        it('should remove invalid filename characters', () => {
            expect(sanitizeFileName('file<>:"/|?*name')).toBe('filename');
        });

        it('should collapse whitespace', () => {
            expect(sanitizeFileName('a   b')).toBe('a b');
        });

        it('should return empty for empty input', () => {
            expect(sanitizeFileName('')).toBe('');
        });
    });

    // ==========================================================================
    // buildExportDir — MODULE-FIRST: basePath\MODULE\CLIENT\PIECE
    // ==========================================================================

    describe('buildExportDir', () => {
        const base = 'Y:\\INGENIERIA';

        it('should build correct dir for AMFE (module-first)', () => {
            const result = buildExportDir('amfe', 'FORD', 'P-001', base);
            expect(result).toBe(`${base}\\01_AMFE\\FORD\\P-001`);
        });

        it('should build correct dir for CP', () => {
            const result = buildExportDir('cp', 'TOYOTA', 'P-002', base);
            expect(result).toBe(`${base}\\02_Plan_de_Control\\TOYOTA\\P-002`);
        });

        it('should build correct dir for HO', () => {
            const result = buildExportDir('ho', 'BMW', 'P-003', base);
            expect(result).toBe(`${base}\\03_Hojas_de_Operaciones\\BMW\\P-003`);
        });

        it('should build correct dir for PFD', () => {
            const result = buildExportDir('pfd', 'VW', 'P-004', base);
            expect(result).toBe(`${base}\\04_Diagramas_de_Flujo\\VW\\P-004`);
        });

        it('should build correct dir for Tiempos', () => {
            const result = buildExportDir('tiempos', 'FIAT', 'PANEL', base);
            expect(result).toBe(`${base}\\05_Tiempos_y_Balanceos\\FIAT\\PANEL`);
        });

        it('should use fallback names for empty fields', () => {
            const result = buildExportDir('amfe', '', '', base);
            expect(result).toBe(`${base}\\01_AMFE\\SIN_CLIENTE\\SIN_PIEZA`);
        });

        it('should sanitize names', () => {
            const result = buildExportDir('amfe', 'ford motor', 'puerta izq', base);
            expect(result).toBe(`${base}\\01_AMFE\\FORD_MOTOR\\PUERTA_IZQ`);
        });

        it('should preserve hyphens in part numbers', () => {
            const result = buildExportDir('amfe', 'FORD', '123-456-789', base);
            expect(result).toBe(`${base}\\01_AMFE\\FORD\\123-456-789`);
        });

        it('should work with UNC base path', () => {
            const uncBase = '\\\\server\\compartido\\INGENIERIA';
            const result = buildExportDir('cp', 'FORD', 'P-001', uncBase);
            expect(result).toBe(`${uncBase}\\02_Plan_de_Control\\FORD\\P-001`);
        });
    });

    // ==========================================================================
    // buildExportFilename
    // ==========================================================================

    describe('buildExportFilename', () => {
        it('should build filename with prefix, name, revision and date', () => {
            const fn = buildExportFilename('amfe', 'Asiento Conductor', 'B', 'xlsx');
            expect(fn).toMatch(/^AMFE - Asiento Conductor - Rev B \(\d{4}-\d{2}-\d{2}\)\.xlsx$/);
        });

        it('should use correct prefix for each module', () => {
            expect(buildExportFilename('cp', 'Test', 'A', 'pdf')).toContain('Plan de Control - Test');
            expect(buildExportFilename('ho', 'Test', 'A', 'xlsx')).toContain('HO - Test');
            expect(buildExportFilename('pfd', 'Test', 'C', 'pdf')).toContain('PFD - Test');
            expect(buildExportFilename('tiempos', 'Test', 'A', 'xlsx')).toContain('Balanceo - Test');
        });

        it('should use "Documento" for empty doc name', () => {
            const fn = buildExportFilename('amfe', '', 'A', 'xlsx');
            expect(fn).toContain('AMFE - Documento');
        });
    });

    // ==========================================================================
    // buildExportFileInfo — uses metadata.pieceName for filename
    // ==========================================================================

    describe('buildExportFileInfo', () => {
        it('should combine dir + filename + fullPath (module-first)', () => {
            const base = 'Y:\\INGENIERIA';
            const meta = { client: 'FORD', piece: 'P-001', pieceName: 'Puerta' };
            const info = buildExportFileInfo('amfe', meta, 'B', 'xlsx', base);

            expect(info.dir).toBe(`${base}\\01_AMFE\\FORD\\P-001`);
            expect(info.filename).toMatch(/^AMFE - Puerta - Rev B/);
            expect(info.fullPath).toBe(`${info.dir}\\${info.filename}`);
        });

        it('should use pieceName for the filename, not piece', () => {
            const base = 'Y:\\INGENIERIA';
            const meta = { client: 'TOYOTA', piece: 'P-002', pieceName: 'Asiento Conductor' };
            const info = buildExportFileInfo('cp', meta, 'A', 'pdf', base);

            expect(info.dir).toContain('P-002');
            expect(info.filename).toContain('Asiento Conductor');
        });
    });

    // ==========================================================================
    // buildManifestPath
    // ==========================================================================

    describe('buildManifestPath', () => {
        it('should build manifest path at basePath root', () => {
            const result = buildManifestPath('Y:\\INGENIERIA');
            expect(result).toBe('Y:\\INGENIERIA\\_sync_manifest.json');
        });

        it('should work with UNC path', () => {
            const result = buildManifestPath('\\\\server\\compartido\\INGENIERIA');
            expect(result).toBe('\\\\server\\compartido\\INGENIERIA\\_sync_manifest.json');
        });
    });

    // ==========================================================================
    // extractDocMetadata — returns client + piece + pieceName
    // ==========================================================================

    describe('extractDocMetadata', () => {
        it('should extract AMFE metadata', () => {
            const doc = { header: { client: 'FORD', subject: 'Ranger', partNumber: 'P-001' } };
            const meta = extractDocMetadata('amfe', doc);
            expect(meta).toEqual({ client: 'FORD', piece: 'P-001', pieceName: 'Ranger' });
        });

        it('should extract CP metadata', () => {
            const doc = { header: { client: 'TOYOTA', partName: 'Hilux', partNumber: 'P-002' } };
            const meta = extractDocMetadata('cp', doc);
            expect(meta).toEqual({ client: 'TOYOTA', piece: 'P-002', pieceName: 'Hilux' });
        });

        it('should extract HO metadata', () => {
            const doc = { header: { client: 'BMW', partDescription: 'Motor', partNumber: 'P-003' } };
            const meta = extractDocMetadata('ho', doc);
            expect(meta).toEqual({ client: 'BMW', piece: 'P-003', pieceName: 'Motor' });
        });

        it('should extract PFD metadata', () => {
            const doc = { header: { customerName: 'VW', partName: 'Gol', partNumber: 'P-004' } };
            const meta = extractDocMetadata('pfd', doc);
            expect(meta).toEqual({ client: 'VW', piece: 'P-004', pieceName: 'Gol' });
        });

        it('should extract Tiempos metadata', () => {
            const doc = { meta: { client: 'FIAT', project: 'Cronos', name: 'Panel' } };
            const meta = extractDocMetadata('tiempos', doc);
            expect(meta).toEqual({ client: 'FIAT', piece: 'Panel', pieceName: 'Panel' });
        });

        it('should return empty strings for missing fields', () => {
            const meta = extractDocMetadata('amfe', {});
            expect(meta).toEqual({ client: '', piece: '', pieceName: '' });
        });

        it('should return empty strings for unknown module', () => {
            const meta = extractDocMetadata('unknown' as ExportDocModule, {});
            expect(meta).toEqual({ client: '', piece: '', pieceName: '' });
        });

        it('should fallback pieceName to partNumber when subject is missing (AMFE)', () => {
            const doc = { header: { client: 'FORD', partNumber: 'P-001' } };
            const meta = extractDocMetadata('amfe', doc);
            expect(meta.pieceName).toBe('P-001');
        });

        it('should fallback pieceName to partNumber when partName is missing (CP)', () => {
            const doc = { header: { client: 'FORD', partNumber: 'P-002' } };
            const meta = extractDocMetadata('cp', doc);
            expect(meta.pieceName).toBe('P-002');
        });
    });

    // ==========================================================================
    // getDocDisplayName
    // ==========================================================================

    describe('getDocDisplayName', () => {
        it('should get AMFE display name from subject', () => {
            expect(getDocDisplayName('amfe', { header: { subject: 'Asiento' } })).toBe('Asiento');
        });

        it('should fallback to partNumber for AMFE', () => {
            expect(getDocDisplayName('amfe', { header: { partNumber: 'P-001' } })).toBe('P-001');
        });

        it('should get CP display name from partName', () => {
            expect(getDocDisplayName('cp', { header: { partName: 'Hilux' } })).toBe('Hilux');
        });

        it('should get HO display name from partDescription', () => {
            expect(getDocDisplayName('ho', { header: { partDescription: 'Motor' } })).toBe('Motor');
        });

        it('should get PFD display name from partName', () => {
            expect(getDocDisplayName('pfd', { header: { partName: 'Gol' } })).toBe('Gol');
        });

        it('should get Tiempos display name from name', () => {
            expect(getDocDisplayName('tiempos', { meta: { name: 'Panel' } })).toBe('Panel');
        });

        it('should return empty for missing data', () => {
            expect(getDocDisplayName('amfe', {})).toBe('');
        });

        it('should get Solicitud display name from solicitudNumber', () => {
            expect(getDocDisplayName('solicitud', { header: { solicitudNumber: 'SGC-005' } })).toBe('SGC-005');
        });

        it('should return empty for solicitud without header', () => {
            expect(getDocDisplayName('solicitud', {})).toBe('');
        });
    });

    // ==========================================================================
    // Solicitud-specific path building
    // ==========================================================================

    describe('solicitud path building', () => {
        const BASE = 'Y:\\INGENIERIA';

        it('should build export dir for producto solicitud', () => {
            const dir = buildExportDir('solicitud', 'Productos', 'SGC-001_ABC-123_FORD', BASE);
            expect(dir).toBe('Y:\\INGENIERIA\\06_Solicitudes_de_Codigo\\Productos\\SGC-001_ABC-123_FORD');
        });

        it('should build export dir for insumo solicitud', () => {
            const dir = buildExportDir('solicitud', 'Insumos', 'SGC-002_LUBRICANTE-500', BASE);
            expect(dir).toBe('Y:\\INGENIERIA\\06_Solicitudes_de_Codigo\\Insumos\\SGC-002_LUBRICANTE-500');
        });

        it('should preserve Productos/Insumos case (not uppercase)', () => {
            const dir = buildExportDir('solicitud', 'Productos', 'SGC-001_TEST', BASE);
            expect(dir).toContain('Productos');
            expect(dir).not.toContain('PRODUCTOS');
        });

        it('should default client to Productos if empty', () => {
            const dir = buildExportDir('solicitud', '', 'SGC-001_TEST', BASE);
            expect(dir).toContain('Productos');
        });

        it('should extract metadata for producto solicitud', () => {
            const doc = {
                tipo: 'producto',
                header: { solicitudNumber: 'SGC-001' },
                producto: { codigo: 'ABC-123', descripcion: 'Test', cliente: 'FORD' },
                insumo: null,
            };
            const meta = extractDocMetadata('solicitud', doc);
            expect(meta.client).toBe('Productos');
            expect(meta.piece).toBe('SGC-001_ABC-123_FORD');
            expect(meta.pieceName).toBe('SGC-001');
        });

        it('should extract metadata for insumo solicitud', () => {
            const doc = {
                tipo: 'insumo',
                header: { solicitudNumber: 'SGC-002' },
                producto: null,
                insumo: { codigo: 'LUB-500', descripcion: 'Lubricante', unidadMedida: 'lt' },
            };
            const meta = extractDocMetadata('solicitud', doc);
            expect(meta.client).toBe('Insumos');
            expect(meta.piece).toBe('SGC-002_LUB-500');
            expect(meta.pieceName).toBe('SGC-002');
        });

        it('should extract metadata for producto without client', () => {
            const doc = {
                tipo: 'producto',
                header: { solicitudNumber: 'SGC-003' },
                producto: { codigo: 'XYZ', descripcion: 'Test', cliente: '' },
                insumo: null,
            };
            const meta = extractDocMetadata('solicitud', doc);
            expect(meta.piece).toBe('SGC-003_XYZ');
        });

        it('should build export filename for solicitud', () => {
            const filename = buildExportFilename('solicitud', 'SGC-001', 'A', 'xlsx');
            expect(filename).toMatch(/^Solicitud - SGC-001 - Rev A \(\d{4}-\d{2}-\d{2}\)\.xlsx$/);
        });

        it('should build full file info for solicitud', () => {
            const info = buildExportFileInfo(
                'solicitud',
                { client: 'Productos', piece: 'SGC-001_ABC_FORD', pieceName: 'SGC-001' },
                'B',
                'pdf',
                BASE,
            );
            expect(info.dir).toBe('Y:\\INGENIERIA\\06_Solicitudes_de_Codigo\\Productos\\SGC-001_ABC_FORD');
            expect(info.filename).toMatch(/^Solicitud - SGC-001 - Rev B/);
            expect(info.fullPath).toContain(info.dir);
        });
    });
});
