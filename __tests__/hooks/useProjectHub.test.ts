/**
 * Tests for useProjectHub hook
 *
 * Verifies:
 * - Returns correct structure with families, members, and document statuses
 * - Empty state (no families)
 * - Mixed document status (some modules present, some missing)
 * - Loading and error states
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useProjectHub } from '../../hooks/useProjectHub';

// Mock repositories
const mockListFamilies = vi.fn();
const mockGetFamilyMembers = vi.fn();
const mockListFamilyDocuments = vi.fn();
const mockGetPendingProposalCount = vi.fn();
const mockListAmfeDocuments = vi.fn();
const mockListCpDocuments = vi.fn();
const mockLoadAmfeDocument = vi.fn();

vi.mock('../../utils/repositories/familyRepository', () => ({
    listFamilies: (...args: unknown[]) => mockListFamilies(...args),
    getFamilyMembers: (...args: unknown[]) => mockGetFamilyMembers(...args),
}));

vi.mock('../../utils/repositories/familyDocumentRepository', () => ({
    listFamilyDocuments: (...args: unknown[]) => mockListFamilyDocuments(...args),
    getPendingProposalCount: (...args: unknown[]) => mockGetPendingProposalCount(...args),
}));

vi.mock('../../utils/repositories/amfeRepository', () => ({
    listAmfeDocuments: (...args: unknown[]) => mockListAmfeDocuments(...args),
    loadAmfeDocument: (...args: unknown[]) => mockLoadAmfeDocument(...args),
}));

vi.mock('../../utils/repositories/cpRepository', () => ({
    listCpDocuments: (...args: unknown[]) => mockListCpDocuments(...args),
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FAMILY_1 = {
    id: 1,
    name: 'Insert',
    description: 'Insert family',
    lineaCode: 'VWA',
    lineaName: 'VWA',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    memberCount: 2,
};

const FAMILY_2 = {
    id: 2,
    name: 'Top Roll',
    description: 'Top Roll family',
    lineaCode: 'VWA',
    lineaName: 'VWA',
    active: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    memberCount: 1,
};

const MEMBERS_FAMILY_1 = [
    {
        id: 1,
        familyId: 1,
        productId: 10,
        isPrimary: true,
        addedAt: '2026-01-01',
        codigo: 'PAT-INS-001',
        descripcion: 'Insert L0',
        lineaCode: 'VWA',
        lineaName: 'VWA',
    },
    {
        id: 2,
        familyId: 1,
        productId: 11,
        isPrimary: false,
        addedAt: '2026-01-01',
        codigo: 'PAT-INS-002',
        descripcion: 'Insert L1',
        lineaCode: 'VWA',
        lineaName: 'VWA',
    },
];

const MEMBERS_FAMILY_2 = [
    {
        id: 3,
        familyId: 2,
        productId: 20,
        isPrimary: true,
        addedAt: '2026-01-01',
        codigo: 'PAT-TR-001',
        descripcion: 'Top Roll',
        lineaCode: 'VWA',
        lineaName: 'VWA',
    },
];

const DOCS_FAMILY_1 = [
    { id: 1, familyId: 1, module: 'pfd', documentId: 'doc-pfd-1', isMaster: true, sourceMasterId: null, productId: null, createdAt: '2026-01-01' },
    { id: 2, familyId: 1, module: 'amfe', documentId: 'doc-amfe-1', isMaster: true, sourceMasterId: null, productId: null, createdAt: '2026-01-01' },
    { id: 3, familyId: 1, module: 'controlPlan', documentId: 'doc-cp-1', isMaster: true, sourceMasterId: null, productId: null, createdAt: '2026-01-01' },
    { id: 4, familyId: 1, module: 'hojaOperaciones', documentId: 'doc-ho-1', isMaster: true, sourceMasterId: null, productId: null, createdAt: '2026-01-01' },
];

// Family 2 only has amfe and controlPlan
const DOCS_FAMILY_2 = [
    { id: 5, familyId: 2, module: 'amfe', documentId: 'doc-amfe-2', isMaster: true, sourceMasterId: null, productId: null, createdAt: '2026-01-01' },
    { id: 6, familyId: 2, module: 'controlPlan', documentId: 'doc-cp-2', isMaster: true, sourceMasterId: null, productId: null, createdAt: '2026-01-01' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProjectHub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListAmfeDocuments.mockResolvedValue([]);
        mockListCpDocuments.mockResolvedValue([]);
        mockGetPendingProposalCount.mockResolvedValue(0);
        mockLoadAmfeDocument.mockResolvedValue(null);
    });

    it('returns correct structure with families and document statuses', async () => {
        mockListFamilies.mockResolvedValueOnce([FAMILY_1, FAMILY_2]);
        mockGetFamilyMembers
            .mockResolvedValueOnce(MEMBERS_FAMILY_1)
            .mockResolvedValueOnce(MEMBERS_FAMILY_2);
        mockListFamilyDocuments
            .mockResolvedValueOnce(DOCS_FAMILY_1)
            .mockResolvedValueOnce(DOCS_FAMILY_2);

        // AMFE docs matching family document IDs
        mockListAmfeDocuments.mockResolvedValue([
            { id: 'doc-amfe-1', apHCount: 2, causeCount: 10 },
            { id: 'doc-amfe-2', apHCount: 1, causeCount: 4 },
        ]);

        // CP docs matching family document IDs
        mockListCpDocuments.mockResolvedValue([
            { id: 'doc-cp-1', item_count: 5 },
            { id: 'doc-cp-2', item_count: 3 },
        ]);

        const { result } = renderHook(() => useProjectHub());

        // Initially loading
        expect(result.current.loading).toBe(true);
        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBeNull();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Should have 2 projects
        expect(result.current.projects).toHaveLength(2);

        // Family 1: all 4 docs present
        const project1 = result.current.projects[0];
        expect(project1.family.id).toBe(1);
        expect(project1.family.name).toBe('Insert');
        expect(project1.members).toHaveLength(2);
        expect(project1.documents).toEqual({
            pfd: 'complete',
            amfe: 'complete',
            controlPlan: 'complete',
            hojaOperaciones: 'complete',
        });
        expect(project1.kpis).toMatchObject({ apHCount: 2, causeCount: 10, cpItemCount: 5 });

        // Family 2: only amfe + controlPlan
        const project2 = result.current.projects[1];
        expect(project2.family.id).toBe(2);
        expect(project2.family.name).toBe('Top Roll');
        expect(project2.members).toHaveLength(1);
        expect(project2.documents).toEqual({
            pfd: 'missing',
            amfe: 'complete',
            controlPlan: 'complete',
            hojaOperaciones: 'missing',
        });
        expect(project2.kpis).toMatchObject({ apHCount: 1, causeCount: 4, cpItemCount: 3 });
    });

    it('returns empty projects when no families exist', async () => {
        mockListFamilies.mockResolvedValueOnce([]);

        const { result } = renderHook(() => useProjectHub());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBeNull();
        // Should not have called getFamilyMembers or listFamilyDocuments
        expect(mockGetFamilyMembers).not.toHaveBeenCalled();
        expect(mockListFamilyDocuments).not.toHaveBeenCalled();
    });

    it('returns all missing statuses when family has no linked documents', async () => {
        mockListFamilies.mockResolvedValueOnce([FAMILY_1]);
        mockGetFamilyMembers.mockResolvedValueOnce(MEMBERS_FAMILY_1);
        mockListFamilyDocuments.mockResolvedValueOnce([]); // no docs

        const { result } = renderHook(() => useProjectHub());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toHaveLength(1);
        expect(result.current.projects[0].documents).toEqual({
            pfd: 'missing',
            amfe: 'missing',
            controlPlan: 'missing',
            hojaOperaciones: 'missing',
        });
        expect(result.current.projects[0].kpis).toMatchObject({ apHCount: 0, causeCount: 0, cpItemCount: 0 });
    });

    it('handles error from listFamilies gracefully', async () => {
        mockListFamilies.mockRejectedValueOnce(new Error('Database connection failed'));

        const { result } = renderHook(() => useProjectHub());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBe('Database connection failed');
    });

    it('passes activeOnly option to listFamilies', async () => {
        mockListFamilies.mockResolvedValueOnce([]);

        const { result } = renderHook(() => useProjectHub());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockListFamilies).toHaveBeenCalledWith({ activeOnly: true });
    });

    it('exposes a refresh function that re-fetches data', async () => {
        mockListFamilies
            .mockResolvedValueOnce([FAMILY_1])
            .mockResolvedValueOnce([FAMILY_1, FAMILY_2]);
        mockGetFamilyMembers
            .mockResolvedValueOnce(MEMBERS_FAMILY_1)
            .mockResolvedValueOnce(MEMBERS_FAMILY_1)
            .mockResolvedValueOnce(MEMBERS_FAMILY_2);
        mockListFamilyDocuments
            .mockResolvedValueOnce(DOCS_FAMILY_1)
            .mockResolvedValueOnce(DOCS_FAMILY_1)
            .mockResolvedValueOnce(DOCS_FAMILY_2);

        const { result } = renderHook(() => useProjectHub());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toHaveLength(1);

        // Trigger refresh
        result.current.refresh();

        await waitFor(() => {
            expect(result.current.projects).toHaveLength(2);
        });
    });

    it('extracts primary member info correctly', async () => {
        mockListFamilies.mockResolvedValueOnce([FAMILY_1]);
        mockGetFamilyMembers.mockResolvedValueOnce(MEMBERS_FAMILY_1);
        mockListFamilyDocuments.mockResolvedValueOnce([]);

        const { result } = renderHook(() => useProjectHub());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        const primary = result.current.projects[0].members.find(m => m.isPrimary);
        expect(primary).toBeDefined();
        expect(primary?.codigo).toBe('PAT-INS-001');
        expect(primary?.lineaName).toBe('VWA');
    });
});
