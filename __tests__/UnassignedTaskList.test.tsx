import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { UnassignedTaskList } from '../modules/balancing/components/UnassignedTaskList';

const task = (id: string): any => ({
    id,
    description: `Tarea ${id}`,
    standardTime: 10,
    averageTime: 10,
    executionMode: 'manual',
});

const renderList = (over: any = {}) =>
    render(
        <DndContext>
            <UnassignedTaskList
                unassignedTasks={over.unassignedTasks ?? [task('A'), task('B')]}
                sectorsList={over.sectorsList ?? []}
                performAssignment={over.performAssignment ?? (() => {})}
                performBulkAssignment={over.performBulkAssignment ?? (() => {})}
                selectedTaskIds={over.selectedTaskIds ?? new Set()}
                onToggleTaskSelection={over.onToggleTaskSelection ?? (() => {})}
            />
        </DndContext>
    );

describe('UnassignedTaskList', () => {
    it('renders the unassigned task ids and count', () => {
        renderList();
        expect(screen.getByText('Tareas Sin Asignar (2)')).toBeTruthy();
        expect(screen.getByText('A')).toBeTruthy();
        expect(screen.getByText('B')).toBeTruthy();
    });

    it('bulk-assigns all tasks to station 1 (via performBulkAssignment) after confirm', () => {
        const performBulkAssignment = vi.fn();
        renderList({ performBulkAssignment });

        fireEvent.click(screen.getByRole('button', { name: 'Asignar todo a Estación 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sí, asignar' }));

        expect(performBulkAssignment).toHaveBeenCalledWith(['A', 'B'], 1);
    });

    it('toggles selection from the task checkbox', () => {
        const onToggle = vi.fn();
        renderList({ onToggleTaskSelection: onToggle });
        fireEvent.click(screen.getByLabelText('Seleccionar tarea A'));
        expect(onToggle).toHaveBeenCalledWith('A');
    });

    it('reflects selected state via the checkbox label', () => {
        renderList({ selectedTaskIds: new Set(['B']) });
        expect(screen.getByLabelText('Quitar selección de tarea B')).toBeTruthy();
    });

    it('shows the empty state when there are no tasks', () => {
        renderList({ unassignedTasks: [] });
        expect(screen.getByText('Todas las tareas asignadas')).toBeTruthy();
    });
});
