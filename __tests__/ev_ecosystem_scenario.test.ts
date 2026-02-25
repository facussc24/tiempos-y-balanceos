import { describe, it, expect } from 'vitest';
import { ProjectData, Task, Shift } from '../types';
import { calculateTaktTime } from '../core/balancing/simulation';
import { simulateBalance } from '../core/balancing/engine';
import { calculateTaskWeights } from '../utils/graph';

describe('EV Ecosystem Scenario Validation', () => {

    const dailyDemand = 450;

    // 1. GLOBAL CONFIG
    const shifts: Shift[] = [
        { id: 1, name: 'Turno Unico', startTime: '08:00', endTime: '16:00', breaks: [{ id: 'b1', name: 'Almuerzo', startTime: '12:00', duration: 30 }] }
    ];

    // 2. TASKS
    const tasks: Task[] = [
        // SECTOR 1
        {
            id: 'T10', description: 'Kitting Celdas',
            times: [30], averageTime: 30, standardTime: 30,
            ratingFactor: 100, fatigueCategory: 'standard',
            predecessors: [], successors: ['T20'],
            executionMode: 'manual', positionalWeight: 0, calculatedSuccessorSum: 0
        },
        // SECTOR 2
        {
            id: 'T20', description: 'Insercion Modulos (15kg)',
            times: [55], averageTime: 55, standardTime: 55,
            ratingFactor: 100, fatigueCategory: 'high',
            predecessors: ['T10'], successors: ['T30'],
            executionMode: 'manual', positionalWeight: 0, calculatedSuccessorSum: 0
        },
        // SECTOR 3
        {
            id: 'T30', description: 'Cableado HV',
            times: [59], averageTime: 59, standardTime: 59,
            ratingFactor: 100, fatigueCategory: 'none',
            predecessors: ['T20'], successors: [],
            executionMode: 'manual', positionalWeight: 0, calculatedSuccessorSum: 0
        }
    ];

    const projectData: ProjectData = {
        meta: {
            name: 'EV Ecosystem', dailyDemand, activeShifts: 1,
            manualOEE: 1.0, useManualOEE: true,
            useSectorOEE: true,
            version: '1', date: '', client: '', engineer: '', configuredStations: 1
        },
        shifts,
        tasks,
        assignments: [],
        sectors: [
            { id: 'S1', name: 'Prep', color: 'gray', targetOee: 1.0 },
            { id: 'S2', name: 'Ensamble', color: 'blue', targetOee: 1.0 },
            { id: 'S3', name: 'HV', color: 'orange', targetOee: 1.0 }
        ],
        stationConfigs: [],
        vsmExternalNodes: [],
        vsmInfoFlows: []
    };

    tasks[0].sectorId = 'S1';
    tasks[1].sectorId = 'S2';
    tasks[2].sectorId = 'S3';

    // Apply fatigue and calculate standardTime through the real pipeline
    projectData.tasks = calculateTaskWeights(tasks);

    let taktCalc: any; // Defined in Test A

    it('A. Logistics Validation (Pitch vs Cycle)', () => {
        taktCalc = calculateTaktTime(shifts, 1, dailyDemand, 1.0);
        expect(taktCalc.nominalSeconds).toBeCloseTo(60, 1);
        const pitchMinutes = (taktCalc.nominalSeconds * 20) / 60;
        expect(pitchMinutes).toBe(20);
        expect(12 < pitchMinutes).toBe(true);
    });

    it('B. Fatigue Check (Fatigue Penalty)', () => {
        const simResult = simulateBalance(projectData, 'LCR', 'EV Sim', taktCalc.nominalSeconds, taktCalc.nominalSeconds);
        const s2Config = simResult.proposedConfigs.find(c => {
            const items = simResult.assignments.filter(a => a.stationId === c.id);
            return items.some(i => i.taskId === 'T20');
        });
        expect(s2Config).toBeDefined();
        // Expect 2 Replicas due to 55s * 1.18 = 64.9s > 60s
        expect(s2Config?.replicas).toBe(2);
    });

    it('C. Heijunka Check (Weighted Mix)', () => {
        try {
            const simResult = simulateBalance(projectData, 'LCR', 'EV Sim', taktCalc.nominalSeconds, taktCalc.nominalSeconds);

            // Find Station for T30
            const s3Config = simResult.proposedConfigs.find(c => {
                const items = simResult.assignments.filter(a => a.stationId === c.id);
                return items.some(i => i.taskId === 'T30');
            });

            expect(s3Config).toBeDefined();
            expect(s3Config?.replicas).toBe(1);
        } catch (e) { console.error('Error Test C:', e); throw e; }
    });

});
