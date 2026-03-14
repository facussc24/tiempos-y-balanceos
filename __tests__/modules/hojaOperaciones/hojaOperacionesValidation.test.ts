import { describe, it, expect } from 'vitest';
import {
    validateHoDocument,
    getHoExportErrors,
    getHoValidationSummary,
} from '../../../modules/hojaOperaciones/hojaOperacionesValidation';
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

function makeSheet(overrides: Partial<HojaOperacion> = {}): HojaOperacion {
    const base = createEmptyHoSheet('op-1', '10', 'Soldadura');
    return { ...base, ...overrides };
}

function makeDoc(sheets?: HojaOperacion[]): HoDocument {
    return {
        header: { ...EMPTY_HO_HEADER },
        sheets: sheets || [makeSheet()],
    };
}

/** A fully valid sheet (no errors expected). */
function makeValidSheet(): HojaOperacion {
    return makeSheet({
        steps: [{ id: 's1', stepNumber: 1, description: 'Paso 1', isKeyPoint: false, keyPointReason: '' }],
        safetyElements: ['anteojos'],
        preparedBy: 'F.Santoro',
        approvedBy: 'M.Donofrio',
        visualAids: [{ id: 'va1', imageData: 'data:...', caption: 'Foto', order: 0 }],
        sector: 'SOLDADURA',
        reactionContact: 'Supervisor de turno',
    });
}

// ============================================================================
// EMPTY DOCUMENT
// ============================================================================

describe('validateHoDocument – empty', () => {
    it('returns error for empty document', () => {
        const doc = makeDoc([]);
        const issues = validateHoDocument(doc);
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('error');
        expect(issues[0].message).toContain('no tiene hojas');
    });
});

// ============================================================================
// PER-SHEET ERRORS
// ============================================================================

describe('validateHoDocument – errors', () => {
    it('error: no steps defined', () => {
        const doc = makeDoc([makeSheet({ steps: [] })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'error' && i.message.includes('pasos'))).toBe(true);
    });

    it('error: no PPE selected', () => {
        const doc = makeDoc([makeSheet({ safetyElements: [] })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'error' && i.message.includes('EPP'))).toBe(true);
    });

    it('error: preparedBy empty', () => {
        const doc = makeDoc([makeSheet({ preparedBy: '' })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'error' && i.message.includes('Realizo'))).toBe(true);
    });

    it('error: approvedBy empty', () => {
        const doc = makeDoc([makeSheet({ approvedBy: '' })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'error' && i.message.includes('Aprobo'))).toBe(true);
    });
});

// ============================================================================
// WARNINGS
// ============================================================================

describe('validateHoDocument – warnings', () => {
    it('warning: no visual aids', () => {
        const doc = makeDoc([makeSheet({ visualAids: [] })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('ayudas visuales'))).toBe(true);
    });

    it('warning: CC/SC without key point', () => {
        const doc = makeDoc([makeSheet({
            qualityChecks: [{
                id: 'qc-1', characteristic: 'Dim A', specification: '', evaluationTechnique: '',
                frequency: '', controlMethod: '', reactionAction: '', reactionContact: '',
                specialCharSymbol: 'CC', registro: '',
            }],
            steps: [{ id: 's1', stepNumber: 1, description: 'Paso', isKeyPoint: false, keyPointReason: '' }],
        })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('CC/SC'))).toBe(true);
    });

    it('no CC/SC warning when step has key point', () => {
        const doc = makeDoc([makeSheet({
            qualityChecks: [{
                id: 'qc-1', characteristic: 'Dim A', specification: '', evaluationTechnique: '',
                frequency: '', controlMethod: '', reactionAction: '', reactionContact: '',
                specialCharSymbol: 'SC', registro: '',
            }],
            steps: [{ id: 's1', stepNumber: 1, description: 'Paso', isKeyPoint: true, keyPointReason: 'Importante' }],
        })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.message.includes('CC/SC'))).toBe(false);
    });

    it('warning: sector empty', () => {
        const doc = makeDoc([makeSheet({ sector: '' })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('Sector'))).toBe(true);
    });
});

// ============================================================================
// VALID SHEET — NO ERRORS
// ============================================================================

describe('validateHoDocument – valid sheet', () => {
    it('returns no errors for a fully valid sheet', () => {
        const doc = makeDoc([makeValidSheet()]);
        const errors = getHoExportErrors(doc);
        expect(errors).toHaveLength(0);
    });
});

// ============================================================================
// SORTING
// ============================================================================

describe('validateHoDocument – sorting', () => {
    it('errors come before warnings', () => {
        const doc = makeDoc([makeSheet({
            steps: [],
            safetyElements: [],
            visualAids: [],
            preparedBy: '',
            approvedBy: '',
        })]);
        const issues = validateHoDocument(doc);
        const firstWarning = issues.findIndex(i => i.severity === 'warning');
        const lastError = issues.map((i, idx) => i.severity === 'error' ? idx : -1).filter(i => i >= 0).pop()!;
        if (firstWarning >= 0 && lastError >= 0) {
            expect(lastError).toBeLessThan(firstWarning);
        }
    });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe('getHoExportErrors', () => {
    it('returns only errors', () => {
        const doc = makeDoc([makeSheet({ steps: [], visualAids: [] })]);
        const errors = getHoExportErrors(doc);
        expect(errors.every(i => i.severity === 'error')).toBe(true);
    });
});

describe('getHoValidationSummary', () => {
    it('returns clean summary for valid sheet', () => {
        const doc = makeDoc([makeValidSheet()]);
        expect(getHoValidationSummary(doc)).toContain('Sin problemas');
    });

    it('returns counts for issues', () => {
        const doc = makeDoc([makeSheet({
            steps: [],
            safetyElements: [],
            preparedBy: '',
            approvedBy: '',
            visualAids: [],
            sector: '',
        })]);
        const summary = getHoValidationSummary(doc);
        expect(summary).toContain('error');
        expect(summary).toContain('advertencia');
    });
});

// ============================================================================
// Audit R8: Soft limit warnings for images and step descriptions (Fix 2.8)
// ============================================================================

describe('validateHoDocument — soft limits (Audit R8)', () => {
    it('warning: visual aid image > 2MB', () => {
        const bigImage = 'x'.repeat(2_500_000);
        const doc = makeDoc([makeSheet({
            visualAids: [{ id: 'va1', imageData: bigImage, caption: 'Foto grande', order: 0 }],
        })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('muy grande'))).toBe(true);
    });

    it('no warning for image <= 2MB', () => {
        const normalImage = 'x'.repeat(1_500_000);
        const doc = makeDoc([makeSheet({
            visualAids: [{ id: 'va1', imageData: normalImage, caption: 'Foto ok', order: 0 }],
        })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.message.includes('muy grande'))).toBe(false);
    });

    it('warning: step description > 500 characters', () => {
        const longDesc = 'A'.repeat(501);
        const doc = makeDoc([makeSheet({
            steps: [{ id: 's1', stepNumber: 1, description: longDesc, isKeyPoint: false, keyPointReason: '' }],
        })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('muy larga'))).toBe(true);
    });

    it('no warning for step description <= 500 characters', () => {
        const okDesc = 'A'.repeat(500);
        const doc = makeDoc([makeSheet({
            steps: [{ id: 's1', stepNumber: 1, description: okDesc, isKeyPoint: false, keyPointReason: '' }],
        })]);
        const issues = validateHoDocument(doc);
        expect(issues.some(i => i.message.includes('muy larga'))).toBe(false);
    });
});
