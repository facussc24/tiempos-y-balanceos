import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from '../modules/LandingPage';

vi.mock('../components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: null, session: null, loading: false, signIn: vi.fn(), signOut: vi.fn(), userDisplayName: '' }),
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

        it('should render Tiempos y Balanceos in Herramientas', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getAllByText('Tiempos y Balanceos').length).toBeGreaterThanOrEqual(1);
        });

        it('should render Herramientas section header', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getAllByText(/Herramientas/).length).toBeGreaterThanOrEqual(1);
        });

        it('should render contentinfo footer with branding', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            // Atajos numericos siguen activos en el handler, pero la leyenda visual fue removida
            // por simplificacion UI. Verificamos que el footer sigue presente con branding.
            expect(screen.getByText(/Barack Mercosul · Ingeniería de Calidad/)).toBeDefined();
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

    describe('document name normalization', () => {
        it('should display ALL_CAPS hierarchical names as Title Case', () => {
            const recentDocs = [
                { id: '1', type: 'amfe' as const, name: 'VWA/PATAGONIA/TOP_ROLL', partNumber: 'P-001', partName: '', client: '', responsible: '', itemCount: 5, updatedAt: '2026-02-28T10:00:00Z' },
            ];
            render(<LandingPage onSelectModule={onSelectModule} recentDocuments={recentDocs} />);
            expect(screen.getByText('Top Roll')).toBeDefined();
        });

        it('should display ALL CAPS names without slashes as Title Case', () => {
            const recentDocs = [
                { id: '1', type: 'pfd' as const, name: 'ARMREST DOOR PANEL', partNumber: '', partName: '', client: '', responsible: '', itemCount: 3, updatedAt: '2026-02-28T10:00:00Z' },
            ];
            render(<LandingPage onSelectModule={onSelectModule} recentDocuments={recentDocs} />);
            expect(screen.getByText('Armrest Door Panel')).toBeDefined();
        });

        it('should preserve mixed-case names as-is', () => {
            const recentDocs = [
                { id: '1', type: 'amfe' as const, name: 'Test AMFE Doc', partNumber: '', partName: '', client: '', responsible: '', itemCount: 1, updatedAt: '2026-02-28T10:00:00Z' },
            ];
            render(<LandingPage onSelectModule={onSelectModule} recentDocuments={recentDocs} />);
            expect(screen.getByText('Test AMFE Doc')).toBeDefined();
        });
    });
});
