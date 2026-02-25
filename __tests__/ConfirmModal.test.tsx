import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../components/modals/ConfirmModal';

describe('ConfirmModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        title: 'Confirmar acción',
        message: '¿Está seguro?',
    };

    it('should not render when isOpen is false', () => {
        render(<ConfirmModal {...defaultProps} isOpen={false} />);

        // Wait for modal transition timeout
        vi.advanceTimersByTime(300);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('should render title and message when open', () => {
        render(<ConfirmModal {...defaultProps} />);

        expect(screen.getByText('Confirmar acción')).toBeDefined();
        expect(screen.getByText('¿Está seguro?')).toBeDefined();
    });

    it('should call onConfirm when confirm button is clicked', () => {
        const onConfirm = vi.fn();
        render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

        fireEvent.click(screen.getByText('Confirmar'));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
        const onClose = vi.fn();
        render(<ConfirmModal {...defaultProps} onClose={onClose} />);

        fireEvent.click(screen.getByText('Cancelar'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should use custom button text', () => {
        render(
            <ConfirmModal
                {...defaultProps}
                confirmText="Eliminar"
                cancelText="Volver"
            />
        );

        expect(screen.getByText('Eliminar')).toBeDefined();
        expect(screen.getByText('Volver')).toBeDefined();
    });

    it('should close on Escape key', () => {
        const onClose = vi.fn();
        render(<ConfirmModal {...defaultProps} onClose={onClose} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT close on Escape when loading', () => {
        const onClose = vi.fn();
        render(<ConfirmModal {...defaultProps} onClose={onClose} isLoading={true} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('should show loading state', () => {
        render(<ConfirmModal {...defaultProps} isLoading={true} />);

        expect(screen.getByText('Procesando...')).toBeDefined();
    });

    it('should have correct ARIA attributes', () => {
        render(<ConfirmModal {...defaultProps} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-modal-title');
        expect(dialog.getAttribute('aria-describedby')).toBe('confirm-modal-message');
    });

    it('should call onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        const { container } = render(
            <ConfirmModal {...defaultProps} onClose={onClose} />
        );

        // Find the backdrop (first div with bg-black)
        const backdrop = container.querySelector('.bg-black\\/50');
        if (backdrop) {
            fireEvent.click(backdrop);
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    });

    it('should NOT call onClose when backdrop is clicked during loading', () => {
        const onClose = vi.fn();
        const { container } = render(
            <ConfirmModal {...defaultProps} onClose={onClose} isLoading={true} />
        );

        const backdrop = container.querySelector('.bg-black\\/50');
        if (backdrop) {
            fireEvent.click(backdrop);
            expect(onClose).not.toHaveBeenCalled();
        }
    });

    it('should disable buttons when loading', () => {
        render(<ConfirmModal {...defaultProps} isLoading={true} />);

        const buttons = screen.getAllByRole('button');
        const disabledButtons = buttons.filter(b => (b as HTMLButtonElement).disabled);
        expect(disabledButtons.length).toBeGreaterThanOrEqual(2);
    });
});
