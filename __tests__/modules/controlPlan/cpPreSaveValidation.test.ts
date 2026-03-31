import { describe, it, expect } from 'vitest';
import { validateCpBeforeSave } from '../../../modules/controlPlan/cpPreSaveValidation';
import type { ControlPlanDocument, ControlPlanItem, ControlPlanHeader } from '../../../modules/controlPlan/controlPlanTypes';
import type { AmfeDocument } from '../../../modules/amfe/amfeTypes';

function makeHeader(overrides: Partial<ControlPlanHeader> = {}): ControlPlanHeader {
    return {
        controlPlanNumber: 'CP-001',
        phase: 'production',
        partNumber: 'N 227',
        latestChangeLevel: '',
        partName: 'Insert Patagonia',
        applicableParts: '',
        organization: 'Barack Mercosul',
        supplier: '',
        supplierCode: '',
        keyContactPhone: '',
        date: '2026-03-30',
        revision: '01',
        responsible: 'Facundo Santoro',
        approvedBy: 'Carlos Baptista',
        plantApproval: 'Gonzalo Cal',
        client: 'VWA',
        coreTeam: 'Carlos Baptista, Manuel Meszaros',
        customerApproval: '',
        otherApproval: '',
        linkedAmfeProject: '',
        ...overrides,
    };
}

function makeItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: 'item1',
        processStepNumber: '20',
        processDescription: 'INYECCION',
        machineDeviceTool: 'Inyectora',
        componentMaterial: '',
        characteristicNumber: '1',
        productCharacteristic: '',
        processCharacteristic: 'Temperatura de molde',
        specialCharClass: '',
        specification: 'Segun set-up ±5°C',
        evaluationTechnique: 'Registro de parametros',
        sampleSize: '100%',
        sampleFrequency: 'Continuo',
        controlMethod: 'Poka-Yoke temperatura',
        reactionPlan: 'Ajustar proceso s/ P-09/I',
        reactionPlanOwner: 'Operador de produccion',
        controlProcedure: '',
        ...overrides,
    } as ControlPlanItem;
}

function makeDoc(items: ControlPlanItem[] = [makeItem()], headerOverrides: Partial<ControlPlanHeader> = {}): ControlPlanDocument {
    return {
        header: makeHeader(headerOverrides),
        items,
    } as ControlPlanDocument;
}

describe('B1: Reception items without componentMaterial', () => {
    it('warns for OP <= 10 with empty componentMaterial', () => {
        const doc = makeDoc([makeItem({ processStepNumber: '10', componentMaterial: '' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.some(w => w.includes('sin componente/material'))).toBe(true);
    });

    it('no warning for OP > 10', () => {
        const doc = makeDoc([makeItem({ processStepNumber: '20', componentMaterial: '' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.filter(w => w.includes('sin componente/material'))).toHaveLength(0);
    });

    it('no warning for OP <= 10 with componentMaterial filled', () => {
        const doc = makeDoc([makeItem({ processStepNumber: '10', componentMaterial: 'Espuma PUR' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.filter(w => w.includes('sin componente/material'))).toHaveLength(0);
    });
});

describe('B2: Generic or empty specification', () => {
    it('warns for TBD specification', () => {
        const doc = makeDoc([makeItem({ specification: 'TBD' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.some(w => w.includes('especificacion generica o vacia'))).toBe(true);
    });

    it('warns for empty specification with characteristic', () => {
        const doc = makeDoc([makeItem({ specification: '', processCharacteristic: 'Temperatura' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.some(w => w.includes('especificacion generica o vacia'))).toBe(true);
    });

    it('no warning for proper specification', () => {
        const doc = makeDoc([makeItem({ specification: 'Segun TL 1010 VW' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.filter(w => w.includes('especificacion generica'))).toHaveLength(0);
    });
});

describe('B3: Product and Process in same row', () => {
    it('blocks when both are filled', () => {
        const doc = makeDoc([makeItem({ productCharacteristic: 'Aspecto', processCharacteristic: 'Temperatura' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('producto') && e.includes('proceso'))).toBe(true);
    });

    it('passes when only product is filled', () => {
        const doc = makeDoc([makeItem({ productCharacteristic: 'Aspecto', processCharacteristic: '' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.errors.filter(e => e.includes('producto') && e.includes('proceso'))).toHaveLength(0);
    });

    it('passes when only process is filled', () => {
        const doc = makeDoc([makeItem({ productCharacteristic: '', processCharacteristic: 'Temperatura' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.errors.filter(e => e.includes('producto') && e.includes('proceso'))).toHaveLength(0);
    });
});

describe('B4: Generic evaluation technique', () => {
    it('warns for just "Visual"', () => {
        const doc = makeDoc([makeItem({ evaluationTechnique: 'Visual' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.some(w => w.includes('tecnica de evaluacion demasiado generica'))).toBe(true);
    });

    it('no warning for detailed technique', () => {
        const doc = makeDoc([makeItem({ evaluationTechnique: 'Inspeccion visual 100% con galga' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.filter(w => w.includes('tecnica de evaluacion demasiado generica'))).toHaveLength(0);
    });
});

describe('B5: Reception without P-14', () => {
    it('warns for OP <= 10 without P-14', () => {
        const doc = makeDoc([makeItem({ processStepNumber: '10', reactionPlan: 'Segregar lote s/ P-09/I' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.some(w => w.includes('sin referencia a P-14'))).toBe(true);
    });

    it('no warning with P-14 present', () => {
        const doc = makeDoc([makeItem({ processStepNumber: '10', reactionPlan: 'Segregar lote s/ P-14' })]);
        const result = validateCpBeforeSave(doc);
        expect(result.warnings.filter(w => w.includes('sin referencia a P-14'))).toHaveLength(0);
    });
});

describe('B7: Approvals empty', () => {
    it('blocks when both approvals empty', () => {
        const doc = makeDoc([makeItem()], { approvedBy: '', plantApproval: '' });
        const result = validateCpBeforeSave(doc);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Faltan ambas aprobaciones'))).toBe(true);
    });

    it('passes when at least one approval filled', () => {
        const doc = makeDoc([makeItem()], { approvedBy: 'Carlos Baptista', plantApproval: '' });
        const result = validateCpBeforeSave(doc);
        expect(result.errors.filter(e => e.includes('Faltan ambas aprobaciones'))).toHaveLength(0);
    });
});
