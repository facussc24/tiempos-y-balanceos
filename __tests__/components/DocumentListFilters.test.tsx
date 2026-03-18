/**
 * Tests for DocumentListFilters component
 *
 * Verifies client filter, project/family filter, search filter,
 * clear button, and handling of empty document arrays.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import DocumentListFilters from '../../components/ui/DocumentListFilters';
import type { DocumentRegistryEntry } from '../../modules/registry/documentRegistryTypes';

// Sample documents for testing
const SAMPLE_DOCS: DocumentRegistryEntry[] = [
    {
        id: 'doc-1',
        type: 'amfe',
        name: 'Insert',
        partNumber: 'BRK-INS-001',
        partName: 'Insert Headrest',
        client: 'VWA',
        responsible: 'Ing. Martinez',
        itemCount: 5,
        updatedAt: '2026-03-01T10:00:00Z',
        linkedAmfeProject: 'Insert',
    },
    {
        id: 'doc-2',
        type: 'controlPlan',
        name: 'Headrest Front - CP',
        partNumber: 'BRK-HF-002',
        partName: 'Headrest Front',
        client: 'VWA',
        responsible: 'Ing. Lopez',
        itemCount: 8,
        updatedAt: '2026-03-02T10:00:00Z',
        linkedAmfeProject: 'Headrest Front',
    },
    {
        id: 'doc-3',
        type: 'pfd',
        name: 'Telas Planas - PFD',
        partNumber: 'BRK-TP-003',
        partName: 'Telas Planas',
        client: 'PWA',
        responsible: 'Ing. Garcia',
        itemCount: 12,
        updatedAt: '2026-03-03T10:00:00Z',
    },
    {
        id: 'doc-4',
        type: 'hojaOperaciones',
        name: 'Insert - OP10',
        partNumber: 'BRK-INS-001',
        partName: 'Insert Headrest',
        client: 'VWA',
        responsible: '',
        itemCount: 3,
        updatedAt: '2026-03-04T10:00:00Z',
        linkedAmfeProject: 'Insert',
    },
    {
        id: 'doc-5',
        type: 'amfe',
        name: 'Telas Termoformadas',
        partNumber: 'BRK-TT-004',
        partName: 'Telas Termoformadas',
        client: 'PWA',
        responsible: 'Ing. Fernandez',
        itemCount: 4,
        updatedAt: '2026-03-05T10:00:00Z',
    },
];

describe('DocumentListFilters', () => {
    let onFilteredChange: ReturnType<typeof vi.fn<(filtered: DocumentRegistryEntry[]) => void>>;

    beforeEach(() => {
        vi.clearAllMocks();
        onFilteredChange = vi.fn<(filtered: DocumentRegistryEntry[]) => void>();
    });

    it('renders with sample documents and shows all results initially', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        // Should call onFilteredChange with all documents initially (no filters active)
        expect(onFilteredChange).toHaveBeenCalledWith(SAMPLE_DOCS);
    });

    it('filters by client when selecting from client dropdown', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        fireEvent.change(clientSelect, { target: { value: 'VWA' } });

        // Should return only VWA documents (doc-1, doc-2, doc-4)
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(3);
        expect(lastCall.every((d: DocumentRegistryEntry) => d.client === 'VWA')).toBe(true);
    });

    it('filters by project/family when selecting from project dropdown', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        const projectSelect = screen.getByLabelText('Filtrar por familia o proyecto');
        fireEvent.change(projectSelect, { target: { value: 'Insert' } });

        // Insert project: doc-1 (linkedAmfeProject=Insert) and doc-4 (linkedAmfeProject=Insert)
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(2);
        expect(lastCall.map((d: DocumentRegistryEntry) => d.id).sort()).toEqual(['doc-1', 'doc-4']);
    });

    it('filters by search text', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        const searchInput = screen.getByLabelText('Buscar documentos');
        fireEvent.change(searchInput, { target: { value: 'Telas' } });

        // Should match doc-3 (Telas Planas) and doc-5 (Telas Termoformadas)
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(2);
        expect(lastCall.map((d: DocumentRegistryEntry) => d.id).sort()).toEqual(['doc-3', 'doc-5']);
    });

    it('combines client and search filters', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        // Select client VWA first
        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        fireEvent.change(clientSelect, { target: { value: 'VWA' } });

        // Then search for "Insert"
        const searchInput = screen.getByLabelText('Buscar documentos');
        fireEvent.change(searchInput, { target: { value: 'Insert' } });

        // Should match VWA + Insert: doc-1 and doc-4
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(2);
        expect(lastCall.map((d: DocumentRegistryEntry) => d.id).sort()).toEqual(['doc-1', 'doc-4']);
    });

    it('shows clear button when filters are active and clears all filters on click', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        // Initially no clear button
        expect(screen.queryByText('Limpiar')).toBeNull();

        // Apply a filter
        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        fireEvent.change(clientSelect, { target: { value: 'VWA' } });

        // Clear button should appear
        const clearBtn = screen.getByText('Limpiar');
        expect(clearBtn).toBeTruthy();

        // Click clear
        fireEvent.click(clearBtn);

        // Should restore all documents
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(SAMPLE_DOCS.length);
    });

    it('handles empty documents array', () => {
        render(
            <DocumentListFilters
                documents={[]}
                onFilteredChange={onFilteredChange}
            />
        );

        // Should call with empty array
        expect(onFilteredChange).toHaveBeenCalledWith([]);

        // Client dropdown should have only "Todos" option
        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        const options = within(clientSelect).getAllByRole('option');
        expect(options).toHaveLength(1);
        expect(options[0].textContent).toBe('Todos');
    });

    it('renders in compact mode for side drawers', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
                compact
            />
        );

        // Compact mode should show "Filtros" label
        expect(screen.getByText('Filtros')).toBeTruthy();
        // Should still have the filter elements
        expect(screen.getByLabelText('Filtrar por cliente')).toBeTruthy();
        expect(screen.getByLabelText('Filtrar por familia o proyecto')).toBeTruthy();
        expect(screen.getByLabelText('Buscar documentos')).toBeTruthy();
    });

    it('resets project filter when client changes', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        // Select client and project
        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        const projectSelect = screen.getByLabelText('Filtrar por familia o proyecto');

        fireEvent.change(clientSelect, { target: { value: 'VWA' } });
        fireEvent.change(projectSelect, { target: { value: 'Insert' } });

        // Now change client to PWA - project should be reset
        fireEvent.change(clientSelect, { target: { value: 'PWA' } });

        // Should only show PWA docs (no project filter active)
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(2);
        expect(lastCall.every((d: DocumentRegistryEntry) => d.client === 'PWA')).toBe(true);
    });

    it('searches by part number', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        const searchInput = screen.getByLabelText('Buscar documentos');
        fireEvent.change(searchInput, { target: { value: 'BRK-INS' } });

        // Should match doc-1 and doc-4 (both have partNumber BRK-INS-001)
        const lastCall = onFilteredChange.mock.calls[onFilteredChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveLength(2);
        expect(lastCall.map((d: DocumentRegistryEntry) => d.id).sort()).toEqual(['doc-1', 'doc-4']);
    });

    it('shows result count when filters are active in compact mode', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
                compact
            />
        );

        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        fireEvent.change(clientSelect, { target: { value: 'VWA' } });

        // Should show "3 de 5 documentos"
        expect(screen.getByText('3 de 5 documentos')).toBeTruthy();
    });

    it('scopes project options by selected client', () => {
        render(
            <DocumentListFilters
                documents={SAMPLE_DOCS}
                onFilteredChange={onFilteredChange}
            />
        );

        // Select client VWA
        const clientSelect = screen.getByLabelText('Filtrar por cliente');
        fireEvent.change(clientSelect, { target: { value: 'VWA' } });

        // Project dropdown should only have VWA-related projects
        const projectSelect = screen.getByLabelText('Filtrar por familia o proyecto');
        const options = within(projectSelect).getAllByRole('option');
        const optionValues = options.map(o => (o as HTMLOptionElement).value).filter(v => v !== '');

        // VWA documents have linkedAmfeProject: 'Insert', 'Headrest Front', and doc-4 is also 'Insert'
        // So unique projects for VWA: 'Headrest Front', 'Insert'
        expect(optionValues).toContain('Insert');
        expect(optionValues).toContain('Headrest Front');
        // Should NOT contain PWA-related project names
        expect(optionValues).not.toContain('Telas Planas - PFD');
        expect(optionValues).not.toContain('Telas Termoformadas');
    });
});
