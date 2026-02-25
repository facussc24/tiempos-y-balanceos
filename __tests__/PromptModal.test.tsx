import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptModal } from '../components/modals/PromptModal';

describe('PromptModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onSubmit: vi.fn(),
        title: 'Ingrese un valor',
        message: 'Por favor complete el campo',
    };

    it('should not render when isOpen is false', () => {
        const { container } = render(<PromptModal {...defaultProps} isOpen={false} />);
        expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('should render title and message when open', () => {
        render(<PromptModal {...defaultProps} />);

        expect(screen.getByText('Ingrese un valor')).toBeDefined();
        expect(screen.getByText('Por favor complete el campo')).toBeDefined();
    });

    it('should show input with placeholder', () => {
        render(<PromptModal {...defaultProps} placeholder="Escriba aquí..." />);

        const input = screen.getByPlaceholderText('Escriba aquí...');
        expect(input).toBeDefined();
    });

    it('should pre-fill with defaultValue', () => {
        render(<PromptModal {...defaultProps} defaultValue="Valor inicial" />);

        const input = screen.getByDisplayValue('Valor inicial');
        expect(input).toBeDefined();
    });

    it('should call onSubmit with input value', () => {
        const onSubmit = vi.fn();
        render(<PromptModal {...defaultProps} onSubmit={onSubmit} />);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Mi valor' } });
        fireEvent.click(screen.getByText('Aceptar'));

        expect(onSubmit).toHaveBeenCalledWith('Mi valor');
    });

    it('should call onClose on cancel', () => {
        const onClose = vi.fn();
        render(<PromptModal {...defaultProps} onClose={onClose} />);

        fireEvent.click(screen.getByText('Cancelar'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close on Escape key', () => {
        const onClose = vi.fn();
        render(<PromptModal {...defaultProps} onClose={onClose} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should submit on Enter key', () => {
        const onSubmit = vi.fn();
        render(<PromptModal {...defaultProps} onSubmit={onSubmit} defaultValue="test" />);

        fireEvent.keyDown(document, { key: 'Enter' });

        expect(onSubmit).toHaveBeenCalledWith('test');
    });

    it('should NOT submit empty value when required', () => {
        const onSubmit = vi.fn();
        render(
            <PromptModal {...defaultProps} onSubmit={onSubmit} required={true} defaultValue="" />
        );

        fireEvent.click(screen.getByText('Aceptar'));

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should submit when required and value is provided', () => {
        const onSubmit = vi.fn();
        render(
            <PromptModal {...defaultProps} onSubmit={onSubmit} required={true} />
        );

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Valid input' } });
        fireEvent.click(screen.getByText('Aceptar'));

        expect(onSubmit).toHaveBeenCalledWith('Valid input');
    });

    it('should use custom button text', () => {
        render(
            <PromptModal
                {...defaultProps}
                submitText="Guardar"
                cancelText="Descartar"
            />
        );

        expect(screen.getByText('Guardar')).toBeDefined();
        expect(screen.getByText('Descartar')).toBeDefined();
    });

    it('should show loading state', () => {
        render(<PromptModal {...defaultProps} isLoading={true} />);

        expect(screen.getByText('Procesando...')).toBeDefined();
    });

    it('should disable input and buttons when loading', () => {
        render(<PromptModal {...defaultProps} isLoading={true} />);

        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.disabled).toBe(true);
    });

    it('should NOT close on Escape when loading', () => {
        const onClose = vi.fn();
        render(<PromptModal {...defaultProps} onClose={onClose} isLoading={true} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).not.toHaveBeenCalled();
    });

    it('should reset input value when reopened', () => {
        const { rerender } = render(
            <PromptModal {...defaultProps} defaultValue="initial" />
        );

        // Change input
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'changed' } });

        // Close
        rerender(<PromptModal {...defaultProps} defaultValue="initial" isOpen={false} />);

        // Reopen
        rerender(<PromptModal {...defaultProps} defaultValue="initial" isOpen={true} />);

        const newInput = screen.getByRole('textbox') as HTMLInputElement;
        expect(newInput.value).toBe('initial');
    });

    it('should disable submit button when required and input is empty', () => {
        render(
            <PromptModal {...defaultProps} required={true} defaultValue="" />
        );

        const submitButton = screen.getByText('Aceptar').closest('button') as HTMLButtonElement;
        expect(submitButton.disabled).toBe(true);
    });
});
