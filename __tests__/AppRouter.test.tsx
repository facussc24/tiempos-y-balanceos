import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AppRouter from '../AppRouter';

vi.mock('../App', () => ({
    default: ({ onBackToLanding }: { onBackToLanding: () => void }) => (
        <div data-testid="tiempos-app">
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

vi.mock('../modules/amfe/AmfeApp', () => ({
    default: ({ onBackToLanding }: { onBackToLanding: () => void }) => (
        <div data-testid="amfe-app">
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

vi.mock('../modules/controlPlan/ControlPlanApp', () => ({
    default: ({ onBackToLanding }: { onBackToLanding: () => void }) => (
        <div data-testid="cp-app">
            <button onClick={onBackToLanding}>Volver</button>
        </div>
    ),
}));

describe('AppRouter', () => {
    it('should render LandingPage by default', () => {
        render(<AppRouter />);
        expect(screen.getByText('Barack Mercosul')).toBeDefined();
        expect(screen.getByRole('navigation', { name: 'Módulos disponibles' })).toBeDefined();
    });

    it('should navigate to Tiempos module on card click', async () => {
        render(<AppRouter />);
        fireEvent.click(screen.getByLabelText('Abrir módulo Tiempos y Balanceos'));
        await waitFor(() => {
            expect(screen.getByTestId('tiempos-app')).toBeDefined();
        });
    });

    it('should navigate to AMFE module on card click', async () => {
        render(<AppRouter />);
        fireEvent.click(screen.getByLabelText('Abrir módulo AMFE VDA'));
        await waitFor(() => {
            expect(screen.getByTestId('amfe-app')).toBeDefined();
        });
    });

    it('should navigate to Control Plan module on card click', async () => {
        render(<AppRouter />);
        fireEvent.click(screen.getByLabelText('Abrir módulo Plan de Control'));
        await waitFor(() => {
            expect(screen.getByTestId('cp-app')).toBeDefined();
        });
    });

    it('should return to landing page when clicking Volver', async () => {
        render(<AppRouter />);
        fireEvent.click(screen.getByLabelText('Abrir módulo Tiempos y Balanceos'));
        await waitFor(() => {
            expect(screen.getByTestId('tiempos-app')).toBeDefined();
        });
        fireEvent.click(screen.getByText('Volver'));
        await waitFor(() => {
            expect(screen.getByText('Barack Mercosul')).toBeDefined();
        });
    });
});
