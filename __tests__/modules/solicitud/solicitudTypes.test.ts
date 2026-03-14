import {
    createEmptySolicitud,
    normalizeSolicitud,
    DEPARTAMENTOS,
    UNIDADES_MEDIDA,
    STATUS_CONFIG,
    SGC_FORM_NUMBER,
    DEFAULT_REVISION,
    DEFAULT_SOLICITUD_BASE_PATH,
    BLOCKED_ATTACHMENT_EXTENSIONS,
    MAX_ATTACHMENT_SIZE_BYTES,
    MAX_TOTAL_ATTACHMENTS_BYTES,
} from '../../../modules/solicitud/solicitudTypes';
import type { SolicitudDocument } from '../../../modules/solicitud/solicitudTypes';

describe('solicitudTypes', () => {
    describe('createEmptySolicitud', () => {
        it('creates a producto solicitud with correct shape', () => {
            const doc = createEmptySolicitud('producto');
            expect(doc.tipo).toBe('producto');
            expect(doc.producto).not.toBeNull();
            expect(doc.producto!.codigo).toBe('');
            expect(doc.producto!.descripcion).toBe('');
            expect(doc.producto!.cliente).toBe('');
            expect(doc.insumo).toBeNull();
        });

        it('creates an insumo solicitud with correct shape', () => {
            const doc = createEmptySolicitud('insumo');
            expect(doc.tipo).toBe('insumo');
            expect(doc.insumo).not.toBeNull();
            expect(doc.insumo!.codigo).toBe('');
            expect(doc.insumo!.descripcion).toBe('');
            expect(doc.insumo!.unidadMedida).toBe('un');
            expect(doc.insumo!.requiereGeneracionInterna).toBe(false);
            expect(doc.producto).toBeNull();
        });

        it('defaults to producto when no argument is given', () => {
            const doc = createEmptySolicitud();
            expect(doc.tipo).toBe('producto');
            expect(doc.producto).not.toBeNull();
            expect(doc.insumo).toBeNull();
        });

        it('sets formNumber and revision from constants', () => {
            const doc = createEmptySolicitud('producto');
            expect(doc.header.formNumber).toBe(SGC_FORM_NUMBER);
            expect(doc.header.revision).toBe(DEFAULT_REVISION);
        });

        it('generates a unique UUID id', () => {
            const doc1 = createEmptySolicitud('producto');
            const doc2 = createEmptySolicitud('producto');
            expect(doc1.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
            expect(doc1.id).not.toBe(doc2.id);
        });

        it('sets fechaSolicitud to today in YYYY-MM-DD format', () => {
            const doc = createEmptySolicitud('producto');
            const today = new Date().toISOString().split('T')[0];
            expect(doc.header.fechaSolicitud).toBe(today);
        });

        it('sets status to borrador', () => {
            const doc = createEmptySolicitud('producto');
            expect(doc.status).toBe('borrador');
        });
    });

    describe('constants', () => {
        it('DEPARTAMENTOS has at least 5 entries and includes Ingenieria and Calidad', () => {
            expect(DEPARTAMENTOS.length).toBeGreaterThanOrEqual(5);
            expect(DEPARTAMENTOS).toContain('Ingenieria');
            expect(DEPARTAMENTOS).toContain('Calidad');
        });

        it('UNIDADES_MEDIDA has 8 entries with kg and un values', () => {
            expect(UNIDADES_MEDIDA).toHaveLength(8);
            const values = UNIDADES_MEDIDA.map(u => u.value);
            expect(values).toContain('kg');
            expect(values).toContain('un');
        });

        it('STATUS_CONFIG has keys borrador, enviada, aprobada, rechazada, obsoleta', () => {
            expect(STATUS_CONFIG).toHaveProperty('borrador');
            expect(STATUS_CONFIG).toHaveProperty('enviada');
            expect(STATUS_CONFIG).toHaveProperty('aprobada');
            expect(STATUS_CONFIG).toHaveProperty('rechazada');
            expect(STATUS_CONFIG).toHaveProperty('obsoleta');
            // Each entry has label, color, bg
            for (const key of Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>) {
                expect(STATUS_CONFIG[key]).toHaveProperty('label');
                expect(STATUS_CONFIG[key]).toHaveProperty('color');
                expect(STATUS_CONFIG[key]).toHaveProperty('bg');
            }
        });
    });

    describe('normalizeSolicitud', () => {
        it('fills defaults for missing fields', () => {
            const raw = {} as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.id).toBeTruthy();
            expect(doc.tipo).toBe('producto');
            expect(doc.header.formNumber).toBe(SGC_FORM_NUMBER);
            expect(doc.header.revision).toBe(DEFAULT_REVISION);
            expect(doc.header.solicitante).toBe('');
            expect(doc.header.areaDepartamento).toBe('');
            expect(doc.status).toBe('borrador');
            expect(doc.observaciones).toBe('');
        });

        it('fills producto object when raw.tipo is producto', () => {
            const raw = { tipo: 'producto' } as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.tipo).toBe('producto');
            expect(doc.producto).not.toBeNull();
            expect(doc.producto!.codigo).toBe('');
            expect(doc.insumo).toBeNull();
        });

        it('defaults invalid status to borrador', () => {
            const raw = { status: 'unknown_status' } as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.status).toBe('borrador');
        });

        it('accepts obsoleta as valid status', () => {
            const raw = { status: 'obsoleta' } as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.status).toBe('obsoleta');
        });

        it('normalizes serverFolderPath to null when missing', () => {
            const raw = {} as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.serverFolderPath).toBeNull();
        });

        it('normalizes attachments to empty array when missing', () => {
            const raw = {} as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.attachments).toEqual([]);
        });

        it('normalizes lastServerSync to null when missing', () => {
            const raw = {} as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.lastServerSync).toBeNull();
        });

        it('preserves serverFolderPath when present', () => {
            const raw = { serverFolderPath: 'Y:\\Ingenieria\\Test' } as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.serverFolderPath).toBe('Y:\\Ingenieria\\Test');
        });

        it('preserves attachments array when present', () => {
            const att = [{ fileName: 'test.pdf', fileSize: 100, fileType: 'pdf', relativePath: 'adjuntos/test.pdf', uploadedAt: '', uploadedBy: '' }];
            const raw = { attachments: att } as Record<string, unknown>;
            const doc = normalizeSolicitud(raw);
            expect(doc.attachments).toHaveLength(1);
            expect(doc.attachments[0].fileName).toBe('test.pdf');
        });
    });

    describe('Phase 2 constants', () => {
        it('DEFAULT_SOLICITUD_BASE_PATH is a Y: drive path', () => {
            expect(DEFAULT_SOLICITUD_BASE_PATH).toMatch(/^Y:\\/);
        });

        it('BLOCKED_ATTACHMENT_EXTENSIONS includes exe and bat', () => {
            expect(BLOCKED_ATTACHMENT_EXTENSIONS).toContain('exe');
            expect(BLOCKED_ATTACHMENT_EXTENSIONS).toContain('bat');
        });

        it('MAX_ATTACHMENT_SIZE_BYTES is 50 MB', () => {
            expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(50 * 1024 * 1024);
        });

        it('MAX_TOTAL_ATTACHMENTS_BYTES is 200 MB', () => {
            expect(MAX_TOTAL_ATTACHMENTS_BYTES).toBe(200 * 1024 * 1024);
        });
    });

    describe('createEmptySolicitud Phase 2 fields', () => {
        it('initializes serverFolderPath as null', () => {
            const doc = createEmptySolicitud();
            expect(doc.serverFolderPath).toBeNull();
        });

        it('initializes attachments as empty array', () => {
            const doc = createEmptySolicitud();
            expect(doc.attachments).toEqual([]);
        });

        it('initializes lastServerSync as null', () => {
            const doc = createEmptySolicitud();
            expect(doc.lastServerSync).toBeNull();
        });
    });
});
