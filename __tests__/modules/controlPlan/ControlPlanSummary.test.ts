import { describe, it, expect } from 'vitest';
import { computeCpStats, CpSummaryStats } from '../../../modules/controlPlan/ControlPlanSummary';
import { ControlPlanDocument, ControlPlanItem, EMPTY_CP_HEADER } from '../../../modules/controlPlan/controlPlanTypes';

/** Helper to build a minimal CP item with overrides */
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

/** Helper to build a CP document */
function makeDoc(items: ControlPlanItem[]): ControlPlanDocument {
    return { header: { ...EMPTY_CP_HEADER }, items };
}

describe('computeCpStats', () => {
    it('returns zeros for empty document', () => {
        const stats = computeCpStats(makeDoc([]));

        expect(stats.totalItems).toBe(0);
        expect(stats.apH).toBe(0);
        expect(stats.apM).toBe(0);
        expect(stats.apL).toBe(0);
        expect(stats.apNone).toBe(0);
        expect(stats.specialCC).toBe(0);
        expect(stats.specialSC).toBe(0);
        expect(stats.withControlMethod).toBe(0);
        expect(stats.withReactionPlan).toBe(0);
        expect(stats.withReactionPlanOwner).toBe(0);
        expect(stats.withSpecification).toBe(0);
        expect(stats.completionPercent).toBe(0);
        expect(stats.criticalItems).toEqual([]);
    });

    it('counts AP distribution correctly', () => {
        const items = [
            makeItem({ id: '1', amfeAp: 'H' }),
            makeItem({ id: '2', amfeAp: 'H' }),
            makeItem({ id: '3', amfeAp: 'M' }),
            makeItem({ id: '4', amfeAp: 'L' }),
            makeItem({ id: '5' }),  // no AP
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.apH).toBe(2);
        expect(stats.apM).toBe(1);
        expect(stats.apL).toBe(1);
        expect(stats.apNone).toBe(1);
        expect(stats.totalItems).toBe(5);
    });

    it('counts CC and SC classifications (case insensitive)', () => {
        const items = [
            makeItem({ id: '1', specialCharClass: 'CC' }),
            makeItem({ id: '2', specialCharClass: 'cc' }),
            makeItem({ id: '3', specialCharClass: 'SC' }),
            makeItem({ id: '4', specialCharClass: ' sc ' }),
            makeItem({ id: '5', specialCharClass: '' }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.specialCC).toBe(2);
        expect(stats.specialSC).toBe(2);
    });

    it('counts filled method fields', () => {
        const items = [
            makeItem({
                id: '1',
                controlMethod: 'SPC',
                reactionPlan: 'Segregar',
                reactionPlanOwner: 'Operador',
                specification: '10±0.5mm',
            }),
            makeItem({
                id: '2',
                controlMethod: 'Visual',
                reactionPlan: '',
                reactionPlanOwner: '',
                specification: '',
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.withControlMethod).toBe(2);
        expect(stats.withReactionPlan).toBe(1);
        expect(stats.withReactionPlanOwner).toBe(1);
        expect(stats.withSpecification).toBe(1);
    });

    it('calculates completion percent for fully filled items', () => {
        // 7 required fields — context-aware: product rows use evaluationTechnique, process rows use controlMethod
        const items = [
            makeItem({
                id: '1',
                processStepNumber: '10',
                processDescription: 'Soldadura',
                productCharacteristic: 'Longitud',
                sampleSize: '5',
                evaluationTechnique: 'Medición directa',
                reactionPlan: 'Segregar',
                reactionPlanOwner: 'Operador A',
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.completionPercent).toBe(100);
    });

    it('calculates partial completion percent', () => {
        // 1 item, 7 required fields. 3 filled = 3/7 ≈ 43%
        const items = [
            makeItem({
                id: '1',
                processStepNumber: '10',
                processDescription: 'Ensamble',
                productCharacteristic: 'Torque',
                // sampleSize, controlMethod, reactionPlan, reactionPlanOwner are empty
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.completionPercent).toBe(43); // Math.round(3/7 * 100)
    });

    it('calculates completion across multiple items', () => {
        // 2 items × 7 required = 14 total. 7 filled (first fully filled) + 0 = 50%
        const items = [
            makeItem({
                id: '1',
                processStepNumber: '10',
                processDescription: 'Soldadura',
                productCharacteristic: 'Longitud',
                sampleSize: '5',
                evaluationTechnique: 'SPC',
                reactionPlan: 'Segregar',
                reactionPlanOwner: 'Operador',
            }),
            makeItem({ id: '2' }),  // all empty
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.completionPercent).toBe(50);
    });

    it('identifies critical items (CC with missing fields)', () => {
        const items = [
            makeItem({
                id: '1',
                specialCharClass: 'CC',
                processStepNumber: '10',
                processDescription: 'Soldadura',
                // Missing: productCharacteristic, sampleSize, controlMethod, reactionPlan, reactionPlanOwner
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems).toHaveLength(1);
        expect(stats.criticalItems[0].processStep).toBe('10');
        expect(stats.criticalItems[0].description).toBe('Soldadura');
        expect(stats.criticalItems[0].missing).toContain('Producto');
        expect(stats.criticalItems[0].missing).toContain('Tam. Muestra');
        expect(stats.criticalItems[0].missing).toContain('Método Control');
        expect(stats.criticalItems[0].missing).toContain('Plan Reacción');
        expect(stats.criticalItems[0].missing).toContain('Resp. Reacción');
    });

    it('identifies critical items (AP=H with missing fields)', () => {
        const items = [
            makeItem({
                id: '1',
                amfeAp: 'H',
                processStepNumber: '20',
                processDescription: 'Pintura',
                productCharacteristic: 'Color',
                // Missing: sampleSize, controlMethod, reactionPlan, reactionPlanOwner
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems).toHaveLength(1);
        expect(stats.criticalItems[0].processStep).toBe('20');
        expect(stats.criticalItems[0].missing).toContain('Tam. Muestra');
        expect(stats.criticalItems[0].missing).not.toContain('Producto');  // filled
    });

    it('does not flag complete CC/SC items as critical', () => {
        const items = [
            makeItem({
                id: '1',
                specialCharClass: 'CC',
                processStepNumber: '10',
                processDescription: 'Ensamble',
                productCharacteristic: 'Torque',
                sampleSize: '5',
                controlMethod: 'SPC',
                reactionPlan: 'Segregar lote',
                reactionPlanOwner: 'Lider turno',
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems).toHaveLength(0);
    });

    it('does not flag non-special, non-high-AP items as critical', () => {
        const items = [
            makeItem({
                id: '1',
                amfeAp: 'L',
                specialCharClass: '',
                // All required fields empty — but not critical since AP=L and no CC/SC
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems).toHaveLength(0);
    });

    it('limits critical items to 10', () => {
        const items = Array.from({ length: 15 }, (_, i) =>
            makeItem({
                id: `item-${i}`,
                specialCharClass: 'CC',
                processStepNumber: `${i + 1}`,
                // All required fields empty
            })
        );
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems).toHaveLength(10);
    });

    it('uses productCharacteristic as fallback description', () => {
        const items = [
            makeItem({
                id: '1',
                specialCharClass: 'SC',
                processDescription: '',
                productCharacteristic: 'Diametro exterior',
                // Missing required fields
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems[0].description).toBe('Diametro exterior');
    });

    it('uses (sin descripcion) when both description fields are empty', () => {
        const items = [
            makeItem({
                id: '1',
                specialCharClass: 'CC',
                processDescription: '',
                productCharacteristic: '',
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.criticalItems[0].description).toBe('(sin descripción)');
        expect(stats.criticalItems[0].processStep).toBe('—');
    });

    it('treats whitespace-only fields as empty', () => {
        const items = [
            makeItem({
                id: '1',
                controlMethod: '   ',
                reactionPlan: '\t',
                specification: '  ',
            }),
        ];
        const stats = computeCpStats(makeDoc(items));

        expect(stats.withControlMethod).toBe(0);
        expect(stats.withReactionPlan).toBe(0);
        expect(stats.withSpecification).toBe(0);
    });
});
