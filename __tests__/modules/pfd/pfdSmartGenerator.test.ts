/**
 * Tests for pfdSmartGenerator — wizard-annotated PFD generation from AMFE document.
 *
 * Covers: buildOperationAnnotations, generateSmartPfd with bookends, transports,
 * annotations, branches, inspections, warnings, and combined scenarios.
 */
import { describe, it, expect } from 'vitest';
import {
    generateSmartPfd,
    buildOperationAnnotations,
    autoDetectInspections,
    SmartPfdGenerationResult,
} from '../../../modules/pfd/pfdSmartGenerator';
import type {
    PfdWizardAnnotations,
    PfdOperationAnnotation,
    PfdBranchGroup,
    PfdInspectionAnnotation,
} from '../../../modules/pfd/pfdWizardTypes';
import { createDefaultAnnotations } from '../../../modules/pfd/pfdWizardTypes';
import type { AmfeDocument } from '../../../modules/amfe/amfeTypes';

// ============================================================================
// HELPERS
// ============================================================================

function createTestAmfeDoc(operationCount: number): AmfeDocument {
    return {
        id: 'test-amfe',
        header: {
            partNumber: 'P-001',
            subject: 'Test Part',
            client: 'Test Client',
            organization: 'Barack Mercosul',
            location: 'Hurlingham',
            team: 'Test Team',
            responsible: 'Test User',
            processResponsible: '',
            approvedBy: '',
            modelYear: '2026',
            startDate: '',
            revDate: '',
            amfeNumber: '',
            confidentiality: '',
            revision: '',
            scope: '',
            applicableParts: '',
        },
        operations: Array.from({ length: operationCount }, (_, i) => ({
            id: `op-${i + 1}`,
            opNumber: String((i + 1) * 10),
            name: `Operacion ${i + 1}`,
            workElements: [],
        })),
    } as AmfeDocument;
}

function createAnnotationsWithOps(amfeDoc: AmfeDocument): PfdWizardAnnotations {
    return {
        ...createDefaultAnnotations(),
        operations: buildOperationAnnotations(amfeDoc),
    };
}

// ============================================================================
// buildOperationAnnotations
// ============================================================================

describe('buildOperationAnnotations', () => {
    it('returns empty array for AMFE with no operations', () => {
        const doc = createTestAmfeDoc(0);
        const result = buildOperationAnnotations(doc);
        expect(result).toEqual([]);
    });

    it('returns one annotation per operation', () => {
        const doc = createTestAmfeDoc(5);
        const result = buildOperationAnnotations(doc);
        expect(result).toHaveLength(5);
        expect(result.map(a => a.operationId)).toEqual([
            'op-1', 'op-2', 'op-3', 'op-4', 'op-5',
        ]);
    });

    it('all annotations default to included=true', () => {
        const doc = createTestAmfeDoc(3);
        const result = buildOperationAnnotations(doc);
        for (const ann of result) {
            expect(ann.included).toBe(true);
        }
    });

    it('all annotations default to isExternal=false', () => {
        const doc = createTestAmfeDoc(3);
        const result = buildOperationAnnotations(doc);
        for (const ann of result) {
            expect(ann.isExternal).toBe(false);
        }
    });

    it('infers step type from operation name', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-sold', opNumber: '10', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-insp', opNumber: '20', name: 'Inspección visual', workElements: [] },
                { id: 'op-trans', opNumber: '30', name: 'Transporte a pintura', workElements: [] },
                { id: 'op-store', opNumber: '40', name: 'Almacenamiento final', workElements: [] },
            ],
        };
        const result = buildOperationAnnotations(doc);

        expect(result.find(a => a.operationId === 'op-sold')!.stepType).toBe('operation');
        expect(result.find(a => a.operationId === 'op-insp')!.stepType).toBe('inspection');
        expect(result.find(a => a.operationId === 'op-trans')!.stepType).toBe('transport');
        expect(result.find(a => a.operationId === 'op-store')!.stepType).toBe('storage');
    });
});

// ============================================================================
// generateSmartPfd - basic
// ============================================================================

describe('generateSmartPfd - basic', () => {
    it('returns empty PFD with warning when no operations', () => {
        const doc = createTestAmfeDoc(0);
        const annotations = createDefaultAnnotations();
        const result = generateSmartPfd(doc, 'test-project', annotations);

        expect(result.document.steps).toHaveLength(0);
        expect(result.warnings.some(w => w.includes('vacío'))).toBe(true);
    });

    it('generates correct number of steps with defaults (cross-sector, generic names → no intermediate transports)', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        // Default: addBookendSteps=true, transportMode='cross-sector'
        // Generic names "Operacion 1/2/3" have no detectable sector → no inter-op transports
        // prevDepartment stays 'Almacén' (from bookend) → no final transport to shipping either
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // 1 receiving + 3 ops + 1 shipping = 5 (no transports when sector is unknown/Almacén)
        expect(result.document.steps).toHaveLength(5);
    });

    it('generates cross-sector transports when operations have different sectors', () => {
        const doc = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Corte de chapa', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Mecanizado CNC', workElements: [] },
            ],
        } as any;
        const annotations = createAnnotationsWithOps(doc);
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // REC + Transport(Almacén→Corte) + OP10 + Transport(Corte→Soldadura) + OP20
        // + Transport(Soldadura→Mecanizado) + OP30 + Transport(Mecanizado→Almacén) + ENV = 9
        expect(result.document.steps).toHaveLength(9);
        const transports = result.document.steps.filter(s => s.stepType === 'transport');
        expect(transports).toHaveLength(4);
        expect(transports[0].description).toBe('Transporte de Almacén a Corte');
        expect(transports[1].description).toBe('Transporte de Corte a Soldadura');
    });

    it('first step is receiving storage when addBookendSteps=true', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.addBookendSteps = true;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const first = result.document.steps[0];
        expect(first.stepType).toBe('storage');
        expect(first.description).toContain('Recepción');
    });

    it('last step is shipping storage when addBookendSteps=true', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.addBookendSteps = true;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const last = result.document.steps[result.document.steps.length - 1];
        expect(last.stepType).toBe('storage');
        expect(last.description).toContain('envío');
    });

    it('no bookend steps when addBookendSteps=false', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const steps = result.document.steps;
        // No receiving or shipping storage steps
        const storageSteps = steps.filter(s => s.stepType === 'storage');
        expect(storageSteps).toHaveLength(0);
    });

    it('no transport steps when transportMode=none', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        expect(transportSteps).toHaveLength(0);
        // Only the 3 operation steps
        expect(result.document.steps).toHaveLength(3);
    });

    it('operation step numbers preserve AMFE opNumbers', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.addBookendSteps = false;
        annotations.transportMode = 'none';
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const stepNumbers = result.document.steps.map(s => s.stepNumber);
        // Operations use AMFE opNumbers directly
        expect(stepNumbers).toEqual(['OP 10', 'OP 20', 'OP 30']);
    });

    it('transport steps have empty step numbers', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.addBookendSteps = false;
        annotations.transportMode = 'all';
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const transportSteps = result.document.steps.filter(s => s.stepType === 'transport');
        for (const t of transportSteps) {
            expect(t.stepNumber).toBe('');
        }
    });

    it('bookend steps use REC and ENV identifiers', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        annotations.addBookendSteps = true;
        annotations.transportMode = 'none';
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const steps = result.document.steps;
        expect(steps[0].stepNumber).toBe('REC');
        expect(steps[steps.length - 1].stepNumber).toBe('ENV');
    });

    it('inspection steps get intermediate numbers between operations', () => {
        const doc = createTestAmfeDoc(2); // op-1 (opNumber=10), op-2 (opNumber=20)
        const annotations = createAnnotationsWithOps(doc);
        annotations.inspections = [{
            id: 'insp-1',
            afterOperationId: 'op-1',
            description: 'Inspección intermedia',
            rejectDisposition: 'none',
            reworkReturnStep: '',
            scrapDescription: '',
        }];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // op-1 = OP 10, inspection = OP 15, op-2 = OP 20
        expect(result.document.steps[0].stepNumber).toBe('OP 10');
        expect(result.document.steps[1].stepNumber).toBe('OP 15');
        expect(result.document.steps[2].stepNumber).toBe('OP 20');
    });

    it('header is populated from AMFE header data', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        const result = generateSmartPfd(doc, 'my-amfe-project', annotations);

        const header = result.document.header;
        expect(header.partNumber).toBe('P-001');
        expect(header.partName).toBe('Test Part');
        expect(header.customerName).toBe('Test Client');
        expect(header.companyName).toBe('Barack Mercosul');
        expect(header.plantLocation).toBe('Hurlingham');
        expect(header.coreTeam).toBe('Test Team');
        expect(header.keyContact).toBe('Test User');
        expect(header.modelYear).toBe('2026');
        expect(header.linkedAmfeId).toBe('my-amfe-project');
    });
});

// ============================================================================
// generateSmartPfd - annotations
// ============================================================================

describe('generateSmartPfd - annotations', () => {
    it('respects user-overridden step type', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        // Override step type from inferred 'operation' to 'inspection'
        annotations.operations[0].stepType = 'inspection';
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        expect(result.document.steps[0].stepType).toBe('inspection');
    });

    it('excludes operations with included=false', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.operations[1].included = false; // Exclude op-2
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // Only 2 ops should remain (op-1 and op-3)
        expect(result.document.steps).toHaveLength(2);
        expect(result.document.steps[0].description).toBe('Operacion 1');
        expect(result.document.steps[1].description).toBe('Operacion 3');
    });

    it('warns about excluded operations', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.operations[0].included = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        expect(result.warnings.some(w => w.includes('excluida'))).toBe(true);
        expect(result.warnings.some(w => w.includes('Operacion 1'))).toBe(true);
    });

    it('sets isExternalProcess from annotation', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.operations[0].isExternal = true;
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        expect(result.document.steps[0].isExternalProcess).toBe(true);
        expect(result.document.steps[1].isExternalProcess).toBe(false);
    });
});

// ============================================================================
// generateSmartPfd - branches
// ============================================================================

describe('generateSmartPfd - branches', () => {
    it('assigns branchId from branch annotations', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea Soldadura', operationIds: ['op-2'] },
        ];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const step2 = result.document.steps.find(s => s.description === 'Operacion 2');
        expect(step2!.branchId).toBe('A');
    });

    it('assigns branchLabel from branch annotations', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'B', branchLabel: 'Linea Pintura', operationIds: ['op-1'] },
        ];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const step1 = result.document.steps[0];
        expect(step1.branchLabel).toBe('Linea Pintura');
    });

    it('operations not in any branch stay on main flow (branchId="")', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Branch A', operationIds: ['op-2'] },
        ];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const step1 = result.document.steps.find(s => s.description === 'Operacion 1');
        const step3 = result.document.steps.find(s => s.description === 'Operacion 3');
        expect(step1!.branchId).toBe('');
        expect(step3!.branchId).toBe('');
    });
});

// ============================================================================
// generateSmartPfd - inspections
// ============================================================================

describe('generateSmartPfd - inspections', () => {
    it('inserts inspection step after matching operation', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.inspections = [{
            id: 'insp-1',
            afterOperationId: 'op-1',
            description: 'Inspección dimensional',
            rejectDisposition: 'rework',
            reworkReturnStep: 'OP 10',
            scrapDescription: '',
        }];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // op-1 at index 0, inspection at index 1, op-2 at index 2
        expect(result.document.steps).toHaveLength(3);
        expect(result.document.steps[0].description).toBe('Operacion 1');
        expect(result.document.steps[1].stepType).toBe('inspection');
        expect(result.document.steps[1].description).toBe('Inspección dimensional');
        expect(result.document.steps[2].description).toBe('Operacion 2');
    });

    it('inspection has correct rejectDisposition', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        annotations.inspections = [{
            id: 'insp-1',
            afterOperationId: 'op-1',
            description: 'Control de calidad',
            rejectDisposition: 'scrap',
            reworkReturnStep: '',
            scrapDescription: 'Piezas fuera de tolerancia',
        }];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const inspStep = result.document.steps.find(s => s.stepType === 'inspection');
        expect(inspStep!.rejectDisposition).toBe('scrap');
    });

    it('inspection has correct reworkReturnStep', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        annotations.inspections = [{
            id: 'insp-1',
            afterOperationId: 'op-1',
            description: 'Inspección',
            rejectDisposition: 'rework',
            reworkReturnStep: 'OP 10',
            scrapDescription: '',
        }];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const inspStep = result.document.steps.find(s => s.stepType === 'inspection');
        expect(inspStep!.reworkReturnStep).toBe('OP 10');
    });

    it('inspection has correct scrapDescription', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        annotations.inspections = [{
            id: 'insp-1',
            afterOperationId: 'op-1',
            description: 'Control final',
            rejectDisposition: 'scrap',
            reworkReturnStep: '',
            scrapDescription: 'Descarte por fisura',
        }];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const inspStep = result.document.steps.find(s => s.stepType === 'inspection');
        expect(inspStep!.scrapDescription).toBe('Descarte por fisura');
    });

    it('inspection inherits branch from parent operation', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea ZAC', operationIds: ['op-1'] },
        ];
        annotations.inspections = [{
            id: 'insp-1',
            afterOperationId: 'op-1',
            description: 'Inspección en linea',
            rejectDisposition: 'none',
            reworkReturnStep: '',
            scrapDescription: '',
        }];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const inspStep = result.document.steps.find(s => s.stepType === 'inspection');
        expect(inspStep!.branchId).toBe('A');
        expect(inspStep!.branchLabel).toBe('Linea ZAC');
    });

    it('multiple inspections after same operation', () => {
        const doc = createTestAmfeDoc(1);
        const annotations = createAnnotationsWithOps(doc);
        annotations.inspections = [
            {
                id: 'insp-1',
                afterOperationId: 'op-1',
                description: 'Inspección visual',
                rejectDisposition: 'sort',
                reworkReturnStep: '',
                scrapDescription: '',
            },
            {
                id: 'insp-2',
                afterOperationId: 'op-1',
                description: 'Inspección dimensional',
                rejectDisposition: 'rework',
                reworkReturnStep: 'OP 10',
                scrapDescription: '',
            },
        ];
        annotations.transportMode = 'none';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // op-1 + 2 inspections = 3 steps
        expect(result.document.steps).toHaveLength(3);
        expect(result.document.steps[1].stepType).toBe('inspection');
        expect(result.document.steps[1].description).toBe('Inspección visual');
        expect(result.document.steps[2].stepType).toBe('inspection');
        expect(result.document.steps[2].description).toBe('Inspección dimensional');
    });
});

// ============================================================================
// generateSmartPfd - warnings
// ============================================================================

describe('generateSmartPfd - warnings', () => {
    it('warns when operations have no work elements', () => {
        const doc = createTestAmfeDoc(1);
        // Operations from createTestAmfeDoc already have empty workElements
        const annotations = createAnnotationsWithOps(doc);
        const result = generateSmartPfd(doc, 'test-project', annotations);

        expect(result.warnings.some(w => w.includes('elementos de trabajo'))).toBe(true);
    });

    it('warns when annotations are empty but operations exist', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createDefaultAnnotations();
        // annotations.operations is [] but doc has 3 ops
        const result = generateSmartPfd(doc, 'test-project', annotations);

        expect(result.warnings.some(w => w.includes('anotaciones del wizard están vacías'))).toBe(true);
    });

    it('always includes a summary warning at the end', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const lastWarning = result.warnings[result.warnings.length - 1];
        expect(lastWarning).toContain('Flujograma generado');
        expect(lastWarning).toContain('pasos');
    });
});

// ============================================================================
// generateSmartPfd - combined scenario
// ============================================================================

describe('generateSmartPfd - combined scenario', () => {
    it('complex scenario with branches, inspections, exclusions, and external processes all at once', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-recv', opNumber: '10', name: 'Recepción MP', workElements: [] },
                { id: 'op-sold', opNumber: '20', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-pint', opNumber: '30', name: 'Pintura electrostática', workElements: [] },
                { id: 'op-trat', opNumber: '40', name: 'Tratamiento térmico', workElements: [] },
                { id: 'op-ensam', opNumber: '50', name: 'Ensamble final', workElements: [] },
            ],
        };

        const annotations: PfdWizardAnnotations = {
            operations: [
                { operationId: 'op-recv', stepType: 'storage', isExternal: false, included: true },
                { operationId: 'op-sold', stepType: 'operation', isExternal: false, included: true },
                { operationId: 'op-pint', stepType: 'operation', isExternal: true, included: true },
                { operationId: 'op-trat', stepType: 'operation', isExternal: false, included: false }, // excluded
                { operationId: 'op-ensam', stepType: 'operation', isExternal: false, included: true },
            ],
            branches: [
                { branchId: 'A', branchLabel: 'Linea Soldadura', operationIds: ['op-sold'] },
                { branchId: 'B', branchLabel: 'Linea Pintura', operationIds: ['op-pint'] },
            ],
            inspections: [
                {
                    id: 'insp-sold',
                    afterOperationId: 'op-sold',
                    description: 'Inspección de soldadura',
                    rejectDisposition: 'rework',
                    reworkReturnStep: 'OP 20',
                    scrapDescription: '',
                },
                {
                    id: 'insp-ensam',
                    afterOperationId: 'op-ensam',
                    description: 'Control final',
                    rejectDisposition: 'scrap',
                    reworkReturnStep: '',
                    scrapDescription: 'Piezas no conformes',
                },
            ],
            transportMode: 'all',
            addBookendSteps: true,
        };

        const result = generateSmartPfd(doc, 'combined-test', annotations);

        // Verify structure:
        // 1. Receiving storage (bookend)
        // 2. Transport to Recepción MP
        // 3. Recepción MP (storage)
        // 4. Transport to Soldadura MIG
        // 5. Soldadura MIG (branch A)
        // 6. Inspección de soldadura (branch A, inherited)
        // 7. Transport to Pintura
        // 8. Pintura electrostática (branch B, external)
        // -- op-trat excluded --
        // 9. Transport to Ensamble
        // 10. Ensamble final
        // 11. Control final (inspection)
        // 12. Transport to almacenamiento
        // 13. Shipping storage (bookend)

        const steps = result.document.steps;
        expect(steps.length).toBe(13);

        // Bookends
        expect(steps[0].stepType).toBe('storage');
        expect(steps[0].description).toContain('Recepción de materia prima');
        expect(steps[steps.length - 1].stepType).toBe('storage');
        expect(steps[steps.length - 1].description).toContain('envío');

        // Soldadura is in branch A
        const soldStep = steps.find(s => s.description === 'Soldadura MIG');
        expect(soldStep).toBeDefined();
        expect(soldStep!.branchId).toBe('A');
        expect(soldStep!.branchLabel).toBe('Linea Soldadura');

        // Inspection after soldadura inherits branch A
        const soldInsp = steps.find(s => s.description === 'Inspección de soldadura');
        expect(soldInsp).toBeDefined();
        expect(soldInsp!.branchId).toBe('A');
        expect(soldInsp!.rejectDisposition).toBe('rework');

        // Pintura is external and in branch B
        const pintStep = steps.find(s => s.description === 'Pintura electrostática');
        expect(pintStep).toBeDefined();
        expect(pintStep!.isExternalProcess).toBe(true);
        expect(pintStep!.branchId).toBe('B');

        // Tratamiento térmico was excluded
        const tratStep = steps.find(s => s.description === 'Tratamiento térmico');
        expect(tratStep).toBeUndefined();

        // Control final inspection at the end (before bookend)
        const ctrlFinal = steps.find(s => s.description === 'Control final');
        expect(ctrlFinal).toBeDefined();
        expect(ctrlFinal!.rejectDisposition).toBe('scrap');
        expect(ctrlFinal!.scrapDescription).toBe('Piezas no conformes');

        // Ensamble is on main flow
        const ensamStep = steps.find(s => s.description === 'Ensamble final');
        expect(ensamStep).toBeDefined();
        expect(ensamStep!.branchId).toBe('');

        // Transport steps present
        const transportSteps = steps.filter(s => s.stepType === 'transport');
        expect(transportSteps.length).toBeGreaterThanOrEqual(4);

        // Warnings include excluded operation and summary
        expect(result.warnings.some(w => w.includes('Tratamiento térmico') && w.includes('excluida'))).toBe(true);
        expect(result.warnings.some(w => w.includes('Flujograma generado'))).toBe(true);
        expect(result.warnings.some(w => w.includes('excluidas'))).toBe(true);

        // Bookend steps use REC/ENV identifiers
        expect(steps[0].stepNumber).toBe('REC');
        expect(steps[steps.length - 1].stepNumber).toBe('ENV');

        // Transport steps have empty step numbers
        const transportSteps2 = steps.filter(s => s.stepType === 'transport');
        for (const t of transportSteps2) {
            expect(t.stepNumber).toBe('');
        }

        // Operation steps preserve their AMFE opNumbers
        expect(soldStep!.stepNumber).toBe('OP 20');
        expect(pintStep!.stepNumber).toBe('OP 30');
        expect(ensamStep!.stepNumber).toBe('OP 50');
        // Recepción MP (AMFE op with opNumber=10)
        const recvStep = steps.find(s => s.description === 'Recepción MP');
        expect(recvStep!.stepNumber).toBe('OP 10');

        // Inspection step gets intermediate number
        // Inspection after soldadura (OP 20), next included op is pintura (OP 30) → OP 25
        expect(soldInsp!.stepNumber).toBe('OP 25');
        // Inspection after ensamble (OP 50), no next op → OP 55
        expect(ctrlFinal!.stepNumber).toBe('OP 55');
    });
});

// ============================================================================
// autoDetectInspections
// ============================================================================

describe('autoDetectInspections', () => {
    it('returns empty array when no operations', () => {
        const doc = createTestAmfeDoc(0);
        const result = autoDetectInspections(doc);
        expect(result).toEqual([]);
    });

    it('returns empty array when no inspection operations', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Ensamble final', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Pintura electrostatica', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(0);
    });

    it('detects "Inspeccion visual" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Inspección visual', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Inspección visual');
        expect(result[0].autoDetected).toBe(true);
    });

    it('detects "Control por Mylar" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Control por Mylar', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Control por Mylar');
    });

    it('detects "Control dimensional" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Prensado', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Control dimensional', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Control dimensional');
    });

    it('detects "Verificacion de torque" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Ajuste de tornillos', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Verificación de torque', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Verificación de torque');
    });

    it('detects "Prueba de fuga" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Soldadura', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Prueba de fuga', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Prueba de fuga');
    });

    it('detects "Ensayo de estanqueidad" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Ensamble', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Ensayo de estanqueidad', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Ensayo de estanqueidad');
    });

    it('detects "Control con galga" as inspection', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Mecanizado', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Control con galga', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('Control con galga');
    });

    it('places inspection after the previous non-inspection operation', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Corte de chapa', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Control por Mylar', workElements: [] },
                { id: 'op-4', opNumber: '40', name: 'Ensamble final', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        // "Control por Mylar" should be placed after "Soldadura MIG"
        expect(result[0].afterOperationId).toBe('op-2');
        expect(result[0].description).toBe('Control por Mylar');
    });

    it('does not create inspection for the first operation if it is an inspection (no previous op)', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Inspección de recepción', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Soldadura MIG', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        // The first op is an inspection but there is no previous non-inspection op, so it is skipped
        expect(result).toHaveLength(0);
    });

    it('multiple consecutive inspections all reference the same previous non-inspection op', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Soldadura', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Inspección visual', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Control dimensional', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(2);
        // Both inspections should reference op-1 (Soldadura)
        expect(result[0].afterOperationId).toBe('op-1');
        expect(result[0].description).toBe('Inspección visual');
        expect(result[1].afterOperationId).toBe('op-1');
        expect(result[1].description).toBe('Control dimensional');
    });

    it('all auto-detected inspections have autoDetected=true', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Corte', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Control por Mylar', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Ensayo de fuga', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        for (const insp of result) {
            expect(insp.autoDetected).toBe(true);
        }
    });

    it('all auto-detected inspections have default rejectDisposition of "none"', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Prensado', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Inspección dimensional', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].rejectDisposition).toBe('none');
    });

    it('infers "sort" disposition for muestreo operations', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Pintura', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Muestreo de piezas', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].rejectDisposition).toBe('sort');
    });

    it('all auto-detected inspections have empty reworkReturnStep and scrapDescription', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Mecanizado', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Control por galga', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        expect(result).toHaveLength(1);
        expect(result[0].reworkReturnStep).toBe('');
        expect(result[0].scrapDescription).toBe('');
    });

    it('detects mixed operations and inspections correctly', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Corte laser', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Medición de espesor', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Soldadura MAG', workElements: [] },
                { id: 'op-4', opNumber: '40', name: 'Control por Mylar', workElements: [] },
                { id: 'op-5', opNumber: '50', name: 'Ensamble final', workElements: [] },
                { id: 'op-6', opNumber: '60', name: 'Verificación de torque', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        // Expected: op-2 after op-1, op-4 after op-3, op-6 after op-5
        expect(result).toHaveLength(3);
        expect(result[0].afterOperationId).toBe('op-1');
        expect(result[0].description).toBe('Medición de espesor');
        expect(result[1].afterOperationId).toBe('op-3');
        expect(result[1].description).toBe('Control por Mylar');
        expect(result[2].afterOperationId).toBe('op-5');
        expect(result[2].description).toBe('Verificación de torque');
    });

    it('all auto-detected inspections have unique IDs', () => {
        const doc: AmfeDocument = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Corte', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Control visual', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Soldadura', workElements: [] },
                { id: 'op-4', opNumber: '40', name: 'Control dimensional', workElements: [] },
            ],
        };
        const result = autoDetectInspections(doc);
        const ids = result.map(i => i.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });
});

// ============================================================================
// generateSmartPfd - transport branchId inheritance
// ============================================================================

describe('generateSmartPfd - transport branchId inheritance', () => {
    it('transport step inherits branchId from destination operation', () => {
        const doc = createTestAmfeDoc(3); // op-1 (10), op-2 (20), op-3 (30)
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea A', operationIds: ['op-2'] },
        ];
        annotations.transportMode = 'all';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // Find the transport step that leads to Operacion 2 (branch A)
        const steps = result.document.steps;
        const op2Index = steps.findIndex(s => s.description === 'Operacion 2');
        expect(op2Index).toBeGreaterThan(0);

        // The transport step immediately before op-2 should inherit its branchId
        const transportBefore = steps[op2Index - 1];
        expect(transportBefore.stepType).toBe('transport');
        expect(transportBefore.description).toContain('Transporte a Operacion 2');
        expect(transportBefore.branchId).toBe('A');
        expect(transportBefore.branchLabel).toBe('Linea A');
    });

    it('transport step for main-flow operation has no branchId', () => {
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea A', operationIds: ['op-2'] },
        ];
        annotations.transportMode = 'all';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        // Transport to op-1 (main flow) should have no branchId
        const steps = result.document.steps;
        const op1Index = steps.findIndex(s => s.description === 'Operacion 1');
        const transportToOp1 = steps[op1Index - 1];
        expect(transportToOp1.stepType).toBe('transport');
        expect(transportToOp1.branchId).toBe('');

        // Transport to op-3 (main flow) should have no branchId
        const op3Index = steps.findIndex(s => s.description === 'Operacion 3');
        const transportToOp3 = steps[op3Index - 1];
        expect(transportToOp3.stepType).toBe('transport');
        expect(transportToOp3.branchId).toBe('');
    });

    it('transport between consecutive same-branch operations stays in branch', () => {
        const doc = createTestAmfeDoc(4); // op-1, op-2, op-3, op-4
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea A', operationIds: ['op-2', 'op-3'] },
        ];
        annotations.transportMode = 'all';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const steps = result.document.steps;

        // Transport to op-2 (branch A)
        const op2Index = steps.findIndex(s => s.description === 'Operacion 2');
        const transportToOp2 = steps[op2Index - 1];
        expect(transportToOp2.branchId).toBe('A');

        // Transport to op-3 (also branch A) - should stay in branch A
        const op3Index = steps.findIndex(s => s.description === 'Operacion 3');
        const transportToOp3 = steps[op3Index - 1];
        expect(transportToOp3.branchId).toBe('A');
        expect(transportToOp3.branchLabel).toBe('Linea A');

        // Both operations in branch A
        expect(steps[op2Index].branchId).toBe('A');
        expect(steps[op3Index].branchId).toBe('A');
    });

    it('final transport to shipping has no branchId', () => {
        const doc = createTestAmfeDoc(2);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea A', operationIds: ['op-2'] },
        ];
        annotations.transportMode = 'all';
        annotations.addBookendSteps = true;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const steps = result.document.steps;
        // The second-to-last step should be "Transporte a almacenamiento" with no branchId
        const shippingTransport = steps[steps.length - 2];
        expect(shippingTransport.stepType).toBe('transport');
        expect(shippingTransport.description).toContain('almacenamiento');
        expect(shippingTransport.branchId).toBe('');
    });

    it('transport inherits different branches for different destination operations', () => {
        const doc = createTestAmfeDoc(4); // op-1 (main), op-2 (A), op-3 (B), op-4 (main)
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea Soldadura', operationIds: ['op-2'] },
            { branchId: 'B', branchLabel: 'Linea Pintura', operationIds: ['op-3'] },
        ];
        annotations.transportMode = 'all';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const steps = result.document.steps;

        // Transport to op-2 inherits branch A
        const op2Index = steps.findIndex(s => s.description === 'Operacion 2');
        expect(steps[op2Index - 1].branchId).toBe('A');
        expect(steps[op2Index - 1].branchLabel).toBe('Linea Soldadura');

        // Transport to op-3 inherits branch B
        const op3Index = steps.findIndex(s => s.description === 'Operacion 3');
        expect(steps[op3Index - 1].branchId).toBe('B');
        expect(steps[op3Index - 1].branchLabel).toBe('Linea Pintura');

        // Transport to op-4 stays on main flow
        const op4Index = steps.findIndex(s => s.description === 'Operacion 4');
        expect(steps[op4Index - 1].branchId).toBe('');
    });

    it('consecutive branch steps group correctly for FlowMap (no fork/converge oscillation)', () => {
        // This is the exact bug scenario: OP10 [main] → OP20 [A] → OP30 [A]
        // With the fix, transport steps inherit branchId so the parallel group stays together
        const doc = createTestAmfeDoc(3);
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea A', operationIds: ['op-2', 'op-3'] },
        ];
        annotations.transportMode = 'all';
        annotations.addBookendSteps = false;
        const result = generateSmartPfd(doc, 'test-project', annotations);

        const steps = result.document.steps;

        // Collect branchIds in order to verify grouping
        const branchSequence = steps.map(s => s.branchId || 'main');

        // Should be: [main, main, A, A, A, A, main]
        // T-to-op1(main), OP1(main), T-to-op2(A), OP2(A), T-to-op3(A), OP3(A), T-to-shipping(main)
        expect(branchSequence).toEqual([
            'main',  // transport to op-1
            'main',  // op-1
            'A',     // transport to op-2
            'A',     // op-2
            'A',     // transport to op-3
            'A',     // op-3
            'main',  // transport to shipping
        ]);

        // Verify no interleaving: once we enter branch A, we stay there until we exit
        let inBranch = false;
        let exitedBranch = false;
        for (const bid of branchSequence) {
            if (bid === 'A') {
                if (exitedBranch) {
                    // Re-entering branch A after exiting = the bug we fixed
                    throw new Error('Branch A re-entered after exit — fork/converge oscillation!');
                }
                inBranch = true;
            } else if (inBranch) {
                inBranch = false;
                exitedBranch = true;
            }
        }
    });
});

// ============================================================================
// generateSmartPfd - per-branch transport tracking (deep fix)
// ============================================================================

describe('generateSmartPfd - per-branch transport tracking', () => {
    it('parallel branches A/B in same sector produce NO intra-sector transport', () => {
        // Two costura ops in branch A, two costura ops in branch B
        const doc = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-main', opNumber: '10', name: 'Corte de chapa', workElements: [] },
                { id: 'op-a1', opNumber: '20', name: 'Costura de funda', workElements: [] },
                { id: 'op-a2', opNumber: '30', name: 'Costura lateral', workElements: [] },
                { id: 'op-b1', opNumber: '40', name: 'Costura de respaldo', workElements: [] },
                { id: 'op-b2', opNumber: '50', name: 'Costura de tapizado', workElements: [] },
                { id: 'op-end', opNumber: '60', name: 'Ensamble final', workElements: [] },
            ],
        } as any;
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Linea A', operationIds: ['op-a1', 'op-a2'] },
            { branchId: 'B', branchLabel: 'Linea B', operationIds: ['op-b1', 'op-b2'] },
        ];
        annotations.transportMode = 'cross-sector';
        annotations.addBookendSteps = true;

        const result = generateSmartPfd(doc, 'test', annotations);
        const steps = result.document.steps;
        const transports = steps.filter(s => s.stepType === 'transport');

        // NO transport between Costura ops within the same branch
        const costuraToCostura = transports.filter(t =>
            t.description.includes('de Costura a Costura')
        );
        expect(costuraToCostura).toHaveLength(0);
    });

    it('parallel branches A(Costura)/B(Soldadura) have independent transport tracking', () => {
        // Branch A: Costura ops, Branch B: Soldadura ops
        const doc = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-main', opNumber: '10', name: 'Corte de chapa', workElements: [] },
                { id: 'op-a1', opNumber: '20', name: 'Costura de funda', workElements: [] },
                { id: 'op-b1', opNumber: '30', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-end', opNumber: '40', name: 'Ensamble final', workElements: [] },
            ],
        } as any;
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Costura', operationIds: ['op-a1'] },
            { branchId: 'B', branchLabel: 'Soldadura', operationIds: ['op-b1'] },
        ];
        annotations.transportMode = 'cross-sector';
        annotations.addBookendSteps = true;

        const result = generateSmartPfd(doc, 'test', annotations);
        const steps = result.document.steps;
        const transports = steps.filter(s => s.stepType === 'transport');

        // Both branches should get a transport from Corte (the pre-fork department)
        const toSoldadura = transports.filter(t => t.description.includes('a Soldadura'));
        const toCostura = transports.filter(t => t.description.includes('a Costura'));
        expect(toSoldadura.length).toBeGreaterThanOrEqual(1);
        expect(toCostura.length).toBeGreaterThanOrEqual(1);
    });

    it('after branch convergence, transport resets to pre-fork department', () => {
        const doc = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-main', opNumber: '10', name: 'Corte de chapa', workElements: [] },
                { id: 'op-a1', opNumber: '20', name: 'Soldadura MIG', workElements: [] },
                { id: 'op-end', opNumber: '30', name: 'Pintura electrostatica', workElements: [] },
            ],
        } as any;
        const annotations = createAnnotationsWithOps(doc);
        annotations.branches = [
            { branchId: 'A', branchLabel: 'Soldadura', operationIds: ['op-a1'] },
        ];
        annotations.transportMode = 'cross-sector';
        annotations.addBookendSteps = true;

        const result = generateSmartPfd(doc, 'test', annotations);
        const steps = result.document.steps;
        const transports = steps.filter(s => s.stepType === 'transport');

        // After branch A (Soldadura) converges, prevDepartment should reset to Corte
        // So the transport to Pintura should be "de Corte a Pintura" (not "de Soldadura a Pintura")
        const toPintura = transports.find(t => t.description.includes('a Pintura'));
        expect(toPintura).toBeDefined();
        expect(toPintura!.description).toBe('Transporte de Corte a Pintura');
    });

    it('WIP operation in branch does NOT trigger false transport', () => {
        const doc = {
            ...createTestAmfeDoc(0),
            operations: [
                { id: 'op-1', opNumber: '10', name: 'Costura de funda', workElements: [] },
                { id: 'op-2', opNumber: '20', name: 'Embalaje de medos WIP', workElements: [] },
                { id: 'op-3', opNumber: '30', name: 'Costura lateral', workElements: [] },
            ],
        } as any;
        const annotations = createAnnotationsWithOps(doc);
        annotations.transportMode = 'cross-sector';
        annotations.addBookendSteps = true;

        const result = generateSmartPfd(doc, 'test', annotations);
        const steps = result.document.steps;
        const transports = steps.filter(s => s.stepType === 'transport');

        // "Embalaje de medos WIP" should return undefined department (WIP guard)
        // So no transport should be generated between costura ops
        const costuraTransports = transports.filter(t =>
            t.description.includes('de Costura a') && !t.description.includes('a Almacén')
        );
        // No false transport due to WIP — the WIP op has no department
        expect(costuraTransports).toHaveLength(0);
    });
});
