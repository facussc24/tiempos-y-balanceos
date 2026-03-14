import { describe, it, expect } from 'vitest';
import {
    getItemValidationState,
    getDocumentCompletionErrors,
    getExportWarnings,
    validateControlPlanDocument,
    getRequiredKeysForItem,
    getCpSoftLimitWarnings,
    MAX_FIELD_LENGTH,
    EXCEL_CELL_LIMIT,
    CP_SOFT_LIMIT_ITEMS,
} from '../../../modules/controlPlan/controlPlanValidation';
import { ControlPlanDocument, ControlPlanItem, EMPTY_CP_HEADER } from '../../../modules/controlPlan/controlPlanTypes';

// --- Helpers ---

function makeItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: overrides.id || 'item-1',
        processStepNumber: '',
        processDescription: '',
        machineDeviceTool: '',
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
        ...overrides,
    };
}

function makeDoc(items: ControlPlanItem[], headerOverrides: Record<string, any> = {}): ControlPlanDocument {
    return {
        header: { ...EMPTY_CP_HEADER, ...headerOverrides },
        items,
    };
}

// ============================================================================
// LAYER 1: getItemValidationState
// ============================================================================

describe('getItemValidationState', () => {
    it('returns ok for a fully complete mixed item', () => {
        const item = makeItem({
            specialCharClass: 'CC',
            processStepNumber: '10',
            processDescription: 'Soldadura',
            productCharacteristic: 'Longitud',
            processCharacteristic: 'Temperatura',
            sampleSize: '5',
            controlMethod: 'SPC',
            evaluationTechnique: 'Calibre',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador A',
            specification: '10±0.5mm',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('ok');
        expect(result.messages).toHaveLength(0);
    });

    it('returns error for CC item missing reactionPlanOwner', () => {
        const item = makeItem({
            specialCharClass: 'CC',
            controlMethod: 'SPC',
            reactionPlanOwner: '',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('error');
        expect(result.messages.some(m => m.includes('Responsable de Reacción'))).toBe(true);
    });

    it('returns error for SC item missing controlMethod', () => {
        const item = makeItem({
            specialCharClass: 'SC',
            controlMethod: '',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('error');
        expect(result.messages.some(m => m.includes('Método de Control'))).toBe(true);
    });

    it('returns error for cc (lowercase) item missing reactionPlanOwner', () => {
        const item = makeItem({
            specialCharClass: 'cc',
            controlMethod: 'Visual',
            reactionPlanOwner: '',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('error');
    });

    it('returns warning for AP=H without specification', () => {
        const item = makeItem({
            amfeAp: 'H',
            specification: '',
            controlMethod: 'SPC',
            reactionPlanOwner: 'Operador',
            processStepNumber: '10',
            processDescription: 'Test',
            productCharacteristic: 'X',
            sampleSize: '5',
            reactionPlan: 'Segregar',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('especificación'))).toBe(true);
    });

    it('returns warning when required fields are partially filled', () => {
        const item = makeItem({
            processStepNumber: '10',
            processDescription: 'Soldadura',
            // productCharacteristic, sampleSize, controlMethod, reactionPlan, reactionPlanOwner empty
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('Campos requeridos faltantes'))).toBe(true);
    });

    it('returns ok when all required fields are empty (nothing started)', () => {
        const item = makeItem({});
        const result = getItemValidationState(item);
        // No CC/SC, no AP=H, no partial fill → ok
        expect(result.level).toBe('ok');
    });

    it('returns warning for field exceeding MAX_FIELD_LENGTH', () => {
        const item = makeItem({
            controlMethod: 'x'.repeat(MAX_FIELD_LENGTH + 1),
            processStepNumber: '10',
            processDescription: 'Test',
            productCharacteristic: 'X',
            sampleSize: '5',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Op',
        });
        const result = getItemValidationState(item);
        expect(result.messages.some(m => m.includes('demasiado largo'))).toBe(true);
    });

    it('error takes precedence over warning', () => {
        const item = makeItem({
            specialCharClass: 'CC',
            controlMethod: '',  // error: CC without controlMethod
            reactionPlanOwner: '',  // error: CC without owner
            amfeAp: 'H',
            specification: '',  // also warning: AP=H without spec
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('error');
    });

    it('does not flag non-CC/SC items without owner as error', () => {
        const item = makeItem({
            specialCharClass: '',
            controlMethod: 'Visual',
            reactionPlanOwner: '',
            processStepNumber: '10',
            processDescription: 'Test',
            productCharacteristic: 'X',
            sampleSize: '5',
            reactionPlan: 'Segregar',
        });
        const result = getItemValidationState(item);
        // Not CC/SC, but has partial required filled → only warning for missing owner in required fields
        expect(result.level).toBe('warning');
        expect(result.messages.every(m => !m.includes('obligatorio CP 2024'))).toBe(true);
    });

    it('error for AP=H process row without controlMethod', () => {
        const item = makeItem({
            amfeAp: 'H',
            processCharacteristic: 'Fuerza de soldadura',
            productCharacteristic: '',
            controlMethod: '',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('error');
        expect(result.messages.some(m => m.includes('Método de Control') && m.includes('AP=H'))).toBe(true);
    });

    it('no AP=H controlMethod error for product rows', () => {
        const item = makeItem({
            amfeAp: 'H',
            productCharacteristic: 'Diámetro de eje',
            processCharacteristic: '',
            controlMethod: '',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        // Product rows don't need controlMethod — should not trigger this specific error
        expect(result.messages.some(m => m.includes('Método de Control') && m.includes('AP=H'))).toBe(false);
    });
});

// ============================================================================
// LAYER 2: getDocumentCompletionErrors
// ============================================================================

describe('getDocumentCompletionErrors', () => {
    it('returns no errors for complete CC product row', () => {
        const items = [makeItem({
            specialCharClass: 'CC',
            processStepNumber: '10',
            processDescription: 'Soldadura',
            productCharacteristic: 'Longitud',
            processCharacteristic: '',
            sampleSize: '5',
            evaluationTechnique: 'Calibre',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        })];
        const errors = getDocumentCompletionErrors(makeDoc(items));
        expect(errors).toHaveLength(0);
    });

    it('returns errors for CC items with missing fields', () => {
        const items = [makeItem({
            id: 'cc-1',
            specialCharClass: 'CC',
            processStepNumber: '10',
            processDescription: 'Soldadura',
            // productCharacteristic, sampleSize, etc. empty
        })];
        const errors = getDocumentCompletionErrors(makeDoc(items));
        expect(errors).toHaveLength(1);
        expect(errors[0].itemId).toBe('cc-1');
        expect(errors[0].missing.length).toBeGreaterThan(0);
    });

    it('returns errors for AP=H items with missing fields', () => {
        const items = [makeItem({
            amfeAp: 'H',
            processStepNumber: '20',
            processDescription: 'Pintura',
        })];
        const errors = getDocumentCompletionErrors(makeDoc(items));
        expect(errors).toHaveLength(1);
        expect(errors[0].processStep).toBe('20');
    });

    it('ignores non-critical items (AP=L, no CC/SC)', () => {
        const items = [makeItem({
            amfeAp: 'L',
            specialCharClass: '',
            // All empty — not critical
        })];
        const errors = getDocumentCompletionErrors(makeDoc(items));
        expect(errors).toHaveLength(0);
    });

    it('uses fallback descriptions for missing fields', () => {
        const items = [makeItem({
            specialCharClass: 'SC',
            processStepNumber: '',
            processDescription: '',
        })];
        const errors = getDocumentCompletionErrors(makeDoc(items));
        expect(errors[0].processStep).toBe('\u2014');
        expect(errors[0].processDescription).toBe('(sin descripción)');
    });

    it('returns empty for empty document', () => {
        const errors = getDocumentCompletionErrors(makeDoc([]));
        expect(errors).toHaveLength(0);
    });
});

// ============================================================================
// LAYER 3: getExportWarnings
// ============================================================================

describe('getExportWarnings', () => {
    it('warns about empty header fields', () => {
        const doc = makeDoc([makeItem({ reactionPlanOwner: 'Op' })], {
            controlPlanNumber: '',
            partName: '',
            partNumber: '',
            organization: '',
            responsible: '',
            date: '',
        });
        const warnings = getExportWarnings(doc);
        expect(warnings.some(w => w.includes('encabezado vacíos'))).toBe(true);
    });

    it('warns about critical items with missing fields', () => {
        const items = [makeItem({ specialCharClass: 'CC' })];
        const doc = makeDoc(items, { controlPlanNumber: 'CP-1', partName: 'P', partNumber: 'N', organization: 'O', responsible: 'R', date: '2025-01-01' });
        const warnings = getExportWarnings(doc);
        expect(warnings.some(w => w.includes('crítico(s)'))).toBe(true);
    });

    it('warns about items without reactionPlanOwner', () => {
        const items = [
            makeItem({ id: '1', reactionPlanOwner: '' }),
            makeItem({ id: '2', reactionPlanOwner: 'Operador' }),
        ];
        const doc = makeDoc(items, { controlPlanNumber: 'CP-1', partName: 'P', partNumber: 'N', organization: 'O', responsible: 'R', date: '2025-01-01' });
        const warnings = getExportWarnings(doc);
        expect(warnings.some(w => w.includes('1 ítem(s) sin Responsable'))).toBe(true);
    });

    it('warns about empty plan', () => {
        const doc = makeDoc([], { controlPlanNumber: 'CP-1', partName: 'P', partNumber: 'N', organization: 'O', responsible: 'R', date: '2025-01-01' });
        const warnings = getExportWarnings(doc);
        expect(warnings.some(w => w.includes('no tiene items'))).toBe(true);
    });

    it('warns about fields exceeding Excel limit', () => {
        const items = [makeItem({
            controlMethod: 'x'.repeat(EXCEL_CELL_LIMIT + 1),
            reactionPlanOwner: 'Op',
        })];
        const doc = makeDoc(items, { controlPlanNumber: 'CP-1', partName: 'P', partNumber: 'N', organization: 'O', responsible: 'R', date: '2025-01-01' });
        const warnings = getExportWarnings(doc);
        expect(warnings.some(w => w.includes('exceden el límite'))).toBe(true);
    });

    it('returns no warnings for fully complete document', () => {
        const items = [makeItem({
            processStepNumber: '10',
            processDescription: 'Soldadura',
            productCharacteristic: 'Longitud',
            sampleSize: '5',
            controlMethod: 'SPC',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        })];
        const doc = makeDoc(items, {
            controlPlanNumber: 'CP-001',
            partName: 'Pieza',
            partNumber: 'PN-100',
            organization: 'BARACK',
            responsible: 'Juan',
            date: '2025-01-01',
        });
        const warnings = getExportWarnings(doc);
        expect(warnings).toHaveLength(0);
    });

    it('counts multiple missing owners correctly', () => {
        const items = [
            makeItem({ id: '1', reactionPlanOwner: '' }),
            makeItem({ id: '2', reactionPlanOwner: '' }),
            makeItem({ id: '3', reactionPlanOwner: 'Op' }),
        ];
        const doc = makeDoc(items, { controlPlanNumber: 'CP-1', partName: 'P', partNumber: 'N', organization: 'O', responsible: 'R', date: '2025-01-01' });
        const warnings = getExportWarnings(doc);
        expect(warnings.some(w => w.includes('2 ítem(s) sin Responsable'))).toBe(true);
    });
});

// ============================================================================
// LAYER 4: validateControlPlanDocument
// ============================================================================

describe('validateControlPlanDocument', () => {
    it('validates a correct document', () => {
        const doc = {
            header: {
                controlPlanNumber: 'CP-001',
                phase: 'production',
                partNumber: 'PN-100',
                partName: 'Pieza',
                organization: 'BARACK',
                responsible: 'Juan',
                date: '2025-01-01',
            },
            items: [{
                id: 'item-1',
                processStepNumber: '10',
                processDescription: 'Soldadura',
                specification: '',
                controlMethod: 'SPC',
                reactionPlan: 'Segregar',
                reactionPlanOwner: 'Operador',
            }],
        };
        const result = validateControlPlanDocument(doc);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects null input', () => {
        const result = validateControlPlanDocument(null);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('JSON válido');
    });

    it('rejects missing header', () => {
        const result = validateControlPlanDocument({ items: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('header'))).toBe(true);
    });

    it('detects missing header fields', () => {
        const result = validateControlPlanDocument({
            header: { phase: 'production' },
            items: [],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('controlPlanNumber'))).toBe(true);
    });

    it('detects invalid phase', () => {
        const result = validateControlPlanDocument({
            header: {
                controlPlanNumber: 'CP-1', phase: 'invalidPhase',
                partNumber: 'P', partName: 'N', organization: 'O', responsible: 'R', date: 'D',
            },
            items: [],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Fase inválida'))).toBe(true);
    });

    it('rejects missing items array', () => {
        const result = validateControlPlanDocument({
            header: {
                controlPlanNumber: 'CP-1', phase: 'production',
                partNumber: 'P', partName: 'N', organization: 'O', responsible: 'R', date: 'D',
            },
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('items'))).toBe(true);
    });

    it('detects items without id', () => {
        const result = validateControlPlanDocument({
            header: {
                controlPlanNumber: 'CP-1', phase: 'production',
                partNumber: 'P', partName: 'N', organization: 'O', responsible: 'R', date: 'D',
            },
            items: [{ processStepNumber: '10' }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('falta "id"'))).toBe(true);
    });

    it('detects non-string fields in items', () => {
        const result = validateControlPlanDocument({
            header: {
                controlPlanNumber: 'CP-1', phase: 'production',
                partNumber: 'P', partName: 'N', organization: 'O', responsible: 'R', date: 'D',
            },
            items: [{ id: 'i1', controlMethod: 123 }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('controlMethod') && e.includes('string'))).toBe(true);
    });
});

// ============================================================================
// CONTEXT-AWARE REQUIRED KEYS (CP 2024: process vs product rows)
// ============================================================================

describe('getRequiredKeysForItem — context-aware', () => {
    it('process row requires processCharacteristic and controlMethod', () => {
        const item = makeItem({
            processCharacteristic: 'Temperatura',
            productCharacteristic: '',
        });
        const keys = getRequiredKeysForItem(item);
        expect(keys).toContain('processCharacteristic');
        expect(keys).toContain('controlMethod');
        expect(keys).not.toContain('productCharacteristic');
        expect(keys).not.toContain('evaluationTechnique');
    });

    it('product row requires productCharacteristic and evaluationTechnique', () => {
        const item = makeItem({
            productCharacteristic: 'Dimension X',
            processCharacteristic: '',
        });
        const keys = getRequiredKeysForItem(item);
        expect(keys).toContain('productCharacteristic');
        expect(keys).toContain('evaluationTechnique');
        expect(keys).not.toContain('processCharacteristic');
        expect(keys).not.toContain('controlMethod');
    });

    it('mixed/legacy row requires productCharacteristic and controlMethod', () => {
        const item = makeItem({
            productCharacteristic: 'Dimension X',
            processCharacteristic: 'Temperatura',
        });
        const keys = getRequiredKeysForItem(item);
        expect(keys).toContain('productCharacteristic');
        expect(keys).toContain('controlMethod');
    });

    it('empty row (neither populated) uses legacy behavior', () => {
        const item = makeItem({
            productCharacteristic: '',
            processCharacteristic: '',
        });
        const keys = getRequiredKeysForItem(item);
        expect(keys).toContain('productCharacteristic');
        expect(keys).toContain('controlMethod');
    });

    it('all row types require common base fields', () => {
        const processItem = makeItem({ processCharacteristic: 'T', productCharacteristic: '' });
        const productItem = makeItem({ productCharacteristic: 'D', processCharacteristic: '' });
        const base = ['processStepNumber', 'processDescription', 'sampleSize', 'reactionPlan', 'reactionPlanOwner'];

        for (const k of base) {
            expect(getRequiredKeysForItem(processItem)).toContain(k);
            expect(getRequiredKeysForItem(productItem)).toContain(k);
        }
    });
});

describe('getItemValidationState — context-aware rows', () => {
    it('process row (empty productCharacteristic) is NOT flagged for missing productCharacteristic', () => {
        const item = makeItem({
            processStepNumber: '10',
            processDescription: 'Op',
            processCharacteristic: 'Temperatura',
            productCharacteristic: '',
            controlMethod: 'SPC',
            sampleSize: '5',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('ok');
    });

    it('product row (empty controlMethod) is NOT flagged for missing controlMethod', () => {
        const item = makeItem({
            processStepNumber: '10',
            processDescription: 'Op',
            productCharacteristic: 'Dimension',
            processCharacteristic: '',
            controlMethod: '',
            evaluationTechnique: 'Calibre',
            sampleSize: '5',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('ok');
    });

    it('process row missing controlMethod IS flagged as warning', () => {
        const item = makeItem({
            processStepNumber: '10',
            processDescription: 'Op',
            processCharacteristic: 'Temperatura',
            productCharacteristic: '',
            controlMethod: '', // missing!
            sampleSize: '5',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('Método Control'))).toBe(true);
    });

    it('product row missing evaluationTechnique IS flagged as warning', () => {
        const item = makeItem({
            processStepNumber: '10',
            processDescription: 'Op',
            productCharacteristic: 'Dimension',
            processCharacteristic: '',
            evaluationTechnique: '', // missing!
            sampleSize: '5',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('Técnica Evaluación'))).toBe(true);
    });

    it('CC product row does NOT trigger missing controlMethod error', () => {
        const item = makeItem({
            specialCharClass: 'CC',
            processStepNumber: '10',
            processDescription: 'Op',
            productCharacteristic: 'Dimension',
            processCharacteristic: '',
            controlMethod: '',
            evaluationTechnique: 'Calibre',
            sampleSize: '5',
            reactionPlan: 'Segregar',
            reactionPlanOwner: 'Operador',
        });
        const result = getItemValidationState(item);
        expect(result.messages.every(m => !m.includes('Método de Control'))).toBe(true);
    });
});

// ============================================================================
// Soft Limits (R6F)
// ============================================================================

describe('getCpSoftLimitWarnings (R6F)', () => {
    it('returns no warnings for small document', () => {
        const doc: ControlPlanDocument = {
            header: { ...EMPTY_CP_HEADER },
            items: [makeItem()],
        };
        expect(getCpSoftLimitWarnings(doc)).toHaveLength(0);
    });

    it('warns when items exceed soft limit', () => {
        const items = Array.from({ length: CP_SOFT_LIMIT_ITEMS + 1 }, (_, i) =>
            makeItem({ id: `item-${i}` })
        );
        const doc: ControlPlanDocument = {
            header: { ...EMPTY_CP_HEADER },
            items,
        };
        const warnings = getCpSoftLimitWarnings(doc);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain(`${CP_SOFT_LIMIT_ITEMS + 1}`);
    });

    it('does not warn at exactly the limit', () => {
        const items = Array.from({ length: CP_SOFT_LIMIT_ITEMS }, (_, i) =>
            makeItem({ id: `item-${i}` })
        );
        const doc: ControlPlanDocument = {
            header: { ...EMPTY_CP_HEADER },
            items,
        };
        expect(getCpSoftLimitWarnings(doc)).toHaveLength(0);
    });
});
