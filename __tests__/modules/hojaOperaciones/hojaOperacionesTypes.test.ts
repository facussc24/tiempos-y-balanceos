import { describe, it, expect } from 'vitest';
import {
    createEmptyHoSheet,
    createEmptyStep,
    normalizeHoDocument,
    EMPTY_HO_HEADER,
    EMPTY_HO_DOCUMENT,
    DEFAULT_REACTION_PLAN_TEXT,
    PPE_CATALOG,
    HAZARD_CATALOG,
    HoDocument,
} from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// createEmptyHoSheet
// ============================================================================

describe('createEmptyHoSheet', () => {
    it('creates a sheet with the given AMFE operation data', () => {
        const sheet = createEmptyHoSheet('op-1', '10', 'Soldadura MIG');
        expect(sheet.amfeOperationId).toBe('op-1');
        expect(sheet.operationNumber).toBe('10');
        expect(sheet.operationName).toBe('Soldadura MIG');
        expect(sheet.hoNumber).toBe('HO-10');
    });

    it('generates a unique id', () => {
        const s1 = createEmptyHoSheet('a', '1', 'Op1');
        const s2 = createEmptyHoSheet('b', '2', 'Op2');
        expect(s1.id).not.toBe(s2.id);
    });

    it('initializes all arrays as empty', () => {
        const sheet = createEmptyHoSheet('a', '1', 'Op1');
        expect(sheet.safetyElements).toEqual([]);
        expect(sheet.hazardWarnings).toEqual([]);
        expect(sheet.steps).toEqual([]);
        expect(sheet.qualityChecks).toEqual([]);
        expect(sheet.visualAids).toEqual([]);
    });

    it('sets default reaction plan text', () => {
        const sheet = createEmptyHoSheet('a', '1', 'Op1');
        expect(sheet.reactionPlanText).toBe(DEFAULT_REACTION_PLAN_TEXT);
    });

    it('sets default status as borrador', () => {
        const sheet = createEmptyHoSheet('a', '1', 'Op1');
        expect(sheet.status).toBe('borrador');
    });

    it('sets default revision as A', () => {
        const sheet = createEmptyHoSheet('a', '1', 'Op1');
        expect(sheet.revision).toBe('A');
    });

    it('sets date to today', () => {
        const sheet = createEmptyHoSheet('a', '1', 'Op1');
        const today = new Date().toISOString().split('T')[0];
        expect(sheet.date).toBe(today);
    });
});

// ============================================================================
// createEmptyStep
// ============================================================================

describe('createEmptyStep', () => {
    it('creates a step with the given number', () => {
        const step = createEmptyStep(3);
        expect(step.stepNumber).toBe(3);
        expect(step.description).toBe('');
        expect(step.isKeyPoint).toBe(false);
        expect(step.keyPointReason).toBe('');
    });

    it('generates unique ids', () => {
        const s1 = createEmptyStep(1);
        const s2 = createEmptyStep(2);
        expect(s1.id).not.toBe(s2.id);
    });
});

// ============================================================================
// normalizeHoDocument
// ============================================================================

describe('normalizeHoDocument', () => {
    it('fills missing header fields with defaults', () => {
        const doc = normalizeHoDocument({});
        expect(doc.header.formNumber).toBe(EMPTY_HO_HEADER.formNumber);
        expect(doc.header.organization).toBe('');
        expect(doc.header.linkedAmfeProject).toBe('');
    });

    it('preserves existing header fields', () => {
        const doc = normalizeHoDocument({
            header: { organization: 'Barack Mercosul', client: 'VW' },
        });
        expect(doc.header.organization).toBe('Barack Mercosul');
        expect(doc.header.client).toBe('VW');
    });

    it('returns empty sheets array when missing', () => {
        const doc = normalizeHoDocument({});
        expect(doc.sheets).toEqual([]);
    });

    it('normalizes sheets with missing fields', () => {
        const doc = normalizeHoDocument({
            sheets: [{ operationName: 'Op1' }],
        });
        expect(doc.sheets).toHaveLength(1);
        expect(doc.sheets[0].operationName).toBe('Op1');
        expect(doc.sheets[0].id).toBeTruthy();
        expect(doc.sheets[0].safetyElements).toEqual([]);
        expect(doc.sheets[0].steps).toEqual([]);
        expect(doc.sheets[0].qualityChecks).toEqual([]);
        expect(doc.sheets[0].visualAids).toEqual([]);
        expect(doc.sheets[0].status).toBe('borrador');
    });

    it('normalizes steps within sheets', () => {
        const doc = normalizeHoDocument({
            sheets: [{
                steps: [{ description: 'Tomar pieza' }],
            }],
        });
        expect(doc.sheets[0].steps).toHaveLength(1);
        expect(doc.sheets[0].steps[0].description).toBe('Tomar pieza');
        expect(doc.sheets[0].steps[0].id).toBeTruthy();
        expect(doc.sheets[0].steps[0].isKeyPoint).toBe(false);
    });

    it('normalizes quality checks within sheets', () => {
        const doc = normalizeHoDocument({
            sheets: [{
                qualityChecks: [{ characteristic: 'Diametro', specification: '10 +/- 0.1' }],
            }],
        });
        const qc = doc.sheets[0].qualityChecks[0];
        expect(qc.characteristic).toBe('Diametro');
        expect(qc.specification).toBe('10 +/- 0.1');
        expect(qc.registro).toBe('');
        expect(qc.id).toBeTruthy();
    });

    it('normalizes visual aids within sheets', () => {
        const doc = normalizeHoDocument({
            sheets: [{
                visualAids: [{ caption: 'Zona de soldadura' }],
            }],
        });
        const va = doc.sheets[0].visualAids[0];
        expect(va.caption).toBe('Zona de soldadura');
        expect(va.imageData).toBe('');
        expect(va.order).toBe(0);
    });

    it('uses DEFAULT_REACTION_PLAN_TEXT when reactionPlanText is missing', () => {
        const doc = normalizeHoDocument({ sheets: [{}] });
        expect(doc.sheets[0].reactionPlanText).toBe(DEFAULT_REACTION_PLAN_TEXT);
    });

    it('preserves explicit empty reactionPlanText', () => {
        const doc = normalizeHoDocument({ sheets: [{ reactionPlanText: '' }] });
        expect(doc.sheets[0].reactionPlanText).toBe('');
    });

    it('handles non-array safetyElements gracefully', () => {
        const doc = normalizeHoDocument({ sheets: [{ safetyElements: 'invalid' }] });
        expect(doc.sheets[0].safetyElements).toEqual([]);
    });

    it('preserves full roundtrip data', () => {
        const original: HoDocument = {
            header: {
                formNumber: 'FORM-001',
                organization: 'Org',
                client: 'Client',
                partNumber: 'PN-123',
                partDescription: 'Part Desc',
                applicableParts: '',
                linkedAmfeProject: 'AMFE-1',
                linkedCpProject: 'CP-1',
            },
            sheets: [{
                id: 'sheet-1',
                amfeOperationId: 'op-1',
                operationNumber: '10',
                operationName: 'Soldadura',
                hoNumber: 'HO-10',
                sector: 'SOLDADURA',
                puestoNumber: 'S1',
                vehicleModel: 'AMAROK',
                partCodeDescription: 'PN-123 / APC',
                safetyElements: ['anteojos', 'guantes'],
                hazardWarnings: ['superficieCaliente'],
                steps: [{
                    id: 'step-1',
                    stepNumber: 1,
                    description: 'Posicionar pieza',
                    isKeyPoint: true,
                    keyPointReason: 'Orientacion correcta',
                    visualAidId: 'va-1',
                }],
                qualityChecks: [{
                    id: 'qc-1',
                    characteristic: 'Cordon soldadura',
                    specification: '3mm +/- 0.5',
                    evaluationTechnique: 'Visual',
                    frequency: 'Cada pieza',
                    controlMethod: 'Inspeccion visual',
                    reactionAction: 'Segregar',
                    reactionContact: 'Supervisor',
                    specialCharSymbol: 'SC',
                    registro: 'Planilla X',
                    cpItemId: 'cp-1',
                }],
                reactionPlanText: 'Custom reaction',
                reactionContact: 'Supervisor',
                visualAids: [{
                    id: 'va-1',
                    imageData: 'base64data',
                    caption: 'Zona 1',
                    order: 0,
                }],
                preparedBy: 'F.Santoro',
                approvedBy: 'M.Donofrio',
                date: '2024-05-08',
                revision: '1',
                status: 'aprobado',
            }],
        };

        const normalized = normalizeHoDocument(original);
        expect(normalized.header).toEqual(original.header);
        expect(normalized.sheets[0].id).toBe('sheet-1');
        expect(normalized.sheets[0].safetyElements).toEqual(['anteojos', 'guantes']);
        expect(normalized.sheets[0].steps[0].isKeyPoint).toBe(true);
        expect(normalized.sheets[0].qualityChecks[0].cpItemId).toBe('cp-1');
        expect(normalized.sheets[0].visualAids[0].imageData).toBe('base64data');
        expect(normalized.sheets[0].status).toBe('aprobado');
    });
});

// ============================================================================
// CATALOGS
// ============================================================================

describe('PPE_CATALOG', () => {
    it('has no duplicate IDs', () => {
        const ids = PPE_CATALOG.map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('has 6 items (reduced to company ISO pictograms)', () => {
        expect(PPE_CATALOG).toHaveLength(6);
    });

    it('each item has iconFile field', () => {
        PPE_CATALOG.forEach(p => {
            expect(p.iconFile).toBeTruthy();
        });
    });
});

describe('HAZARD_CATALOG', () => {
    it('has no duplicate IDs', () => {
        const ids = HAZARD_CATALOG.map(h => h.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('has 8 items', () => {
        expect(HAZARD_CATALOG).toHaveLength(8);
    });
});

// ============================================================================
// CONSTANTS
// ============================================================================

describe('DEFAULT_REACTION_PLAN_TEXT', () => {
    it('is non-empty', () => {
        expect(DEFAULT_REACTION_PLAN_TEXT.length).toBeGreaterThan(0);
    });

    it('contains key action words', () => {
        expect(DEFAULT_REACTION_PLAN_TEXT).toContain('DETENGA');
        expect(DEFAULT_REACTION_PLAN_TEXT).toContain('NOTIFIQUE');
        expect(DEFAULT_REACTION_PLAN_TEXT).toContain('ESPERE');
    });
});

describe('EMPTY_HO_DOCUMENT', () => {
    it('has empty sheets array', () => {
        expect(EMPTY_HO_DOCUMENT.sheets).toEqual([]);
    });

    it('has default form number', () => {
        expect(EMPTY_HO_DOCUMENT.header.formNumber).toBe('I-IN-002.4-R01');
    });
});
