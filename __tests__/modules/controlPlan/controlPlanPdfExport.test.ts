import { describe, it, expect } from 'vitest';
import {
    getCpPdfPreviewHtml,
    esc,
    groupByProcessStep,
    CpPdfTemplate,
} from '../../../modules/controlPlan/controlPlanPdfExport';
import {
    ControlPlanDocument,
    ControlPlanItem,
    EMPTY_CP_HEADER,
    CP_COLUMNS,
    CP_COLUMN_GROUPS,
} from '../../../modules/controlPlan/controlPlanTypes';

// --- Helpers ---

function makeItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: overrides.id || 'item-1',
        processStepNumber: '',
        processDescription: '',
        machineDeviceTool: '',
        componentMaterial: '',
        characteristicNumber: '',
        productCharacteristic: '',
        processCharacteristic: '',
        specialCharClass: '',
        specification: '',
        evaluationTechnique: '',
        sampleSize: '',
        sampleFrequency: '',
        controlMethod: '',
        reactionPlan: '',
        reactionPlanOwner: '',
        controlProcedure: '',
        ...overrides,
    };
}

function makeDoc(items: ControlPlanItem[], headerOverrides: Record<string, any> = {}): ControlPlanDocument {
    return {
        header: {
            ...EMPTY_CP_HEADER,
            controlPlanNumber: 'CP-001',
            partName: 'Pieza Test',
            partNumber: 'PN-100',
            organization: 'BARACK',
            responsible: 'Juan',
            ...headerOverrides,
        },
        items,
    };
}

// ============================================================================
// esc() — XSS Prevention
// ============================================================================

describe('esc', () => {
    it('escapes HTML special characters', () => {
        expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
        expect(esc('A & B')).toBe('A &amp; B');
    });

    it('returns empty string for null/undefined', () => {
        expect(esc(null as any)).toBe('');
        expect(esc(undefined)).toBe('');
        expect(esc('')).toBe('');
    });

    it('converts numbers to string', () => {
        expect(esc(42)).toBe('42');
    });
});

// ============================================================================
// groupByProcessStep
// ============================================================================

describe('groupByProcessStep', () => {
    it('groups items with same processStepNumber', () => {
        const items = [
            makeItem({ id: '1', processStepNumber: '10', processDescription: 'Soldadura' }),
            makeItem({ id: '2', processStepNumber: '10', processDescription: 'Soldadura' }),
            makeItem({ id: '3', processStepNumber: '20', processDescription: 'Pintura' }),
        ];
        const groups = groupByProcessStep(items);
        expect(groups).toHaveLength(2);
        expect(groups[0].processStepNumber).toBe('10');
        expect(groups[0].items).toHaveLength(2);
        expect(groups[1].processStepNumber).toBe('20');
        expect(groups[1].items).toHaveLength(1);
    });

    it('returns empty array for no items', () => {
        expect(groupByProcessStep([])).toHaveLength(0);
    });

    it('creates one group per unique step when all different', () => {
        const items = [
            makeItem({ id: '1', processStepNumber: '10' }),
            makeItem({ id: '2', processStepNumber: '20' }),
            makeItem({ id: '3', processStepNumber: '30' }),
        ];
        const groups = groupByProcessStep(items);
        expect(groups).toHaveLength(3);
        groups.forEach(g => expect(g.items).toHaveLength(1));
    });

    it('creates separate groups for non-consecutive same steps', () => {
        const items = [
            makeItem({ id: '1', processStepNumber: '10' }),
            makeItem({ id: '2', processStepNumber: '20' }),
            makeItem({ id: '3', processStepNumber: '10' }),
        ];
        const groups = groupByProcessStep(items);
        // Non-consecutive same step = separate groups
        expect(groups).toHaveLength(3);
    });
});

// ============================================================================
// FULL TEMPLATE
// ============================================================================

describe('getCpPdfPreviewHtml — full template', () => {
    it('contains PLAN DE CONTROL title', () => {
        const html = getCpPdfPreviewHtml(makeDoc([]), 'full');
        expect(html).toContain('PLAN DE CONTROL');
    });

    it('contains header metadata', () => {
        const doc = makeDoc([], {
            controlPlanNumber: 'CP-100',
            partName: 'Mi Pieza',
            organization: 'BARACK',
        });
        const html = getCpPdfPreviewHtml(doc, 'full');
        expect(html).toContain('CP-100');
        expect(html).toContain('Mi Pieza');
        expect(html).toContain('BARACK');
    });

    it('contains column group headers', () => {
        const html = getCpPdfPreviewHtml(makeDoc([makeItem()]), 'full');
        for (const group of CP_COLUMN_GROUPS) {
            expect(html).toContain(group.label);
        }
    });

    it('contains all column headers', () => {
        const html = getCpPdfPreviewHtml(makeDoc([makeItem()]), 'full');
        for (const col of CP_COLUMNS) {
            expect(html).toContain(col.label);
        }
    });

    it('renders item data', () => {
        const items = [makeItem({
            processStepNumber: '10',
            processDescription: 'Soldadura MIG',
            controlMethod: 'SPC Chart',
            reactionPlanOwner: 'Operador A',
        })];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'full');
        expect(html).toContain('Soldadura MIG');
        expect(html).toContain('SPC Chart');
        expect(html).toContain('Operador A');
    });

    it('repeats processStepNumber in flat rows (no rowspan for safe page breaks)', () => {
        const items = [
            makeItem({ id: '1', processStepNumber: '10', processDescription: 'Soldadura' }),
            makeItem({ id: '2', processStepNumber: '10', processDescription: 'Soldadura' }),
        ];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'full');
        // No rowspan — flat rows for reliable page breaks in html2pdf.js
        expect(html).not.toContain('rowspan');
        // Step number repeated in both rows
        const matches = html.match(/>10<\/td>/g);
        expect(matches?.length).toBeGreaterThanOrEqual(2);
        // Description shown only on first row of group (visual grouping)
        expect(html).toContain('Soldadura');
    });

    it('applies AP stripe colors to rows', () => {
        const items = [
            makeItem({ id: '1', amfeAp: 'H' }),
            makeItem({ id: '2', amfeAp: 'M' }),
            makeItem({ id: '3', amfeAp: 'L' }),
        ];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'full');
        expect(html).toContain('background:#FEF2F2');  // H - light red
        expect(html).toContain('background:#FEFCE8');  // M - light yellow
        expect(html).toContain('background:#F0FDF4');  // L - light green
    });

    it('renders CC/SC badges', () => {
        const items = [
            makeItem({ id: '1', specialCharClass: 'CC' }),
            makeItem({ id: '2', specialCharClass: 'SC' }),
        ];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'full');
        expect(html).toContain('>CC</span>');
        expect(html).toContain('>SC</span>');
    });

    it('shows empty message for no items', () => {
        const html = getCpPdfPreviewHtml(makeDoc([]), 'full');
        expect(html).toContain('Sin items en el Plan de Control');
    });

    it('includes table-header-group for page repeating', () => {
        const html = getCpPdfPreviewHtml(makeDoc([makeItem()]), 'full');
        expect(html).toContain('display:table-header-group');
    });

    it('escapes XSS in user data', () => {
        const items = [makeItem({
            processDescription: '<script>alert("xss")</script>',
        })];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'full');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

// ============================================================================
// CRITICAL TEMPLATE
// ============================================================================

describe('getCpPdfPreviewHtml — critical template', () => {
    it('contains Items Criticos title', () => {
        const html = getCpPdfPreviewHtml(makeDoc([]), 'critical');
        expect(html).toContain('Ítems Críticos');
    });

    it('filters only CC/SC and AP=H items', () => {
        const items = [
            makeItem({ id: '1', specialCharClass: 'CC', processDescription: 'CC Item' }),
            makeItem({ id: '2', specialCharClass: 'SC', processDescription: 'SC Item' }),
            makeItem({ id: '3', amfeAp: 'H', processDescription: 'AP-H Item' }),
            makeItem({ id: '4', amfeAp: 'L', processDescription: 'AP-L Item' }),
            makeItem({ id: '5', processDescription: 'Normal Item' }),
        ];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'critical');
        expect(html).toContain('CC Item');
        expect(html).toContain('SC Item');
        expect(html).toContain('AP-H Item');
        expect(html).not.toContain('AP-L Item');
        expect(html).not.toContain('Normal Item');
    });

    it('shows missing required fields in red', () => {
        const items = [makeItem({
            specialCharClass: 'CC',
            processStepNumber: '10',
            processDescription: 'Soldadura',
            // Other required fields empty
        })];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'critical');
        expect(html).toContain('color:#DC2626');
    });

    it('shows checkmark for complete items', () => {
        const items = [makeItem({
            specialCharClass: 'CC',
            processStepNumber: '10',
            processDescription: 'Soldadura',
            productCharacteristic: 'Longitud',
            processCharacteristic: 'Temperatura',
            sampleSize: '5',
            controlMethod: 'SPC',
            evaluationTechnique: 'Calibre',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        })];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'critical');
        expect(html).toContain('\u2714');
    });

    it('shows appropriate message when no critical items exist', () => {
        const items = [makeItem({
            amfeAp: 'L',
            specialCharClass: '',
            processDescription: 'Normal',
        })];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'critical');
        expect(html).toContain('no-críticos');
    });

    it('shows empty plan message when no items at all', () => {
        const html = getCpPdfPreviewHtml(makeDoc([]), 'critical');
        expect(html).toContain('Sin items en el Plan de Control');
    });

    it('includes summary counts (CC, SC, AP=H, Total)', () => {
        const items = [
            makeItem({ id: '1', specialCharClass: 'CC' }),
            makeItem({ id: '2', specialCharClass: 'SC' }),
            makeItem({ id: '3', amfeAp: 'H' }),
        ];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'critical');
        expect(html).toContain('CC:</strong> 1');
        expect(html).toContain('SC:</strong> 1');
        expect(html).toContain('AP=H:</strong> 1');
        expect(html).toContain('Total Items:</strong> 3');
    });

    it('highlights unassigned reactionPlanOwner', () => {
        const items = [makeItem({
            specialCharClass: 'CC',
            reactionPlanOwner: '',
        })];
        const html = getCpPdfPreviewHtml(makeDoc(items), 'critical');
        expect(html).toContain('(sin asignar)');
    });
});
