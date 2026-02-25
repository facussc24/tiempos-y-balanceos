import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingPage from '../modules/LandingPage';

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

        it('should render four module cards', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText('Diagrama de Flujo')).toBeDefined();
            expect(screen.getByText('Tiempos y Balanceos')).toBeDefined();
            expect(screen.getByText('AMFE VDA')).toBeDefined();
            expect(screen.getByText('Plan de Control')).toBeDefined();
        });

        it('should render AIAG-VDA 1ª Edición in AMFE description', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText(/AIAG-VDA 1ª Edición/)).toBeDefined();
        });

        it('should render APQP in Plan de Control description', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getAllByText(/AIAG \(APQP\)/).length).toBeGreaterThanOrEqual(1);
        });

        it('should render tags for each module', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText('Cronometraje')).toBeDefined();
            expect(screen.getByText('AIAG-VDA')).toBeDefined();
            expect(screen.getByText('13 Columnas')).toBeDefined();
        });

        it('should render version footer', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByText(/v7\.0/)).toBeDefined();
        });
    });

    describe('module selection', () => {
        it('should call onSelectModule with "tiempos" when clicking Tiempos card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir módulo Tiempos y Balanceos'));
            expect(onSelectModule).toHaveBeenCalledWith('tiempos');
        });

        it('should call onSelectModule with "amfe" when clicking AMFE card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir módulo AMFE VDA'));
            expect(onSelectModule).toHaveBeenCalledWith('amfe');
        });

        it('should call onSelectModule with "controlPlan" when clicking Control Plan card', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.click(screen.getByLabelText('Abrir módulo Plan de Control'));
            expect(onSelectModule).toHaveBeenCalledWith('controlPlan');
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

        it('should select tiempos when pressing "4"', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            fireEvent.keyDown(document, { key: '4' });
            expect(onSelectModule).toHaveBeenCalledWith('tiempos');
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
        it('should have navigation landmark with aria-label', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            const nav = screen.getByRole('navigation', { name: 'Módulos disponibles' });
            expect(nav).toBeDefined();
        });

        it('should have aria-labels on all card buttons', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            expect(screen.getByLabelText('Abrir módulo Diagrama de Flujo del Proceso')).toBeDefined();
            expect(screen.getByLabelText('Abrir módulo Tiempos y Balanceos')).toBeDefined();
            expect(screen.getByLabelText('Abrir módulo AMFE VDA')).toBeDefined();
            expect(screen.getByLabelText('Abrir módulo Plan de Control')).toBeDefined();
        });

        it('should render all cards as buttons', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBe(4);
        });

        it('should have contentinfo footer', () => {
            render(<LandingPage onSelectModule={onSelectModule} />);
            const footer = screen.getByRole('contentinfo');
            expect(footer).toBeDefined();
        });
    });
});
