import { describe, it, expect } from 'vitest';
import { pfdStepsToZipFlow } from '../../../modules/pfd/zip-renderer/pfdStepsToZipFlow';
import { createEmptyStep, type PfdStep } from '../../../modules/pfd/pfdTypes';

function step(overrides: Partial<PfdStep>): PfdStep {
    return { ...createEmptyStep(''), ...overrides };
}

describe('pfdStepsToZipFlow — inverse converter', () => {
    it('returns empty array for empty input', () => {
        expect(pfdStepsToZipFlow([])).toEqual([]);
    });

    it('maps a simple linear flow with all step types', () => {
        const steps: PfdStep[] = [
            step({ id: 's1', stepNumber: 'OP 10', stepType: 'storage', description: 'Recepción' }),
            step({ id: 's2', stepNumber: '', stepType: 'transport', description: 'Traslado' }),
            step({ id: 's3', stepNumber: 'OP 20', stepType: 'operation', description: 'Corte' }),
            step({ id: 's4', stepNumber: 'OP 30', stepType: 'inspection', description: 'Control' }),
            step({ id: 's5', stepNumber: 'OP 40', stepType: 'combined', description: 'Op + Insp' }),
            step({ id: 's6', stepNumber: 'OP 50', stepType: 'decision', description: '¿OK?' }),
            step({ id: 's7', stepNumber: 'ENV', stepType: 'storage', description: 'Almacén' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out).toHaveLength(7);
        expect(out[0].type).toBe('storage');
        expect(out[1].type).toBe('transfer');
        expect(out[2].type).toBe('operation');
        expect(out[3].type).toBe('inspection');
        expect(out[4].type).toBe('op-ins');
        expect(out[5].type).toBe('condition');
        expect(out[6].type).toBe('storage');
    });

    it('strips the "OP " prefix from stepNumber when generating stepId', () => {
        const steps: PfdStep[] = [
            step({ id: 's1', stepNumber: 'OP 30', stepType: 'operation', description: 'Corte' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out[0].stepId).toBe('30');
    });

    it('preserves srcId so clicks can route back to the original PfdStep', () => {
        const steps: PfdStep[] = [
            step({ id: 'unique-id-abc', stepNumber: 'OP 10', stepType: 'operation', description: 'X' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out[0].srcId).toBe('unique-id-abc');
    });

    it('moves the description into labelCondition for decision steps', () => {
        const steps: PfdStep[] = [
            step({ id: 's1', stepNumber: 'OP 50', stepType: 'decision', description: '¿PRODUCTO CONFORME?' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out[0].type).toBe('condition');
        expect(out[0].labelCondition).toBe('¿PRODUCTO CONFORME?');
        expect(out[0].description).toBeUndefined();
        expect(out[0].labelDown).toBe('SI');
    });

    it('attaches scrap branchSide when a decision has rejectDisposition=scrap', () => {
        const steps: PfdStep[] = [
            step({ id: 's1', stepNumber: 'OP 50', stepType: 'decision', description: '¿OK?', rejectDisposition: 'scrap' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out[0].branchSide).toEqual({ type: 'terminal', text: 'SCRAP', labelNode: 'NO' });
    });

    it('attaches "RETRABAJO" terminal when disposition=rework', () => {
        const steps: PfdStep[] = [
            step({ id: 's1', stepNumber: 'OP 50', stepType: 'decision', description: '¿OK?', rejectDisposition: 'rework' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out[0].branchSide?.type).toBe('terminal');
        expect(out[0].branchSide?.text).toBe('RETRABAJO');
    });

    it('builds nested rework_or_scrap sequence consuming following isRework steps', () => {
        const steps: PfdStep[] = [
            step({ id: 'd1', stepNumber: 'OP 80', stepType: 'decision', description: '¿OK?', rejectDisposition: 'rework_or_scrap' }),
            step({ id: 'rw1', stepNumber: 'OP 81', stepType: 'operation', description: 'Retrabajo adhesivado', isRework: true }),
            step({ id: 'rw2', stepNumber: '', stepType: 'transport', description: 'Volver a OP 80', isRework: true, reworkReturnStep: 'OP 80' }),
            step({ id: 's1', stepNumber: 'OP 90', stepType: 'storage', description: 'Almacén' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        // Decision + the standalone storage AFTER the rework chain. Rework steps consumed inside branchSide.sequence.
        expect(out).toHaveLength(2);
        expect(out[0].type).toBe('condition');
        expect(out[0].branchSide?.sequence).toBeTruthy();
        expect(out[0].branchSide?.labelNode).toBe('NO');
        // Sequence: subdecision + 2 rework steps (the transfer carries the rework annotation already)
        expect(out[0].branchSide!.sequence!.length).toBeGreaterThanOrEqual(3);
        expect(out[1].type).toBe('storage');
    });

    it('groups consecutive steps with the same branchId into a single parallel block', () => {
        const steps: PfdStep[] = [
            step({ id: 'm1', stepNumber: 'OP 10', stepType: 'storage' }),
            step({ id: 'a1', stepNumber: 'OP 20', stepType: 'operation', branchId: 'A', branchLabel: 'Línea A' }),
            step({ id: 'a2', stepNumber: 'OP 30', stepType: 'operation', branchId: 'A', branchLabel: 'Línea A' }),
            step({ id: 'b1', stepNumber: 'OP 25', stepType: 'operation', branchId: 'B', branchLabel: 'Línea B' }),
            step({ id: 'm2', stepNumber: 'OP 40', stepType: 'operation' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        // m1, fork(branches: A=2steps, B=1step), m2
        expect(out).toHaveLength(3);
        expect(out[1].branches).toBeTruthy();
        expect(out[1].branches).toHaveLength(2);
        expect(out[1].branches![0]).toHaveLength(2); // A: 2 steps
        expect(out[1].branches![1]).toHaveLength(1); // B: 1 step
    });

    it('preserves rework metadata for transfer steps with reworkReturnStep', () => {
        const steps: PfdStep[] = [
            step({ id: 's1', stepNumber: '', stepType: 'transport', description: 'Volver', isRework: true, reworkReturnStep: 'OP 80' }),
        ];
        const out = pfdStepsToZipFlow(steps);
        expect(out[0].rework).toEqual({ targetId: '80', label: 'RETRABAJO (A OP 80)' });
    });
});
