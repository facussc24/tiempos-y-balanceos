import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BalancingMetrics } from '../modules/balancing/components/BalancingMetrics';

const baseProps: any = {
    configuredStations: 3,
    totalHeadcount: 3,
    efficiency: 80,
    efficiencyLine: 80,
    saturationVsTakt: 80,
    realCycleTime: 50,
    machineCycleTime: 0,
    totalIdleTimePerCycle: 10,
    dailyLostHours: 0,
    setStationCount: () => {},
    addStation: () => {},
    removeEmptyStation: () => {},
    emptyStationIds: [],
    clearBalance: () => {},
    handleOptimization: () => {},
    nominalTaktTime: 60,
    stationData: [],
};

describe('BalancingMetrics — optimize/cancel button', () => {
    it('shows an enabled "Balanceo Automático" button when not optimizing', () => {
        render(<BalancingMetrics {...baseProps} gaProgress={null} />);
        const btn = screen.getByRole('button', { name: /Balanceo Automático/i }) as HTMLButtonElement;
        expect(btn).toBeTruthy();
        expect(btn.disabled).toBe(false);
        expect(screen.queryByLabelText('Cancelar optimización')).toBeNull();
    });

    it('disables the optimize button and shows progress + cancel while running', () => {
        const onCancel = vi.fn();
        render(
            <BalancingMetrics
                {...baseProps}
                gaProgress={{ generation: 5, totalGenerations: 100, bestFitness: 1234, phase: 'evolving' }}
                onCancelOptimization={onCancel}
            />
        );

        const optimizeBtn = screen.getByRole('button', { name: /Optimizando/i }) as HTMLButtonElement;
        expect(optimizeBtn.disabled).toBe(true);

        // Progress text reflects the current generation
        expect(screen.getByText('Optimizando 5/100')).toBeTruthy();

        const cancelBtn = screen.getByLabelText('Cancelar optimización');
        fireEvent.click(cancelBtn);
        expect(onCancel).toHaveBeenCalled();
    });
});
