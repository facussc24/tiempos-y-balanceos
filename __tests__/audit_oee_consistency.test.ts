import { describe, it, expect } from 'vitest';
import { ProjectData, Task, Shift } from '../types';
import { simulateBalance } from '../core/balancing/engine';

describe('Audit: Station OEE Consistency', () => {

    const dailyDemand = 100;
    const nominalSeconds = 60; // Takt

    const shifts: Shift[] = [
        { id: 1, name: 'Shift 1', startTime: '08:00', endTime: '16:00', breaks: [] }
    ];

    const tasks: Task[] = [
        {
            id: 'T1', description: 'Task S1',
            times: [20], averageTime: 20, standardTime: 20,
            ratingFactor: 100, fatigueCategory: 'none',
            predecessors: [], successors: ['T2'],
            executionMode: 'manual', positionalWeight: 0, calculatedSuccessorSum: 0,
            sectorId: 'S1'
        },
        {
            id: 'T2', description: 'Task S2',
            times: [20], averageTime: 20, standardTime: 20,
            ratingFactor: 100, fatigueCategory: 'none',
            predecessors: ['T1'], successors: [],
            executionMode: 'manual', positionalWeight: 0, calculatedSuccessorSum: 0,
            sectorId: 'S2'
        }
    ];

    const projectData: ProjectData = {
        meta: {
            name: 'Audit Sim', dailyDemand, activeShifts: 1,
            manualOEE: 0.85, // GLOBAL DEFAULT
            useManualOEE: true,
            useSectorOEE: true, // ENABLE SECTOR OEE
            version: '1', date: '', client: '', engineer: '', configuredStations: 0
        },
        shifts,
        tasks,
        assignments: [],
        sectors: [
            { id: 'S1', name: 'Sector 1', color: 'red', targetOee: 0.50 }, // LOW OEE
            { id: 'S2', name: 'Sector 2', color: 'green', targetOee: 1.00 }, // HIGH OEE
            { id: 'S3', name: 'Sector 3', color: 'blue', targetOee: 0.85 }
        ],
        stationConfigs: [],
        vsmExternalNodes: [],
        vsmInfoFlows: []
    };

    it('Should assign correct Target OEE to stations based on Sector', () => {
        const simResult = simulateBalance(projectData, 'LCR', 'Audit', nominalSeconds, nominalSeconds);

        // Check assignments
        // T1 -> Station 1
        // T2 -> Station 2 (Sector Break)

        const s1Config = simResult.proposedConfigs.find(c => c.id === 1);
        const s2Config = simResult.proposedConfigs.find(c => c.id === 2);

        expect(s1Config).toBeDefined();
        expect(s2Config).toBeDefined();

        // CHECK OEE TARGETS
        console.log('Station 1 OEE:', s1Config?.oeeTarget);
        console.log('Station 2 OEE:', s2Config?.oeeTarget);

        // EXPECTATION: S1 should use Sector 1 OEE (0.50)
        expect(s1Config?.oeeTarget).toBe(0.50);

        // EXPECTATION: S2 should use Sector 2 OEE (1.00)
        expect(s2Config?.oeeTarget).toBe(1.00);
    });

});
