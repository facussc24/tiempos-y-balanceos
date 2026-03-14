import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PfdFlowContextMenu from '../../../modules/pfd/PfdFlowContextMenu';
import type { PfdFlowContextMenuProps } from '../../../modules/pfd/PfdFlowContextMenu';
import type { PfdStep } from '../../../modules/pfd/pfdTypes';
import { createEmptyStep, PFD_STEP_TYPES } from '../../../modules/pfd/pfdTypes';

function makeStep(overrides?: Partial<PfdStep>): PfdStep {
    return { ...createEmptyStep(), stepNumber: 'OP 10', description: 'Test step', ...overrides };
}

function makeProps(overrides?: Partial<PfdFlowContextMenuProps>): PfdFlowContextMenuProps {
    return {
        isOpen: true,
        position: { x: 100, y: 200 },
        step: makeStep(),
        stepIndex: 1,
        totalSteps: 5,
        onClose: vi.fn(),
        onInsertBefore: vi.fn(),
        onInsertAfter: vi.fn(),
        onDelete: vi.fn(),
        onDuplicate: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onChangeType: vi.fn(),
        ...overrides,
    };
}

describe('PfdFlowContextMenu', () => {
    it('does not render when isOpen=false', () => {
        const props = makeProps({ isOpen: false });
        const { container } = render(<PfdFlowContextMenu {...props} />);
        expect(container.querySelector('[role="menu"]')).toBeNull();
    });

    it('renders menu items when isOpen=true', () => {
        const props = makeProps();
        render(<PfdFlowContextMenu {...props} />);
        expect(screen.getByText('Insertar paso arriba')).toBeTruthy();
        expect(screen.getByText('Insertar paso abajo')).toBeTruthy();
        expect(screen.getByText('Duplicar')).toBeTruthy();
        expect(screen.getByText('Mover arriba')).toBeTruthy();
        expect(screen.getByText('Mover abajo')).toBeTruthy();
        expect(screen.getByText('Eliminar')).toBeTruthy();
        expect(screen.getByText('Cambiar tipo')).toBeTruthy();
    });

    it('calls onInsertAfter when clicking "Insertar paso abajo"', () => {
        const props = makeProps();
        render(<PfdFlowContextMenu {...props} />);
        fireEvent.click(screen.getByText('Insertar paso abajo'));
        expect(props.onInsertAfter).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when clicking "Eliminar"', () => {
        const props = makeProps();
        render(<PfdFlowContextMenu {...props} />);
        fireEvent.click(screen.getByText('Eliminar'));
        expect(props.onDelete).toHaveBeenCalledTimes(1);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape is pressed', () => {
        const props = makeProps();
        render(<PfdFlowContextMenu {...props} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalled();
    });

    it('move up disabled when stepIndex=0', () => {
        const props = makeProps({ stepIndex: 0 });
        render(<PfdFlowContextMenu {...props} />);
        const moveUpBtn = screen.getByText('Mover arriba').closest('button')!;
        expect(moveUpBtn.disabled).toBe(true);
        expect(moveUpBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('move down disabled when stepIndex=totalSteps-1', () => {
        const props = makeProps({ stepIndex: 4, totalSteps: 5 });
        render(<PfdFlowContextMenu {...props} />);
        const moveDownBtn = screen.getByText('Mover abajo').closest('button')!;
        expect(moveDownBtn.disabled).toBe(true);
        expect(moveDownBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('shows step type submenu options', () => {
        const props = makeProps();
        render(<PfdFlowContextMenu {...props} />);
        // Click "Cambiar tipo" to open submenu
        fireEvent.click(screen.getByText('Cambiar tipo'));
        // All 7 step types should be visible
        for (const { label } of PFD_STEP_TYPES) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });
});
