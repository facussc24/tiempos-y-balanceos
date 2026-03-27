import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CpHelpPanel from '../../../modules/controlPlan/CpHelpPanel';

describe('CpHelpPanel (R6A)', () => {
    it('renders with a close button', () => {
        const onClose = vi.fn();
        render(<CpHelpPanel onClose={onClose} />);
        expect(screen.getByText('Referencia Rapida CP')).toBeDefined();
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('has 3 tabs: Columnas, Atajos, Fases', () => {
        render(<CpHelpPanel onClose={vi.fn()} />);
        expect(screen.getByText('Columnas')).toBeDefined();
        expect(screen.getByText('Atajos')).toBeDefined();
        expect(screen.getByText('Fases')).toBeDefined();
    });

    it('shows Columnas tab content by default (column info)', () => {
        render(<CpHelpPanel onClose={vi.fn()} />);
        expect(screen.getAllByText('Proceso').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Características').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Métodos').length).toBeGreaterThan(0);
    });

    it('clicking Atajos tab shows shortcuts content', () => {
        render(<CpHelpPanel onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Atajos'));
        expect(screen.getByText('General')).toBeDefined();
        expect(screen.getByText('Guardar proyecto')).toBeDefined();
    });

    it('clicking Fases tab shows phase content', () => {
        render(<CpHelpPanel onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Fases'));
        expect(screen.getByText('Pre-Lanzamiento')).toBeDefined();
        expect(screen.getByText('Producción')).toBeDefined();
    });

    it('calls onClose when the X button is clicked', () => {
        const onClose = vi.fn();
        render(<CpHelpPanel onClose={onClose} />);
        const allButtons = screen.getAllByRole('button');
        // The first button is the close button in the header
        const closeButton = allButtons[0];
        fireEvent.click(closeButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the backdrop overlay', () => {
        const onClose = vi.fn();
        const { container } = render(<CpHelpPanel onClose={onClose} />);
        const backdrop = container.firstChild as HTMLElement;
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
