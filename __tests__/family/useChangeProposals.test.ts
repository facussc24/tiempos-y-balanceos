/**
 * Tests for useChangeProposals hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useChangeProposals } from '../../modules/family/hooks/useChangeProposals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    getDocumentFamilyInfo: vi.fn(),
    listPendingProposals: vi.fn(),
    resolveProposal: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import {
    getDocumentFamilyInfo,
    listPendingProposals,
    resolveProposal,
} from '../../utils/repositories/familyDocumentRepository';

const mockGetDocumentFamilyInfo = getDocumentFamilyInfo as ReturnType<typeof vi.fn>;
const mockListPendingProposals = listPendingProposals as ReturnType<typeof vi.fn>;
const mockResolveProposal = resolveProposal as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VARIANT_FAMILY_INFO = {
    id: 10,
    familyId: 1,
    module: 'amfe',
    documentId: 'doc-variant-1',
    isMaster: false,
    sourceMasterId: 5,
    productId: null,
    createdAt: '2026-01-01',
};

const MASTER_FAMILY_INFO = {
    id: 5,
    familyId: 1,
    module: 'amfe',
    documentId: 'doc-master-1',
    isMaster: true,
    sourceMasterId: null,
    productId: null,
    createdAt: '2026-01-01',
};

const MOCK_PROPOSALS = [
    {
        id: 100,
        familyId: 1,
        module: 'amfe',
        masterDocId: 'doc-master-1',
        targetFamilyDocId: 10,
        changeType: 'modified',
        itemType: 'pfd_step',
        itemId: 'step-1',
        oldData: '{"description":"Corte de chapa"}',
        newData: '{"description":"Corte y plegado de chapa"}',
        status: 'pending',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-03-15',
    },
    {
        id: 101,
        familyId: 1,
        module: 'amfe',
        masterDocId: 'doc-master-1',
        targetFamilyDocId: 10,
        changeType: 'added',
        itemType: 'amfe_operation',
        itemId: 'op-new',
        oldData: null,
        newData: '{"name":"New operation"}',
        status: 'pending',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-03-15',
    },
    {
        id: 102,
        familyId: 1,
        module: 'amfe',
        masterDocId: 'doc-master-1',
        targetFamilyDocId: 10,
        changeType: 'removed',
        itemType: 'cp_item',
        itemId: 'item-old',
        oldData: '{"name":"Old item"}',
        newData: null,
        status: 'pending',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-03-15',
    },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChangeProposals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveProposal.mockResolvedValue(undefined);
    });

    it('returns empty state when documentId is null', async () => {
        const { result } = renderHook(() => useChangeProposals(null));

        expect(result.current.proposals).toEqual([]);
        expect(result.current.pendingCount).toBe(0);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(mockGetDocumentFamilyInfo).not.toHaveBeenCalled();
    });

    it('returns empty state for master documents', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(MASTER_FAMILY_INFO);

        const { result } = renderHook(() => useChangeProposals('doc-master-1'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.proposals).toEqual([]);
        expect(result.current.pendingCount).toBe(0);
        expect(mockListPendingProposals).not.toHaveBeenCalled();
    });

    it('returns empty state for documents not linked to a family', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(null);

        const { result } = renderHook(() => useChangeProposals('doc-unlinked'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.proposals).toEqual([]);
        expect(result.current.pendingCount).toBe(0);
    });

    it('loads proposals for variant documents', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS);

        const { result } = renderHook(() => useChangeProposals('doc-variant-1'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockGetDocumentFamilyInfo).toHaveBeenCalledWith('doc-variant-1');
        expect(mockListPendingProposals).toHaveBeenCalledWith(10);
        expect(result.current.proposals).toHaveLength(3);
        expect(result.current.pendingCount).toBe(3);
    });

    it('acceptProposal calls resolveProposal with accepted status and refreshes', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS);

        const { result } = renderHook(() => useChangeProposals('doc-variant-1'));

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(3);
        });

        // After accept, list will return 2 proposals
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS.slice(1));

        await act(async () => {
            await result.current.acceptProposal(100);
        });

        expect(mockResolveProposal).toHaveBeenCalledWith(100, 'accepted', 'user');

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(2);
        });
    });

    it('rejectProposal calls resolveProposal with rejected status and refreshes', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS);

        const { result } = renderHook(() => useChangeProposals('doc-variant-1'));

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(3);
        });

        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS.slice(1));

        await act(async () => {
            await result.current.rejectProposal(100);
        });

        expect(mockResolveProposal).toHaveBeenCalledWith(100, 'rejected', 'user');

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(2);
        });
    });

    it('acceptAll accepts all pending proposals and refreshes', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS);

        const { result } = renderHook(() => useChangeProposals('doc-variant-1'));

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(3);
        });

        mockListPendingProposals.mockResolvedValue([]);

        await act(async () => {
            await result.current.acceptAll();
        });

        expect(mockResolveProposal).toHaveBeenCalledTimes(3);
        expect(mockResolveProposal).toHaveBeenCalledWith(100, 'accepted', 'user');
        expect(mockResolveProposal).toHaveBeenCalledWith(101, 'accepted', 'user');
        expect(mockResolveProposal).toHaveBeenCalledWith(102, 'accepted', 'user');

        await waitFor(() => {
            expect(result.current.pendingCount).toBe(0);
        });
    });

    it('sets error when loading fails', async () => {
        mockGetDocumentFamilyInfo.mockRejectedValue(new Error('DB connection failed'));

        const { result } = renderHook(() => useChangeProposals('doc-variant-1'));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('DB connection failed');
        expect(result.current.proposals).toEqual([]);
    });

    it('reloads proposals when documentId changes', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS);

        const { result, rerender } = renderHook(
            ({ docId }) => useChangeProposals(docId),
            { initialProps: { docId: 'doc-variant-1' as string | null } }
        );

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(3);
        });

        // Change documentId to null
        rerender({ docId: null });

        expect(result.current.proposals).toEqual([]);
        expect(result.current.pendingCount).toBe(0);
    });

    it('sets error when acceptProposal fails', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS);

        const { result } = renderHook(() => useChangeProposals('doc-variant-1'));

        await waitFor(() => {
            expect(result.current.proposals).toHaveLength(3);
        });

        mockResolveProposal.mockRejectedValueOnce(new Error('Accept failed'));

        await act(async () => {
            await result.current.acceptProposal(100);
        });

        expect(result.current.error).toBe('Accept failed');
    });
});
