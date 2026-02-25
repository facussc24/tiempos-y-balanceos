import { describe, it, expect } from 'vitest';
import {
    validateCpAgainstAmfe,
    validateSpecialCharConsistency,
    validateOrphanFailures,
    validate4MAlignment,
    validateReactionPlanOwners,
    validatePokaYokeFrequency,
    validatePokaYokeDetectionCoherence,
    validateSamplingConsistency,
} from '../../../modules/controlPlan/cpCrossValidation';
import { ControlPlanDocument, ControlPlanItem, EMPTY_CP_HEADER } from '../../../modules/controlPlan/controlPlanTypes';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';

// ============================================================================
// HELPERS
// ============================================================================

function makeItem(overrides?: Partial<ControlPlanItem>): ControlPlanItem {
    return {
        id: 'item-1',
        processStepNumber: '10',
        processDescription: 'Soldadura MIG',
        machineDeviceTool: 'Robot Soldador',
        characteristicNumber: 'C-001',
        productCharacteristic: 'Cordón de soldadura',
        processCharacteristic: 'Corriente de soldadura',
        specialCharClass: '',
        specification: '200-250A',
        evaluationTechnique: 'Inspección visual',
        sampleSize: '5 piezas',
        sampleFrequency: 'Cada hora',
        controlMethod: 'SPC carta X-R',
        reactionPlan: 'Contener producto',
        reactionPlanOwner: 'Operador',
        amfeAp: 'H',
        amfeSeverity: 8,
        operationCategory: 'soldadura',
        ...overrides,
    };
}

function makeCpDoc(items?: ControlPlanItem[]): ControlPlanDocument {
    return {
        header: { ...EMPTY_CP_HEADER, partName: 'TestPieza', partNumber: 'PN-100' },
        items: items || [makeItem()],
    };
}

function makeAmfeDoc(overrides?: {
    opName?: string;
    severity?: number;
    ap?: string;
    specialChar?: string;
    weName?: string;
    failDesc?: string;
    causeName?: string;
}): AmfeDocument {
    const o = overrides || {};
    return {
        header: {
            organization: 'BARACK', location: 'PLANT', client: 'Client',
            modelYear: '2025', subject: 'Test AMFE', startDate: '2025-01-01',
            revDate: '', team: 'Team', amfeNumber: 'A-001', responsible: 'Resp',
            confidentiality: '-', partNumber: 'PN-100', processResponsible: 'PR',
            revision: 'Rev-A', approvedBy: 'Appr', scope: '',
        },
        operations: [{
            id: 'op1', opNumber: '10', name: o.opName ?? 'Soldadura MIG',
            workElements: [{
                id: 'we1', type: 'Machine', name: o.weName ?? 'Robot Soldador',
                functions: [{
                    id: 'f1', description: 'Soldar piezas', requirements: '',
                    failures: [{
                        id: 'fail1', description: o.failDesc ?? 'No suelda',
                        effectLocal: '', effectNextLevel: '', effectEndUser: 'Pieza defectuosa',
                        severity: o.severity ?? 8,
                        causes: [{
                            id: 'c1', cause: o.causeName ?? 'Electrodo gastado',
                            preventionControl: 'Mantenimiento', detectionControl: 'Inspección',
                            occurrence: 5, detection: 6, ap: o.ap ?? 'H',
                            characteristicNumber: '', specialChar: o.specialChar ?? '', filterCode: '',
                            preventionAction: '', detectionAction: '', responsible: '',
                            targetDate: '', status: '', actionTaken: '', completionDate: '',
                            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
                            observations: '',
                        }],
                    }],
                }],
            }],
        }],
    };
}

// ============================================================================
// V1: Special Characteristic Consistency
// ============================================================================

describe('validateSpecialCharConsistency', () => {
    it('reports no issues when CC/SC matches AMFE', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: 'SC' })]);
        const amfe = makeAmfeDoc({ severity: 8 });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('detects missing CC when AMFE severity >= 9', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: '' })]);
        const amfe = makeAmfeDoc({ severity: 9 });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues.some(i => i.code === 'CC_SC_MISSING' && i.message.includes('CC'))).toBe(true);
    });

    it('detects missing SC when AMFE severity 5-8 (AIAG S=5-8 → SC)', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: '' })]);
        const amfe = makeAmfeDoc({ severity: 7 });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues.some(i => i.code === 'CC_SC_MISSING' && i.message.includes('SC'))).toBe(true);
    });

    it('detects missing SC when AMFE severity = 5 (lower SC bound)', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: '' })]);
        const amfe = makeAmfeDoc({ severity: 5 });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues.some(i => i.code === 'CC_SC_MISSING' && i.message.includes('SC'))).toBe(true);
    });

    it('detects mismatch (CP has SC but AMFE expects CC)', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: 'SC' })]);
        const amfe = makeAmfeDoc({ severity: 10 });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues.some(i => i.code === 'CC_SC_MISMATCH')).toBe(true);
    });

    it('uses explicit specialChar from AMFE over severity-derived', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: 'D' })]);
        const amfe = makeAmfeDoc({ severity: 9, specialChar: 'D' });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('no issues when severity < 5 and no explicit specialChar', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: '' })]);
        const amfe = makeAmfeDoc({ severity: 4 });
        const issues = validateSpecialCharConsistency(cp, amfe);
        expect(issues).toHaveLength(0);
    });
});

// ============================================================================
// V2: Orphan Failures
// ============================================================================

describe('validateOrphanFailures', () => {
    it('reports no issues when all causes are covered', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Soldadura MIG' })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG' });
        const issues = validateOrphanFailures(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('detects AP=H cause not covered in CP', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Ensamble' })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG', ap: 'H' });
        const issues = validateOrphanFailures(cp, amfe);
        expect(issues.some(i => i.code === 'ORPHAN_FAILURE' && i.severity === 'error')).toBe(true);
    });

    it('detects AP=M cause not covered (warning level)', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Ensamble' })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG', ap: 'M' });
        const issues = validateOrphanFailures(cp, amfe);
        expect(issues.some(i => i.code === 'ORPHAN_FAILURE' && i.severity === 'warning')).toBe(true);
    });

    it('does not flag AP=L causes', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Ensamble' })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG', ap: 'L' });
        const issues = validateOrphanFailures(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('matches by substring (partial process name)', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Soldadura' })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG' });
        const issues = validateOrphanFailures(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('includes AMFE path in issue', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Ensamble' })]);
        const amfe = makeAmfeDoc({ opName: 'Pintura', failDesc: 'Descascarado', causeName: 'Contaminación' });
        const issues = validateOrphanFailures(cp, amfe);
        expect(issues[0]?.amfePath).toContain('Pintura');
    });
});

// ============================================================================
// V3: 4M Alignment
// ============================================================================

describe('validate4MAlignment', () => {
    it('reports no issues when machine matches work element', () => {
        const cp = makeCpDoc([makeItem({ machineDeviceTool: 'Robot Soldador' })]);
        const amfe = makeAmfeDoc({ weName: 'Robot Soldador' });
        const issues = validate4MAlignment(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('detects machine mismatch', () => {
        const cp = makeCpDoc([makeItem({ machineDeviceTool: 'Prensa Hidráulica' })]);
        const amfe = makeAmfeDoc({ weName: 'Robot Soldador' });
        const issues = validate4MAlignment(cp, amfe);
        expect(issues.some(i => i.code === '4M_MISMATCH')).toBe(true);
    });

    it('matches by substring (partial machine name)', () => {
        const cp = makeCpDoc([makeItem({ machineDeviceTool: 'Robot' })]);
        const amfe = makeAmfeDoc({ weName: 'Robot Soldador' });
        const issues = validate4MAlignment(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('skips items with empty machine field', () => {
        const cp = makeCpDoc([makeItem({ machineDeviceTool: '' })]);
        const amfe = makeAmfeDoc();
        const issues = validate4MAlignment(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('severity is info', () => {
        const cp = makeCpDoc([makeItem({ machineDeviceTool: 'Prensa' })]);
        const amfe = makeAmfeDoc({ weName: 'Robot Soldador' });
        const issues = validate4MAlignment(cp, amfe);
        expect(issues.every(i => i.severity === 'info')).toBe(true);
    });
});

// ============================================================================
// V4: Reaction Plan Owners
// ============================================================================

describe('validateReactionPlanOwners', () => {
    it('reports no issues when all items have owners', () => {
        const cp = makeCpDoc([
            makeItem({ reactionPlanOwner: 'Operador' }),
            makeItem({ id: 'item-2', reactionPlanOwner: 'Supervisor' }),
        ]);
        const issues = validateReactionPlanOwners(cp);
        expect(issues).toHaveLength(0);
    });

    it('detects items without owner', () => {
        const cp = makeCpDoc([
            makeItem({ reactionPlanOwner: 'Operador' }),
            makeItem({ id: 'item-2', processDescription: 'Ensamble', reactionPlanOwner: '' }),
        ]);
        const issues = validateReactionPlanOwners(cp);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe('MISSING_OWNER');
        expect(issues[0].severity).toBe('error');
    });

    it('treats whitespace-only owner as missing', () => {
        const cp = makeCpDoc([makeItem({ reactionPlanOwner: '   ' })]);
        const issues = validateReactionPlanOwners(cp);
        expect(issues).toHaveLength(1);
    });

    it('reports all items without owners', () => {
        const cp = makeCpDoc([
            makeItem({ id: '1', reactionPlanOwner: '' }),
            makeItem({ id: '2', reactionPlanOwner: '' }),
        ]);
        const issues = validateReactionPlanOwners(cp);
        expect(issues).toHaveLength(2);
    });
});

// ============================================================================
// V5: Poka-Yoke Frequency
// ============================================================================

describe('validatePokaYokeFrequency', () => {
    it('reports no issues for non-Poka-Yoke items', () => {
        const cp = makeCpDoc([makeItem({ controlMethod: 'SPC carta X-R' })]);
        const issues = validatePokaYokeFrequency(cp);
        expect(issues).toHaveLength(0);
    });

    it('reports no issues when Poka-Yoke has verification frequency', () => {
        const cp = makeCpDoc([makeItem({
            controlMethod: 'Poka-Yoke geométrico',
            sampleFrequency: 'Verificar pieza patrón cada turno',
        })]);
        const issues = validatePokaYokeFrequency(cp);
        expect(issues).toHaveLength(0);
    });

    it('detects Poka-Yoke without verification', () => {
        const cp = makeCpDoc([makeItem({
            controlMethod: 'Poka-Yoke',
            sampleFrequency: 'Cada pieza',
        })]);
        const issues = validatePokaYokeFrequency(cp);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe('POKAYOKE_NO_VERIFY');
    });

    it('detects "poka yoke" without hyphen', () => {
        const cp = makeCpDoc([makeItem({
            controlMethod: 'Poka Yoke sensor',
            sampleFrequency: 'Continuo',
        })]);
        const issues = validatePokaYokeFrequency(cp);
        expect(issues).toHaveLength(1);
    });
});

// ============================================================================
// V6: Poka-Yoke vs Detection Coherence
// ============================================================================

describe('validatePokaYokeDetectionCoherence (R6F)', () => {
    it('reports no issues when Poka-Yoke and D <= 3', () => {
        const cp = makeCpDoc([makeItem({ controlMethod: 'Poka-Yoke geométrico' })]);
        const amfe = makeAmfeDoc();
        // Override detection to 2 in the AMFE
        amfe.operations[0].workElements[0].functions[0].failures[0].causes[0].detection = 2;
        const issues = validatePokaYokeDetectionCoherence(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('warns when Poka-Yoke but D > 3', () => {
        const cp = makeCpDoc([makeItem({ controlMethod: 'Poka-Yoke sensor' })]);
        const amfe = makeAmfeDoc();
        amfe.operations[0].workElements[0].functions[0].failures[0].causes[0].detection = 7;
        const issues = validatePokaYokeDetectionCoherence(cp, amfe);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe('POKAYOKE_HIGH_D');
        expect(issues[0].severity).toBe('warning');
    });

    it('does not flag non-Poka-Yoke items', () => {
        const cp = makeCpDoc([makeItem({ controlMethod: 'SPC carta X-R' })]);
        const amfe = makeAmfeDoc();
        amfe.operations[0].workElements[0].functions[0].failures[0].causes[0].detection = 9;
        const issues = validatePokaYokeDetectionCoherence(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('requires AMFE doc to produce issues', () => {
        const cp = makeCpDoc([makeItem({ controlMethod: 'Poka-Yoke' })]);
        const issues = validatePokaYokeDetectionCoherence(cp);
        expect(issues).toHaveLength(0);
    });
});

// ============================================================================
// V7: Sampling Consistency
// ============================================================================

describe('validateSamplingConsistency (R6F)', () => {
    it('reports no issues when 100% with cada pieza', () => {
        const cp = makeCpDoc([makeItem({ sampleSize: '100%', sampleFrequency: 'Cada pieza' })]);
        const issues = validateSamplingConsistency(cp);
        expect(issues).toHaveLength(0);
    });

    it('reports no issues when 100% with continuo', () => {
        const cp = makeCpDoc([makeItem({ sampleSize: '100%', sampleFrequency: 'Continuo' })]);
        const issues = validateSamplingConsistency(cp);
        expect(issues).toHaveLength(0);
    });

    it('warns when 100% with non-continuous frequency', () => {
        const cp = makeCpDoc([makeItem({ sampleSize: '100%', sampleFrequency: 'Cada turno' })]);
        const issues = validateSamplingConsistency(cp);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe('SAMPLE_INCONSISTENCY');
        expect(issues[0].severity).toBe('info');
    });

    it('does not flag non-100% samples', () => {
        const cp = makeCpDoc([makeItem({ sampleSize: '5 piezas', sampleFrequency: 'Cada turno' })]);
        const issues = validateSamplingConsistency(cp);
        expect(issues).toHaveLength(0);
    });

    it('does not flag 100% with empty frequency', () => {
        const cp = makeCpDoc([makeItem({ sampleSize: '100%', sampleFrequency: '' })]);
        const issues = validateSamplingConsistency(cp);
        expect(issues).toHaveLength(0);
    });
});

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

describe('validateCpAgainstAmfe', () => {
    it('returns empty array for clean doc', () => {
        const cp = makeCpDoc([makeItem({ specialCharClass: 'SC', reactionPlanOwner: 'Operador' })]);
        const amfe = makeAmfeDoc({ severity: 8 });
        const issues = validateCpAgainstAmfe(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('runs CP-only validations without AMFE', () => {
        const cp = makeCpDoc([makeItem({ reactionPlanOwner: '' })]);
        const issues = validateCpAgainstAmfe(cp);
        expect(issues.some(i => i.code === 'MISSING_OWNER')).toBe(true);
    });

    it('runs cross-validations when AMFE provided', () => {
        const cp = makeCpDoc([makeItem({ processDescription: 'Ensamble', specialCharClass: '', reactionPlanOwner: 'Op' })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG', severity: 9 });
        const issues = validateCpAgainstAmfe(cp, amfe);
        expect(issues.some(i => i.code === 'ORPHAN_FAILURE')).toBe(true);
    });

    it('sorts issues by severity (error > warning > info)', () => {
        const cp = makeCpDoc([
            makeItem({ id: '1', processDescription: 'Soldadura MIG', machineDeviceTool: 'Prensa', reactionPlanOwner: '', specialCharClass: '' }),
        ]);
        const amfe = makeAmfeDoc({ severity: 9, weName: 'Robot' });
        const issues = validateCpAgainstAmfe(cp, amfe);
        if (issues.length >= 2) {
            const severityOrder = { error: 0, warning: 1, info: 2 };
            for (let i = 1; i < issues.length; i++) {
                expect(severityOrder[issues[i].severity]).toBeGreaterThanOrEqual(severityOrder[issues[i - 1].severity]);
            }
        }
    });

    it('skips cross-validation when AMFE has no operations', () => {
        const cp = makeCpDoc([makeItem({ reactionPlanOwner: 'Op' })]);
        const emptyAmfe: AmfeDocument = {
            header: makeAmfeDoc().header,
            operations: [],
        };
        const issues = validateCpAgainstAmfe(cp, emptyAmfe);
        expect(issues.some(i => i.code === 'ORPHAN_FAILURE')).toBe(false);
    });
});

// ============================================================================
// Audit R8: Whitespace collapse in cross-validation (Fix 1.6)
// ============================================================================

describe('cpCrossValidation: whitespace collapse (Audit R8)', () => {
    it('4M alignment matches despite extra whitespace in CP machine name', () => {
        const cp = makeCpDoc([makeItem({ machineDeviceTool: 'Robot  Soldador', reactionPlanOwner: 'Op' })]);
        const amfe = makeAmfeDoc({ weName: 'Robot Soldador' });
        const issues = validate4MAlignment(cp, amfe);
        expect(issues).toHaveLength(0);
    });

    it('orphan validation matches description with collapsed whitespace', () => {
        const cp = makeCpDoc([makeItem({
            processDescription: 'Soldadura  MIG',
            reactionPlanOwner: 'Op',
            specialCharClass: 'SC',
        })]);
        const amfe = makeAmfeDoc({ opName: 'Soldadura MIG', severity: 8 });
        const issues = validateOrphanFailures(cp, amfe);
        // CP covers the AMFE failure → no orphan
        expect(issues.filter(i => i.code === 'ORPHAN_FAILURE')).toHaveLength(0);
    });
});
