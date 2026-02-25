import { describe, it, expect } from 'vitest';
import { generateHoFromAmfeAndCp } from '../../../modules/hojaOperaciones/hojaOperacionesGenerator';
import { AmfeDocument, AmfeOperation, createEmptyCause } from '../../../modules/amfe/amfeTypes';
import { ControlPlanDocument, ControlPlanItem, EMPTY_CP_HEADER } from '../../../modules/controlPlan/controlPlanTypes';
import { DEFAULT_REACTION_PLAN_TEXT } from '../../../modules/hojaOperaciones/hojaOperacionesTypes';

// ============================================================================
// HELPERS
// ============================================================================

function makeAmfeDoc(operations: Partial<AmfeOperation>[] = []): AmfeDocument {
    return {
        header: {
            organization: 'Barack Mercosul',
            location: 'Argentina',
            client: 'VW',
            modelYear: 'AMAROK',
            subject: 'APC Delantero',
            startDate: '2024-01-01',
            revDate: '2024-06-01',
            team: 'Equipo A',
            amfeNumber: 'AMFE-001',
            responsible: 'F.Santoro',
            confidentiality: '',
            partNumber: 'XXX-123',
            processResponsible: '',
            revision: '1',
            approvedBy: 'M.Donofrio',
            scope: '',
        },
        operations: operations.map((op, i) => ({
            id: op.id || `op-${i}`,
            opNumber: op.opNumber ?? String((i + 1) * 10),
            name: op.name || `Operacion ${i + 1}`,
            workElements: op.workElements || [],
        })),
    };
}

function makeCpItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: overrides.id || 'cp-item-1',
        processStepNumber: overrides.processStepNumber || '10',
        processDescription: overrides.processDescription || 'Op 10',
        machineDeviceTool: overrides.machineDeviceTool || '',
        characteristicNumber: overrides.characteristicNumber || '',
        productCharacteristic: overrides.productCharacteristic || '',
        processCharacteristic: overrides.processCharacteristic || '',
        specialCharClass: overrides.specialCharClass || '',
        specification: overrides.specification || '',
        evaluationTechnique: overrides.evaluationTechnique || '',
        sampleSize: overrides.sampleSize || '',
        sampleFrequency: overrides.sampleFrequency || '',
        controlMethod: overrides.controlMethod || '',
        reactionPlan: overrides.reactionPlan || '',
        reactionPlanOwner: overrides.reactionPlanOwner || '',
    };
}

function makeCpDoc(items: ControlPlanItem[]): ControlPlanDocument {
    return {
        header: { ...EMPTY_CP_HEADER, controlPlanNumber: 'CP-001' },
        items,
    };
}

// ============================================================================
// BASIC GENERATION
// ============================================================================

describe('generateHoFromAmfeAndCp', () => {
    it('generates one sheet per AMFE operation', () => {
        const amfe = makeAmfeDoc([
            { opNumber: '10', name: 'Soldadura' },
            { opNumber: '20', name: 'Costura' },
            { opNumber: '30', name: 'Ensamble' },
        ]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'Proyecto 1');
        expect(document.sheets).toHaveLength(3);
    });

    it('populates header from AMFE header', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'Mi AMFE');
        expect(document.header.organization).toBe('Barack Mercosul');
        expect(document.header.client).toBe('VW');
        expect(document.header.partNumber).toBe('XXX-123');
        expect(document.header.partDescription).toBe('APC Delantero');
        expect(document.header.linkedAmfeProject).toBe('Mi AMFE');
    });

    it('sets vehicleModel from AMFE modelYear', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].vehicleModel).toBe('AMAROK');
    });

    it('sets partCodeDescription from AMFE partNumber + subject', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].partCodeDescription).toBe('XXX-123 / APC Delantero');
    });

    it('sets hoNumber as HO-{opNumber}', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].hoNumber).toBe('HO-10');
    });

    it('uses DEFAULT_REACTION_PLAN_TEXT', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].reactionPlanText).toBe(DEFAULT_REACTION_PLAN_TEXT);
    });

    it('initializes manual fields as empty', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        const sheet = document.sheets[0];
        expect(sheet.steps).toEqual([]);
        expect(sheet.safetyElements).toEqual([]);
        expect(sheet.hazardWarnings).toEqual([]);
        expect(sheet.visualAids).toEqual([]);
        expect(sheet.sector).toBe('');
        expect(sheet.puestoNumber).toBe('');
        expect(sheet.preparedBy).toBe('');
        expect(sheet.approvedBy).toBe('');
    });

    it('sets status to borrador', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].status).toBe('borrador');
    });
});

// ============================================================================
// SORTING
// ============================================================================

describe('sheet sorting', () => {
    it('sorts sheets by operation number ascending', () => {
        const amfe = makeAmfeDoc([
            { opNumber: '30', name: 'Third' },
            { opNumber: '10', name: 'First' },
            { opNumber: '20', name: 'Second' },
        ]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets.map(s => s.operationNumber)).toEqual(['10', '20', '30']);
    });
});

// ============================================================================
// CONTROL PLAN INTEGRATION
// ============================================================================

describe('CP integration', () => {
    it('maps CP items to quality checks for matching operation', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Soldadura' }]);
        const cp = makeCpDoc([
            makeCpItem({
                processStepNumber: '10',
                productCharacteristic: 'Cordon soldadura',
                specification: '3mm +/- 0.5',
                evaluationTechnique: 'Visual',
                sampleFrequency: '100%',
                controlMethod: 'Inspeccion visual',
                reactionPlan: 'Segregar pieza',
                reactionPlanOwner: 'Supervisor',
                specialCharClass: 'SC',
            }),
        ]);

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        const checks = document.sheets[0].qualityChecks;
        expect(checks).toHaveLength(1);
        expect(checks[0].characteristic).toBe('Cordon soldadura');
        expect(checks[0].specification).toBe('3mm +/- 0.5');
        expect(checks[0].evaluationTechnique).toBe('Visual');
        expect(checks[0].frequency).toBe('100%');
        expect(checks[0].controlMethod).toBe('Inspeccion visual');
        expect(checks[0].reactionAction).toBe('Segregar pieza');
        expect(checks[0].reactionContact).toBe('Supervisor');
        expect(checks[0].specialCharSymbol).toBe('SC');
        expect(checks[0].cpItemId).toBe('cp-item-1');
    });

    it('uses processCharacteristic when productCharacteristic is empty', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({
                processStepNumber: '10',
                productCharacteristic: '',
                processCharacteristic: 'Temperatura horno',
            }),
        ]);

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.sheets[0].qualityChecks[0].characteristic).toBe('Temperatura horno');
    });

    it('skips CP items with empty characteristics', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({
                processStepNumber: '10',
                productCharacteristic: '',
                processCharacteristic: '',
            }),
        ]);

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.sheets[0].qualityChecks).toHaveLength(0);
    });

    it('does not assign CP items to wrong operations', () => {
        const amfe = makeAmfeDoc([
            { opNumber: '10', name: 'Op1' },
            { opNumber: '20', name: 'Op2' },
        ]);
        const cp = makeCpDoc([
            makeCpItem({ processStepNumber: '20', productCharacteristic: 'Dimension A' }),
        ]);

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.sheets[0].qualityChecks).toHaveLength(0); // Op 10
        expect(document.sheets[1].qualityChecks).toHaveLength(1); // Op 20
    });

    it('maps multiple CP items to the same operation', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({ id: 'cp-1', processStepNumber: '10', productCharacteristic: 'Dim A' }),
            makeCpItem({ id: 'cp-2', processStepNumber: '10', productCharacteristic: 'Dim B' }),
            makeCpItem({ id: 'cp-3', processStepNumber: '10', processCharacteristic: 'Temp' }),
        ]);

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.sheets[0].qualityChecks).toHaveLength(3);
    });

    it('sets reactionContact from first CP item with reactionPlanOwner', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({ processStepNumber: '10', productCharacteristic: 'A', reactionPlanOwner: '' }),
            makeCpItem({ processStepNumber: '10', productCharacteristic: 'B', reactionPlanOwner: 'Lider de Linea' }),
        ]);

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.sheets[0].reactionContact).toBe('Lider de Linea');
    });

    it('links CP project number in header', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([]);
        cp.header.controlPlanNumber = 'CP-2024-001';

        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.header.linkedCpProject).toBe('CP-2024-001');
    });

    it('handles null cpDoc gracefully', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].qualityChecks).toEqual([]);
        expect(document.header.linkedCpProject).toBe('');
    });
});

// ============================================================================
// WARNINGS
// ============================================================================

describe('warnings', () => {
    it('warns when AMFE has no operations', () => {
        const amfe = makeAmfeDoc([]);
        const { warnings } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(warnings.some(w => w.includes('no tiene operaciones'))).toBe(true);
    });

    it('warns when generating without CP', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { warnings } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(warnings.some(w => w.includes('sin Plan de Control'))).toBe(true);
    });

    it('warns when operations have no CP items', () => {
        const amfe = makeAmfeDoc([
            { opNumber: '10', name: 'Op1' },
            { opNumber: '20', name: 'Op2' },
        ]);
        const cp = makeCpDoc([
            makeCpItem({ processStepNumber: '10', productCharacteristic: 'Dim A' }),
        ]);

        const { warnings } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(warnings.some(w => w.includes('1 operacion(es) no tienen items'))).toBe(true);
    });

    it('emits summary warning with counts', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({ processStepNumber: '10', productCharacteristic: 'A' }),
            makeCpItem({ processStepNumber: '10', productCharacteristic: 'B' }),
        ]);

        const { warnings } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(warnings.some(w => w.includes('1 hoja(s)') && w.includes('2 verificacion(es)'))).toBe(true);
    });

    it('does not warn about missing CP items when cpDoc is null', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const { warnings } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(warnings.some(w => w.includes('no tienen items en el Plan de Control'))).toBe(false);
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
    it('handles operations with empty opNumber', () => {
        const amfe = makeAmfeDoc([{ opNumber: '', name: 'Sin numero' }]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets).toHaveLength(1);
        expect(document.sheets[0].hoNumber).toBe('HO-');
    });

    it('handles AMFE header with missing fields', () => {
        const amfe: AmfeDocument = {
            header: {
                organization: '', location: '', client: '', modelYear: '',
                subject: '', startDate: '', revDate: '', team: '',
                amfeNumber: '', responsible: '', confidentiality: '',
                partNumber: '', processResponsible: '', revision: '',
                approvedBy: '', scope: '',
            },
            operations: [{ id: 'op-1', opNumber: '10', name: 'Op1', workElements: [] }],
        };
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].vehicleModel).toBe('');
        expect(document.sheets[0].partCodeDescription).toBe('');
    });

    it('trims processStepNumber when matching CP items', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({ processStepNumber: ' 10 ', productCharacteristic: 'Dim' }),
        ]);
        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        expect(document.sheets[0].qualityChecks).toHaveLength(1);
    });

    it('each sheet gets a unique id', () => {
        const amfe = makeAmfeDoc([
            { opNumber: '10', name: 'Op1' },
            { opNumber: '20', name: 'Op2' },
        ]);
        const { document } = generateHoFromAmfeAndCp(amfe, null, 'P1');
        expect(document.sheets[0].id).not.toBe(document.sheets[1].id);
    });

    it('each quality check gets a unique id', () => {
        const amfe = makeAmfeDoc([{ opNumber: '10', name: 'Op1' }]);
        const cp = makeCpDoc([
            makeCpItem({ id: 'cp-1', processStepNumber: '10', productCharacteristic: 'A' }),
            makeCpItem({ id: 'cp-2', processStepNumber: '10', productCharacteristic: 'B' }),
        ]);
        const { document } = generateHoFromAmfeAndCp(amfe, cp, 'P1');
        const ids = document.sheets[0].qualityChecks.map(qc => qc.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
