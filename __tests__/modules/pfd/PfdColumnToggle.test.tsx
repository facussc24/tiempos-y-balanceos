import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PfdColumnToggle from '../../../modules/pfd/PfdColumnToggle';
import { PFD_COLUMN_GROUPS, PFD_COLUMNS } from '../../../modules/pfd/pfdTypes';
import type { PfdColumnGroup } from '../../../modules/pfd/pfdTypes';

function makeVisibleGroups(overrides?: Partial<Record<PfdColumnGroup, boolean>>): Record<PfdColumnGroup, boolean> {
    return {
        essential: true,
        equipment: true,
        characteristics: true,
        flow: false,
        reference: false,
        disposition: false,
        ...overrides,
    };
}

describe('PfdColumnToggle', () => {
    const defaultProps = {
        visibleGroups: makeVisibleGroups(),
        onToggle: vi.fn(),
        onReset: vi.fn(),
    };

    it('should render all column group pills', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        for (const group of PFD_COLUMN_GROUPS) {
            expect(screen.getByText(group.label)).toBeTruthy();
        }
    });

    it('should render correct column count on each pill', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        for (const group of PFD_COLUMN_GROUPS) {
            const count = PFD_COLUMNS.filter(c => c.group === group.id).length;
            const pill = screen.getByLabelText(`${group.label} (${count} columnas)`);
            expect(pill).toBeTruthy();
        }
    });

    it('should mark essential pill as disabled (not clickable)', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        const essentialPill = screen.getByLabelText(/Esencial/);
        expect(essentialPill.hasAttribute('disabled')).toBe(true);
    });

    it('should not call onToggle when essential is clicked', () => {
        const onToggle = vi.fn();
        render(<PfdColumnToggle {...defaultProps} onToggle={onToggle} />);
        const essentialPill = screen.getByLabelText(/Esencial/);
        fireEvent.click(essentialPill);
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('should call onToggle with group id when non-essential pill is clicked', () => {
        const onToggle = vi.fn();
        render(<PfdColumnToggle {...defaultProps} onToggle={onToggle} />);
        const equipmentPill = screen.getByLabelText(/Equipo/);
        fireEvent.click(equipmentPill);
        expect(onToggle).toHaveBeenCalledWith('equipment');
    });

    it('should call onToggle with each group id correctly', () => {
        const onToggle = vi.fn();
        render(<PfdColumnToggle {...defaultProps} onToggle={onToggle} />);

        fireEvent.click(screen.getByLabelText(/Referencia/));
        expect(onToggle).toHaveBeenCalledWith('reference');

        fireEvent.click(screen.getByLabelText(/Flujo/));
        expect(onToggle).toHaveBeenCalledWith('flow');

        fireEvent.click(screen.getByLabelText(/Disposición/));
        expect(onToggle).toHaveBeenCalledWith('disposition');
    });

    it('should show active pills with cyan styling (aria-pressed=true)', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        const equipmentPill = screen.getByLabelText(/Equipo/);
        expect(equipmentPill.getAttribute('aria-pressed')).toBe('true');
    });

    it('should show inactive pills with aria-pressed=false', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        const referencePill = screen.getByLabelText(/Referencia/);
        expect(referencePill.getAttribute('aria-pressed')).toBe('false');
    });

    it('should have active pill with cyan class', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        const equipmentPill = screen.getByLabelText(/Equipo/);
        expect(equipmentPill.className).toContain('bg-cyan-50');
    });

    it('should have inactive pill with gray class', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        const referencePill = screen.getByLabelText(/Referencia/);
        expect(referencePill.className).toContain('bg-gray-50');
    });

    it('should render reset button', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        expect(screen.getByLabelText('Restablecer columnas')).toBeTruthy();
    });

    it('should call onReset when reset button is clicked', () => {
        const onReset = vi.fn();
        render(<PfdColumnToggle {...defaultProps} onReset={onReset} />);
        fireEvent.click(screen.getByLabelText('Restablecer columnas'));
        expect(onReset).toHaveBeenCalled();
    });

    it('should render reset button text', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        expect(screen.getByText('Restablecer')).toBeTruthy();
    });

    it('should have toolbar role', () => {
        render(<PfdColumnToggle {...defaultProps} />);
        expect(screen.getByRole('toolbar')).toBeTruthy();
    });

    it('should show lock icon on essential pill only', () => {
        const { container } = render(<PfdColumnToggle {...defaultProps} />);
        // Essential pill should have the lock icon (rendered as SVG by lucide)
        const essentialPill = screen.getByLabelText(/Esencial/);
        const lockSvg = essentialPill.querySelector('svg');
        expect(lockSvg).toBeTruthy();

        // Non-essential pills should not have SVG (lock icon)
        const equipmentPill = screen.getByLabelText(/Equipo/);
        const equipmentSvg = equipmentPill.querySelector('svg');
        expect(equipmentSvg).toBeNull();
    });

    it('should reflect all groups visible', () => {
        const allVisible = makeVisibleGroups({
            flow: true,
            reference: true,
            disposition: true,
        });
        render(<PfdColumnToggle {...defaultProps} visibleGroups={allVisible} />);

        for (const group of PFD_COLUMN_GROUPS) {
            const pill = screen.getByLabelText(new RegExp(group.label));
            expect(pill.getAttribute('aria-pressed')).toBe('true');
        }
    });
});
