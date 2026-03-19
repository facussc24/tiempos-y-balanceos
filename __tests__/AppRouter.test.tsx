import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AppRouter from '../AppRouter';

// Bypass auth in tests — render children directly as if user is logged in
vi.mock('../components/auth/AuthProvider', () => ({
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAuth: () => ({ user: { id: 'test-user' }, session: null, loading: false, signIn: vi.fn(), signOut: vi.fn(), userDisplayName: 'test-user' }),
}));

vi.mock('../modules/registry/useDocumentRegistry', () => ({
    useDocumentRegistry: () => ({
        entries: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
    }),
}));

vi.mock('../App', () => ({
    default: ({ onBackToLanding }: { onBackToLanding: () => void }) => (
        <div data-testid="tiempos-app">
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

vi.mock('../modules/amfe/AmfeApp', () => ({
    default: ({ onBackToLanding, initialTab }: { onBackToLanding: () => void; initialTab?: string }) => (
        <div data-testid="amfe-app" data-initial-tab={initialTab || 'amfe'}>
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

vi.mock('../modules/registry/DocumentHub', () => ({
    default: ({ onBackToLanding }: { onBackToLanding: () => void }) => (
        <div data-testid="document-hub">
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

vi.mock('../modules/solicitud/SolicitudApp', () => ({
    default: ({ onBackToLanding }: { onBackToLanding: () => void }) => (
        <div data-testid="solicitud-app">
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

describe('AppRouter', () => {
    beforeEach(() => {
        localStorage.removeItem('barack_lastModule');
    });

    it('should render LandingPage by default', () => {
        render(<AppRouter />);
        expect(screen.getByText('Barack Mercosul')).toBeDefined();
    });

    it('should navigate to Tiempos module on card click', async () => {
        render(<AppRouter />);
        fireEvent.click(screen.getByLabelText('Abrir Tiempos y Balanceos'));
        await waitFor(() => {
            expect(screen.getByTestId('tiempos-app')).toBeDefined();
        });
    });

    it('should navigate to AMFE module via keyboard shortcut', async () => {
        render(<AppRouter />);
        fireEvent.keyDown(document, { key: '2' });
        await waitFor(() => {
            const el = screen.getByTestId('amfe-app');
            expect(el).toBeDefined();
            expect(el.getAttribute('data-initial-tab')).toBe('amfe');
        });
    });

    it('should navigate to Control Plan via keyboard shortcut', async () => {
        render(<AppRouter />);
        fireEvent.keyDown(document, { key: '3' });
        await waitFor(() => {
            const el = screen.getByTestId('amfe-app');
            expect(el).toBeDefined();
            expect(el.getAttribute('data-initial-tab')).toBe('controlPlan');
        });
    });

    it('should navigate to PFD via keyboard shortcut', async () => {
        render(<AppRouter />);
        fireEvent.keyDown(document, { key: '1' });
        await waitFor(() => {
            const el = screen.getByTestId('amfe-app');
            expect(el).toBeDefined();
            expect(el.getAttribute('data-initial-tab')).toBe('pfd');
        });
    });

    it('should navigate to Hojas de Operaciones via keyboard shortcut', async () => {
        render(<AppRouter />);
        fireEvent.keyDown(document, { key: '4' });
        await waitFor(() => {
            const el = screen.getByTestId('amfe-app');
            expect(el).toBeDefined();
            expect(el.getAttribute('data-initial-tab')).toBe('hojaOperaciones');
        });
    });

    it('should return to landing page when clicking Volver', async () => {
        render(<AppRouter />);
        fireEvent.click(screen.getByLabelText('Abrir Tiempos y Balanceos'));
        await waitFor(() => {
            expect(screen.getByTestId('tiempos-app')).toBeDefined();
        });
        fireEvent.click(screen.getByText('Volver'));
        await waitFor(() => {
            expect(screen.getByText('Barack Mercosul')).toBeDefined();
        });
    });

    it('should return to landing from AMFE modules (PFD entry)', async () => {
        render(<AppRouter />);
        fireEvent.keyDown(document, { key: '1' });
        await waitFor(() => {
            expect(screen.getByTestId('amfe-app')).toBeDefined();
        });
        fireEvent.click(screen.getByText('Volver'));
        await waitFor(() => {
            expect(screen.getByText('Barack Mercosul')).toBeDefined();
        });
    });
});
