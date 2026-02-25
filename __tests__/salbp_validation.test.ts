import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task } from '../types';

describe('SALBP-1 Validation: Ergo-ALBP-C Scenario', () => {
    // Scenario Configuration
    const nominalSeconds = 26.1; // Takt Time (435 min / 1000 pcs)
    const effectiveSeconds = 26.1; // Assuming 100% OEE for this test

    const tasks: Task[] = [
        { id: 'T1', description: 'Fijación', times: [12], averageTime: 12, standardTime: 12, ratingFactor: 100, fatigueCategory: 'standard', predecessors: [], successors: ['T2'], positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0, executionMode: 'manual' },
        { id: 'T2', description: 'Taladrado', times: [25], averageTime: 25, standardTime: 25, ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T1'], successors: ['T3'], positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0, executionMode: 'manual' },
        { id: 'T3', description: 'Inspección', times: [8], averageTime: 8, standardTime: 8, ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T2'], successors: ['T4'], positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0, executionMode: 'manual' },
        { id: 'T4', description: 'Ensamble Crítico', times: [35], averageTime: 35, standardTime: 35, ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T3'], successors: ['T5'], positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0, executionMode: 'manual' },
        { id: 'T5', description: 'Ajuste', times: [10], averageTime: 10, standardTime: 10, ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T4'], successors: ['T6'], positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0, executionMode: 'manual' },
        { id: 'T6', description: 'Empaque', times: [14], averageTime: 14, standardTime: 14, ratingFactor: 100, fatigueCategory: 'standard', predecessors: ['T5'], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, stdDev: 0, executionMode: 'manual' },
    ];

    const projectData: ProjectData = {
        meta: {
            name: 'Test SALBP-1',
            date: '2023-10-27',
            client: 'Test',
            version: '1.0',
            engineer: 'Test',
            activeShifts: 1,
            manualOEE: 1.0,
            useManualOEE: true,
            dailyDemand: 1000,
            configuredStations: 1
        },
        shifts: [],
        sectors: [],
        tasks: tasks,
        assignments: [],
        stationConfigs: []
    };

    it('should assign 2 operators to High Risk task with Ergo Factor 0.85', () => {
        // Run Balancing
        const result = simulateBalance(projectData, 'LCR', 'Test Run', nominalSeconds, effectiveSeconds);

        console.log('--- Simulation Results (Factor 0.85) ---');
        console.log(`Total Headcount: ${result.totalHeadcount}`);
        console.log(`Stations: ${result.stationsCount}`);
        console.log(`Efficiency: ${result.efficiency.toFixed(2)}%`);

        result.proposedConfigs.forEach(cfg => {
            const stationTasks = result.assignments.filter(a => a.stationId === cfg.id).map(a => a.taskId);
            console.log(`Station ${cfg.id} (Replicas: ${cfg.replicas}): ${stationTasks.join(', ')}`);
        });

        // Verification Logic
        // T4 (35s) with Factor 0.85 (Limit = 22.185s)
        // 35 / 22.185 = 1.57 -> Ceil(1.57) = 2 Operators

        // Find station with T4
        const t4Assignment = result.assignments.find(a => a.taskId === 'T4');
        expect(t4Assignment).toBeDefined();

        const t4StationConfig = result.proposedConfigs.find(c => c.id === t4Assignment?.stationId);
        expect(t4StationConfig).toBeDefined();

        // Expect 2 Replicas for T4's station
        expect(t4StationConfig?.replicas).toBe(2);

        // Total Headcount Check
        // Should be less than 7 (likely 6)
        expect(result.totalHeadcount).toBeLessThan(7);

        // Efficiency Check
        // Total Work = 104s. Headcount 6 * 26.1 = 156.6. Eff = 66.4%
        // Headcount 5 * 26.1 = 130.5. Eff = 79.7%
        expect(result.efficiency).toBeGreaterThan(60);
    });
});
