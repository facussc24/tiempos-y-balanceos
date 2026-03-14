import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from '../modules/LandingPage';

vi.mock('../components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: null, session: null, loading: false, signIn: vi.fn(), signOut: vi.fn() }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('LandingPage', () => {
    const onSelectModule = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('should render the Barack Mercosul title', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText('Barack Mercosul')).toBeDefined();
        });

        it('should render the subtitle with automotive quality context', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText('Ingeniería de Calidad Automotriz')).toBeDefined();
        });

        it('should render the logo image', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            const logo = screen.getByAltText('Barack Mercosul');
            expect(logo).toBeDefined();
            expect(logo.tagName).toBe('IMG');
        });

        it('should render four APQP module cards and Tiempos', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            // Module names may appear in multiple places (cards, empty state, etc.)
            expect(screen.getAllByText('Diagrama de Flujo').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('AMFE VDA').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Plan de Control').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Hoja de Operaciones').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('Tiempos y Balanceos').length).toBeGreaterThanOrEqual(1);
        });

        it('should render APQP section header', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText(/Documentación APQP/)).toBeDefined();
        });

        it('should render Herramientas section header', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getAllByText(/Herramientas/).length).toBeGreaterThanOrEqual(1);
        });

        it('should render step numbers on APQP cards', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText('PASO 1')).toBeDefined();
            expect(screen.getByText('PASO 2')).toBeDefined();
            expect(screen.getByText('PASO 3')).toBeDefined();
            expect(screen.getByText('PASO 4')).toBeDefined();
        });

        it('should render keyboard shortcuts footer', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText(/Atajos/)).toBeDefined();
        });

        it('should render document counts when provided', () => {
            render(
                <LandingPage
                    onSelectModule={onSelectModule}
                    documentCounts={{ pfd: 3, amfe: 7, controlPlan: 2, hojaOperaciones: 4 }}
                />
            );
            // Check the total count shows in header button
            expect(screen.getByText('16 documentos')).toBeDefined();
            // Check individual count badges exist (use getAllByText for numbers that may appear multiple times)
            expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1); // amfe count badge
        });

        it('should render recent documents when provided', () => {
            const recentDocs = [
                { id: '1', type: 'amfe' as const, name: 'Test AMFE', partNumber: 'P-001', partName: 'Test Part', client: 'TestClient', responsible: '', itemCount: 5, updatedAt: '2026-02-28T10:00:00Z' },
            ];
            render(
                <LandingPage
                    onSelectModule={onSelectModule}
                    recentDocuments={recentDocs}
                />
            );
            expect(screen.getByText('Test AMFE')).toBeDefined();
            expect(screen.getByText('TestClient')).toBeDefined();
        });

        it('should render empty state when no recent documents', () => {
            render(<LandingPage onSelectModule={onSelectModule} recentDocuments={[]} />);
            expect(screen.getByText('No hay documentos aún')).toBeDefined();
        });
    });

    describe('module selection', () => {
        it('should call onSelectModule with "tiempos" when clicking Tiempos card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir Tiempos y Balanceos'));
            expect(onSelectModule).toHaveBeenCalledWith('tiempos');
        });

        it('should call onSelectModule with "amfe" when clicking AMFE card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir AMFE VDA'));
            expect(onSelectModule).toHaveBeenCalledWith('amfe');
        });

        it('should call onSelectModule with "controlPlan" when clicking Control Plan card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir Plan de Control'));
            expect(onSelectModule).toHaveBeenCalledWith('controlPlan');
        });

        it('should call onSelectModule with "hojaOperaciones" when clicking HO card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir Hoja de Operaciones'));
            expect(onSelectModule).toHaveBeenCalledWith('hojaOperaciones');
        });

        it('should call onSelectModule with "pfd" when clicking PFD card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir Diagrama de Flujo'));
            expect(onSelectModule).toHaveBeenCalledWith('pfd');
        });

        it('should call onSelectModule with "registry" when clicking documents button', () => {
            render(
                <LandingPage
                    onSelectModule={onSelectModule}
                    documentCounts={{ pfd: 3, amfe: 7, controlPlan: 2, hojaOperaciones: 4 }}
                />
            );
            fireEvent.click(screen.getByText('16 documentos'));
            expect(onSelectModule).toHaveBeenCalledWith('registry');
        });
    });

    describe('keyboard shortcuts', () => {
        it('should select pfd when pressing "1"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '1' });
            expect(onSelectModule).toHaveBeenCalledWith('pfd');
        });

        it('should select amfe when pressing "2"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '2' });
            expect(onSelectModule).toHaveBeenCalledWith('amfe');
        });

        it('should select controlPlan when pressing "3"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '3' });
            expect(onSelectModule).toHaveBeenCalledWith('controlPlan');
        });

        it('should select hojaOperaciones when pressing "4"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '4' });
            expect(onSelectModule).toHaveBeenCalledWith('hojaOperaciones');
        });

        it('should select tiempos when pressing "5"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '5' });
            expect(onSelectModule).toHaveBeenCalledWith('tiempos');
        });

        it('should select registry when pressing "6"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '6' });
            expect(onSelectModule).toHaveBeenCalledWith('registry');
        });

        it('should not trigger when typing in an input', () => {
            render(
                <div>
                    <LandingPage onSelectModule={onSelectModule} />
                    <input data-testid="test-input" />
                </div>
            );
            const input = screen.getByTestId('test-input');
            fireEvent.keyDown(input, { key: '1' });
            expect(onSelectModule).not.toHaveBeenCalled();
        });
    });

    describe('accessibility', () => {
        it('should have navigation landmark for APQP modules', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            const nav = screen.getByRole('navigation', { name: 'Módulos de documentación' });
            expect(nav).toBeDefined();
        });

        it('should have aria-labels on APQP card buttons', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByLabelText('Abrir Diagrama de Flujo')).toBeDefined();
            expect(screen.getByLabelText('Abrir AMFE VDA')).toBeDefined();
            expect(screen.getByLabelText('Abrir Plan de Control')).toBeDefined();
            expect(screen.getByLabelText('Abrir Hoja de Operaciones')).toBeDefined();
        });

        it('should have aria-label on Tiempos card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByLabelText('Abrir Tiempos y Balanceos')).toBeDefined();
        });

        it('should have contentinfo footer', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            const footer = screen.getByRole('contentinfo');
            expect(footer).toBeDefined();
        });
    });

    describe('workflow guide', () => {
        // Provide at least 1 document so the auto-open (totalDocs===0) logic doesn't fire
        const noAutoOpen = { documentCounts: { pfd: 1, amfe: 0, controlPlan: 0, hojaOperaciones: 0 } };

        const clickWorkflowToggle = () => {
            const toggle = screen.getByText(/Guía de flujo APQP/).closest('button')!;
            fireEvent.click(toggle);
        };

        it('should render the workflow toggle button', () => {
            render(<LandingPage onSelectModule={onSelectModule} {...noAutoOpen} />);
            expect(screen.getByText(/Guía de flujo APQP/)).toBeDefined();
        });

        it('should show workflow guide when toggle is clicked', () => {
            render(<LandingPage onSelectModule={onSelectModule} {...noAutoOpen} />);
            clickWorkflowToggle();
            expect(screen.getByRole('region', { name: 'Guía APQP' })).toBeDefined();
        });

        it('should show step descriptions when expanded', () => {
            render(<LandingPage onSelectModule={onSelectModule} {...noAutoOpen} />);
            clickWorkflowToggle();
            expect(screen.getByText(/Definí cada operación del proceso productivo/)).toBeDefined();
            expect(screen.getByText(/analizá fallas, causas, severidad/)).toBeDefined();
            expect(screen.getByText(/Se genera desde el AMFE/)).toBeDefined();
            expect(screen.getByText(/El documento para el puesto de trabajo/)).toBeDefined();
        });

        it('should show the workflow tip when expanded', () => {
            render(<LandingPage onSelectModule={onSelectModule} {...noAutoOpen} />);
            clickWorkflowToggle();
            expect(screen.getByText(/Consejo:/)).toBeDefined();
        });

        it('should hide workflow guide when toggle is clicked again', () => {
            render(<LandingPage onSelectModule={onSelectModule} {...noAutoOpen} />);
            clickWorkflowToggle();
            expect(screen.getByRole('region', { name: 'Guía APQP' })).toBeDefined();
            const closeBtn = screen.getByText(/Ocultar/).closest('button')!;
            fireEvent.click(closeBtn);
            expect(screen.queryByRole('region', { name: 'Guía APQP' })).toBeNull();
        });
    });
});
