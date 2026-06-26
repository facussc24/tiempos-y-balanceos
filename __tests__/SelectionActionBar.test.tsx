import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionActionBar } from '../modules/balancing/components/SelectionActionBar';

describe('SelectionActionBar', () => {
    it('shows the selection count (singular vs plural)', () => {
        const { rerender } = render(
            <SelectionActionBar count={1} stationCount={3} onMove={() => {}} onClear={() => {}} />
        );
        expect(screen.getByText('1 tarea seleccionada')).toBeTruthy();

        rerender(<SelectionActionBar count={2} stationCount={3} onMove={() => {}} onClear={() => {}} />);
        expect(screen.getByText('2 tareas seleccionadas')).toBeTruthy();
    });

    it('lists one option per configured station', () => {
        render(<SelectionActionBar count={2} stationCount={4} onMove={() => {}} onClear={() => {}} />);
        const select = screen.getByLabelText('Mover a') as HTMLSelectElement;
        expect(select.querySelectorAll('option').length).toBe(4);
    });

    it('moves the selection to the chosen station', () => {
        const onMove = vi.fn();
        render(<SelectionActionBar count={2} stationCount={3} onMove={onMove} onClear={() => {}} />);
        const select = screen.getByLabelText('Mover a') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: '2' } });
        fireEvent.click(screen.getByRole('button', { name: /Mover/i }));
        expect(onMove).toHaveBeenCalledWith(2);
    });

    it('defaults to station 1 when the dropdown is untouched', () => {
        const onMove = vi.fn();
        render(<SelectionActionBar count={1} stationCount={3} onMove={onMove} onClear={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Mover/i }));
        expect(onMove).toHaveBeenCalledWith(1);
    });

    it('clears the selection', () => {
        const onClear = vi.fn();
        render(<SelectionActionBar count={1} stationCount={3} onMove={() => {}} onClear={onClear} />);
        fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
        expect(onClear).toHaveBeenCalled();
    });
});
