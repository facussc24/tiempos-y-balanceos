import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { StationCard } from '../modules/balancing/components/StationCard';

const baseData: any = {
    tasks: [{ id: 'T1', description: 'Coser unión', standardTime: 20, averageTime: 20, executionMode: 'manual' }],
    meta: { capacityLimitMode: 'effective' },
    assignments: [{ taskId: 'T1', stationId: 1 }],
    sectors: [],
};

const baseSt = { id: 1, time: 20, limit: 50, replicas: 1, oee: 0.85, tasks: ['T1'] };

const renderCard = (over: any = {}) =>
    render(
        <DndContext>
            <StationCard
                st={over.st ?? baseSt}
                sectorsList={over.sectorsList ?? []}
                draggedTask={over.draggedTask ?? null}
                isOverload={false}
                data={over.data ?? baseData}
                effectiveSeconds={50}
                onUpdateReplicas={() => {}}
                onOpenConfig={() => {}}
                onUnassignTask={over.onUnassignTask ?? (() => {})}
                dragPreview={over.dragPreview ?? null}
                selectedTaskIds={over.selectedTaskIds ?? new Set()}
                onToggleTaskSelection={over.onToggleTaskSelection ?? (() => {})}
            />
        </DndContext>
    );

describe('StationCard', () => {
    it('renders a context-rich aria-label (sector/saturation)', () => {
        const station = renderCard().getByLabelText(/^Estación 1/);
        expect(station.getAttribute('aria-label')).toContain('saturación');
    });

    it('renders the assigned task chip', () => {
        renderCard();
        expect(screen.getByText('T1')).toBeTruthy();
    });

    it('toggles selection when the task checkbox is clicked', () => {
        const onToggle = vi.fn();
        renderCard({ onToggleTaskSelection: onToggle });
        fireEvent.click(screen.getByLabelText('Seleccionar tarea T1'));
        expect(onToggle).toHaveBeenCalledWith('T1');
    });

    it('reflects the selected state via the checkbox label', () => {
        renderCard({ selectedTaskIds: new Set(['T1']) });
        expect(screen.getByLabelText('Quitar selección de tarea T1')).toBeTruthy();
    });

    it('warns about a blocked constraint in the live drag preview', () => {
        renderCard({
            dragPreview: {
                stationId: 1,
                previewTime: 40,
                previewSaturation: 80,
                delta: 20,
                wouldOverload: false,
                constraintBlocked: true,
                constraintReason: 'Conflicto de máquina',
            },
        });
        expect(screen.getByText('No permitido aquí')).toBeTruthy();
        expect(screen.getByText('Conflicto de máquina')).toBeTruthy();
    });

    it('shows the normal saturation preview when no constraint is violated', () => {
        renderCard({
            dragPreview: {
                stationId: 1,
                previewTime: 40,
                previewSaturation: 80,
                delta: 20,
                wouldOverload: false,
                constraintBlocked: false,
            },
        });
        expect(screen.queryByText('No permitido aquí')).toBeNull();
        // The non-blocked overlay shows the OK status badge.
        expect(screen.getByText('OK')).toBeTruthy();
    });
});
