import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import PfdSyntaxHelpDrawer from '../../../modules/pfd/PfdSyntaxHelpDrawer';

describe('PfdSyntaxHelpDrawer', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            writable: true,
            configurable: true,
        });
    });

    it('does not show backdrop when closed', () => {
        render(<PfdSyntaxHelpDrawer isOpen={false} onClose={() => {}} />);
        expect(screen.queryByTestId('pfd-help-drawer-backdrop')).toBeNull();
    });

    it('shows the title when open', () => {
        render(<PfdSyntaxHelpDrawer isOpen onClose={() => {}} />);
        expect(screen.getByText('Ayuda — Diagrama de Flujo')).toBeTruthy();
    });

    it('calls onClose when backdrop is clicked', () => {
        const onClose = vi.fn();
        render(<PfdSyntaxHelpDrawer isOpen onClose={onClose} />);
        fireEvent.click(screen.getByTestId('pfd-help-drawer-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
        const onClose = vi.fn();
        render(<PfdSyntaxHelpDrawer isOpen onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('Cerrar ayuda'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows tutorial section by default', () => {
        render(<PfdSyntaxHelpDrawer isOpen onClose={() => {}} />);
        expect(screen.getByText('1. Símbolos del flujograma')).toBeTruthy();
    });

    it('switches to Prompt IA tab when clicked', () => {
        render(<PfdSyntaxHelpDrawer isOpen onClose={() => {}} />);
        fireEvent.click(screen.getByText('Prompt IA'));
        expect(screen.queryByText('1. Símbolos del flujograma')).toBeNull();
        // The textarea (with prompt content) should now be visible
        const textarea = screen.getByLabelText('Prompt IA') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        expect(textarea.value).toContain('Eres un asistente que genera flujogramas');
    });

    it('parameterises the prompt with header.partName', () => {
        render(
            <PfdSyntaxHelpDrawer
                isOpen
                onClose={() => {}}
                header={{ partName: 'TOP ROLL' }}
            />
        );
        fireEvent.click(screen.getByText('Prompt IA'));
        const textarea = screen.getByLabelText('Prompt IA') as HTMLTextAreaElement;
        expect(textarea.value).toContain('TOP ROLL');
    });

    it('calls navigator.clipboard.writeText with full prompt when "Copiar prompt" clicked', async () => {
        render(
            <PfdSyntaxHelpDrawer
                isOpen
                onClose={() => {}}
                header={{ partName: 'INSERT', customerName: 'VWA', applicableParts: '2HC.123.456' }}
            />
        );
        fireEvent.click(screen.getByText('Prompt IA'));

        const button = screen.getByText('Copiar prompt');
        await act(async () => {
            fireEvent.click(button);
        });

        const writeText = (navigator.clipboard.writeText as unknown) as ReturnType<typeof vi.fn>;
        expect(writeText).toHaveBeenCalledTimes(1);
        const arg = writeText.mock.calls[0][0] as string;
        expect(arg).toContain('INSERT');
        expect(arg).toContain('VWA');
        expect(arg).toContain('2HC.123.456');
        expect(arg).toContain('Eres un asistente que genera flujogramas');
    });
});
