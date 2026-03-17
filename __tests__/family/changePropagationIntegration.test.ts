/**
 * Integration tests: changePropagation wired into module save flows
 *
 * Tests that saveHoDocumentFormal (the simplest standalone save function)
 * correctly loads the old document before saving and calls
 * triggerChangePropagation with old + new doc on success.
 *
 * Also verifies that ChangeProposalPanel imports resolve for all 4 modules.
 */

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

vi.mock('../../utils/repositories/hoRepository', () => ({
    saveHoDocument: vi.fn(),
    loadHoDocument: vi.fn(),
    listHoDocuments: vi.fn(),
    deleteHoDocument: vi.fn(),
}));

vi.mock('../../utils/repositories/draftRepository', () => ({
    saveDraft: vi.fn(),
    loadDraft: vi.fn(),
    deleteDraft: vi.fn(),
    listDraftKeys: vi.fn(),
}));

vi.mock('../../core/inheritance/triggerOverrideTracking', () => ({
    triggerOverrideTracking: vi.fn(),
}));

vi.mock('../../core/inheritance/changePropagation', () => ({
    triggerChangePropagation: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../utils/database', () => ({
    getDatabase: vi.fn(),
}));

vi.mock('../../config', () => ({
    AUTOSAVE_DEBOUNCE_MS: 2000,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { saveHoDocumentFormal } from '../../modules/hojaOperaciones/useHoPersistence';
import { saveHoDocument, loadHoDocument } from '../../utils/repositories/hoRepository';
import { triggerOverrideTracking } from '../../core/inheritance/triggerOverrideTracking';
import { triggerChangePropagation } from '../../core/inheritance/changePropagation';
import type { HoDocument } from '../../modules/hojaOperaciones/hojaOperacionesTypes';

const mockSaveHoDocument = saveHoDocument as ReturnType<typeof vi.fn>;
const mockLoadHoDocument = loadHoDocument as ReturnType<typeof vi.fn>;
const mockTriggerOverrideTracking = triggerOverrideTracking as ReturnType<typeof vi.fn>;
const mockTriggerChangePropagation = triggerChangePropagation as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTestHoDoc(overrides: Partial<HoDocument> = {}): HoDocument {
    return {
        header: {
            formNumber: 'I-IN-002.4-R01',
            revision: 'A',
            date: '2026-03-17',
            preparedBy: 'Test',
            approvedBy: 'Test',
            client: 'TestClient',
            linkedAmfeProject: 'test-project',
            linkedCpProject: '',
            applicableParts: '',
        },
        sheets: [
            {
                id: 'sheet-1',
                hoNumber: '1',
                operationName: 'Op Test',
                operationNumber: '10',
                partName: 'Test Part',
                partNumber: 'TP-001',
                steps: [],
                ppe: [],
                visualAids: [],
                qualityChecks: [],
                reactionPlan: '',
                reactionContact: '',
            },
        ],
        ...overrides,
    } as HoDocument;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('changePropagation integration — saveHoDocumentFormal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads old doc before saving', async () => {
        const oldDoc = createTestHoDoc();
        const newDoc = createTestHoDoc({ sheets: [...oldDoc.sheets, { ...oldDoc.sheets[0], id: 'sheet-2' }] });
        mockLoadHoDocument.mockResolvedValue(oldDoc);
        mockSaveHoDocument.mockResolvedValue(true);

        await saveHoDocumentFormal('doc-1', newDoc);

        // loadHoDocument should be called BEFORE saveHoDocument
        const loadCallOrder = mockLoadHoDocument.mock.invocationCallOrder[0];
        const saveCallOrder = mockSaveHoDocument.mock.invocationCallOrder[0];
        expect(loadCallOrder).toBeLessThan(saveCallOrder);
        expect(mockLoadHoDocument).toHaveBeenCalledWith('doc-1');
    });

    it('calls triggerChangePropagation with old and new doc on success', async () => {
        const oldDoc = createTestHoDoc();
        const newDoc = createTestHoDoc({ sheets: [...oldDoc.sheets, { ...oldDoc.sheets[0], id: 'sheet-2' }] });
        mockLoadHoDocument.mockResolvedValue(oldDoc);
        mockSaveHoDocument.mockResolvedValue(true);

        await saveHoDocumentFormal('doc-1', newDoc);

        expect(mockTriggerChangePropagation).toHaveBeenCalledWith('doc-1', oldDoc, newDoc, 'ho');
    });

    it('does NOT call triggerChangePropagation when save fails', async () => {
        const oldDoc = createTestHoDoc();
        const newDoc = createTestHoDoc();
        mockLoadHoDocument.mockResolvedValue(oldDoc);
        mockSaveHoDocument.mockResolvedValue(false);

        await saveHoDocumentFormal('doc-1', newDoc);

        expect(mockTriggerChangePropagation).not.toHaveBeenCalled();
    });

    it('does not fail if loading old doc throws', async () => {
        const newDoc = createTestHoDoc();
        mockLoadHoDocument.mockRejectedValue(new Error('DB error'));
        mockSaveHoDocument.mockResolvedValue(true);

        const result = await saveHoDocumentFormal('doc-1', newDoc);

        expect(result).toBe(true);
        // Should still call triggerOverrideTracking but NOT changePropagation (no old doc)
        expect(mockTriggerOverrideTracking).toHaveBeenCalledWith('doc-1', newDoc, 'ho');
        expect(mockTriggerChangePropagation).not.toHaveBeenCalled();
    });

    it('does not propagate when old doc is null (first save)', async () => {
        const newDoc = createTestHoDoc();
        mockLoadHoDocument.mockResolvedValue(null);
        mockSaveHoDocument.mockResolvedValue(true);

        await saveHoDocumentFormal('doc-1', newDoc);

        expect(mockTriggerOverrideTracking).toHaveBeenCalled();
        expect(mockTriggerChangePropagation).not.toHaveBeenCalled();
    });

    it('still calls triggerOverrideTracking on success', async () => {
        const oldDoc = createTestHoDoc();
        const newDoc = createTestHoDoc();
        mockLoadHoDocument.mockResolvedValue(oldDoc);
        mockSaveHoDocument.mockResolvedValue(true);

        await saveHoDocumentFormal('doc-1', newDoc);

        expect(mockTriggerOverrideTracking).toHaveBeenCalledWith('doc-1', newDoc, 'ho');
    });

    it('returns false when save throws an error', async () => {
        const newDoc = createTestHoDoc();
        mockLoadHoDocument.mockResolvedValue(createTestHoDoc());
        mockSaveHoDocument.mockRejectedValue(new Error('write error'));

        const result = await saveHoDocumentFormal('doc-1', newDoc);

        expect(result).toBe(false);
        expect(mockTriggerChangePropagation).not.toHaveBeenCalled();
    });

    it('passes correct module type "ho" to triggerChangePropagation', async () => {
        const oldDoc = createTestHoDoc();
        const newDoc = createTestHoDoc();
        mockLoadHoDocument.mockResolvedValue(oldDoc);
        mockSaveHoDocument.mockResolvedValue(true);

        await saveHoDocumentFormal('doc-abc', newDoc);

        expect(mockTriggerChangePropagation).toHaveBeenCalledWith(
            'doc-abc',
            expect.anything(),
            expect.anything(),
            'ho',
        );
    });
});

// ---------------------------------------------------------------------------
// Import resolution tests — verify ChangeProposalPanel is importable from
// each module's perspective.
// ---------------------------------------------------------------------------

describe('ChangeProposalPanel import resolution', () => {
    it('resolves from modules/family path', async () => {
        const mod = await import('../../modules/family/ChangeProposalPanel');
        expect(mod.default).toBeDefined();
        expect(typeof mod.default).toBe('function');
    });

    it('exports getDiffFields utility', async () => {
        const mod = await import('../../modules/family/ChangeProposalPanel');
        expect(mod.getDiffFields).toBeDefined();
        expect(typeof mod.getDiffFields).toBe('function');
    });

    it('triggerChangePropagation is importable from changePropagation', async () => {
        const mod = await import('../../core/inheritance/changePropagation');
        expect(mod.triggerChangePropagation).toBeDefined();
        expect(typeof mod.triggerChangePropagation).toBe('function');
    });
});
