import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectTable } from '../../../components/landing/ProjectTable';
import type { ProjectEntry } from '../../../hooks/useProjectHub';

vi.mock('../../../components/ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const BASE_ENTRY: ProjectEntry = {
    family: { id: 1, name: 'Insert', description: '', lineaCode: 'VWA', lineaName: 'VWA', active: true, createdAt: '', updatedAt: '' },
    members: [{ id: 1, familyId: 1, productId: 1, isPrimary: true, addedAt: '', codigo: 'PAT-001', descripcion: 'Insert L0', lineaCode: 'VWA', lineaName: 'VWA' }],
    documents: { pfd: 'complete', amfe: 'complete', controlPlan: 'complete', hojaOperaciones: 'missing' },
    kpis: { apHCount: 2, apHUnmitigated: 0, causeCount: 10, cpItemCount: 5, pendingProposals: 0 },
    health: 'yellow',
    phase: 'production',
    hasMaster: true,
    variantCount: 1,
};

const RED_ENTRY: ProjectEntry = {
    ...BASE_ENTRY,
    family: { ...BASE_ENTRY.family, id: 2, name: 'Top Roll' },
    kpis: { ...BASE_ENTRY.kpis, apHUnmitigated: 3 },
    health: 'red',
    phase: 'preLaunch',
    hasMaster: false,
    variantCount: 0,
};

const GREEN_ENTRY: ProjectEntry = {
    ...BASE_ENTRY,
    family: { ...BASE_ENTRY.family, id: 3, name: 'Telas Planas', lineaName: 'PWA' },
    members: [{ ...BASE_ENTRY.members[0], lineaName: 'PWA', lineaCode: 'PWA', codigo: 'HILUX-581D' }],
    documents: { pfd: 'complete', amfe: 'complete', controlPlan: 'complete', hojaOperaciones: 'complete' },
    kpis: { apHCount: 0, apHUnmitigated: 0, causeCount: 5, cpItemCount: 8, pendingProposals: 0 },
    health: 'green',
    hasMaster: false,
    variantCount: 1,
};

const ALL_PROJECTS = [BASE_ENTRY, RED_ENTRY, GREEN_ENTRY];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectTable', () => {
    it('renders table with all project rows', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText('Insert')).toBeTruthy();
        expect(screen.getByText('Top Roll')).toBeTruthy();
        expect(screen.getByText('Telas Planas')).toBeTruthy();
    });

    it('renders column headers', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText('Producto')).toBeTruthy();
        expect(screen.getByText('AP=H')).toBeTruthy();
        expect(screen.getByText('Acciones')).toBeTruthy();
    });

    it('sorts red (REQUIERE ATENCIÓN) to top', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        const rows = screen.getAllByRole('row').filter(r => r.getAttribute('aria-label'));
        // Red should be first
        expect(rows[0].getAttribute('aria-label')).toBe('Abrir proyecto Top Roll');
    });

    it('shows AP=H count in red when > 0', () => {
        render(<ProjectTable projects={[RED_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText('3')).toBeTruthy();
    });

    it('shows green checkmark when AP=H is 0', () => {
        render(<ProjectTable projects={[GREEN_ENTRY]} onSelectProject={vi.fn()} />);
        // The Check icon is rendered (no red number)
        expect(screen.queryByText('0')).toBeNull();
    });

    it('shows phase badge', () => {
        render(<ProjectTable projects={[BASE_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Producción/)).toBeTruthy();
    });

    it('shows Pre-lanzamiento badge', () => {
        render(<ProjectTable projects={[RED_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Pre-lanzamiento/)).toBeTruthy();
    });

    it('shows Maestro tag', () => {
        render(<ProjectTable projects={[BASE_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Maestro/)).toBeTruthy();
    });

    it('shows Variante tag', () => {
        render(<ProjectTable projects={[GREEN_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Variante/)).toBeTruthy();
    });

    it('shows part number', () => {
        render(<ProjectTable projects={[BASE_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText('PAT-001')).toBeTruthy();
    });

    it('shows client name below product name', () => {
        render(<ProjectTable projects={[GREEN_ENTRY]} onSelectProject={vi.fn()} />);
        expect(screen.getByText('Toyota Argentina')).toBeTruthy();
    });

    it('calls onSelectProject when row is clicked', () => {
        const handler = vi.fn();
        render(<ProjectTable projects={[BASE_ENTRY]} onSelectProject={handler} />);
        const row = screen.getByRole('row', { name: /Insert/ });
        fireEvent.click(row);
        expect(handler).toHaveBeenCalledWith(1);
    });

    it('calls onSelectProject on Enter key', () => {
        const handler = vi.fn();
        render(<ProjectTable projects={[BASE_ENTRY]} onSelectProject={handler} />);
        const row = screen.getByRole('row', { name: /Insert/ });
        fireEvent.keyDown(row, { key: 'Enter' });
        expect(handler).toHaveBeenCalledWith(1);
    });

    it('filters by product name via search bar', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        const search = screen.getByPlaceholderText('Buscar producto o cliente...');
        fireEvent.change(search, { target: { value: 'Telas' } });
        expect(screen.getByText('Telas Planas')).toBeTruthy();
        expect(screen.queryByText('Insert')).toBeNull();
        expect(screen.queryByText('Top Roll')).toBeNull();
    });

    it('filters by client name via search bar', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        const search = screen.getByPlaceholderText('Buscar producto o cliente...');
        fireEvent.change(search, { target: { value: 'Toyota' } });
        expect(screen.getByText('Telas Planas')).toBeTruthy();
        expect(screen.queryByText('Insert')).toBeNull();
    });

    it('shows empty message when no results match search', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        const search = screen.getByPlaceholderText('Buscar producto o cliente...');
        fireEvent.change(search, { target: { value: 'zzzzz' } });
        expect(screen.getByText(/No se encontraron proyectos/)).toBeTruthy();
    });

    it('renders search bar with correct aria-label', () => {
        render(<ProjectTable projects={ALL_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByLabelText('Buscar proyectos')).toBeTruthy();
    });
});
