import { describe, it, expect } from 'vitest';
import { buildSheetHtml, esc, PdfAssets } from '../../../modules/hojaOperaciones/hojaOperacionesPdfExport';
import {
    HoDocument,
    HojaOperacion,
    EMPTY_HO_HEADER,
    DEFAULT_REACTION_PLAN_TEXT,
    createEmptyHoSheet,
} from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// HELPERS
// ============================================================================

const MOCK_ASSETS: PdfAssets = {
    logoBase64: 'data:image/png;base64,LOGO_PLACEHOLDER',
    ppeBase64Map: {
        anteojos: 'data:image/png;base64,ANTEOJOS_B64',
        guantes: 'data:image/png;base64,GUANTES_B64',
    },
};

function makeSheet(overrides: Partial<HojaOperacion> = {}): HojaOperacion {
    const base = createEmptyHoSheet('op-1', '10', 'Soldadura MIG');
    return { ...base, ...overrides };
}

function makeDoc(sheets?: HojaOperacion[]): HoDocument {
    return {
        header: { ...EMPTY_HO_HEADER, organization: 'Barack Mercosul', client: 'VW' },
        sheets: sheets || [makeSheet()],
    };
}

// ============================================================================
// esc() FUNCTION
// ============================================================================

describe('esc – HTML escaping', () => {
    it('escapes angle brackets', () => {
        expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
        expect(esc('A & B')).toBe('A &amp; B');
    });

    it('returns empty string for undefined', () => {
        expect(esc(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(esc('')).toBe('');
    });

    it('handles numbers', () => {
        expect(esc(42)).toBe('42');
    });
});

// ============================================================================
// buildSheetHtml
// ============================================================================

describe('buildSheetHtml', () => {
    it('includes logo base64 image', () => {
        const doc = makeDoc();
        const html = buildSheetHtml(doc.sheets[0], doc, MOCK_ASSETS);
        expect(html).toContain('data:image/png;base64,LOGO_PLACEHOLDER');
        expect(html).toContain('<img');
    });

    it('falls back to text when logo is empty', () => {
        const doc = makeDoc();
        const emptyAssets: PdfAssets = { logoBase64: '', ppeBase64Map: {} };
        const html = buildSheetHtml(doc.sheets[0], doc, emptyAssets);
        expect(html).toContain('Barack Mercosul'); // Uses organization name as fallback
    });

    it('includes HO number', () => {
        const sheet = makeSheet({ hoNumber: 'HO-10' });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('HO-10');
    });

    it('includes operation number and name in header', () => {
        const sheet = makeSheet({ operationNumber: '20', operationName: 'Costura' });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('20');
        expect(html).toContain('Costura');
    });

    it('includes sector and puesto', () => {
        const sheet = makeSheet({ sector: 'SOLDADURA', puestoNumber: 'S3' });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('SOLDADURA');
        expect(html).toContain('S3');
    });

    it('includes vehicle model', () => {
        const sheet = makeSheet({ vehicleModel: 'AMAROK' });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('AMAROK');
    });

    it('includes preparedBy and approvedBy in header', () => {
        const sheet = makeSheet({ preparedBy: 'F.Santoro', approvedBy: 'M.Donofrio', date: '2024-06-01', revision: 'A' });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('F.Santoro');
        expect(html).toContain('M.Donofrio');
        expect(html).toContain('2024-06-01');
        expect(html).toContain('Realizo');
        expect(html).toContain('Aprobo');
    });

    it('includes form number in header', () => {
        const doc = makeDoc();
        const html = buildSheetHtml(doc.sheets[0], doc, MOCK_ASSETS);
        expect(html).toContain('I-IN-002.4-R01');
    });

    it('renders steps with correct numbering', () => {
        const sheet = makeSheet({
            steps: [
                { id: 's1', stepNumber: 1, description: 'Tomar pieza', isKeyPoint: false, keyPointReason: '' },
                { id: 's2', stepNumber: 2, description: 'Posicionar', isKeyPoint: true, keyPointReason: 'Critico' },
            ],
        });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('Tomar pieza');
        expect(html).toContain('Posicionar');
        expect(html).toContain('\u2605'); // Key point star marker
        expect(html).toContain('Critico'); // Key point reason
    });

    it('renders PPE as circular images when base64 available', () => {
        const sheet = makeSheet({ safetyElements: ['anteojos', 'guantes'] });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('data:image/png;base64,ANTEOJOS_B64');
        expect(html).toContain('data:image/png;base64,GUANTES_B64');
        expect(html).toContain('border-radius:50%');
    });

    it('renders PPE as text fallback when no base64', () => {
        const sheet = makeSheet({ safetyElements: ['respirador'] });
        const doc = makeDoc([sheet]);
        const emptyAssets: PdfAssets = { logoBase64: '', ppeBase64Map: {} };
        const html = buildSheetHtml(sheet, doc, emptyAssets);
        expect(html).toContain('Respirador');
    });

    it('renders quality checks with CC/SC badges', () => {
        const sheet = makeSheet({
            qualityChecks: [{
                id: 'qc-1',
                characteristic: 'Cordon soldadura',
                specification: '3mm +/- 0.5',
                evaluationTechnique: 'Visual',
                frequency: '100%',
                controlMethod: 'Inspeccion visual',
                reactionAction: 'Segregar',
                reactionContact: 'Supervisor',
                specialCharSymbol: 'SC',
                registro: 'PLN-001',
            }],
        });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('Cordon soldadura');
        expect(html).toContain('3mm +/- 0.5');
        expect(html).toContain('100%');
        expect(html).toContain('SC'); // Badge
        expect(html).toContain('PLN-001');
    });

    it('renders empty checks message when no quality checks', () => {
        const sheet = makeSheet({ qualityChecks: [] });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('Sin verificaciones de calidad');
    });

    it('renders "Referencia: OP" subtitle', () => {
        const doc = makeDoc();
        const html = buildSheetHtml(doc.sheets[0], doc, MOCK_ASSETS);
        expect(html).toContain('Referencia: OP - Operador de Produccion');
    });

    it('renders reaction plan text', () => {
        const sheet = makeSheet({ reactionPlanText: DEFAULT_REACTION_PLAN_TEXT });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('DETENGA');
        expect(html).toContain('NOTIFIQUE');
    });

    it('escapes HTML in user-entered fields', () => {
        const sheet = makeSheet({ sector: '<script>alert(1)</script>' });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('renders visual aid images', () => {
        const sheet = makeSheet({
            visualAids: [{
                id: 'va-1',
                imageData: 'data:image/png;base64,abc123',
                caption: 'Vista frontal',
                order: 0,
            }],
        });
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('data:image/png;base64,abc123');
        expect(html).toContain('Vista frontal');
    });

    it('includes page-break-after for multi-page support', () => {
        const sheet = makeSheet();
        const doc = makeDoc([sheet]);
        const html = buildSheetHtml(sheet, doc, MOCK_ASSETS);
        expect(html).toContain('page-break-after:always');
    });

    it('uses navy color scheme', () => {
        const doc = makeDoc();
        const html = buildSheetHtml(doc.sheets[0], doc, MOCK_ASSETS);
        expect(html).toContain('#1e3a5f'); // NAVY constant
    });
});
