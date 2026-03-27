/**
 * Tests for the Change Propagation Engine (core/inheritance/changePropagation)
 *
 * Covers:
 * - diffMasterChanges: pure diff logic detecting added/removed/modified items
 * - propagateChangesToVariants: async proposal creation with override-aware status
 * - triggerChangePropagation: fire-and-forget wrapper (never throws)
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

const mockGetDocumentFamilyInfo = vi.fn();
const mockGetVariantDocuments = vi.fn().mockResolvedValue([]);
const mockListOverrides = vi.fn().mockResolvedValue([]);
let createProposalCounter = 0;
const mockCreateProposal = vi.fn().mockImplementation(() => Promise.resolve(++createProposalCounter));

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    getDocumentFamilyInfo: (...args: unknown[]) => mockGetDocumentFamilyInfo(...args),
    getVariantDocuments: (...args: unknown[]) => mockGetVariantDocuments(...args),
    listOverrides: (...args: unknown[]) => mockListOverrides(...args),
    createProposal: (...args: unknown[]) => mockCreateProposal(...args),
    addOverride: vi.fn().mockResolvedValue(1),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    diffMasterChanges,
    propagateChangesToVariants,
    triggerChangePropagation,
    type DetectedMasterChange,
} from '../../core/inheritance/changePropagation';
import { logger } from '../../utils/logger';

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
// Helper: flush microtask queue so the fire-and-forget IIFE completes
// ---------------------------------------------------------------------------

async function flushAsync(): Promise<void> {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('changePropagation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createProposalCounter = 0;
        mockExecute.mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 });
        mockGetDocumentFamilyInfo.mockResolvedValue(null);
        mockGetVariantDocuments.mockResolvedValue([]);
        mockListOverrides.mockResolvedValue([]);
    });

    // =========================================================================
    // diffMasterChanges — pure diff logic
    // =========================================================================

    describe('diffMasterChanges', () => {
        it('should return empty array when old and new master are identical', () => {
            const step = makePfdStep();
            const oldDoc = makePfdDocument([step]);
            const newDoc = makePfdDocument([{ ...step }]);

            const result = diffMasterChanges(oldDoc, newDoc, 'pfd');
            expect(result).toHaveLength(0);
        });

        it('should detect item added in new master', () => {
            const step1 = makePfdStep({ id: 'step-1' });
            const step2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20', description: 'Nuevo paso' });

            const oldDoc = makePfdDocument([step1]);
            const newDoc = makePfdDocument([{ ...step1 }, step2]);

            const result = diffMasterChanges(oldDoc, newDoc, 'pfd');
            expect(result).toHaveLength(1);
            expect(result[0].changeType).toBe('added');
            expect(result[0].itemId).toBe('step-2');
            expect(result[0].itemType).toBe('pfd_step');
            expect(result[0].oldData).toBeUndefined();
            expect(result[0].newData).toBeDefined();
        });

        it('should detect item removed in new master', () => {
            const step1 = makePfdStep({ id: 'step-1' });
            const step2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20' });

            const oldDoc = makePfdDocument([step1, step2]);
            const newDoc = makePfdDocument([{ ...step1 }]);

            const result = diffMasterChanges(oldDoc, newDoc, 'pfd');
            expect(result).toHaveLength(1);
            expect(result[0].changeType).toBe('removed');
            expect(result[0].itemId).toBe('step-2');
            expect(result[0].oldData).toBeDefined();
            expect(result[0].newData).toBeUndefined();
        });

        it('should detect item modified in new master with oldData/newData', () => {
            const oldStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep = makePfdStep({ id: 'step-1', description: 'Modificado' });

            const oldDoc = makePfdDocument([oldStep]);
            const newDoc = makePfdDocument([newStep]);

            const result = diffMasterChanges(oldDoc, newDoc, 'pfd');
            expect(result).toHaveLength(1);
            expect(result[0].changeType).toBe('modified');
            expect(result[0].itemId).toBe('step-1');
            expect(result[0].itemType).toBe('pfd_step');
            expect(result[0].oldData).toBeDefined();
            expect(result[0].newData).toBeDefined();
            expect(result[0].oldData).not.toBe(result[0].newData);
        });

        it('should detect multiple changes at once', () => {
            const step1 = makePfdStep({ id: 'step-1', description: 'Original' });
            const step2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20' });

            const oldDoc = makePfdDocument([step1, step2]);

            const modifiedStep1 = makePfdStep({ id: 'step-1', description: 'Cambiado' });
            const newStep3 = makePfdStep({ id: 'step-3', stepNumber: 'OP 30' });
            const newDoc = makePfdDocument([modifiedStep1, newStep3]);

            const result = diffMasterChanges(oldDoc, newDoc, 'pfd');
            expect(result).toHaveLength(3);

            const modified = result.filter(r => r.changeType === 'modified');
            const added = result.filter(r => r.changeType === 'added');
            const removed = result.filter(r => r.changeType === 'removed');

            expect(modified).toHaveLength(1);
            expect(modified[0].itemId).toBe('step-1');

            expect(added).toHaveLength(1);
            expect(added[0].itemId).toBe('step-3');

            expect(removed).toHaveLength(1);
            expect(removed[0].itemId).toBe('step-2');
        });

        it('should work for AMFE module', () => {
            const op1 = makeAmfeOperation({ id: 'op-1', name: 'Original' });
            const op2 = makeAmfeOperation({ id: 'op-1', name: 'Modificado' });

            const oldDoc = makeAmfeDocument([op1]);
            const newDoc = makeAmfeDocument([op2]);

            const result = diffMasterChanges(oldDoc, newDoc, 'amfe');
            expect(result).toHaveLength(1);
            expect(result[0].changeType).toBe('modified');
            expect(result[0].itemType).toBe('amfe_operation');
        });

        it('should work for CP module', () => {
            const item1 = makeCpItem({ id: 'cp-1', specification: '10mm' });
            const item2 = makeCpItem({ id: 'cp-1', specification: '12mm' });

            const oldDoc = makeCpDocument([item1]);
            const newDoc = makeCpDocument([item2]);

            const result = diffMasterChanges(oldDoc, newDoc, 'cp');
            expect(result).toHaveLength(1);
            expect(result[0].changeType).toBe('modified');
            expect(result[0].itemType).toBe('cp_item');
        });

        it('should work for HO module', () => {
            const sheet1 = makeHoSheet({ id: 'ho-1', reactionPlanText: 'Original' });
            const sheet2 = makeHoSheet({ id: 'ho-1', reactionPlanText: 'Modificado' });

            const oldDoc = makeHoDocument([sheet1]);
            const newDoc = makeHoDocument([sheet2]);

            const result = diffMasterChanges(oldDoc, newDoc, 'ho');
            expect(result).toHaveLength(1);
            expect(result[0].changeType).toBe('modified');
            expect(result[0].itemType).toBe('ho_sheet');
        });

        it('should handle empty documents', () => {
            const oldDoc = makePfdDocument([]);
            const newDoc = makePfdDocument([]);

            const result = diffMasterChanges(oldDoc, newDoc, 'pfd');
            expect(result).toHaveLength(0);
        });
    });

    // =========================================================================
    // propagateChangesToVariants
    // =========================================================================

    describe('propagateChangesToVariants', () => {
        const baseParams = {
            familyId: 10,
            module: 'pfd',
            masterDocId: 'master-doc-1',
            moduleType: 'pfd' as const,
        };

        it('should create auto_applied proposals for variant without overrides', async () => {
            const oldStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });

            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            mockListOverrides.mockResolvedValue([]); // No overrides

            const result = await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([oldStep]),
                newDoc: makePfdDocument([newStep]),
            });

            expect(result.totalProposals).toBe(1);
            expect(result.autoApplied).toBe(1);
            expect(result.pending).toBe(0);
            expect(mockCreateProposal).toHaveBeenCalledWith(expect.objectContaining({
                familyId: 10,
                module: 'pfd',
                masterDocId: 'master-doc-1',
                targetFamilyDocId: 100,
                changeType: 'modified',
                itemType: 'pfd_step',
                itemId: 'step-1',
            }));
        });

        it('should create pending proposals for variant with overrides on changed item', async () => {
            const oldStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });

            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            // Variant has an override on step-1
            mockListOverrides.mockResolvedValue([
                { id: 1, familyDocId: 100, itemType: 'pfd_step', itemId: 'step-1', overrideType: 'modified', overrideData: null, createdAt: '' },
            ]);

            const result = await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([oldStep]),
                newDoc: makePfdDocument([newStep]),
            });

            expect(result.totalProposals).toBe(1);
            expect(result.autoApplied).toBe(0);
            expect(result.pending).toBe(1);
        });

        it('should handle multiple variants', async () => {
            const oldStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });

            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
                { id: 200, familyId: 10, module: 'pfd', documentId: 'variant-2', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            mockListOverrides.mockResolvedValue([]);

            const result = await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([oldStep]),
                newDoc: makePfdDocument([newStep]),
            });

            expect(result.totalProposals).toBe(2);
            expect(result.autoApplied).toBe(2);
            expect(result.proposalsByVariant.size).toBe(2);
            expect(result.proposalsByVariant.get(100)).toEqual({ autoApplied: 1, pending: 0 });
            expect(result.proposalsByVariant.get(200)).toEqual({ autoApplied: 1, pending: 0 });
        });

        it('should handle variant with mixed overrides (some items overridden, some not)', async () => {
            const oldStep1 = makePfdStep({ id: 'step-1', description: 'Original 1' });
            const oldStep2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20', description: 'Original 2' });
            const newStep1 = makePfdStep({ id: 'step-1', description: 'Cambiado 1' });
            const newStep2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20', description: 'Cambiado 2' });

            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            // Variant overrides step-1 but not step-2
            mockListOverrides.mockResolvedValue([
                { id: 1, familyDocId: 100, itemType: 'pfd_step', itemId: 'step-1', overrideType: 'modified', overrideData: null, createdAt: '' },
            ]);

            const result = await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([oldStep1, oldStep2]),
                newDoc: makePfdDocument([newStep1, newStep2]),
            });

            expect(result.totalProposals).toBe(2);
            expect(result.pending).toBe(1); // step-1 has override
            expect(result.autoApplied).toBe(1); // step-2 does not
            expect(result.proposalsByVariant.get(100)).toEqual({ autoApplied: 1, pending: 1 });
        });

        it('should return correct summary counts', async () => {
            const oldStep1 = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep1 = makePfdStep({ id: 'step-1', description: 'Cambiado' });
            const newStep2 = makePfdStep({ id: 'step-2', stepNumber: 'OP 20' });

            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
                { id: 200, familyId: 10, module: 'pfd', documentId: 'variant-2', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            mockListOverrides.mockResolvedValue([]);

            const result = await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([oldStep1]),
                newDoc: makePfdDocument([newStep1, newStep2]),
            });

            // 2 changes x 2 variants = 4 proposals
            expect(result.totalProposals).toBe(4);
            expect(result.autoApplied).toBe(4);
            expect(result.pending).toBe(0);
        });

        it('should clear old proposals before creating new ones', async () => {
            const oldStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });

            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            mockListOverrides.mockResolvedValue([]);

            await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([oldStep]),
                newDoc: makePfdDocument([newStep]),
            });

            // Should have called DELETE before INSERT
            expect(mockExecute).toHaveBeenCalledWith(
                `DELETE FROM family_change_proposals WHERE target_family_doc_id = ? AND status IN ('pending', 'auto_applied')`,
                [100]
            );

            // The DELETE should have been called before createProposal
            const deleteCallOrder = mockExecute.mock.invocationCallOrder[0];
            const createCallOrder = mockCreateProposal.mock.invocationCallOrder[0];
            expect(deleteCallOrder).toBeLessThan(createCallOrder);
        });

        it('should return zero proposals when documents are identical', async () => {
            const step = makePfdStep();
            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);

            const result = await propagateChangesToVariants({
                ...baseParams,
                oldDoc: makePfdDocument([step]),
                newDoc: makePfdDocument([{ ...step }]),
            });

            expect(result.totalProposals).toBe(0);
            expect(mockCreateProposal).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // triggerChangePropagation — fire-and-forget
    // =========================================================================

    describe('triggerChangePropagation', () => {
        it('should do nothing for non-family document', async () => {
            mockGetDocumentFamilyInfo.mockResolvedValue(null);

            const step = makePfdStep();
            triggerChangePropagation('doc-123', makePfdDocument([step]), makePfdDocument([step]), 'pfd');

            await flushAsync();

            expect(mockGetDocumentFamilyInfo).toHaveBeenCalledWith('doc-123');
            expect(mockGetVariantDocuments).not.toHaveBeenCalled();
            expect(mockCreateProposal).not.toHaveBeenCalled();
        });

        it('should do nothing for variant document', async () => {
            mockGetDocumentFamilyInfo.mockResolvedValue({
                id: 5, familyId: 10, module: 'pfd', documentId: 'doc-variant',
                isMaster: false, sourceMasterId: 1, productId: null, createdAt: '',
            });

            const step = makePfdStep();
            triggerChangePropagation('doc-variant', makePfdDocument([step]), makePfdDocument([step]), 'pfd');

            await flushAsync();

            expect(mockGetVariantDocuments).not.toHaveBeenCalled();
            expect(mockCreateProposal).not.toHaveBeenCalled();
        });

        it('should do nothing for master with no variants', async () => {
            mockGetDocumentFamilyInfo.mockResolvedValue({
                id: 1, familyId: 10, module: 'pfd', documentId: 'doc-master',
                isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
            });
            mockGetVariantDocuments.mockResolvedValue([]);

            const step = makePfdStep();
            triggerChangePropagation('doc-master', makePfdDocument([step]), makePfdDocument([step]), 'pfd');

            await flushAsync();

            expect(mockGetVariantDocuments).toHaveBeenCalledWith(10, 'pfd');
            expect(mockCreateProposal).not.toHaveBeenCalled();
        });

        it('should create proposals for master with variants', async () => {
            mockGetDocumentFamilyInfo.mockResolvedValue({
                id: 1, familyId: 10, module: 'pfd', documentId: 'doc-master',
                isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
            });
            mockGetVariantDocuments.mockResolvedValue([
                { id: 100, familyId: 10, module: 'pfd', documentId: 'variant-1', isMaster: false, sourceMasterId: 1, productId: null, createdAt: '' },
            ]);
            mockListOverrides.mockResolvedValue([]);

            const oldStep = makePfdStep({ id: 'step-1', description: 'Original' });
            const newStep = makePfdStep({ id: 'step-1', description: 'Cambiado' });

            triggerChangePropagation('doc-master', makePfdDocument([oldStep]), makePfdDocument([newStep]), 'pfd');

            await flushAsync();

            expect(mockCreateProposal).toHaveBeenCalledTimes(1);
            expect(mockCreateProposal).toHaveBeenCalledWith(expect.objectContaining({
                familyId: 10,
                module: 'pfd',
                masterDocId: 'doc-master',
                targetFamilyDocId: 100,
                changeType: 'modified',
                itemType: 'pfd_step',
                itemId: 'step-1',
            }));
        });

        it('should never throw even on error', async () => {
            mockGetDocumentFamilyInfo.mockRejectedValue(new Error('DB connection failed'));

            const step = makePfdStep();

            // Should not throw
            expect(() => {
                triggerChangePropagation('doc-123', makePfdDocument([step]), makePfdDocument([step]), 'pfd');
            }).not.toThrow();

            await flushAsync();

            expect(logger.error).toHaveBeenCalledWith(
                'ChangePropagation',
                expect.stringContaining('Change propagation failed'),
                expect.objectContaining({ error: 'DB connection failed' }),
                expect.any(Error)
            );
        });

        it('should log non-Error exceptions gracefully', async () => {
            mockGetDocumentFamilyInfo.mockRejectedValue('string error');

            const step = makePfdStep();
            triggerChangePropagation('doc-123', makePfdDocument([step]), makePfdDocument([step]), 'pfd');

            await flushAsync();

            expect(logger.error).toHaveBeenCalledWith(
                'ChangePropagation',
                expect.stringContaining('Change propagation failed'),
                expect.objectContaining({ error: 'string error' }),
                undefined
            );
        });
    });
});
