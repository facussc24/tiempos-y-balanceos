
import { describe, it, expect } from 'vitest';
import { simulateBalance } from '../core/balancing/engine';
import { ProjectData, Task, Sector } from '../types';

describe('SALBP-1 Validation - Chips Scenario', () => {
    it('should balance Chips scenario into 1 station (Pure Time Logic)', () => {
        // 1. Setup Data (350 Demand -> Takt ~74s)
        // Total Time = 54.43s. 
        // Since Total < Takt, it MUST be 1 Station if Ergo is removed.

        const tasks: Task[] = [
            { id: "INY", description: "Inyectar", times: [8.14], averageTime: 8.14, standardTime: 8.14, predecessors: [], successors: ["CUR"], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100, executionMode: 'injection' },
            { id: "CUR", description: "Curado", times: [27.57], averageTime: 27.57, standardTime: 27.57, predecessors: ["INY"], successors: ["RET"], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100 },
            { id: "RET", description: "Retirar", times: [3.67], averageTime: 3.67, standardTime: 3.67, predecessors: ["CUR"], successors: ["TRA"], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100 },
            { id: "TRA", description: "Traslado", times: [1.33], averageTime: 1.33, standardTime: 1.33, predecessors: ["RET"], successors: ["SEL"], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100 },
            { id: "SEL", description: "Sellado", times: [2.31], averageTime: 2.31, standardTime: 2.31, predecessors: ["TRA"], successors: ["REF"], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100 },
            { id: "REF", description: "Refilado", times: [18.92], averageTime: 18.92, standardTime: 18.92, predecessors: ["SEL"], successors: ["EMB"], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100 },
            { id: "EMB", description: "Embalaje", times: [2.50], averageTime: 2.50, standardTime: 2.50, predecessors: ["REF"], successors: [], positionalWeight: 0, calculatedSuccessorSum: 0, fatigueCategory: 'standard', ratingFactor: 100 }
        ];

        const projectData: ProjectData = {
            meta: {
                name: "Chips Test",
                date: "2025-12-04",
                client: "Test",
                version: "1.0",
                engineer: "AI",
                activeShifts: 1,
                manualOEE: 0.85,
                useManualOEE: true,
                dailyDemand: 350,
                configuredStations: 1
            },
            shifts: [],
            sectors: [{ id: "Chips", name: "Chips", color: "#000" }],
            tasks: tasks,
            assignments: [],
            stationConfigs: []
        };

        // Takt Time Calculation:
        // Available = 8 * 3600 = 28800s
        // Effective = 28800 * 0.85 = 24480s
        // Demand = 350
        // Takt = 24480 / 350 = 69.94s (Wait, let's check utils logic)
        // Actually, let's trust the simulation function's inputs.

        const nominalSeconds = (8 * 3600) / 350; // ~82.28s
        const effectiveSeconds = nominalSeconds * 0.85; // ~69.94s

        // Total Task Time = 8.14+27.57+3.67+1.33+2.31+18.92+2.50 = 64.44s
        // 64.44s < 69.94s (Effective Takt)
        // Therefore, 1 Station is feasible.

        const result = simulateBalance(projectData, 'RPW', 'Test', nominalSeconds, effectiveSeconds);

        console.log("Stations:", result.stationsCount);
        console.log("Efficiency:", result.efficiency);
        console.log("Assignments:", result.assignments);

        // The engine now correctly produces 1 station (total 64.44s < takt 69.94s).
        // Previously the engine produced 2 stations due to injection task handling,
        // but the improved SALBP-2 path now achieves the theoretical optimum.
        expect(result.stationsCount).toBe(1);
        expect(result.efficiency).toBe(100); // Perfect single-station efficiency
    });
});
