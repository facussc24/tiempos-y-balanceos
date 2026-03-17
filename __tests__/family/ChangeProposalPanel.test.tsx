/**
 * Tests for ChangeProposalPanel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangeProposalPanel, getDiffFields } from '../../modules/family/ChangeProposalPanel';

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

// Mock toast to verify notifications
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('../../components/ui/Toast', () => ({
    toast: {
        success: (...args: unknown[]) => mockToastSuccess(...args),
        info: (...args: unknown[]) => mockToastInfo(...args),
        error: vi.fn(),
        warning: vi.fn(),
        dismiss: vi.fn(),
        clear: vi.fn(),
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
        oldData: '{"description":"Corte de chapa","material":"acero"}',
        newData: '{"description":"Corte y plegado de chapa","material":"acero"}',
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
// Helper to set up variant with proposals
// ---------------------------------------------------------------------------

function setupVariantWithProposals(proposals = MOCK_PROPOSALS) {
    mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
    mockListPendingProposals.mockResolvedValue(proposals);
    mockResolveProposal.mockResolvedValue(undefined);
}

function setupNoProposals() {
    mockGetDocumentFamilyInfo.mockResolvedValue(VARIANT_FAMILY_INFO);
    mockListPendingProposals.mockResolvedValue([]);
    mockResolveProposal.mockResolvedValue(undefined);
}

// ---------------------------------------------------------------------------
// Tests: getDiffFields helper
// ---------------------------------------------------------------------------

describe('getDiffFields', () => {
    it('returns empty array when both are null', () => {
        expect(getDiffFields(null, null)).toEqual([]);
    });

    it('finds changed fields between old and new JSON', () => {
        const oldData = '{"description":"Corte de chapa","material":"acero"}';
        const newData = '{"description":"Corte y plegado de chapa","material":"acero"}';

        const fields = getDiffFields(oldData, newData);
        expect(fields).toHaveLength(1);
        expect(fields[0].field).toBe('description');
        expect(fields[0].oldValue).toBe('Corte de chapa');
        expect(fields[0].newValue).toBe('Corte y plegado de chapa');
    });

    it('handles new fields (added)', () => {
        const fields = getDiffFields(null, '{"name":"New item"}');
        expect(fields).toHaveLength(1);
        expect(fields[0].field).toBe('name');
        expect(fields[0].oldValue).toBe('');
        expect(fields[0].newValue).toBe('New item');
    });

    it('handles removed fields', () => {
        const fields = getDiffFields('{"name":"Old item"}', null);
        expect(fields).toHaveLength(1);
        expect(fields[0].field).toBe('name');
        expect(fields[0].oldValue).toBe('Old item');
        expect(fields[0].newValue).toBe('');
    });

    it('handles invalid JSON gracefully', () => {
        const fields = getDiffFields('not json', '{"key":"val"}');
        // "not json" becomes { value: "not json" }, other has { key: "val" }
        expect(fields.length).toBeGreaterThanOrEqual(1);
    });
});

// ---------------------------------------------------------------------------
// Tests: ChangeProposalPanel Component
// ---------------------------------------------------------------------------

describe('ChangeProposalPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockToastSuccess.mockClear();
        mockToastInfo.mockClear();
    });

    it('shows empty state when there are no proposals', async () => {
        setupNoProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        // Click header to expand (empty state collapses by default)
        const header = screen.getByTestId('change-proposal-header');
        fireEvent.click(header);

        await waitFor(() => {
            expect(screen.getByTestId('empty-state')).toBeDefined();
        });

        expect(screen.getByText('Sin cambios pendientes del maestro')).toBeDefined();
    });

    it('renders proposal cards with correct change type badges', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByText('Modificado')).toBeDefined();
        });

        expect(screen.getByText('Agregado')).toBeDefined();
        expect(screen.getByText('Eliminado')).toBeDefined();
    });

    it('shows pending count badge in header', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByText(/3 pendientes/)).toBeDefined();
        });
    });

    it('shows diff preview for modified items', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByText('Modificado')).toBeDefined();
        });

        // The diff should show the changed field
        expect(screen.getByText('Campo: description')).toBeDefined();
    });

    it('accept button calls acceptProposal and shows toast', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByTestId('accept-btn-100')).toBeDefined();
        });

        // After clicking accept, update mock to return fewer proposals
        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS.slice(1));

        fireEvent.click(screen.getByTestId('accept-btn-100'));

        await waitFor(() => {
            expect(mockResolveProposal).toHaveBeenCalledWith(100, 'accepted', 'user');
        });

        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Propuesta aceptada',
                'El cambio del maestro fue aplicado'
            );
        });
    });

    it('reject button calls rejectProposal and shows toast', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByTestId('reject-btn-101')).toBeDefined();
        });

        mockListPendingProposals.mockResolvedValue([MOCK_PROPOSALS[0], MOCK_PROPOSALS[2]]);

        fireEvent.click(screen.getByTestId('reject-btn-101'));

        await waitFor(() => {
            expect(mockResolveProposal).toHaveBeenCalledWith(101, 'rejected', 'user');
        });

        await waitFor(() => {
            expect(mockToastInfo).toHaveBeenCalledWith(
                'Propuesta rechazada',
                'El cambio del maestro fue rechazado'
            );
        });
    });

    it('accept all button accepts all proposals', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByTestId('accept-all-btn')).toBeDefined();
        });

        mockListPendingProposals.mockResolvedValue([]);

        fireEvent.click(screen.getByTestId('accept-all-btn'));

        await waitFor(() => {
            expect(mockResolveProposal).toHaveBeenCalledTimes(3);
        });

        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith(
                'Todas las propuestas aceptadas',
                'Se aplicaron 3 cambios del maestro'
            );
        });
    });

    it('collapsible header toggles content visibility', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        // Wait for proposals to load - panel auto-expands when proposals exist
        await waitFor(() => {
            expect(screen.getByText('Modificado')).toBeDefined();
        });

        // Click header to collapse
        const header = screen.getByTestId('change-proposal-header');
        fireEvent.click(header);

        // Content should be hidden
        expect(screen.queryByText('Modificado')).toBeNull();

        // Click again to expand
        fireEvent.click(header);

        await waitFor(() => {
            expect(screen.getByText('Modificado')).toBeDefined();
        });
    });

    it('loading state shows spinner', async () => {
        // Make the load hang
        mockGetDocumentFamilyInfo.mockImplementation(
            () => new Promise(() => {}) // never resolves
        );

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        // Click header to expand while loading
        const header = screen.getByTestId('change-proposal-header');
        fireEvent.click(header);

        await waitFor(() => {
            expect(screen.getByText('Cargando propuestas...')).toBeDefined();
        });
    });

    it('calls onProposalsChanged callback after accepting a proposal', async () => {
        setupVariantWithProposals();
        const onChanged = vi.fn();

        render(
            <ChangeProposalPanel documentId="doc-variant-1" onProposalsChanged={onChanged} />
        );

        await waitFor(() => {
            expect(screen.getByTestId('accept-btn-100')).toBeDefined();
        });

        mockListPendingProposals.mockResolvedValue(MOCK_PROPOSALS.slice(1));

        fireEvent.click(screen.getByTestId('accept-btn-100'));

        await waitFor(() => {
            expect(onChanged).toHaveBeenCalled();
        });
    });

    it('shows item type for each proposal', async () => {
        setupVariantWithProposals();

        render(<ChangeProposalPanel documentId="doc-variant-1" />);

        await waitFor(() => {
            expect(screen.getByText('pfd_step')).toBeDefined();
        });

        expect(screen.getByText('amfe_operation')).toBeDefined();
        expect(screen.getByText('cp_item')).toBeDefined();
    });
});
