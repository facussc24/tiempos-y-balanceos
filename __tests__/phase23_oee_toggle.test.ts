
import { describe, it, expect } from 'vitest';
import { ProjectData, Task } from '../types';
import { simulateBalance } from '../core/balancing/engine';

describe('Phase 23: OEE Integration & Toggle', () => {

    const createTask = (id: string, time: number, sector: string | undefined): Task => ({
        id,
        description: `Task ${id}`,
        times: [time, time, time, time, time],
        averageTime: time,
        standardTime: time,
        ratingFactor: 100,
        fatigueCategory: 'standard',
        predecessors: [],
        successors: [],
        positionalWeight: 0,
        calculatedSuccessorSum: 0,
        stdDev: 0,
        executionMode: 'manual',
        sectorId: sector,
        isMachineInternal: false
    });

    it('Should assign 1 Replica (Global OEE 0.85 -> Limit 85 > Task 80)', () => {
        const data: ProjectData = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1,
                dailyDemand: 288,
                manualOEE: 0.85,
                useManualOEE: true,
                useSectorOEE: false, // OFF
                configuredStations: 0
            },
            shifts: [{ id: 1, name: 'T1', startTime: '06:00', endTime: '14:00', breaks: [] }], // Fixed Property Names
            sectors: [{ id: 'SEC1', name: 'Sector 1', color: '#fff', targetOee: 0.50 }],
            tasks: [createTask('T1', 80, 'SEC1')],
            assignments: [],
            stationConfigs: []
        };

        // Pass explicit Takt Time (100s)
        const result = simulateBalance(data, 'RPW', 'Test Case 1', 100, 100);

        // Expect 1 Station because 80 < 85
        expect(result.stationsCount).toBe(1);

        // Configs: find station 1
        const config = result.proposedConfigs.find(c => c.id === 1);
        const replicas = config?.replicas || 1;

        console.log('DEBUG Case 1 Replicas:', replicas);
        expect(replicas).toBe(1);
    });

    it('Should assign 2 Replicas (Sector OEE 0.50 -> Limit 50 < Task 80)', () => {
        const data: ProjectData = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1,
                dailyDemand: 288,
                manualOEE: 0.85,
                useManualOEE: true,
                useSectorOEE: true, // ON
                configuredStations: 0
            },
            shifts: [{ id: 1, name: 'T1', startTime: '06:00', endTime: '14:00', breaks: [] }],
            sectors: [{ id: 'SEC1', name: 'Sector 1', color: '#fff', targetOee: 0.50 }],
            tasks: [createTask('T1', 80, 'SEC1')],
            assignments: [],
            stationConfigs: []
        };

        const result = simulateBalance(data, 'RPW', 'Test Case 2', 100, 100);
        const config = result.proposedConfigs.find(c => c.id === 1);
        const replicas = config?.replicas || 1;

        console.log('DEBUG Case 2 Replicas:', replicas);

        // Task 80 / Limit 50 = 1.6 => 2 Replicas
        expect(replicas).toBe(2);
    });

    it('Should fallback to Global OEE (0.85) if Sector undefined', () => {
        const data: ProjectData = {
            meta: {
                name: 'Test', date: '', client: '', version: '', engineer: '',
                activeShifts: 1,
                dailyDemand: 288,
                manualOEE: 0.85,
                useManualOEE: true,
                useSectorOEE: true, // ON
                configuredStations: 0
            },
            shifts: [{ id: 1, name: 'T1', startTime: '06:00', endTime: '14:00', breaks: [] }],
            sectors: [{ id: 'SEC1', name: 'Sector 1', color: '#fff', targetOee: 0.50 }],
            tasks: [createTask('T2', 80, undefined)], // No Sector
            assignments: [],
            stationConfigs: []
        };

        const result = simulateBalance(data, 'RPW', 'Test Case 3', 100, 100);
        const config = result.proposedConfigs.find(c => c.id === 1);
        const replicas = config?.replicas || 1;

        console.log('DEBUG Case 3 Replicas:', replicas);
        expect(replicas).toBe(1);
    });

});
