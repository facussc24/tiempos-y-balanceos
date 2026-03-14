import { describe, it, expect } from 'vitest';
import { clampSOD, validateAmfeDocument, migrateFailureToCausesModel, migrateFailureEffects, getFailureWarnings, getCauseValidationState, getSoftLimitWarnings, SOFT_LIMIT_OPERATIONS, SOFT_LIMIT_CAUSES_PER_FAILURE, SOFT_LIMIT_TOTAL_CAUSES } from '../../../modules/amfe/amfeValidation';
import { AmfeDocument, AmfeFailure, AmfeCause } from '../../../modules/amfe/amfeTypes';

describe('clampSOD', () => {
    it('returns valid integers 1-10', () => {
        expect(clampSOD('1')).toBe(1);
        expect(clampSOD('5')).toBe(5);
        expect(clampSOD('10')).toBe(10);
    });

    it('rounds decimals', () => {
        expect(clampSOD('5.4')).toBe(5);
        expect(clampSOD('5.6')).toBe(6);
        expect(clampSOD('1.5')).toBe(2);
    });

    it('clamps values below 1 to 1', () => {
        expect(clampSOD('0')).toBe(1);
        expect(clampSOD('-1')).toBe(1);
        expect(clampSOD('0.4')).toBe(1);
    });

    it('clamps values above 10 to 10', () => {
        expect(clampSOD('11')).toBe(10);
        expect(clampSOD('100')).toBe(10);
        expect(clampSOD('10.6')).toBe(10);
    });

    it('returns empty string for empty input', () => {
        expect(clampSOD('')).toBe('');
    });

    it('returns empty string for NaN strings', () => {
        expect(clampSOD('abc')).toBe('');
        expect(clampSOD('--')).toBe('');
    });

    it('returns empty for undefined/null cast to string', () => {
        expect(clampSOD(undefined as any)).toBe('');
        expect(clampSOD(null as any)).toBe('');
    });
});

describe('validateAmfeDocument', () => {
    const validDoc = {
        header: {
            organization: 'BARACK',
            location: 'HURLINGHAM',
            client: 'Test',
            modelYear: '2024',
            subject: 'Test AMFE',
            startDate: '2024-01-01',
            team: 'Equipo',
            responsible: 'Responsable',
            revDate: '2024-06-01',
            amfeNumber: 'AMFE-001',
            confidentiality: 'Interno',
            processResponsible: 'Resp. Proceso',
            partNumber: 'PN-100',
        },
        operations: [],
    };

    it('validates a correct empty document', () => {
        const result = validateAmfeDocument(validDoc);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects null', () => {
        const result = validateAmfeDocument(null);
        expect(result.valid).toBe(false);
    });

    it('rejects non-object', () => {
        const result = validateAmfeDocument('not an object');
        expect(result.valid).toBe(false);
    });

    it('rejects missing header', () => {
        const result = validateAmfeDocument({ operations: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('header'))).toBe(true);
    });

    it('rejects missing operations', () => {
        const result = validateAmfeDocument({ header: validDoc.header });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('operations'))).toBe(true);
    });

    it('reports missing header fields', () => {
        const result = validateAmfeDocument({
            header: { organization: 'Test' },
            operations: [],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates operations with work elements', () => {
        const doc = {
            ...validDoc,
            operations: [{
                id: 'op1',
                opNumber: '10',
                name: 'Soldadura',
                workElements: [{
                    id: 'we1',
                    type: 'Machine',
                    name: 'Robot',
                    functions: [{
                        id: 'f1',
                        description: 'Soldar',
                        requirements: '',
                        failures: [{
                            id: 'fail1',
                            description: 'No suelda',
                            effect: 'Pieza defectuosa',
                            severity: 8,
                            cause: 'Electrodo gastado',
                            preventionControl: '',
                            detectionControl: '',
                            occurrence: 5,
                            detection: 6,
                            ap: 'M',
                            specialChar: '',
                            filterCode: '',
                            preventionAction: '',
                            detectionAction: '',
                            responsible: '',
                            targetDate: '',
                            status: '',
                            actionTaken: '',
                            completionDate: '',
                            severityNew: '',
                            occurrenceNew: '',
                            detectionNew: '',
                            apNew: '',
                            observations: '',
                        }],
                    }],
                }],
            }],
        };
        const result = validateAmfeDocument(doc);
        expect(result.valid).toBe(true);
    });

    it('rejects invalid work element type', () => {
        const doc = {
            ...validDoc,
            operations: [{
                id: 'op1',
                opNumber: '10',
                name: 'Test',
                workElements: [{
                    id: 'we1',
                    type: 'InvalidType',
                    name: 'Bad',
                    functions: [],
                }],
            }],
        };
        const result = validateAmfeDocument(doc);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('tipo'))).toBe(true);
    });

    it('rejects operation missing id', () => {
        const doc = {
            ...validDoc,
            operations: [{
                opNumber: '10',
                name: 'Test',
                workElements: [],
            }],
        };
        const result = validateAmfeDocument(doc);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });

    it('rejects failure missing id', () => {
        const doc = {
            ...validDoc,
            operations: [{
                id: 'op1',
                opNumber: '10',
                name: 'Test',
                workElements: [{
                    id: 'we1',
                    type: 'Machine',
                    name: 'Robot',
                    functions: [{
                        id: 'f1',
                        description: 'Func',
                        requirements: '',
                        failures: [{ description: 'no id' }],
                    }],
                }],
            }],
        };
        const result = validateAmfeDocument(doc);
        expect(result.valid).toBe(false);
    });
});

describe('migrateFailureEffects', () => {
    it('migrates legacy single effect to effectEndUser', () => {
        const legacy = { id: 'f1', effect: 'Pieza defectuosa' };
        const result = migrateFailureEffects(legacy);
        expect(result.effectEndUser).toBe('Pieza defectuosa');
        expect(result.effectLocal).toBe('');
        expect(result.effectNextLevel).toBe('');
    });

    it('preserves existing 3-level effects without overwriting', () => {
        const modern = {
            id: 'f1',
            effect: 'Old effect',
            effectEndUser: 'End user effect',
            effectLocal: 'Local effect',
            effectNextLevel: 'Next level',
        };
        const result = migrateFailureEffects(modern);
        expect(result.effectEndUser).toBe('End user effect');
        expect(result.effectLocal).toBe('Local effect');
        expect(result.effectNextLevel).toBe('Next level');
    });

    it('adds characteristicNumber if missing', () => {
        const failure = { id: 'f1' };
        const result = migrateFailureEffects(failure);
        expect(result.characteristicNumber).toBe('');
    });

    it('adds per-level severity fields if missing', () => {
        const failure = { id: 'f1', severity: 8 };
        const result = migrateFailureEffects(failure);
        expect(result.severityLocal).toBe('');
        expect(result.severityNextLevel).toBe('');
        expect(result.severityEndUser).toBe('');
    });

    it('preserves existing per-level severity values', () => {
        const failure = { id: 'f1', severity: 9, severityLocal: 5, severityNextLevel: 7, severityEndUser: 9 };
        const result = migrateFailureEffects(failure);
        expect(result.severityLocal).toBe(5);
        expect(result.severityNextLevel).toBe(7);
        expect(result.severityEndUser).toBe(9);
    });
});

describe('migrateFailureToCausesModel', () => {
    it('migrates flat cause fields into causes array', () => {
        const legacy = {
            id: 'f1',
            cause: 'Electrodo gastado',
            preventionControl: 'Mantenimiento',
            detectionControl: 'Visual',
            occurrence: 5,
            detection: 6,
            ap: 'M',
        };
        const result = migrateFailureToCausesModel(legacy);
        expect(result.causes).toHaveLength(1);
        expect(result.causes[0].cause).toBe('Electrodo gastado');
        expect(result.causes[0].preventionControl).toBe('Mantenimiento');
        expect(result.causes[0].occurrence).toBe(5);
        expect(result.causes[0].id).toBeTruthy();
    });

    it('returns empty causes array when no cause data exists', () => {
        const noData = { id: 'f1' };
        const result = migrateFailureToCausesModel(noData);
        expect(result.causes).toEqual([]);
    });

    it('does not re-migrate if causes array already exists', () => {
        const alreadyMigrated = {
            id: 'f1',
            causes: [{ id: 'c1', cause: 'Existing cause' }],
        };
        const result = migrateFailureToCausesModel(alreadyMigrated);
        expect(result.causes).toHaveLength(1);
        expect(result.causes[0].id).toBe('c1');
    });
});

describe('getFailureWarnings', () => {
    const makeFailureWithCauses = (causes: any[]): AmfeFailure => ({
        id: 'f1',
        description: 'Test failure',
        effectLocal: '', effectNextLevel: '', effectEndUser: '',
        severity: 8,
        causes,
    });

    it('returns no warnings for a complete failure', () => {
        const failure = makeFailureWithCauses([{
            id: 'c1', cause: 'Test', preventionControl: '', detectionControl: '',
            occurrence: 5, detection: 6, ap: 'M', characteristicNumber: '',
            specialChar: '', filterCode: '',
            preventionAction: '', detectionAction: '',
            responsible: '', targetDate: '', status: '', actionTaken: '', completionDate: '',
            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
            observations: '',
        }]);
        const warnings = getFailureWarnings(failure);
        expect(warnings).toHaveLength(0);
    });

    it('warns when AP=H without actions', () => {
        const failure = makeFailureWithCauses([{
            id: 'c1', cause: 'Test', preventionControl: '', detectionControl: '',
            occurrence: 5, detection: 6, ap: 'H', characteristicNumber: '',
            specialChar: '', filterCode: '',
            preventionAction: '', detectionAction: '',
            responsible: '', targetDate: '', status: '', actionTaken: '', completionDate: '',
            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
            observations: '',
        }]);
        const warnings = getFailureWarnings(failure);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]).toContain('AP Alto');
    });

    it('warns when status is Completado without completion date', () => {
        const failure = makeFailureWithCauses([{
            id: 'c1', cause: 'Test', preventionControl: '', detectionControl: '',
            occurrence: 5, detection: 6, ap: 'M', characteristicNumber: '',
            specialChar: '', filterCode: '',
            preventionAction: 'Action', detectionAction: '',
            responsible: '', targetDate: '', status: 'Completado', actionTaken: '', completionDate: '',
            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
            observations: '',
        }]);
        const warnings = getFailureWarnings(failure);
        expect(warnings.some(w => w.includes('Completado'))).toBe(true);
    });

    it('warns on partial S/O/D', () => {
        const failure = makeFailureWithCauses([{
            id: 'c1', cause: 'Test', preventionControl: '', detectionControl: '',
            occurrence: 5, detection: '', ap: '', characteristicNumber: '',
            specialChar: '', filterCode: '',
            preventionAction: '', detectionAction: '',
            responsible: '', targetDate: '', status: '', actionTaken: '', completionDate: '',
            severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
            observations: '',
        }]);
        const warnings = getFailureWarnings(failure);
        expect(warnings.some(w => w.includes('incompletos'))).toBe(true);
    });
});

describe('getCauseValidationState', () => {
    const makeBaseCause = (overrides?: Partial<AmfeCause>): AmfeCause => ({
        id: 'c1', cause: 'Test cause',
        preventionControl: '', detectionControl: '',
        occurrence: 5, detection: 6, ap: 'M',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
        ...overrides,
    });

    const makeBaseFailure = (severity: number, causes: AmfeCause[]): AmfeFailure => ({
        id: 'f1', description: 'Test failure',
        effectLocal: '', effectNextLevel: '', effectEndUser: '',
        severity,
        causes,
    });

    it('returns ok for a complete AP=M cause with no issues', () => {
        const cause = makeBaseCause({ ap: 'M', observations: 'Analisis concluido, controles actuales son adecuados' });
        const failure = makeBaseFailure(8, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('ok');
        expect(result.messages).toHaveLength(0);
    });

    it('returns warning when AP=M without actions and without observations', () => {
        const cause = makeBaseCause({ ap: 'M', preventionAction: '', detectionAction: '', observations: '' });
        const failure = makeBaseFailure(8, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('AP Medio'))).toBe(true);
        expect(result.messages.some(m => m.includes('Observaciones'))).toBe(true);
    });

    it('returns ok when AP=M without actions but with observations', () => {
        const cause = makeBaseCause({ ap: 'M', preventionAction: '', detectionAction: '', observations: 'Controles actuales adecuados' });
        const failure = makeBaseFailure(8, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('ok');
    });

    it('returns error when AP=H and no actions defined', () => {
        const cause = makeBaseCause({ ap: 'H', preventionAction: '', detectionAction: '' });
        const failure = makeBaseFailure(8, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('error');
        expect(result.messages.some(m => m.includes('AP Alto'))).toBe(true);
        expect(result.messages.some(m => m.includes('acciones'))).toBe(true);
    });

    it('returns warning when AP=H has action but missing responsible/date', () => {
        const cause = makeBaseCause({ ap: 'H', preventionAction: 'Calibrar', responsible: '', targetDate: '' });
        const failure = makeBaseFailure(8, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('responsable'))).toBe(true);
    });

    it('returns warning on partial S/O/D', () => {
        const cause = makeBaseCause({ occurrence: 5, detection: '' as any, ap: '' });
        const failure = makeBaseFailure(8, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('S/O/D incompletos'))).toBe(true);
    });

    it('returns warning when severity >= 9 without CC', () => {
        const cause = makeBaseCause({ specialChar: '', ap: 'H', preventionAction: 'Fix', responsible: 'John', targetDate: '2025-01-01' });
        const failure = makeBaseFailure(9, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('CC'))).toBe(true);
    });

    it('returns ok when severity >= 9 with CC set', () => {
        const cause = makeBaseCause({ specialChar: 'CC', ap: 'H', preventionAction: 'Fix', responsible: 'John', targetDate: '2025-01-01' });
        const failure = makeBaseFailure(9, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('ok');
    });

    it('returns warning when status Completado without completionDate', () => {
        const cause = makeBaseCause({ status: 'Completado', completionDate: '' });
        const failure = makeBaseFailure(5, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('warning');
        expect(result.messages.some(m => m.includes('Completado'))).toBe(true);
    });

    it('error takes precedence over warning', () => {
        const cause = makeBaseCause({
            ap: 'H', preventionAction: '', detectionAction: '',
            status: 'Completado', completionDate: '',
        });
        const failure = makeBaseFailure(9, [cause]);
        const result = getCauseValidationState(failure, cause);
        expect(result.level).toBe('error');
        expect(result.messages.length).toBeGreaterThan(1);
    });
});

// ============================================================================
// R5D: Soft Limit Warnings
// ============================================================================

describe('getSoftLimitWarnings (R5D)', () => {
    /** Build a minimal AmfeDocument with a given number of operations, each with 1 failure and N causes. */
    function makeSoftLimitDoc(opts: {
        opCount?: number;
        causesPerFailure?: number;
        /** If set, override total cause count by distributing across ops (ignoring causesPerFailure). */
        totalCausesOverride?: number;
    }): AmfeDocument {
        const { opCount = 1, causesPerFailure = 1, totalCausesOverride } = opts;

        const operations = [];
        for (let i = 0; i < opCount; i++) {
            // If totalCausesOverride: put all causes in the first op's first failure
            const numCauses = totalCausesOverride
                ? (i === 0 ? totalCausesOverride : 0)
                : causesPerFailure;

            const causes = [];
            for (let j = 0; j < numCauses; j++) {
                causes.push({
                    id: `c-${i}-${j}`, cause: `Causa ${j}`,
                    preventionControl: '', detectionControl: '',
                    occurrence: 5, detection: 6, ap: 'M',
                    characteristicNumber: '', specialChar: '', filterCode: '',
                    preventionAction: '', detectionAction: '',
                    responsible: '', targetDate: '', status: '',
                    actionTaken: '', completionDate: '',
                    severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
                    observations: '',
                });
            }

            operations.push({
                id: `op-${i}`, opNumber: String((i + 1) * 10), name: `Op ${i + 1}`,
                workElements: [{
                    id: `we-${i}`, type: 'Machine' as const, name: `WE ${i}`,
                    functions: [{
                        id: `f-${i}`, description: `Func ${i}`, requirements: '',
                        failures: [{
                            id: `fail-${i}`, description: `Falla ${i}`,
                            effectLocal: '', effectNextLevel: '', effectEndUser: '',
                            severity: 5,
                            causes,
                        }],
                    }],
                }],
            });
        }

        return {
            header: {
                organization: 'TEST', location: '', client: '', modelYear: '',
                subject: '', startDate: '', revDate: '', team: '',
                amfeNumber: '', responsible: '', confidentiality: '',
                partNumber: '', processResponsible: '', revision: '', approvedBy: '', scope: '', applicableParts: '',
            },
            operations,
        };
    }

    it('returns no warnings for a small document', () => {
        const doc = makeSoftLimitDoc({ opCount: 3, causesPerFailure: 2 });
        const warnings = getSoftLimitWarnings(doc);
        expect(warnings).toEqual([]);
    });

    it('warns when operations exceed SOFT_LIMIT_OPERATIONS', () => {
        const doc = makeSoftLimitDoc({ opCount: SOFT_LIMIT_OPERATIONS + 1, causesPerFailure: 1 });
        const warnings = getSoftLimitWarnings(doc);
        expect(warnings.length).toBeGreaterThanOrEqual(1);
        const opWarning = warnings.find(w => w.includes('operaciones'));
        expect(opWarning).toBeDefined();
        expect(opWarning).toContain(String(SOFT_LIMIT_OPERATIONS + 1));
    });

    it('warns when a single failure has more than SOFT_LIMIT_CAUSES_PER_FAILURE causes', () => {
        const doc = makeSoftLimitDoc({ opCount: 1, causesPerFailure: SOFT_LIMIT_CAUSES_PER_FAILURE + 1 });
        const warnings = getSoftLimitWarnings(doc);
        expect(warnings.length).toBeGreaterThanOrEqual(1);
        const causeWarning = warnings.find(w => w.includes('causas') && w.includes('Falla'));
        expect(causeWarning).toBeDefined();
        expect(causeWarning).toContain(String(SOFT_LIMIT_CAUSES_PER_FAILURE + 1));
    });

    it('warns when total causes exceed SOFT_LIMIT_TOTAL_CAUSES', () => {
        // Put all causes in one op to keep opCount small
        const doc = makeSoftLimitDoc({ opCount: 1, totalCausesOverride: SOFT_LIMIT_TOTAL_CAUSES + 1 });
        const warnings = getSoftLimitWarnings(doc);
        const totalWarning = warnings.find(w => w.includes('causas totales'));
        expect(totalWarning).toBeDefined();
        expect(totalWarning).toContain(String(SOFT_LIMIT_TOTAL_CAUSES + 1));
    });

    it('can fire multiple warnings simultaneously', () => {
        // Exceed all 3 limits:
        // 51 ops (> 50), each with 21 causes (> 20 per failure), total = 51*21 = 1071 (> 500)
        const doc = makeSoftLimitDoc({
            opCount: SOFT_LIMIT_OPERATIONS + 1,
            causesPerFailure: SOFT_LIMIT_CAUSES_PER_FAILURE + 1,
        });
        const warnings = getSoftLimitWarnings(doc);
        // Should have at least: 1 operations warning + N failure warnings + 1 total causes warning
        expect(warnings.length).toBeGreaterThanOrEqual(3);

        const hasOpWarning = warnings.some(w => w.includes('operaciones'));
        const hasPerFailureWarning = warnings.some(w => w.includes('causas') && w.includes('Falla'));
        const hasTotalWarning = warnings.some(w => w.includes('causas totales'));

        expect(hasOpWarning).toBe(true);
        expect(hasPerFailureWarning).toBe(true);
        expect(hasTotalWarning).toBe(true);
    });
});
