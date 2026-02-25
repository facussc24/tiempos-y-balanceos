import { describe, it, expect } from 'vitest';
import { computeAmfeStepProgress, computeOverallProgress, AmfeStepStatus } from '../../../modules/amfe/amfeStepProgress';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';

/** Minimal empty document */
const emptyDoc: AmfeDocument = {
    header: {
        organization: '', location: '', client: '', modelYear: '',
        subject: '', startDate: '', team: '', responsible: '',
        revDate: '', amfeNumber: '', confidentiality: '',
        partNumber: '', processResponsible: '', revision: '', approvedBy: '', scope: '',
    },
    operations: [],
};

/** Document with full header */
const fullHeaderDoc: AmfeDocument = {
    ...emptyDoc,
    header: {
        ...emptyDoc.header,
        organization: 'BARACK', location: 'HURLINGHAM', client: 'TestClient',
        modelYear: '2025', subject: 'Test AMFE', startDate: '2025-01-01',
        team: 'Equipo', responsible: 'Responsable',
    },
};

/** Complete well-filled document */
const completeDoc: AmfeDocument = {
    header: {
        ...fullHeaderDoc.header,
        revDate: '2025-06-01',
    },
    operations: [{
        id: 'op1', opNumber: '10', name: 'Soldadura MIG',
        workElements: [{
            id: 'we1', type: 'Machine', name: 'Robot',
            functions: [{
                id: 'f1', description: 'Soldar piezas', requirements: '',
                failures: [{
                    id: 'fail1', description: 'No suelda',
                    effectLocal: 'Reproceso', effectNextLevel: '', effectEndUser: 'Defecto',
                    severity: 8,
                    causes: [{
                        id: 'c1', cause: 'Electrodo gastado',
                        preventionControl: 'Mantenimiento', detectionControl: 'Visual',
                        occurrence: 5, detection: 6, ap: 'H',
                        characteristicNumber: '', specialChar: '', filterCode: '',
                        preventionAction: 'Calibrar', detectionAction: 'Sensor',
                        responsible: 'Juan', targetDate: '2025-03-01', status: 'Completado',
                        actionTaken: 'Se calibro', completionDate: '2025-03-05',
                        severityNew: 4, occurrenceNew: 3, detectionNew: 3, apNew: 'L',
                        observations: '',
                    }],
                }],
            }],
        }],
    }],
};

describe('computeAmfeStepProgress', () => {
    it('returns 7 steps', () => {
        const steps = computeAmfeStepProgress(emptyDoc);
        expect(steps).toHaveLength(7);
        expect(steps[0].step).toBe(1);
        expect(steps[6].step).toBe(7);
    });

    it('empty doc: step 1 is pending (0%)', () => {
        const steps = computeAmfeStepProgress(emptyDoc);
        expect(steps[0].status).toBe('pending');
        expect(steps[0].completionPercent).toBe(0);
    });

    it('full header: step 1 is completed (100%)', () => {
        const steps = computeAmfeStepProgress(fullHeaderDoc);
        expect(steps[0].status).toBe('completed');
        expect(steps[0].completionPercent).toBe(100);
    });

    it('partial header: step 1 is in-progress', () => {
        const doc: AmfeDocument = {
            ...emptyDoc,
            header: { ...emptyDoc.header, organization: 'BARACK', client: 'Test' },
        };
        const steps = computeAmfeStepProgress(doc);
        expect(steps[0].status).toBe('in-progress');
        expect(steps[0].completionPercent).toBeGreaterThan(0);
        expect(steps[0].completionPercent).toBeLessThan(100);
    });

    it('no operations: steps 2-6 are pending', () => {
        const steps = computeAmfeStepProgress(fullHeaderDoc);
        expect(steps[1].status).toBe('pending');
        expect(steps[2].status).toBe('pending');
        expect(steps[3].status).toBe('pending');
        expect(steps[4].status).toBe('pending');
    });

    it('complete doc: all steps completed or in-progress', () => {
        const steps = computeAmfeStepProgress(completeDoc);
        expect(steps[0].status).toBe('completed'); // Header
        expect(steps[1].status).toBe('completed'); // Structure
        expect(steps[2].status).toBe('completed'); // Functions
        expect(steps[3].status).toBe('completed'); // Failures
        expect(steps[4].status).toBe('completed'); // Risk
        expect(steps[5].status).toBe('completed'); // Optimization
        expect(steps[6].status).toBe('completed'); // Documentation
    });

    it('step 7 pending when no revDate', () => {
        const doc = { ...completeDoc, header: { ...completeDoc.header, revDate: '' } };
        const steps = computeAmfeStepProgress(doc);
        expect(steps[6].status).toBe('pending');
        expect(steps[6].completionPercent).toBe(0);
    });

    it('step 6 is 100% when no AP=H causes exist', () => {
        const doc: AmfeDocument = {
            ...fullHeaderDoc,
            operations: [{
                id: 'op1', opNumber: '10', name: 'Test',
                workElements: [{
                    id: 'we1', type: 'Machine', name: 'Bot',
                    functions: [{
                        id: 'f1', description: 'Func', requirements: '',
                        failures: [{
                            id: 'fail1', description: 'Fail',
                            effectLocal: 'Eff', effectNextLevel: '', effectEndUser: '',
                            severity: 3,
                            causes: [{
                                id: 'c1', cause: 'Cause', preventionControl: '', detectionControl: '',
                                occurrence: 2, detection: 2, ap: 'L',
                                characteristicNumber: '', specialChar: '', filterCode: '',
                                preventionAction: '', detectionAction: '',
                                responsible: '', targetDate: '', status: '',
                                actionTaken: '', completionDate: '',
                                severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
                                observations: '',
                            }],
                        }],
                    }],
                }],
            }],
        };
        const steps = computeAmfeStepProgress(doc);
        expect(steps[5].completionPercent).toBe(100);
    });

    it('step labels are in Spanish', () => {
        const steps = computeAmfeStepProgress(emptyDoc);
        expect(steps[0].label).toBe('Planificación');
        expect(steps[6].label).toBe('Documentación');
    });
});

describe('computeOverallProgress', () => {
    it('returns 0 for empty steps', () => {
        expect(computeOverallProgress([])).toBe(0);
    });

    it('returns average of all step percentages', () => {
        const steps: AmfeStepStatus[] = [
            { step: 1, label: 'A', shortLabel: 'A', status: 'completed', completionPercent: 100 },
            { step: 2, label: 'B', shortLabel: 'B', status: 'pending', completionPercent: 0 },
        ];
        expect(computeOverallProgress(steps)).toBe(50);
    });

    it('complete doc has high overall progress', () => {
        const steps = computeAmfeStepProgress(completeDoc);
        const overall = computeOverallProgress(steps);
        expect(overall).toBeGreaterThanOrEqual(85);
    });
});
