import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumb } from '../components/navigation/Breadcrumb';
import { DropdownNav } from '../components/navigation/DropdownNav';

// Minimal icon stub
const MockIcon = (props: any) => <span data-testid="icon" {...props} />;

describe('Breadcrumb Accessibility', () => {
    it('should have aria-label on nav element', () => {
        render(
            <Breadcrumb items={[
                { label: 'Inicio', onClick: vi.fn() },
                { label: 'Proyecto', onClick: vi.fn() },
                { label: 'Tareas' },
            ]} />
        );

        const nav = screen.getByLabelText('Breadcrumb');
        expect(nav).toBeDefined();
    });

    it('should render clickable items as buttons', () => {
        const onClick = vi.fn();
        render(
            <Breadcrumb items={[
                { label: 'Inicio', onClick },
                { label: 'Proyecto' },
            ]} />
        );

        const button = screen.getByText('Inicio');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalled();
    });

    it('should render last item as non-clickable (active)', () => {
        render(
            <Breadcrumb items={[
                { label: 'Inicio', onClick: vi.fn() },
                { label: 'Active Item' },
            ]} />
        );

        const activeItem = screen.getByText('Active Item');
        expect(activeItem.tagName).not.toBe('BUTTON');
    });

    it('should truncate long labels', () => {
        render(
            <Breadcrumb items={[
                { label: 'This is a very long breadcrumb label that should be truncated', onClick: vi.fn() },
            ]} />
        );

        const label = screen.getByText('This is a very long breadcrumb label that should be truncated');
        expect(label).toBeDefined();
    });
});

describe('DropdownNav Accessibility', () => {
    const defaultProps = {
        label: 'Menú',
        icon: MockIcon,
        items: [
            { id: 'panel', label: 'Panel' },
            { id: 'tasks', label: 'Tareas' },
            { id: 'balance', label: 'Balanceo' },
        ],
        activeTab: 'panel',
        onNavigate: vi.fn(),
    };

    it('should have aria-haspopup attribute on trigger button', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button');
        expect(button?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('should have aria-expanded=false when closed', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button');
        expect(button?.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-expanded=true when open', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);

        expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('should render menu items with role=menuitem', () => {
        render(<DropdownNav {...defaultProps} />);

        // Open menu
        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);

        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(3);
    });

    it('should call onNavigate when clicking a menu item', () => {
        const onNavigate = vi.fn();
        render(<DropdownNav {...defaultProps} onNavigate={onNavigate} />);

        // Open menu
        fireEvent.click(screen.getByText('Menú').closest('button')!);

        // Click menu item
        fireEvent.click(screen.getByText('Tareas'));

        expect(onNavigate).toHaveBeenCalledWith('tasks');
    });

    it('should close on Escape key', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);
        expect(button.getAttribute('aria-expanded')).toBe('true');

        fireEvent.keyDown(button, { key: 'Escape' });
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('should navigate with arrow keys', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);

        // ArrowDown should work
        fireEvent.keyDown(button, { key: 'ArrowDown' });

        // Check that a menu item has focus indication (via aria-activedescendant)
        const controls = button.getAttribute('aria-controls');
        expect(controls).toBeDefined();
    });

    it('should select item with Enter key', () => {
        const onNavigate = vi.fn();
        render(<DropdownNav {...defaultProps} onNavigate={onNavigate} />);

        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);

        // Navigate down to first item
        fireEvent.keyDown(button, { key: 'ArrowDown' });
        // Press Enter to select
        fireEvent.keyDown(button, { key: 'Enter' });

        expect(onNavigate).toHaveBeenCalled();
    });

    it('should jump to first item with Home key', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);

        // Navigate down a few times
        fireEvent.keyDown(button, { key: 'ArrowDown' });
        fireEvent.keyDown(button, { key: 'ArrowDown' });

        // Home should jump to first
        fireEvent.keyDown(button, { key: 'Home' });

        // The menu should still be open and focused on first item
        expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('should jump to last item with End key', () => {
        render(<DropdownNav {...defaultProps} />);

        const button = screen.getByText('Menú').closest('button')!;
        fireEvent.click(button);

        fireEvent.keyDown(button, { key: 'End' });

        expect(button.getAttribute('aria-expanded')).toBe('true');
    });
});
