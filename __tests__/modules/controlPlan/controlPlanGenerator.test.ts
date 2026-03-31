import { describe, it, expect } from 'vitest';
import { generateItemsFromAmfe, generateControlPlanFromAmfe } from '../../../modules/controlPlan/controlPlanGenerator';
import { AmfeDocument } from '../../../modules/amfe/amfeTypes';

/** Helper: build a minimal AMFE doc for testing CP generation. */
function makeAmfeDoc(overrides?: {
    opNumber?: string;
    opName?: string;
    weName?: string;
    funcDesc?: string;
    failDesc?: string;
    severity?: number;
    causes?: any[];
}): AmfeDocument {
    const o = overrides || {};
    return {
        header: {
            organization: 'BARACK',
            location: 'HURLINGHAM',
            client: 'TestClient',
            modelYear: '2025',
            subject: 'Test AMFE',
            startDate: '2025-01-01',
            revDate: '',
            team: 'Equipo',
            amfeNumber: 'AMFE-001',
            responsible: 'Responsable',
            confidentiality: '-',
            partNumber: 'PN-100',
            processResponsible: 'ProcResp',
            revision: 'Rev-A',
            approvedBy: 'Aprobador',
            scope: '', applicableParts: '',
        },
        operations: [{
            id: 'op1',
            opNumber: o.opNumber ?? '10',
            name: o.opName ?? 'Soldadura MIG',
            workElements: [{
                id: 'we1',
                type: 'Machine',
                name: o.weName ?? 'Robot Soldador',
                functions: [{
                    id: 'f1',
                    description: o.funcDesc ?? 'Soldar piezas',
                    requirements: '',
                    failures: [{
                        id: 'fail1',
                        description: o.failDesc ?? 'No suelda',
                        effectLocal: '',
                        effectNextLevel: '',
                        effectEndUser: 'Pieza defectuosa',
                        severity: o.severity ?? 8,
                        causes: o.causes ?? [{
                            id: 'c1',
                            cause: 'Electrodo gastado',
                            preventionControl: 'Mantenimiento preventivo',
                            detectionControl: 'Inspeccion visual 100%',
                            occurrence: 5,
                            detection: 6,
                            ap: 'H',
                            characteristicNumber: 'C-001',
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
        }],
    };
}

/** Helper: make a full cause object with overrides. */
function makeCause(overrides?: Record<string, any>) {
    return {
        id: 'c-default',
        cause: 'Causa generica',
        preventionControl: 'Control preventivo',
        detectionControl: 'Control deteccion',
        occurrence: 5,
        detection: 6,
        ap: 'H',
        characteristicNumber: '',
        specialChar: '',
        filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
        ...overrides,
    };
}

/** Helper: find process rows (processCharacteristic populated, productCharacteristic empty). */
function processRows(items: any[]) {
    return items.filter(i => i.processCharacteristic && !i.productCharacteristic);
}

/** Helper: find product rows (productCharacteristic populated, processCharacteristic empty). */
function productRows(items: any[]) {
    return items.filter(i => i.productCharacteristic && !i.processCharacteristic);
}

// ============================================================================
// ROW TYPE SEPARATION (CP 2024)
// ============================================================================

describe('generateItemsFromAmfe — row type separation', () => {
    it('generates separate process and product rows from a single cause', () => {
        const doc = makeAmfeDoc();
        const { items } = generateItemsFromAmfe(doc);
        expect(processRows(items)).toHaveLength(1);
        expect(productRows(items)).toHaveLength(1);
        expect(items).toHaveLength(2);
    });

    it('process row has processCharacteristic from cause and controlMethod from preventionControl', () => {
        const doc = makeAmfeDoc();
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items)[0];
        expect(proc.processCharacteristic).toBe('Electrodo gastado');
        expect(proc.controlMethod).toBe('Mantenimiento preventivo');
        expect(proc.productCharacteristic).toBe('');
        expect(proc.evaluationTechnique).toBe('');
    });

    it('product row has productCharacteristic from failure and evaluationTechnique from detectionControl', () => {
        const doc = makeAmfeDoc();
        const { items } = generateItemsFromAmfe(doc);
        const prod = productRows(items)[0];
        expect(prod.productCharacteristic).toBe('No suelda');
        expect(prod.evaluationTechnique).toBe('Inspeccion visual 100%');
        expect(prod.processCharacteristic).toBe('');
        expect(prod.controlMethod).toBe('');
    });

    it('process rows come before product rows in sort order', () => {
        const doc = makeAmfeDoc();
        const { items } = generateItemsFromAmfe(doc);
        expect(items[0].processCharacteristic).toBeTruthy();
        expect(items[1].productCharacteristic).toBeTruthy();
    });

    it('generates process row even with empty preventionControl', () => {
        const doc = makeAmfeDoc({
            causes: [makeCause({ id: 'c1', cause: 'Causa sin control', preventionControl: '', ap: 'H' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].processCharacteristic).toBe('Causa sin control');
        expect(proc[0].controlMethod).toBe('');
    });

    it('generates product row even with empty detectionControl', () => {
        const doc = makeAmfeDoc({
            causes: [makeCause({ id: 'c1', detectionControl: '', ap: 'H' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        const prod = productRows(items);
        expect(prod).toHaveLength(1);
        expect(prod[0].evaluationTechnique).toBe('');
    });
});

// ============================================================================
// FIELD MAPPING
// ============================================================================

describe('generateItemsFromAmfe — field mapping', () => {
    it('maps machineDeviceTool from work element name', () => {
        const doc = makeAmfeDoc({ weName: 'CNC Router' });
        const { items } = generateItemsFromAmfe(doc);
        expect(items[0].machineDeviceTool).toBe('CNC Router');
        expect(items[1].machineDeviceTool).toBe('CNC Router');
    });

    it('maps processStepNumber and processDescription from operation', () => {
        const doc = makeAmfeDoc({ opNumber: '20', opName: 'Ensamble' });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.processStepNumber).toBe('20');
            expect(item.processDescription).toBe('Ensamble');
        }
    });

    it('maps characteristicNumber from cause', () => {
        const doc = makeAmfeDoc();
        const { items } = generateItemsFromAmfe(doc);
        expect(items[0].characteristicNumber).toBe('C-001');
    });

    it('populates amfeAp from cause AP', () => {
        const doc = makeAmfeDoc();
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.amfeAp).toBe('H');
        }
    });

    it('populates amfeSeverity from failure severity', () => {
        const doc = makeAmfeDoc({ severity: 9 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.amfeSeverity).toBe(9);
        }
    });

    it('populates operationCategory from operation name', () => {
        const doc = makeAmfeDoc({ opName: 'Soldadura MIG' });
        const { items } = generateItemsFromAmfe(doc);
        expect(items[0].operationCategory).toBe('soldadura');
    });

    it('sets operationCategory empty when name is unrecognized', () => {
        const doc = makeAmfeDoc({ opName: 'Proceso Especial' });
        const { items } = generateItemsFromAmfe(doc);
        expect(items[0].operationCategory).toBe('');
    });

    it('populates amfeAp=M for medium priority causes', () => {
        const doc = makeAmfeDoc({
            causes: [makeCause({ id: 'c1', ap: 'M' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.amfeAp).toBe('M');
        }
    });

    it('does NOT auto-fill specification from func.requirements (AIAG-VDA)', () => {
        const doc = makeAmfeDoc();
        doc.operations[0].workElements[0].functions[0].requirements = 'ISO 3834-2';
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specification).toBe('');
        }
    });
});

// ============================================================================
// SPECIAL CHARACTER (CC/SC)
// ============================================================================

describe('generateItemsFromAmfe — specialChar classification', () => {
    it('auto-derives CC when severity >= 9 and specialChar empty', () => {
        const doc = makeAmfeDoc({ severity: 9 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('CC');
        }
    });

    it('auto-derives CC when severity = 10', () => {
        const doc = makeAmfeDoc({ severity: 10 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('CC');
        }
    });

    it('does NOT auto-derive SC when severity = 7 without explicit specialChar', () => {
        const doc = makeAmfeDoc({ severity: 7 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('');
        }
    });

    it('does NOT auto-derive SC when severity = 8 without explicit specialChar', () => {
        const doc = makeAmfeDoc({ severity: 8 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('');
        }
    });

    it('does NOT auto-derive SC when severity = 6 without explicit specialChar', () => {
        const doc = makeAmfeDoc({ severity: 6 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('');
        }
    });

    it('does NOT auto-derive SC when severity = 5 without explicit specialChar', () => {
        const doc = makeAmfeDoc({ severity: 5 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('');
        }
    });

    it('preserves explicit specialChar SC from AMFE cause', () => {
        const doc = makeAmfeDoc({
            severity: 7,
            causes: [makeCause({ id: 'c1', ap: 'H', specialChar: 'SC' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('SC');
        }
    });

    it('does not derive CC/SC when severity < 5', () => {
        const doc = makeAmfeDoc({ severity: 4 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('');
        }
    });

    it('does not derive CC/SC when severity = 1', () => {
        const doc = makeAmfeDoc({ severity: 1 });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('');
        }
    });

    it('preserves explicit specialChar over auto-derived', () => {
        const doc = makeAmfeDoc({
            severity: 9,
            causes: [makeCause({ id: 'c1', ap: 'H', specialChar: 'D' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('D');
        }
    });
});

// ============================================================================
// AP FILTERING
// ============================================================================

describe('generateItemsFromAmfe — AP filtering', () => {
    it('filters AP=H, AP=M, and explicit SC/CC AP=L causes (IATF 16949)', () => {
        const doc = makeAmfeDoc({
            severity: 8,
            causes: [
                makeCause({ id: 'c1', cause: 'High', ap: 'H', preventionControl: 'PC1', detectionControl: 'DC1' }),
                makeCause({ id: 'c2', cause: 'Medium', ap: 'M', preventionControl: 'PC2', detectionControl: 'DC2' }),
                makeCause({ id: 'c3', cause: 'Low SC', ap: 'L', preventionControl: 'PC3', detectionControl: 'DC3', specialChar: 'SC' }),
                makeCause({ id: 'c4', cause: 'None', ap: '', preventionControl: '', detectionControl: '' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        // 3 qualifying causes with different cause text → 3 process rows
        const proc = processRows(items);
        expect(proc).toHaveLength(3);
        // 3 causes share same failure → 1 product row with combined detection controls
        const prod = productRows(items);
        expect(prod).toHaveLength(1);
        expect(prod[0].evaluationTechnique).toContain('DC1');
        expect(prod[0].evaluationTechnique).toContain('DC2');
        expect(prod[0].evaluationTechnique).toContain('DC3');
    });

    it('groups AP=L causes into 1 generic line per operation (no SC/CC)', () => {
        const doc = makeAmfeDoc({
            severity: 3, // S=3 → no SC/CC
            causes: [
                makeCause({ id: 'c1', cause: 'High', ap: 'H', preventionControl: 'PC1', detectionControl: 'DC1' }),
                makeCause({ id: 'c2', cause: 'Low no SC', ap: 'L', preventionControl: 'PC2', detectionControl: 'DC2' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // 1 individual H process row + 1 generic L line
        expect(proc).toHaveLength(2);
        const genericLine = proc.find(i => i.amfeAp === 'L');
        expect(genericLine?.processCharacteristic).toBe('Autocontrol visual general');
    });

    it('returns empty items with warning when no operations exist', () => {
        const doc: AmfeDocument = {
            header: makeAmfeDoc().header,
            operations: [],
        };
        const { items, warnings } = generateItemsFromAmfe(doc);
        expect(items).toEqual([]);
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]).toContain('no tiene causas definidas');
    });

    it('AP=L only → produces 1 generic line per operation', () => {
        const doc = makeAmfeDoc({
            severity: 3, // S=3 → no SC/CC
            causes: [makeCause({ id: 'c1', cause: 'Low risk', ap: 'L' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        // 1 generic L line for the operation
        expect(items).toHaveLength(1);
        expect(items[0].amfeAp).toBe('L');
        expect(items[0].processCharacteristic).toBe('Autocontrol visual general');
    });
});

// ============================================================================
// DEDUP LOGIC
// ============================================================================

describe('generateItemsFromAmfe — dedup', () => {
    it('3 causes with same cause text + same preventionControl = 1 process row', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temp alta', preventionControl: 'SPC', detectionControl: 'DC1', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Temp alta', preventionControl: 'SPC', detectionControl: 'DC2', ap: 'M' }),
                makeCause({ id: 'c3', cause: 'Temp alta', preventionControl: 'SPC', detectionControl: 'DC3', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].processCharacteristic).toBe('Temp alta');
        expect(proc[0].controlMethod).toBe('SPC');
    });

    it('3 causes with same failure desc + same detectionControl = 1 product row', () => {
        const doc = makeAmfeDoc({
            failDesc: 'Pieza defectuosa',
            causes: [
                makeCause({ id: 'c1', cause: 'Causa A', detectionControl: 'Visual', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Causa B', detectionControl: 'Visual', ap: 'M' }),
                makeCause({ id: 'c3', cause: 'Causa C', detectionControl: 'Visual', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const prod = productRows(items);
        expect(prod).toHaveLength(1);
        expect(prod[0].productCharacteristic).toBe('Pieza defectuosa');
        expect(prod[0].evaluationTechnique).toBe('Visual');
    });

    it('different cause text with same preventionControl = separate process rows', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temperatura', preventionControl: 'SPC', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Presion', preventionControl: 'SPC', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(2);
    });

    it('same cause text with different preventionControl = 1 process row with combined controls', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temperatura', preventionControl: 'SPC', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Temperatura', preventionControl: 'Poka-Yoke', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // Same cause text → 1 row with combined controlMethod
        expect(proc).toHaveLength(1);
        expect(proc[0].controlMethod).toContain('SPC');
        expect(proc[0].controlMethod).toContain('Poka-Yoke');
        expect(proc[0].controlMethod).toContain(' / ');
    });

    it('dedup takes highest severity from grouped causes', () => {
        const doc: AmfeDocument = {
            header: makeAmfeDoc().header,
            operations: [{
                id: 'op1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we1', type: 'Machine', name: 'Maq',
                    functions: [{
                        id: 'f1', description: 'Func', requirements: '',
                        failures: [
                            {
                                id: 'fail1', description: 'Falla', severity: 5,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c1', cause: 'X', preventionControl: 'PC', detectionControl: 'DC', ap: 'H' })],
                            },
                            {
                                id: 'fail2', description: 'Falla', severity: 9,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c2', cause: 'X', preventionControl: 'PC', detectionControl: 'DC', ap: 'M' })],
                            },
                        ],
                    }],
                }],
            }],
        };
        const { items } = generateItemsFromAmfe(doc);
        // Process rows dedup by cause+prevention → both are "X" + "PC" → 1 process row
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].amfeSeverity).toBe(9); // highest from group
    });

    it('dedup takes highest AP (H over M) from grouped causes', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temp', preventionControl: 'SPC', ap: 'M' }),
                makeCause({ id: 'c2', cause: 'Temp', preventionControl: 'SPC', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].amfeAp).toBe('H');
    });

    it('dedup takes most restrictive specialChar (CC over SC)', () => {
        const doc: AmfeDocument = {
            header: makeAmfeDoc().header,
            operations: [{
                id: 'op1', opNumber: '10', name: 'Op',
                workElements: [{
                    id: 'we1', type: 'Machine', name: 'Maq',
                    functions: [{
                        id: 'f1', description: 'Func', requirements: '',
                        failures: [
                            {
                                id: 'fail1', description: 'Falla', severity: 6,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c1', cause: 'X', preventionControl: 'PC', detectionControl: 'DC', ap: 'H' })],
                            },
                            {
                                id: 'fail2', description: 'Falla', severity: 10,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c2', cause: 'X', preventionControl: 'PC', detectionControl: 'DC', ap: 'H' })],
                            },
                        ],
                    }],
                }],
            }],
        };
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].specialCharClass).toBe('CC'); // severity 10 → CC wins over severity 6 → '' (no auto SC)
    });

    it('dedup key does not collide when fields contain pipe characters (Audit R8)', () => {
        // Before fix: delimiter was "||" which would collide if fields contained "||"
        // After fix: JSON.stringify prevents this
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'A||B', preventionControl: 'C', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'A', preventionControl: 'B||C', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // These must be 2 separate rows, not merged — the old "||" delimiter would merge them
        expect(proc).toHaveLength(2);
    });

    it('dedup key handles whitespace collapse (Audit R8)', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temp  alta', preventionControl: 'SPC', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Temp alta', preventionControl: 'SPC', ap: 'M' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // Extra whitespace should collapse → same key → merged into 1
        expect(proc).toHaveLength(1);
    });

    it('dedup preserves characteristicNumber from first member with non-empty value', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temp', preventionControl: 'SPC', ap: 'H', characteristicNumber: '' }),
                makeCause({ id: 'c2', cause: 'Temp', preventionControl: 'SPC', ap: 'M', characteristicNumber: 'CHAR-42' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].characteristicNumber).toBe('CHAR-42');
    });

    it('generates summary warning with item counts', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'A', preventionControl: 'PC', detectionControl: 'DC', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'B', preventionControl: 'PC2', detectionControl: 'DC', ap: 'M' }),
                makeCause({ id: 'c3', cause: 'C', preventionControl: 'PC3', detectionControl: 'DC', ap: 'H' }),
            ],
        });
        const { items, warnings } = generateItemsFromAmfe(doc);
        expect(items.length).toBeGreaterThan(0);
        const summary = warnings.find(w => w.includes('Plan de Control generado'));
        expect(summary).toBeDefined();
        expect(summary).toContain('de proceso');
        expect(summary).toContain('de producto');
        expect(summary).toContain('3 causa(s) AP Alto/Medio');
    });

    it('handles multiple operations independently', () => {
        const doc: AmfeDocument = {
            header: makeAmfeDoc().header,
            operations: [
                {
                    id: 'op1', opNumber: '10', name: 'Op10',
                    workElements: [{
                        id: 'we1', type: 'Machine', name: 'M1',
                        functions: [{
                            id: 'f1', description: 'F1', requirements: '',
                            failures: [{
                                id: 'fail1', description: 'Fail1', severity: 8,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c1', cause: 'CauseA', ap: 'H' })],
                            }],
                        }],
                    }],
                },
                {
                    id: 'op2', opNumber: '20', name: 'Op20',
                    workElements: [{
                        id: 'we2', type: 'Machine', name: 'M2',
                        functions: [{
                            id: 'f2', description: 'F2', requirements: '',
                            failures: [{
                                id: 'fail2', description: 'Fail2', severity: 7,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c2', cause: 'CauseB', ap: 'M' })],
                            }],
                        }],
                    }],
                },
            ],
        };
        const { items } = generateItemsFromAmfe(doc);
        // 2 operations × (1 process + 1 product) = 4 items
        expect(items).toHaveLength(4);
        const op10Items = items.filter(i => i.processStepNumber === '10');
        const op20Items = items.filter(i => i.processStepNumber === '20');
        expect(op10Items).toHaveLength(2);
        expect(op20Items).toHaveLength(2);
        // Sorted by step number: op10 first, op20 second
        expect(items[0].processStepNumber).toBe('10');
        expect(items[2].processStepNumber).toBe('20');
    });
});

// ============================================================================
// SORTING
// ============================================================================

describe('generateItemsFromAmfe — sorting', () => {
    it('sorts by processStepNumber across operations', () => {
        const doc: AmfeDocument = {
            header: makeAmfeDoc().header,
            operations: [
                {
                    id: 'op2', opNumber: '30', name: 'Op30',
                    workElements: [{
                        id: 'we2', type: 'Machine', name: 'M2',
                        functions: [{
                            id: 'f2', description: 'F2', requirements: '',
                            failures: [{
                                id: 'fail2', description: 'Fail2', severity: 8,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c2', ap: 'H' })],
                            }],
                        }],
                    }],
                },
                {
                    id: 'op1', opNumber: '10', name: 'Op10',
                    workElements: [{
                        id: 'we1', type: 'Machine', name: 'M1',
                        functions: [{
                            id: 'f1', description: 'F1', requirements: '',
                            failures: [{
                                id: 'fail1', description: 'Fail1', severity: 8,
                                effectLocal: '', effectNextLevel: '', effectEndUser: '',
                                causes: [makeCause({ id: 'c1', ap: 'H' })],
                            }],
                        }],
                    }],
                },
            ],
        };
        const { items } = generateItemsFromAmfe(doc);
        expect(items[0].processStepNumber).toBe('10');
        expect(items[items.length - 1].processStepNumber).toBe('30');
    });
});

// ============================================================================
// EMPTY CONTROLS
// ============================================================================

describe('generateItemsFromAmfe — empty controls', () => {
    it('handles empty controlMethod/evaluationTechnique when controls are empty', () => {
        const doc = makeAmfeDoc({
            causes: [makeCause({ id: 'c1', cause: 'No controls', ap: 'H', preventionControl: '', detectionControl: '' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        const prod = productRows(items);
        expect(proc[0].controlMethod).toBe('');
        expect(prod[0].evaluationTechnique).toBe('');
    });
});

// ============================================================================
// generateControlPlanFromAmfe
// ============================================================================

describe('generateControlPlanFromAmfe', () => {
    it('pre-fills header from AMFE header data', () => {
        const doc = makeAmfeDoc();
        const { document: cpDoc } = generateControlPlanFromAmfe(doc, 'test-project');
        expect(cpDoc.header.partNumber).toBe('PN-100');
        expect(cpDoc.header.partName).toBe('Test AMFE');
        expect(cpDoc.header.organization).toBe('BARACK');
        expect(cpDoc.header.client).toBe('TestClient');
        expect(cpDoc.header.responsible).toBe('ProcResp');
        expect(cpDoc.header.approvedBy).toBe('Aprobador');
        expect(cpDoc.header.coreTeam).toBe('Equipo');
        expect(cpDoc.header.linkedAmfeProject).toBe('test-project');
        expect(cpDoc.header.latestChangeLevel).toBe('Rev-A');
    });

    it('generates process and product items from AMFE causes', () => {
        const doc = makeAmfeDoc();
        const { document: cpDoc } = generateControlPlanFromAmfe(doc, 'test-project');
        expect(cpDoc.items).toHaveLength(2); // 1 process + 1 product
        expect(processRows(cpDoc.items)).toHaveLength(1);
        expect(productRows(cpDoc.items)).toHaveLength(1);
        expect(cpDoc.items[0].machineDeviceTool).toBe('Robot Soldador');
    });

    it('sets date to today', () => {
        const doc = makeAmfeDoc();
        const { document: cpDoc } = generateControlPlanFromAmfe(doc, 'test-project');
        const today = new Date().toISOString().split('T')[0];
        expect(cpDoc.header.date).toBe(today);
    });

    it('returns warnings when no items generated', () => {
        const doc: AmfeDocument = { header: makeAmfeDoc().header, operations: [] };
        const { warnings } = generateControlPlanFromAmfe(doc, 'test');
        expect(warnings.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// TRACEABILITY (R5A): amfeCauseIds & amfeFailureId
// ============================================================================

describe('generateItemsFromAmfe — traceability fields (R5A)', () => {
    it('process rows have amfeCauseIds populated with the correct cause IDs', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'cause-alpha', cause: 'Causa A', preventionControl: 'PC-A', detectionControl: 'DC-A', ap: 'H' }),
                makeCause({ id: 'cause-beta', cause: 'Causa B', preventionControl: 'PC-B', detectionControl: 'DC-B', ap: 'M' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // 2 different cause texts → 2 separate process rows, each with their own cause ID
        expect(proc).toHaveLength(2);
        expect(proc[0].amfeCauseIds).toEqual(['cause-alpha']);
        expect(proc[1].amfeCauseIds).toEqual(['cause-beta']);
    });

    it('product rows have amfeFailureId matching the failure ID', () => {
        const doc = makeAmfeDoc({
            failDesc: 'Falla de prueba',
            causes: [
                makeCause({ id: 'c-x', cause: 'Causa X', detectionControl: 'DC-1', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const prod = productRows(items);
        expect(prod).toHaveLength(1);
        expect(prod[0].amfeFailureId).toBe('fail1'); // fail1 is the failure ID in makeAmfeDoc
        expect(prod[0].amfeCauseIds).toEqual(['c-x']);
    });

    it('deduped process rows merge cause IDs without duplicates', () => {
        const doc = makeAmfeDoc({
            causes: [
                makeCause({ id: 'c1', cause: 'Temp alta', preventionControl: 'SPC', detectionControl: 'DC1', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Temp alta', preventionControl: 'SPC', detectionControl: 'DC2', ap: 'M' }),
                makeCause({ id: 'c3', cause: 'Temp alta', preventionControl: 'SPC', detectionControl: 'DC3', ap: 'H' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // All 3 causes have same cause text + same preventionControl → deduped into 1 process row
        expect(proc).toHaveLength(1);
        expect(proc[0].amfeCauseIds).toEqual(expect.arrayContaining(['c1', 'c2', 'c3']));
        expect(proc[0].amfeCauseIds).toHaveLength(3);
        // Verify no duplicates: Set size should equal array length
        expect(new Set(proc[0].amfeCauseIds).size).toBe(proc[0].amfeCauseIds!.length);
        // amfeFailureId should be set from the first cause's failure
        expect(proc[0].amfeFailureId).toBe('fail1');
    });
});

// ============================================================================
// SC/CC WITH AP=L — IATF 16949 §8.3.3.3
// ============================================================================

describe('generateItemsFromAmfe — SC/CC with AP=L (IATF 16949)', () => {
    it('includes explicit SC cause (S=6, AP=L) in CP', () => {
        const doc = makeAmfeDoc({
            severity: 6,
            causes: [makeCause({ id: 'c1', cause: 'SC cause', ap: 'L', preventionControl: 'Audit', detectionControl: 'Visual', specialChar: 'SC' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        expect(items.length).toBeGreaterThan(0);
        expect(processRows(items)).toHaveLength(1);
        expect(productRows(items)).toHaveLength(1);
    });

    it('includes CC cause (S=9, AP=L) in CP', () => {
        const doc = makeAmfeDoc({
            severity: 9,
            causes: [makeCause({ id: 'c1', cause: 'CC cause', ap: 'L', preventionControl: 'SPC', detectionControl: 'CMM' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        expect(items.length).toBeGreaterThan(0);
        expect(processRows(items)).toHaveLength(1);
        expect(productRows(items)).toHaveLength(1);
    });

    it('AP=L (S=3) without SC/CC → 1 generic grouped line', () => {
        const doc = makeAmfeDoc({
            severity: 3,
            causes: [makeCause({ id: 'c1', cause: 'Low low', ap: 'L' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        expect(items).toHaveLength(1);
        expect(items[0].amfeAp).toBe('L');
        expect(items[0].processCharacteristic).toBe('Autocontrol visual general');
    });

    it('explicit SC cause (S=5, AP=L) gets specialCharClass=SC', () => {
        const doc = makeAmfeDoc({
            severity: 5,
            causes: [makeCause({ id: 'c1', cause: 'SC edge', ap: 'L', specialChar: 'SC' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('SC');
        }
    });

    it('CC cause (S=10, AP=L) gets specialCharClass=CC', () => {
        const doc = makeAmfeDoc({
            severity: 10,
            causes: [makeCause({ id: 'c1', cause: 'CC edge', ap: 'L' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.specialCharClass).toBe('CC');
        }
    });

    it('explicit SC cause with AP=L gets amfeAp=L', () => {
        const doc = makeAmfeDoc({
            severity: 7,
            causes: [makeCause({ id: 'c1', cause: 'SC L cause', ap: 'L', specialChar: 'SC' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        for (const item of items) {
            expect(item.amfeAp).toBe('L');
        }
    });

    it('mixed group H + L → pickHighestAp returns H', () => {
        const doc = makeAmfeDoc({
            severity: 8,
            causes: [
                makeCause({ id: 'c1', cause: 'Same cause', preventionControl: 'SPC', ap: 'H' }),
                makeCause({ id: 'c2', cause: 'Same cause', preventionControl: 'SPC', ap: 'L', specialChar: 'SC' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].amfeAp).toBe('H');
    });

    it('mixed group M + L → pickHighestAp returns M', () => {
        const doc = makeAmfeDoc({
            severity: 6,
            causes: [
                makeCause({ id: 'c1', cause: 'Same cause', preventionControl: 'SPC', ap: 'M' }),
                makeCause({ id: 'c2', cause: 'Same cause', preventionControl: 'SPC', ap: 'L', specialChar: 'SC' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].amfeAp).toBe('M');
    });

    it('group of only AP=L with explicit SC → pickHighestAp returns L', () => {
        const doc = makeAmfeDoc({
            severity: 7,
            causes: [
                makeCause({ id: 'c1', cause: 'Same SC', preventionControl: 'SPC', ap: 'L', specialChar: 'SC' }),
                makeCause({ id: 'c2', cause: 'Same SC', preventionControl: 'SPC', ap: 'L', specialChar: 'SC' }),
            ],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc).toHaveLength(1);
        expect(proc[0].amfeAp).toBe('L');
    });

    it('summary includes SC/CC count when AP=L causes qualify via explicit specialChar', () => {
        const doc = makeAmfeDoc({
            severity: 8,
            causes: [
                makeCause({ id: 'c1', cause: 'H cause', ap: 'H', preventionControl: 'PC1', detectionControl: 'DC1' }),
                makeCause({ id: 'c2', cause: 'L SC cause', ap: 'L', preventionControl: 'PC2', detectionControl: 'DC2', specialChar: 'SC' }),
            ],
        });
        const { warnings } = generateItemsFromAmfe(doc);
        const summary = warnings.find(w => w.includes('Plan de Control generado'));
        expect(summary).toBeDefined();
        expect(summary).toContain('SC/CC');
    });

    it('AP=L with explicit specialChar (e.g., "D") is included', () => {
        const doc = makeAmfeDoc({
            severity: 3, // No auto SC/CC
            causes: [makeCause({ id: 'c1', cause: 'Custom char', ap: 'L', specialChar: 'D' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].specialCharClass).toBe('D');
    });

    it('AP=L defaults: S=9 → sampleSize=1 pieza, sampleFrequency=Cada lote', () => {
        const doc = makeAmfeDoc({
            severity: 9,
            causes: [makeCause({ id: 'c1', cause: 'CC low', ap: 'L', preventionControl: 'SPC', detectionControl: 'CMM' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc[0].sampleSize).toBe('1 pieza');
        expect(proc[0].sampleFrequency).toBe('Cada lote');
    });

    it('AP=L defaults with explicit SC: S=6 → sampleSize=1 pieza, sampleFrequency=Cada lote', () => {
        const doc = makeAmfeDoc({
            severity: 6,
            causes: [makeCause({ id: 'c1', cause: 'SC low', ap: 'L', preventionControl: 'Audit', detectionControl: 'Visual', specialChar: 'SC' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        expect(proc[0].sampleSize).toBe('1 pieza');
        expect(proc[0].sampleFrequency).toBe('Cada lote');
    });

    it('AP=L with S>=9: reactionPlan still auto-filled based on severity (consequence is the same)', () => {
        const doc = makeAmfeDoc({
            severity: 9,
            causes: [makeCause({ id: 'c1', cause: 'CC with react', ap: 'L' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        // Reaction plan is severity-based: S=9 → stop line, regardless of AP level
        const proc = processRows(items);
        expect(proc[0].reactionPlan).toContain('Detener');
    });

    it('AP=L with explicit SC and S=6: reactionPlan is severity-based', () => {
        const doc = makeAmfeDoc({
            severity: 6,
            causes: [makeCause({ id: 'c1', cause: 'SC mid react', ap: 'L', specialChar: 'SC' })],
        });
        const { items } = generateItemsFromAmfe(doc);
        const proc = processRows(items);
        // S=6 → "Ajustar proceso" reaction plan
        expect(proc[0].reactionPlan).toContain('Ajustar');
    });
});
