/**
 * Tests for HO Formal Persistence (hoRepository delegation)
 *
 * Verifies that useHoPersistence formal methods correctly delegate
 * to hoRepository CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must be declared before imports
// ============================================================================

const mockSaveHoDocument = vi.fn().mockResolvedValue(true);
const mockLoadHoDocument = vi.fn().mockResolvedValue(null);
const mockListHoDocuments = vi.fn().mockResolvedValue([]);
const mockDeleteHoDocument = vi.fn().mockResolvedValue(true);

vi.mock('../../../utils/repositories/hoRepository', () => ({
    saveHoDocument: (...args: unknown[]) => mockSaveHoDocument(...args),
    loadHoDocument: (...args: unknown[]) => mockLoadHoDocument(...args),
    listHoDocuments: (...args: unknown[]) => mockListHoDocuments(...args),
    deleteHoDocument: (...args: unknown[]) => mockDeleteHoDocument(...args),
}));

vi.mock('../../../utils/repositories/draftRepository', () => ({
    saveDraft: vi.fn().mockResolvedValue(undefined),
    loadDraft: vi.fn().mockResolvedValue(null),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    listDraftKeys: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/logger', () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/crypto', () => ({
    generateChecksum: vi.fn().mockResolvedValue('mock-checksum'),
}));

// Import after mocks
import {
    saveHoDocumentFormal,
    loadHoDocumentFormal,
    listHoDocumentsFormal,
    deleteHoDocumentFormal,
    deleteHoUnsavedDraft,
} from '../../../modules/hojaOperaciones/useHoPersistence';
import type { HoDocument } from '../../../modules/hojaOperaciones/hojaOperacionesTypes';
import { EMPTY_HO_HEADER } from '../../../modules/hojaOperaciones/hojaOperacionesTypes';
import { deleteDraft } from '../../../utils/repositories/draftRepository';

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_DOC: HoDocument = {
    header: { ...EMPTY_HO_HEADER, organization: 'TestOrg', linkedAmfeProject: 'proj-1' },
    sheets: [],
};

const MOCK_DOC_WITH_SHEETS: HoDocument = {
    header: { ...EMPTY_HO_HEADER, organization: 'TestOrg', linkedAmfeProject: 'proj-1' },
    sheets: [{
        id: 'sheet-1',
        amfeOperationId: 'op-1',
        operationNumber: '10',
        operationName: 'Test Op',
        hoNumber: 'HO-10',
        sector: '',
        puestoNumber: '',
        vehicleModel: '',
        partCodeDescription: '',
        safetyElements: [],
        hazardWarnings: [],
        steps: [],
        qualityChecks: [],
        reactionPlanText: '',
        reactionContact: '',
        visualAids: [],
        preparedBy: '',
        approvedBy: '',
        date: '2026-01-01',
        revision: 'A',
        status: 'borrador',
    }],
};

const MOCK_LIST_ITEMS = [
    {
        id: 'doc-1',
        form_number: 'I-IN-002.4-R01',
        organization: 'TestOrg',
        client: 'ClientA',
        part_number: 'PN-001',
        part_description: 'Test Part',
        linked_amfe_project: 'proj-1',
        linked_cp_project: '',
        sheet_count: 2,
        created_at: '2026-01-01',
        updated_at: '2026-01-15',
    },
    {
        id: 'doc-2',
        form_number: 'I-IN-002.4-R01',
        organization: 'TestOrg',
        client: 'ClientB',
        part_number: 'PN-002',
        part_description: 'Test Part 2',
        linked_amfe_project: 'proj-2',
        linked_cp_project: '',
        sheet_count: 1,
        created_at: '2026-01-05',
        updated_at: '2026-01-20',
    },
];

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
});

describe('saveHoDocumentFormal', () => {
    it('delegates to hoRepository.saveHoDocument and returns true on success', async () => {
        mockSaveHoDocument.mockResolvedValueOnce(true);

        const result = await saveHoDocumentFormal('doc-1', MOCK_DOC);

        expect(result).toBe(true);
        expect(mockSaveHoDocument).toHaveBeenCalledOnce();
        expect(mockSaveHoDocument).toHaveBeenCalledWith('doc-1', MOCK_DOC);
    });

    it('returns false when hoRepository.saveHoDocument fails', async () => {
        mockSaveHoDocument.mockResolvedValueOnce(false);

        const result = await saveHoDocumentFormal('doc-1', MOCK_DOC);

        expect(result).toBe(false);
        expect(mockSaveHoDocument).toHaveBeenCalledOnce();
    });

    it('returns false and logs error on exception', async () => {
        mockSaveHoDocument.mockRejectedValueOnce(new Error('DB error'));

        const result = await saveHoDocumentFormal('doc-1', MOCK_DOC);

        expect(result).toBe(false);
    });
});

describe('loadHoDocumentFormal', () => {
    it('delegates to hoRepository.loadHoDocument and returns normalized document', async () => {
        mockLoadHoDocument.mockResolvedValueOnce(MOCK_DOC_WITH_SHEETS);

        const result = await loadHoDocumentFormal('doc-1');

        expect(result).not.toBeNull();
        expect(result?.header.organization).toBe('TestOrg');
        expect(result?.sheets).toHaveLength(1);
        expect(result?.sheets[0].operationName).toBe('Test Op');
        expect(mockLoadHoDocument).toHaveBeenCalledOnce();
        expect(mockLoadHoDocument).toHaveBeenCalledWith('doc-1');
    });

    it('returns null for nonexistent document', async () => {
        mockLoadHoDocument.mockResolvedValueOnce(null);

        const result = await loadHoDocumentFormal('nonexistent-id');

        expect(result).toBeNull();
        expect(mockLoadHoDocument).toHaveBeenCalledWith('nonexistent-id');
    });

    it('returns null and logs error on exception', async () => {
        mockLoadHoDocument.mockRejectedValueOnce(new Error('DB error'));

        const result = await loadHoDocumentFormal('doc-1');

        expect(result).toBeNull();
    });
});

describe('listHoDocumentsFormal', () => {
    it('delegates to hoRepository.listHoDocuments and returns the list', async () => {
        mockListHoDocuments.mockResolvedValueOnce(MOCK_LIST_ITEMS);

        const result = await listHoDocumentsFormal();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('doc-1');
        expect(result[1].id).toBe('doc-2');
        expect(mockListHoDocuments).toHaveBeenCalledOnce();
    });

    it('returns empty array when no documents exist', async () => {
        mockListHoDocuments.mockResolvedValueOnce([]);

        const result = await listHoDocumentsFormal();

        expect(result).toEqual([]);
    });

    it('returns empty array on exception', async () => {
        mockListHoDocuments.mockRejectedValueOnce(new Error('DB error'));

        const result = await listHoDocumentsFormal();

        expect(result).toEqual([]);
    });
});

describe('deleteHoDocumentFormal', () => {
    it('delegates to hoRepository.deleteHoDocument and returns true on success', async () => {
        mockDeleteHoDocument.mockResolvedValueOnce(true);

        const result = await deleteHoDocumentFormal('doc-1');

        expect(result).toBe(true);
        expect(mockDeleteHoDocument).toHaveBeenCalledOnce();
        expect(mockDeleteHoDocument).toHaveBeenCalledWith('doc-1');
    });

    it('returns false when hoRepository.deleteHoDocument fails', async () => {
        mockDeleteHoDocument.mockResolvedValueOnce(false);

        const result = await deleteHoDocumentFormal('doc-1');

        expect(result).toBe(false);
    });

    it('returns false on exception', async () => {
        mockDeleteHoDocument.mockRejectedValueOnce(new Error('DB error'));

        const result = await deleteHoDocumentFormal('doc-1');

        expect(result).toBe(false);
    });
});

describe('deleteHoUnsavedDraft', () => {
    it('delegates to draftRepository.deleteDraft with ho module', async () => {
        await deleteHoUnsavedDraft('ho_draft_proj-1');

        expect(deleteDraft).toHaveBeenCalledWith('ho', 'ho_draft_proj-1');
    });

    it('does not throw when deleteDraft fails', async () => {
        (deleteDraft as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

        await expect(deleteHoUnsavedDraft('ho_draft_proj-1')).resolves.toBeUndefined();
    });
});
