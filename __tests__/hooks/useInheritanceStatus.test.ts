/**
 * Tests for useInheritanceStatus hook
 *
 * Verifies:
 * - Returns null statusMap for null documentId
 * - Returns null statusMap for master documents
 * - Correctly classifies items as inherited/modified/own based on overrides
 * - Handles removed items
 * - Loading and error states
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useInheritanceStatus, getItemInheritanceStatus } from '../../hooks/useInheritanceStatus';

// Mock the family document repository
const mockGetDocumentFamilyInfo = vi.fn();
const mockListOverrides = vi.fn();

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    getDocumentFamilyInfo: (...args: unknown[]) => mockGetDocumentFamilyInfo(...args),
    listOverrides: (...args: unknown[]) => mockListOverrides(...args),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('useInheritanceStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null statusMap when documentId is null', async () => {
        const { result } = renderHook(() => useInheritanceStatus(null, ['item-1', 'item-2']));

        expect(result.current.statusMap).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('returns null statusMap when documentId is empty string', async () => {
        const { result } = renderHook(() => useInheritanceStatus('', ['item-1']));

        expect(result.current.statusMap).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('returns null statusMap for master documents', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValueOnce({
            id: 1,
            familyId: 10,
            module: 'amfe',
            documentId: 'doc-123',
            isMaster: true,
            sourceMasterId: null,
            productId: null,
            createdAt: '2026-01-01T00:00:00Z',
        });

        const { result } = renderHook(() =>
            useInheritanceStatus('doc-123', ['item-1', 'item-2']),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.statusMap).toBeNull();
        expect(mockListOverrides).not.toHaveBeenCalled();
    });

    it('returns null statusMap for unlinked documents', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValueOnce(null);

        const { result } = renderHook(() =>
            useInheritanceStatus('doc-456', ['item-1']),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.statusMap).toBeNull();
    });

    it('classifies items correctly for a variant document', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValueOnce({
            id: 5,
            familyId: 10,
            module: 'amfe',
            documentId: 'variant-doc',
            isMaster: false,
            sourceMasterId: 1,
            productId: 2,
            createdAt: '2026-01-01T00:00:00Z',
        });

        mockListOverrides.mockResolvedValueOnce([
            { id: 100, familyDocId: 5, itemType: 'operation', itemId: 'item-2', overrideType: 'modified', overrideData: null, createdAt: '2026-01-01T00:00:00Z' },
            { id: 101, familyDocId: 5, itemType: 'operation', itemId: 'item-3', overrideType: 'added', overrideData: null, createdAt: '2026-01-01T00:00:00Z' },
            { id: 102, familyDocId: 5, itemType: 'operation', itemId: 'item-4', overrideType: 'removed', overrideData: null, createdAt: '2026-01-01T00:00:00Z' },
        ]);

        const { result } = renderHook(() =>
            useInheritanceStatus('variant-doc', ['item-1', 'item-2', 'item-3']),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.statusMap).not.toBeNull();
        expect(result.current.statusMap!.isVariant).toBe(true);
        expect(result.current.statusMap!.familyDocId).toBe(5);

        // item-1: no override → inherited
        expect(result.current.statusMap!.items.get('item-1')).toBe('inherited');

        // item-2: modified override
        expect(result.current.statusMap!.items.get('item-2')).toBe('modified');

        // item-3: added override → own
        expect(result.current.statusMap!.items.get('item-3')).toBe('own');

        // item-4: removed → in removedItems set
        expect(result.current.statusMap!.removedItems.has('item-4')).toBe(true);
    });

    it('handles rejected overrides as removed', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValueOnce({
            id: 5,
            familyId: 10,
            module: 'pfd',
            documentId: 'variant-pfd',
            isMaster: false,
            sourceMasterId: 1,
            productId: null,
            createdAt: '2026-01-01T00:00:00Z',
        });

        mockListOverrides.mockResolvedValueOnce([
            { id: 200, familyDocId: 5, itemType: 'step', itemId: 'step-X', overrideType: 'rejected', overrideData: null, createdAt: '2026-01-01T00:00:00Z' },
        ]);

        const { result } = renderHook(() =>
            useInheritanceStatus('variant-pfd', ['step-A', 'step-X']),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.statusMap).not.toBeNull();
        expect(result.current.statusMap!.removedItems.has('step-X')).toBe(true);
    });

    it('handles errors gracefully', async () => {
        mockGetDocumentFamilyInfo.mockRejectedValueOnce(new Error('DB connection failed'));

        const { result } = renderHook(() =>
            useInheritanceStatus('doc-err', ['item-1']),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.statusMap).toBeNull();
        expect(result.current.error).toBe('DB connection failed');
    });

    it('shows loading state while fetching', async () => {
        let resolvePromise: (value: unknown) => void;
        const promise = new Promise((resolve) => { resolvePromise = resolve; });
        mockGetDocumentFamilyInfo.mockReturnValueOnce(promise);

        const { result } = renderHook(() =>
            useInheritanceStatus('doc-loading', ['item-1']),
        );

        // Should be loading
        expect(result.current.loading).toBe(true);

        // Resolve the promise
        await act(async () => {
            resolvePromise!(null);
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });
    });

    it('refresh function triggers re-fetch', async () => {
        mockGetDocumentFamilyInfo.mockResolvedValue(null);

        const { result } = renderHook(() =>
            useInheritanceStatus('doc-refresh', ['item-1']),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockGetDocumentFamilyInfo).toHaveBeenCalledTimes(1);

        // Trigger refresh
        act(() => {
            result.current.refresh();
        });

        await waitFor(() => {
            expect(mockGetDocumentFamilyInfo).toHaveBeenCalledTimes(2);
        });
    });
});

describe('getItemInheritanceStatus', () => {
    it('returns null when statusMap is null', () => {
        expect(getItemInheritanceStatus(null, 'item-1')).toBeNull();
    });

    it('returns the correct status for a known item', () => {
        const statusMap = {
            items: new Map([
                ['item-1', 'inherited' as const],
                ['item-2', 'modified' as const],
                ['item-3', 'own' as const],
            ]),
            removedItems: new Set<string>(),
            familyDocId: 5,
            isVariant: true as const,
        };

        expect(getItemInheritanceStatus(statusMap, 'item-1')).toBe('inherited');
        expect(getItemInheritanceStatus(statusMap, 'item-2')).toBe('modified');
        expect(getItemInheritanceStatus(statusMap, 'item-3')).toBe('own');
    });

    it('returns "inherited" for unknown items (default)', () => {
        const statusMap = {
            items: new Map<string, 'inherited' | 'modified' | 'own'>(),
            removedItems: new Set<string>(),
            familyDocId: 5,
            isVariant: true as const,
        };

        expect(getItemInheritanceStatus(statusMap, 'unknown-item')).toBe('inherited');
    });
});
