/**
 * Tests for triggerOverrideTracking (core/inheritance/triggerOverrideTracking)
 *
 * Covers:
 * - Fire-and-forget behavior (no errors thrown)
 * - Skipping when document is not linked to a family
 * - Skipping when document is a master
 * - Calling trackOverrides when document is a variant
 * - Handling errors gracefully (logging, not throwing)
 */

import type { PfdDocument, PfdStep } from '../../modules/pfd/pfdTypes';
import type { AmfeDocument, AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause } from '../../modules/amfe/amfeTypes';
import type { ControlPlanDocument, ControlPlanItem } from '../../modules/controlPlan/controlPlanTypes';
import type { HoDocument, HojaOperacion } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetDocumentFamilyInfo = vi.fn();
const mockGetFamilyMasterDocument = vi.fn();

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    getDocumentFamilyInfo: (...args: unknown[]) => mockGetDocumentFamilyInfo(...args),
    getFamilyMasterDocument: (...args: unknown[]) => mockGetFamilyMasterDocument(...args),
    addOverride: vi.fn().mockResolvedValue(1),
    listOverrides: vi.fn().mockResolvedValue([]),
}));

const mockTrackOverrides = vi.fn().mockResolvedValue({
    totalOverrides: 0, modified: 0, added: 0, removed: 0, overrides: [],
});

vi.mock('../../core/inheritance/overrideTracker', () => ({
    trackOverrides: (...args: unknown[]) => mockTrackOverrides(...args),
}));

const mockLoadAmfeDocument = vi.fn();
const mockLoadPfdDocument = vi.fn();
const mockLoadCpDocument = vi.fn();
const mockLoadHoDocument = vi.fn();

vi.mock('../../utils/repositories/amfeRepository', () => ({
    loadAmfeDocument: (...args: unknown[]) => mockLoadAmfeDocument(...args),
}));

vi.mock('../../utils/repositories/pfdRepository', () => ({
    loadPfdDocument: (...args: unknown[]) => mockLoadPfdDocument(...args),
}));

vi.mock('../../utils/repositories/cpRepository', () => ({
    loadCpDocument: (...args: unknown[]) => mockLoadCpDocument(...args),
}));

vi.mock('../../utils/repositories/hoRepository', () => ({
    loadHoDocument: (...args: unknown[]) => mockLoadHoDocument(...args),
}));

vi.mock('../../utils/database', () => ({
    getDatabase: vi.fn().mockResolvedValue({
        execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
        select: vi.fn().mockResolvedValue([]),
    }),
}));

vi.mock('../../utils/logger', () => ({
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import (after mocks)
// ---------------------------------------------------------------------------

import { triggerOverrideTracking } from '../../core/inheritance/triggerOverrideTracking';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makePfdStep(overrides: Partial<PfdStep> = {}): PfdStep {
    return {
        id: 'step-1',
        stepNumber: 'OP 10',
        stepType: 'operation',
        description: 'Test step',
        machineDeviceTool: '',
        productCharacteristic: '',
        productSpecialChar: 'none',
        processCharacteristic: '',
        processSpecialChar: 'none',
        reference: '',
        department: '',
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

function makePfdDocument(steps: PfdStep[] = []): PfdDocument {
    return {
        id: 'pfd-doc-variant',
        header: {
            partNumber: 'P-001', partName: 'Test', engineeringChangeLevel: '',
            modelYear: '2026', documentNumber: 'PFD-001', revisionLevel: 'A',
            revisionDate: '', companyName: '', plantLocation: '', supplierCode: '',
            customerName: '', coreTeam: '', keyContact: '', processPhase: 'production',
            preparedBy: '', preparedDate: '', approvedBy: '', approvedDate: '',
        },
        steps,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    };
}

function makeCpDocument(): ControlPlanDocument {
    return {
        header: {
            controlPlanNumber: 'CP-001', phase: 'production', partNumber: 'P-001',
            latestChangeLevel: '', partName: 'Test', applicableParts: '',
            organization: '', supplier: '', supplierCode: '', keyContactPhone: '',
            date: '', revision: 'A', responsible: '', approvedBy: '', client: '',
            coreTeam: '', customerEngApproval: '', customerQualityApproval: '',
            otherApproval: '', linkedAmfeProject: '',
        },
        items: [],
    };
}

function makeHoDocument(): HoDocument {
    return {
        header: {
            formNumber: '', organization: '', client: '', partNumber: '',
            partDescription: '', applicableParts: '', linkedAmfeProject: '',
            linkedCpProject: '',
        },
        sheets: [],
    };
}

function makeAmfeDocument(): AmfeDocument {
    return {
        header: {
            organization: '', location: '', client: '', modelYear: '',
            subject: '', startDate: '', revDate: '', team: '', amfeNumber: '',
            responsible: '', confidentiality: '', partNumber: '', processResponsible: '',
            revision: '', approvedBy: '', scope: '', applicableParts: '',
        },
        operations: [],
    };
}

// ---------------------------------------------------------------------------
// Helper: flush microtask queue so the fire-and-forget IIFE completes
// ---------------------------------------------------------------------------

async function flushAsync(): Promise<void> {
    // Two rounds of microtask flushing to ensure nested promises resolve
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('triggerOverrideTracking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDocumentFamilyInfo.mockResolvedValue(null);
        mockGetFamilyMasterDocument.mockResolvedValue(null);
        mockTrackOverrides.mockResolvedValue({
            totalOverrides: 0, modified: 0, added: 0, removed: 0, overrides: [],
        });
    });

    // =========================================================================
    // Skip cases
    // =========================================================================

    it('should do nothing when document is not linked to a family', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(null);

        const doc = makePfdDocument([makePfdStep()]);
        triggerOverrideTracking('doc-123', doc, 'pfd');

        await flushAsync();

        expect(mockGetDocumentFamilyInfo).toHaveBeenCalledWith('doc-123');
        expect(mockTrackOverrides).not.toHaveBeenCalled();
    });

    it('should do nothing when document is a master', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 1, familyId: 10, module: 'pfd', documentId: 'doc-123',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });

        const doc = makePfdDocument([makePfdStep()]);
        triggerOverrideTracking('doc-123', doc, 'pfd');

        await flushAsync();

        expect(mockTrackOverrides).not.toHaveBeenCalled();
    });

    it('should warn and skip when no master document found for family', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 5, familyId: 10, module: 'pfd', documentId: 'doc-variant',
            isMaster: false, sourceMasterId: 1, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue(null);

        const doc = makePfdDocument([makePfdStep()]);
        triggerOverrideTracking('doc-variant', doc, 'pfd');

        await flushAsync();

        expect(mockGetFamilyMasterDocument).toHaveBeenCalledWith(10, 'pfd');
        expect(mockTrackOverrides).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'OverrideTrackingTrigger',
            'No master document found for family',
            expect.objectContaining({ familyId: 10 })
        );
    });

    it('should warn and skip when master document content cannot be loaded', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 5, familyId: 10, module: 'pfd', documentId: 'doc-variant',
            isMaster: false, sourceMasterId: 1, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue({
            id: 1, familyId: 10, module: 'pfd', documentId: 'doc-master',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });
        mockLoadPfdDocument.mockResolvedValue(null);

        const doc = makePfdDocument([makePfdStep()]);
        triggerOverrideTracking('doc-variant', doc, 'pfd');

        await flushAsync();

        expect(mockLoadPfdDocument).toHaveBeenCalledWith('doc-master');
        expect(mockTrackOverrides).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'OverrideTrackingTrigger',
            'Failed to load master document content',
            expect.objectContaining({ masterDocumentId: 'doc-master' })
        );
    });

    // =========================================================================
    // Success cases
    // =========================================================================

    it('should call trackOverrides for a PFD variant document', async () => {
        const variantDoc = makePfdDocument([makePfdStep({ description: 'Modified' })]);
        const masterDoc = makePfdDocument([makePfdStep({ description: 'Original' })]);

        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 5, familyId: 10, module: 'pfd', documentId: 'pfd-variant-id',
            isMaster: false, sourceMasterId: 1, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue({
            id: 1, familyId: 10, module: 'pfd', documentId: 'pfd-master-id',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });
        mockLoadPfdDocument.mockResolvedValue(masterDoc);
        mockTrackOverrides.mockResolvedValue({
            totalOverrides: 1, modified: 1, added: 0, removed: 0, overrides: [],
        });

        triggerOverrideTracking('pfd-variant-id', variantDoc, 'pfd');

        await flushAsync();

        expect(mockTrackOverrides).toHaveBeenCalledWith(variantDoc, masterDoc, 'pfd', 5);
        expect(logger.info).toHaveBeenCalledWith(
            'OverrideTrackingTrigger',
            expect.stringContaining('Override tracking completed'),
            expect.objectContaining({ documentId: 'pfd-variant-id', overrides: 1 })
        );
    });

    it('should call trackOverrides for an AMFE variant document', async () => {
        const variantDoc = makeAmfeDocument();
        const masterDoc = makeAmfeDocument();

        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 7, familyId: 20, module: 'amfe', documentId: 'amfe-variant-id',
            isMaster: false, sourceMasterId: 3, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue({
            id: 3, familyId: 20, module: 'amfe', documentId: 'amfe-master-id',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });
        mockLoadAmfeDocument.mockResolvedValue({ doc: masterDoc, meta: { id: 'amfe-master-id' } });

        triggerOverrideTracking('amfe-variant-id', variantDoc, 'amfe');

        await flushAsync();

        expect(mockLoadAmfeDocument).toHaveBeenCalledWith('amfe-master-id');
        expect(mockTrackOverrides).toHaveBeenCalledWith(variantDoc, masterDoc, 'amfe', 7);
    });

    it('should call trackOverrides for a CP variant document', async () => {
        const variantDoc = makeCpDocument();
        const masterDoc = makeCpDocument();

        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 9, familyId: 30, module: 'cp', documentId: 'cp-variant-id',
            isMaster: false, sourceMasterId: 4, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue({
            id: 4, familyId: 30, module: 'cp', documentId: 'cp-master-id',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });
        mockLoadCpDocument.mockResolvedValue(masterDoc);

        triggerOverrideTracking('cp-variant-id', variantDoc, 'cp');

        await flushAsync();

        expect(mockLoadCpDocument).toHaveBeenCalledWith('cp-master-id');
        expect(mockTrackOverrides).toHaveBeenCalledWith(variantDoc, masterDoc, 'cp', 9);
    });

    it('should call trackOverrides for an HO variant document', async () => {
        const variantDoc = makeHoDocument();
        const masterDoc = makeHoDocument();

        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 11, familyId: 40, module: 'ho', documentId: 'ho-variant-id',
            isMaster: false, sourceMasterId: 6, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue({
            id: 6, familyId: 40, module: 'ho', documentId: 'ho-master-id',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });
        mockLoadHoDocument.mockResolvedValue(masterDoc);

        triggerOverrideTracking('ho-variant-id', variantDoc, 'ho');

        await flushAsync();

        expect(mockLoadHoDocument).toHaveBeenCalledWith('ho-master-id');
        expect(mockTrackOverrides).toHaveBeenCalledWith(variantDoc, masterDoc, 'ho', 11);
    });

    // =========================================================================
    // Error handling
    // =========================================================================

    it('should not throw when getDocumentFamilyInfo fails', async () => {
        mockGetDocumentFamilyInfo.mockRejectedValue(new Error('DB connection failed'));

        const doc = makePfdDocument([makePfdStep()]);

        // Should not throw
        expect(() => triggerOverrideTracking('doc-123', doc, 'pfd')).not.toThrow();

        await flushAsync();

        expect(logger.error).toHaveBeenCalledWith(
            'OverrideTrackingTrigger',
            expect.stringContaining('Override tracking failed'),
            expect.objectContaining({ error: 'DB connection failed' }),
            expect.any(Error)
        );
    });

    it('should not throw when trackOverrides fails', async () => {
        const variantDoc = makePfdDocument([makePfdStep()]);
        const masterDoc = makePfdDocument([makePfdStep()]);

        mockGetDocumentFamilyInfo.mockResolvedValue({
            id: 5, familyId: 10, module: 'pfd', documentId: 'pfd-variant-id',
            isMaster: false, sourceMasterId: 1, productId: null, createdAt: '',
        });
        mockGetFamilyMasterDocument.mockResolvedValue({
            id: 1, familyId: 10, module: 'pfd', documentId: 'pfd-master-id',
            isMaster: true, sourceMasterId: null, productId: null, createdAt: '',
        });
        mockLoadPfdDocument.mockResolvedValue(masterDoc);
        mockTrackOverrides.mockRejectedValue(new Error('Tracking failed'));

        expect(() => triggerOverrideTracking('pfd-variant-id', variantDoc, 'pfd')).not.toThrow();

        await flushAsync();

        expect(logger.error).toHaveBeenCalledWith(
            'OverrideTrackingTrigger',
            expect.stringContaining('Override tracking failed'),
            expect.objectContaining({ error: 'Tracking failed' }),
            expect.any(Error)
        );
    });

    it('should log non-Error exceptions gracefully', async () => {
        mockGetDocumentFamilyInfo.mockRejectedValue('string error');

        const doc = makePfdDocument([makePfdStep()]);
        triggerOverrideTracking('doc-123', doc, 'pfd');

        await flushAsync();

        expect(logger.error).toHaveBeenCalledWith(
            'OverrideTrackingTrigger',
            expect.stringContaining('Override tracking failed'),
            expect.objectContaining({ error: 'string error' }),
            undefined
        );
    });
});
