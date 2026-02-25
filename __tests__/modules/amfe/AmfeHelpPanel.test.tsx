import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AmfeHelpPanel from '../../../modules/amfe/AmfeHelpPanel';

describe('AmfeHelpPanel (R5B)', () => {
    it('renders with a close button', () => {
        const onClose = vi.fn();
        render(<AmfeHelpPanel onClose={onClose} />);

        // The panel renders its title
        expect(screen.getByText('Referencia Rapida AMFE')).toBeDefined();

        // There's a close button (the X icon button)
        // The X button is the only button in the header area
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('has 3 tabs: Escalas, Atajos, Flujo VDA', () => {
        render(<AmfeHelpPanel onClose={vi.fn()} />);

        expect(screen.getByText('Escalas')).toBeDefined();
        expect(screen.getByText('Atajos')).toBeDefined();
        expect(screen.getByText('Flujo VDA')).toBeDefined();
    });

    it('shows Escalas tab content by default (severity scale)', () => {
        render(<AmfeHelpPanel onClose={vi.fn()} />);

        // Default tab is "Escalas" which shows severity/occurrence/detection scales
        expect(screen.getByText('Severidad (S)')).toBeDefined();
        expect(screen.getByText('Ocurrencia (O)')).toBeDefined();
        expect(screen.getByText('Deteccion (D)')).toBeDefined();
    });

    it('clicking Atajos tab shows shortcuts content', () => {
        render(<AmfeHelpPanel onClose={vi.fn()} />);

        fireEvent.click(screen.getByText('Atajos'));

        // Shortcuts tab should show keyboard shortcut categories
        expect(screen.getByText('General')).toBeDefined();
        expect(screen.getByText('Guardar proyecto')).toBeDefined();
    });

    it('clicking Flujo VDA tab shows workflow content', () => {
        render(<AmfeHelpPanel onClose={vi.fn()} />);

        fireEvent.click(screen.getByText('Flujo VDA'));

        // Workflow tab should show step titles
        expect(screen.getByText('Definir Operaciones')).toBeDefined();
        expect(screen.getByText('Generar Plan de Control')).toBeDefined();
    });

    it('calls onClose when the X button is clicked', () => {
        const onClose = vi.fn();
        render(<AmfeHelpPanel onClose={onClose} />);

        // The X button is in the header. Find it by looking for the button
        // near the panel title. The close button is the last button in the header area.
        // Since we know the structure, the X button is identifiable by its position.
        // Let's find the button that contains the X icon (it's the one after the title area).
        const allButtons = screen.getAllByRole('button');
        // The first buttons are the tab buttons (Escalas, Atajos, Flujo VDA),
        // but the close button comes before tabs in DOM order (it's in the header).
        // Click the first button (close) since it appears first in the header.
        const closeButton = allButtons[0];
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the backdrop overlay', () => {
        const onClose = vi.fn();
        const { container } = render(<AmfeHelpPanel onClose={onClose} />);

        // The outermost div has onClick={onClose} for backdrop click
        // Find the overlay backdrop element
        const backdrop = container.firstChild as HTMLElement;
        fireEvent.click(backdrop);

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
