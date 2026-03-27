/**
 * Tests for the Override Tracker (core/inheritance/overrideTracker)
 *
 * Covers:
 * - diffDocuments: pure diff logic for all 4 modules (PFD, AMFE, CP, HO)
 * - trackOverrides: persistence of detected overrides via repository
 * - getOverrideStatus: query override status for a variant document
 */

import type { PfdDocument, PfdStep } from '../../modules/pfd/pfdTypes';
import type { AmfeDocument, AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause } from '../../modules/amfe/amfeTypes';
import type { ControlPlanDocument, ControlPlanItem } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument, HojaOperacion } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock('../../utils/database', () => ({
    getDatabase: vi.fn().mockResolvedValue({
        execute: (...args: unknown[]) => mockExecute(...args),
        select: (...args: unknown[]) => mockSelect(...args),
        close: vi.fn(),
    }),
}));

vi.mock('../../utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let addOverrideCounter = 0;
const mockAddOverride = vi.fn().mockImplementation(() => Promise.resolve(++addOverrideCounter));
const mockListOverrides = vi.fn().mockResolvedValue([]);

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    addOverride: (...args: unknown[]) => mockAddOverride(...args),
    listOverrides: (...args: unknown[]) => mockListOverrides(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    diffDocuments,
    trackOverrides,
    getOverrideStatus,
    type DetectedOverride,
} from '../../core/inheritance/overrideTracker';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makePfdStep(overrides: Partial<PfdStep> = {}): PfdStep {
    return {
        id: 'step-1',
        stepNumber: 'OP 10',
        stepType: 'operation',
        description: 'Recepcion de materia prima',
        machineDeviceTool: 'Mesa de inspeccion',
        productCharacteristic: 'Dimension A',
        productSpecialChar: 'none',
        processCharacteristic: 'Presion',
        processSpecialChar: 'none',
        reference: '',
        department: 'Produccion',
        notes: '',
        isRework: false,
        isExternalProcess: false,
        reworkReturnStep: '',
        rejectDisposition: 'none',
        scrapDescription: '',
        branchId: '',
        branchLabel: '',
        ...overrides,
    };
}

function makePfdDocument(steps: PfdStep[]): PfdDocument {
    return {
        id: 'pfd-doc-1',
        header: {
            partNumber: 'P-001',
            partName: 'Test Part',
            engineeringChangeLevel: '',
            modelYear: '2026',
            documentNumber: 'PFD-001',
            revisionLevel: 'A',
            revisionDate: '2026-01-01',
            companyName: 'Barack Mercosul',
            plantLocation: 'Hurlingham',
            supplierCode: '',
            customerName: '',
            coreTeam: '',
            keyContact: '',
            processPhase: 'production',
            preparedBy: '',
            preparedDate: '',
            approvedBy: '',
            approvedDate: '',
        },
        steps,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    };
}

function makeCause(overrides: Partial<AmfeCause> = {}): AmfeCause {
    return {
        id: 'cause-1',
        cause: 'Sensor descalibrado',
        preventionControl: 'Calibracion semanal',
        detectionControl: 'Inspeccion visual',
        occurrence: 5,
        detection: 4,
        ap: 'M',
        characteristicNumber: '',
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
        ...overrides,
    };
}

function makeFailure(overrides: Partial<AmfeFailure> = {}): AmfeFailure {
    return {
        id: 'fail-1',
        description: 'No mantiene temperatura',
        effectLocal: 'Rechazo interno',
        effectNextLevel: 'Devolucion',
        effectEndUser: 'Mal funcionamiento',
        severity: 8,
        causes: [makeCause()],
        ...overrides,
    };
}

function makeFunction(overrides: Partial<AmfeFunction> = {}): AmfeFunction {
    return {
        id: 'func-1',
        description: 'Mantener temperatura',
        requirements: 'T > 200C',
        failures: [makeFailure()],
        ...overrides,
    };
}

function makeWorkElement(overrides: Partial<AmfeWorkElement> = {}): AmfeWorkElement {
    return {
        id: 'we-1',
        type: 'Machine',
        name: 'CNC Machine',
        functions: [makeFunction()],
        ...overrides,
    };
}

function makeAmfeOperation(overrides: Partial<AmfeOperation> = {}): AmfeOperation {
    return {
        id: 'op-1',
        opNumber: 'OP 10',
        name: 'Torneado',
        workElements: [makeWorkElement()],
        ...overrides,
    };
}

function makeAmfeDocument(operations: AmfeOperation[]): AmfeDocument {
    return {
        header: {
            organization: 'Barack Mercosul',
            location: 'Hurlingham',
            client: '',
            modelYear: '2026',
            subject: 'Test AMFE',
            startDate: '',
            revDate: '',
            team: '',
            amfeNumber: 'AMFE-001',
            responsible: '',
            confidentiality: '',
            partNumber: 'P-001',
            processResponsible: '',
            revision: 'A',
            approvedBy: '',
            scope: '',
            applicableParts: '',
        },
        operations,
    };
}

function makeCpItem(overrides: Partial<ControlPlanItem> = {}): ControlPlanItem {
    return {
        id: 'cp-item-1',
        processStepNumber: 'OP 10',
        processDescription: 'Torneado',
        machineDeviceTool: 'CNC',
        characteristicNumber: '1',
        productCharacteristic: 'Diametro',
        processCharacteristic: 'RPM',
        specialCharClass: 'SC',
        specification: '10 +/- 0.1 mm',
        evaluationTechnique: 'Calibre',
        sampleSize: '5',
        sampleFrequency: 'Cada hora',
        controlMethod: 'SPC',
        reactionPlan: 'Parar linea',
        reactionPlanOwner: 'Supervisor',
        controlProcedure: 'P-REC-001',
        ...overrides,
    };
}

function makeCpDocument(items: ControlPlanItem[]): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: 'CP-001',
            phase: 'production',
            partNumber: 'P-001',
            latestChangeLevel: '',
            partName: 'Test Part',
            applicableParts: '',
            organization: 'Barack Mercosul',
            supplier: '',
            supplierCode: '',
            keyContactPhone: '',
            date: '',
            revision: 'A',
            responsible: '',
            approvedBy: '',
            plantApproval: '',
            client: '',
            coreTeam: '',
            customerApproval: '',
            otherApproval: '',
            linkedAmfeProject: '',
        },
        items,
    };
}

function makeHoSheet(overrides: Partial<HojaOperacion> = {}): HojaOperacion {
    return {
        id: 'ho-sheet-1',
        amfeOperationId: 'op-1',
        operationNumber: 'OP 10',
        operationName: 'Torneado',
        hoNumber: 'HO-OP 10',
        sector: '',
        puestoNumber: '',
        vehicleModel: '',
        partCodeDescription: '',
        safetyElements: [],
        hazardWarnings: [],
        steps: [],
        qualityChecks: [],
        reactionPlanText: 'Parar linea',
        reactionContact: '',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: '2026-01-01',
        revision: 'A',
        status: 'borrador',
        ...overrides,
    };
}

function makeHoDocument(sheets: HojaOperacion[]): HoDocument {
    return {
        header: {
            formNumber: 'I-IN-002.4-R01',
            organization: 'Barack Mercosul',
            client: '',
            partNumber: 'P-001',
            partDescription: 'Test Part',
            applicableParts: '',
            linkedAmfeProject: '',
            linkedCpProject: '',
        },
        sheets,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('overrideTracker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addOverrideCounter = 0;
        mockExecute.mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
        mockListOverrides.mockResolvedValue([]);
    });

    // =========================================================================
    // diffDocuments — PFD
    // =========================================================================

    describe('diffDocuments — PFD', () => {
        it('should detect no overrides when master and variant are identical', () => {
            const step = makePfdStep();
            const master = makePfdDocument([step]);
            const variant = makePfdDocument([{ ...step }]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(0);
        });

        it('should detect a modified step', () => {
            const masterStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const variantStep = makePfdStep({ id: 'step-1', description: 'Modificado' });

            const master = makePfdDocument([masterStep]);
            const variant = makePfdDocument([variantStep]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('modified');
            expect(result[0].itemType).toBe('pfd_step');
            expect(result[0].itemId).toBe('step-1');

            // overrideData should mention the changed field
            const data = JSON.parse(result[0].overrideData!);
            expect(data.changedFields).toContain('description');
        });

        it('should detect an added step', () => {
            const masterStep = makePfdStep({ id: 'step-1' });
            const variantStep1 = makePfdStep({ id: 'step-1' });
            const variantStep2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20', description: 'Nuevo paso' });

            const master = makePfdDocument([masterStep]);
            const variant = makePfdDocument([variantStep1, variantStep2]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('added');
            expect(result[0].itemId).toBe('step-2');
        });

        it('should detect a removed step', () => {
            const step1 = makePfdStep({ id: 'step-1' });
            const step2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20' });

            const master = makePfdDocument([step1, step2]);
            const variant = makePfdDocument([{ ...step1 }]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('removed');
            expect(result[0].itemId).toBe('step-2');
        });

        it('should detect mixed overrides (modified + added + removed)', () => {
            const step1 = makePfdStep({ id: 'step-1', description: 'Original' });
            const step2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20' });

            const master = makePfdDocument([step1, step2]);

            const modifiedStep1 = makePfdStep({ id: 'step-1', description: 'Cambiado' });
            const newStep3 = makePfdStep({ id: 'step-3', stepNumber: 'OP 30' });
            const variant = makePfdDocument([modifiedStep1, newStep3]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(3);

            const modified = result.filter(r => r.overrideType === 'modified');
            const added = result.filter(r => r.overrideType === 'added');
            const removed = result.filter(r => r.overrideType === 'removed');

            expect(modified).toHaveLength(1);
            expect(modified[0].itemId).toBe('step-1');

            expect(added).toHaveLength(1);
            expect(added[0].itemId).toBe('step-3');

            expect(removed).toHaveLength(1);
            expect(removed[0].itemId).toBe('step-2');
        });

        it('should ignore linkage fields when comparing PFD steps', () => {
            const masterStep = makePfdStep({ id: 'step-1', linkedAmfeOperationId: 'op-master' });
            const variantStep = makePfdStep({ id: 'step-1', linkedAmfeOperationId: 'op-variant' });

            const master = makePfdDocument([masterStep]);
            const variant = makePfdDocument([variantStep]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // diffDocuments — AMFE
    // =========================================================================

    describe('diffDocuments — AMFE', () => {
        it('should detect no overrides for identical AMFE documents', () => {
            const op = makeAmfeOperation();
            const master = makeAmfeDocument([op]);
            // Deep clone to avoid reference sharing
            const variant = makeAmfeDocument([JSON.parse(JSON.stringify(op))]);

            const result = diffDocuments(variant, master, 'amfe');
            expect(result).toHaveLength(0);
        });

        it('should detect modified operation when nested content changes', () => {
            const masterOp = makeAmfeOperation({
                id: 'op-1',
                workElements: [makeWorkElement({
                    functions: [makeFunction({
                        failures: [makeFailure({ severity: 8 })],
                    })],
                })],
            });
            const variantOp = makeAmfeOperation({
                id: 'op-1',
                workElements: [makeWorkElement({
                    functions: [makeFunction({
                        failures: [makeFailure({ severity: 10 })],
                    })],
                })],
            });

            const master = makeAmfeDocument([masterOp]);
            const variant = makeAmfeDocument([variantOp]);

            const result = diffDocuments(variant, master, 'amfe');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('modified');
            expect(result[0].itemType).toBe('amfe_operation');
        });

        it('should detect added operation', () => {
            const op1 = makeAmfeOperation({ id: 'op-1' });
            const op2 = makeAmfeOperation({ id: 'op-2', opNumber: 'OP 20', name: 'Fresado' });

            const master = makeAmfeDocument([op1]);
            const variant = makeAmfeDocument([JSON.parse(JSON.stringify(op1)), op2]);

            const result = diffDocuments(variant, master, 'amfe');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('added');
            expect(result[0].itemId).toBe('op-2');
        });

        it('should detect removed operation', () => {
            const op1 = makeAmfeOperation({ id: 'op-1' });
            const op2 = makeAmfeOperation({ id: 'op-2', opNumber: 'OP 20', name: 'Fresado' });

            const master = makeAmfeDocument([op1, op2]);
            const variant = makeAmfeDocument([JSON.parse(JSON.stringify(op1))]);

            const result = diffDocuments(variant, master, 'amfe');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('removed');
            expect(result[0].itemId).toBe('op-2');
        });

        it('should ignore linkage fields when comparing AMFE operations', () => {
            const masterOp = makeAmfeOperation({ id: 'op-1', linkedPfdStepId: 'pfd-step-master' });
            const variantOp = makeAmfeOperation({ id: 'op-1', linkedPfdStepId: 'pfd-step-variant' });

            const master = makeAmfeDocument([masterOp]);
            const variant = makeAmfeDocument([variantOp]);

            const result = diffDocuments(variant, master, 'amfe');
            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // diffDocuments — CP
    // =========================================================================

    describe('diffDocuments — CP', () => {
        it('should detect no overrides for identical CP documents', () => {
            const item = makeCpItem();
            const master = makeCpDocument([item]);
            const variant = makeCpDocument([{ ...item }]);

            const result = diffDocuments(variant, master, 'cp');
            expect(result).toHaveLength(0);
        });

        it('should detect modified CP item', () => {
            const masterItem = makeCpItem({ id: 'cp-item-1', specification: '10 +/- 0.1 mm' });
            const variantItem = makeCpItem({ id: 'cp-item-1', specification: '10 +/- 0.05 mm' });

            const master = makeCpDocument([masterItem]);
            const variant = makeCpDocument([variantItem]);

            const result = diffDocuments(variant, master, 'cp');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('modified');
            expect(result[0].itemType).toBe('cp_item');
        });

        it('should ignore AMFE metadata fields when comparing CP items', () => {
            const masterItem = makeCpItem({ id: 'cp-item-1', amfeAp: 'H', amfeSeverity: 9 });
            const variantItem = makeCpItem({ id: 'cp-item-1', amfeAp: 'M', amfeSeverity: 6 });

            const master = makeCpDocument([masterItem]);
            const variant = makeCpDocument([variantItem]);

            const result = diffDocuments(variant, master, 'cp');
            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // diffDocuments — HO
    // =========================================================================

    describe('diffDocuments — HO', () => {
        it('should detect no overrides for identical HO documents', () => {
            const sheet = makeHoSheet();
            const master = makeHoDocument([sheet]);
            const variant = makeHoDocument([JSON.parse(JSON.stringify(sheet))]);

            const result = diffDocuments(variant, master, 'ho');
            expect(result).toHaveLength(0);
        });

        it('should detect modified HO sheet', () => {
            const masterSheet = makeHoSheet({ id: 'ho-sheet-1', reactionPlanText: 'Original' });
            const variantSheet = makeHoSheet({ id: 'ho-sheet-1', reactionPlanText: 'Modificado' });

            const master = makeHoDocument([masterSheet]);
            const variant = makeHoDocument([variantSheet]);

            const result = diffDocuments(variant, master, 'ho');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('modified');
            expect(result[0].itemType).toBe('ho_sheet');
        });

        it('should detect added HO sheet', () => {
            const sheet1 = makeHoSheet({ id: 'ho-sheet-1' });
            const sheet2 = makeHoSheet({ id: 'ho-sheet-2', operationNumber: 'OP 20', operationName: 'Fresado' });

            const master = makeHoDocument([sheet1]);
            const variant = makeHoDocument([JSON.parse(JSON.stringify(sheet1)), sheet2]);

            const result = diffDocuments(variant, master, 'ho');
            expect(result).toHaveLength(1);
            expect(result[0].overrideType).toBe('added');
        });

        it('should ignore amfeOperationId linkage when comparing HO sheets', () => {
            const masterSheet = makeHoSheet({ id: 'ho-sheet-1', amfeOperationId: 'op-master' });
            const variantSheet = makeHoSheet({ id: 'ho-sheet-1', amfeOperationId: 'op-variant' });

            const master = makeHoDocument([masterSheet]);
            const variant = makeHoDocument([variantSheet]);

            const result = diffDocuments(variant, master, 'ho');
            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // diffDocuments — edge cases
    // =========================================================================

    describe('diffDocuments — edge cases', () => {
        it('should handle empty documents (no items)', () => {
            const master = makePfdDocument([]);
            const variant = makePfdDocument([]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(0);
        });

        it('should treat all items as added when master is empty', () => {
            const master = makePfdDocument([]);
            const variant = makePfdDocument([makePfdStep({ id: 'step-1' }), makePfdStep({ id: 'step-2' })]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(2);
            expect(result.every(o => o.overrideType === 'added')).toBe(true);
        });

        it('should treat all items as removed when variant is empty', () => {
            const master = makePfdDocument([makePfdStep({ id: 'step-1' }), makePfdStep({ id: 'step-2' })]);
            const variant = makePfdDocument([]);

            const result = diffDocuments(variant, master, 'pfd');
            expect(result).toHaveLength(2);
            expect(result.every(o => o.overrideType === 'removed')).toBe(true);
        });
    });

    // =========================================================================
    // trackOverrides — persistence
    // =========================================================================

    describe('trackOverrides', () => {
        it('should clear existing overrides and persist new ones', async () => {
            const masterStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const variantStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });
            const newStep = makePfdStep({ id: 'step-2', stepNumber: 'OP 20' });

            const master = makePfdDocument([masterStep]);
            const variant = makePfdDocument([variantStep, newStep]);

            const result = await trackOverrides(variant, master, 'pfd', 42);

            // Should have cleared existing overrides
            expect(mockExecute).toHaveBeenCalledWith(
                'DELETE FROM family_document_overrides WHERE family_doc_id = ?',
                [42]
            );

            // Should have persisted 2 overrides (1 modified + 1 added)
            expect(mockAddOverride).toHaveBeenCalledTimes(2);
            expect(result.totalOverrides).toBe(2);
            expect(result.modified).toBe(1);
            expect(result.added).toBe(1);
            expect(result.removed).toBe(0);
        });

        it('should return zero overrides when documents are identical', async () => {
            const step = makePfdStep();
            const master = makePfdDocument([step]);
            const variant = makePfdDocument([{ ...step }]);

            const result = await trackOverrides(variant, master, 'pfd', 42);

            expect(result.totalOverrides).toBe(0);
            expect(mockAddOverride).not.toHaveBeenCalled();
        });

        it('should pass correct data to addOverride', async () => {
            const masterStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const variantStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });

            const master = makePfdDocument([masterStep]);
            const variant = makePfdDocument([variantStep]);

            await trackOverrides(variant, master, 'pfd', 99);

            expect(mockAddOverride).toHaveBeenCalledWith({
                familyDocId: 99,
                itemType: 'pfd_step',
                itemId: 'step-1',
                overrideType: 'modified',
                overrideData: expect.any(String),
            });
        });
    });

    // =========================================================================
    // getOverrideStatus
    // =========================================================================

    describe('getOverrideStatus', () => {
        it('should return empty map when no overrides exist', async () => {
            mockListOverrides.mockResolvedValue([]);

            const status = await getOverrideStatus(42);

            expect(status.totalOverrides).toBe(0);
            expect(status.overrides.size).toBe(0);
        });

        it('should build a map keyed by itemType:itemId', async () => {
            mockListOverrides.mockResolvedValue([
                {
                    id: 1,
                    familyDocId: 42,
                    itemType: 'pfd_step',
                    itemId: 'step-1',
                    overrideType: 'modified',
                    overrideData: '{"changedFields":["description"]}',
                    createdAt: '2026-01-01T00:00:00Z',
                },
                {
                    id: 2,
                    familyDocId: 42,
                    itemType: 'pfd_step',
                    itemId: 'step-2',
                    overrideType: 'added',
                    overrideData: null,
                    createdAt: '2026-01-01T00:00:00Z',
                },
            ]);

            const status = await getOverrideStatus(42);

            expect(status.totalOverrides).toBe(2);
            expect(status.overrides.has('pfd_step:step-1')).toBe(true);
            expect(status.overrides.get('pfd_step:step-1')!.overrideType).toBe('modified');
            expect(status.overrides.has('pfd_step:step-2')).toBe(true);
            expect(status.overrides.get('pfd_step:step-2')!.overrideType).toBe('added');
        });

        it('should delegate to listOverrides with the correct familyDocId', async () => {
            await getOverrideStatus(123);
            expect(mockListOverrides).toHaveBeenCalledWith(123);
        });
    });

    // =========================================================================
    // overrideData — diff summary
    // =========================================================================

    describe('overrideData diff summary', () => {
        it('should list changed fields in overrideData for modified items', () => {
            const masterItem = makeCpItem({ id: 'cp-1', specification: '10mm', sampleSize: '5' });
            const variantItem = makeCpItem({ id: 'cp-1', specification: '12mm', sampleSize: '10' });

            const master = makeCpDocument([masterItem]);
            const variant = makeCpDocument([variantItem]);

            const result = diffDocuments(variant, master, 'cp');
            expect(result).toHaveLength(1);

            const data = JSON.parse(result[0].overrideData!);
            expect(data.changedFields).toContain('specification');
            expect(data.changedFields).toContain('sampleSize');
            // Unchanged fields should NOT be listed
            expect(data.changedFields).not.toContain('processDescription');
        });

        it('should not include overrideData for added items', () => {
            const master = makeCpDocument([]);
            const variant = makeCpDocument([makeCpItem({ id: 'cp-1' })]);

            const result = diffDocuments(variant, master, 'cp');
            expect(result[0].overrideData).toBeUndefined();
        });

        it('should not include overrideData for removed items', () => {
            const master = makeCpDocument([makeCpItem({ id: 'cp-1' })]);
            const variant = makeCpDocument([]);

            const result = diffDocuments(variant, master, 'cp');
            expect(result[0].overrideData).toBeUndefined();
        });
    });
});
