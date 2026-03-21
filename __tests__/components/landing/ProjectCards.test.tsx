import React from 'react';
import { render, screen } from '@testing-library/react';
import { normalizeClientName } from '../../../components/landing/ProjectCards';
import { ProjectCards } from '../../../components/landing/ProjectCards';
import type { ProjectEntry } from '../../../hooks/useProjectHub';

vi.mock('../../../components/ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// normalizeClientName
// ---------------------------------------------------------------------------

describe('normalizeClientName', () => {
    it('maps VWA to Volkswagen Argentina', () => {
        expect(normalizeClientName('VWA')).toBe('Volkswagen Argentina');
    });

    it('strips leading numeric code and maps to Volkswagen Argentina', () => {
        expect(normalizeClientName('095 VOLKSWAGEN')).toBe('Volkswagen Argentina');
    });

    it('maps VOLKSWAGEN to Volkswagen Argentina', () => {
        expect(normalizeClientName('VOLKSWAGEN')).toBe('Volkswagen Argentina');
    });

    it('maps PWA to Toyota Argentina', () => {
        expect(normalizeClientName('PWA')).toBe('Toyota Argentina');
    });

    it('returns already-proper names as-is', () => {
        expect(normalizeClientName('Volkswagen Argentina')).toBe('Volkswagen Argentina');
    });

    it('returns empty string for empty input', () => {
        expect(normalizeClientName('')).toBe('');
    });

    it('title-cases unknown all-caps names', () => {
        expect(normalizeClientName('FORD MOTOR')).toBe('Ford Motor');
    });
});

// ---------------------------------------------------------------------------
// ProjectCards rendering
// ---------------------------------------------------------------------------

const TEST_PROJECTS: ProjectEntry[] = [{
    family: { id: 1, name: 'Insert', description: '', lineaCode: 'VWA', lineaName: 'VWA', active: true, createdAt: '', updatedAt: '' },
    members: [{ id: 1, familyId: 1, productId: 1, isPrimary: true, addedAt: '', codigo: 'PAT-001', descripcion: 'Insert L0', lineaCode: 'VWA', lineaName: 'VWA' }],
    documents: { pfd: 'complete' as const, amfe: 'complete' as const, controlPlan: 'complete' as const, hojaOperaciones: 'missing' as const },
    kpis: { apHCount: 2, apHUnmitigated: 0, causeCount: 10, cpItemCount: 5, pendingProposals: 0 },
    health: 'yellow' as const,
    phase: 'production',
    hasMaster: true,
    variantCount: 1,
    partNumber: 'PAT-001',
}];

describe('ProjectCards', () => {
    it('renders project cards with correct family names', () => {
        render(<ProjectCards projects={TEST_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText('Insert')).toBeTruthy();
    });

    it('shows health indicator badge', () => {
        render(<ProjectCards projects={TEST_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText('Incompleto')).toBeTruthy();
    });

    it('shows phase badge when phase is set', () => {
        render(<ProjectCards projects={TEST_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Producción/)).toBeTruthy();
    });

    it('shows maestro tag when hasMaster is true', () => {
        render(<ProjectCards projects={TEST_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Maestro/)).toBeTruthy();
    });

    it('shows actionable KPI when pending actions exist', () => {
        const withActions: ProjectEntry[] = [{
            ...TEST_PROJECTS[0],
            kpis: { ...TEST_PROJECTS[0].kpis, apHUnmitigated: 3, pendingProposals: 1 },
            health: 'red' as const,
        }];
        render(<ProjectCards projects={withActions} onSelectProject={vi.fn()} />);
        expect(screen.getByText('4 acciones pendientes')).toBeTruthy();
    });

    it('shows client and part number', () => {
        render(<ProjectCards projects={TEST_PROJECTS} onSelectProject={vi.fn()} />);
        expect(screen.getByText(/Volkswagen Argentina/)).toBeTruthy();
    });
});
