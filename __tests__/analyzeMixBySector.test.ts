/**
 * Tests for analyzeMixBySector function
 * Created as part of H-05 audit fix
 * 
 * @module analyzeMixBySector.test
 */
import { describe, it, expect } from 'vitest';
import { analyzeMixBySector } from '../core/balancing/mixBalancing';
import { SimulationResult } from '../core/balancing/engine';
import { PlantConfig, Task } from '../types';

// Helper to create mock SimulationResult
function createMockResult(tasks: Array<{
    id: string;
    standardTime: number;
    sectorId?: string;
    requiredMachineId?: string;
    description?: string;
}>): SimulationResult {
    return {
        heuristicName: 'Test',
        technicalName: 'RPW',
        stationsCount: 1,
        totalHeadcount: 1,
        cycleTime: 60,
        efficiency: 85,
        idleTime: 0,
        parallelStations: 0,
        sortedTasks: tasks.map(t => ({
            id: t.id,
            description: t.description || `Task ${t.id}`,
            standardTime: t.standardTime,
            sectorId: t.sectorId,
            requiredMachineId: t.requiredMachineId,
            predecessors: [],
            successors: [],
            times: [],
            averageTime: t.standardTime,
            ratingFactor: 100,
            fatigueCategory: 'standard',
            executionMode: 'manual',
            modelApplicability: {}
        } as unknown as Task)),
        assignments: [],
        proposedConfigs: []
    } as SimulationResult;
}

describe('analyzeMixBySector', () => {

    it('should handle empty result gracefully', () => {
        const result = createMockResult([]);
        const products = [{ path: 'test', demand: 100 }];

        const analysis = analyzeMixBySector(result, products, 60, undefined, 0.85);

        expect(analysis.sectors).toHaveLength(0);
        expect(analysis.totalPuestos).toBe(0);
        expect(analysis.hasAnyDeficit).toBe(false);
    });

    it('should group tasks by sector correctly', () => {
        const result = createMockResult([
            { id: 'T1', standardTime: 30, sectorId: 'SEC1' },
            { id: 'T2', standardTime: 45, sectorId: 'SEC1' },
            { id: 'T3', standardTime: 20, sectorId: 'SEC2' }
        ]);
        const products = [{ path: 'test', demand: 100 }];

        const analysis = analyzeMixBySector(result, products, 60, undefined, 0.85);

        // Should have at least 2 sectors (SEC1 and SEC2)
        expect(analysis.sectors.length).toBeGreaterThanOrEqual(2);
    });

    it('should fallback to Manual sector for tasks without sectorId', () => {
        const result = createMockResult([
            { id: 'T1', standardTime: 30 } // No sectorId
        ]);
        const products = [{ path: 'test', demand: 100 }];

        const analysis = analyzeMixBySector(result, products, 60, undefined, 0.85);

        const manualSector = analysis.sectors.find(s => s.sectorName === 'Manual');
        expect(manualSector).toBeDefined();
    });

    it('should apply efficiency factor correctly (1.0 vs 0.85)', () => {
        const result = createMockResult([
            { id: 'T1', standardTime: 60 }
        ]);
        const products = [{ path: 'test', demand: 100 }];
        const taktTime = 60;

        // With 100% efficiency (theoretical)
        const analysis100 = analyzeMixBySector(result, products, taktTime, undefined, 1.0);

        // With 85% efficiency (real OBE)
        const analysis85 = analyzeMixBySector(result, products, taktTime, undefined, 0.85);

        // 85% efficiency should require more resources (or equal)
        expect(analysis85.totalPuestos).toBeGreaterThanOrEqual(analysis100.totalPuestos);
    });

    it('should handle undefined plantConfig without crashing', () => {
        const result = createMockResult([
            { id: 'T1', standardTime: 30, requiredMachineId: 'UNKNOWN_MACHINE' }
        ]);
        const products = [{ path: 'test', demand: 100 }];

        // Should not throw
        expect(() => {
            analyzeMixBySector(result, products, 60, undefined, 0.85);
        }).not.toThrow();
    });

    it('should calculate totalDemand correctly from products', () => {
        const result = createMockResult([
            { id: 'T1', standardTime: 30 }
        ]);
        const products = [
            { path: 'prodA', demand: 100 },
            { path: 'prodB', demand: 200 }
        ];

        const analysis = analyzeMixBySector(result, products, 60, undefined, 0.85);

        expect(analysis.totalDemand).toBe(300);
    });

    it('should return valid taktTime from input', () => {
        const result = createMockResult([
            { id: 'T1', standardTime: 30 }
        ]);
        const products = [{ path: 'test', demand: 100 }];

        const analysis = analyzeMixBySector(result, products, 45.5, undefined, 0.85);

        expect(analysis.taktTime).toBe(45.5);
    });

    it('should detect deficit when required > available machines', () => {
        const result = createMockResult([
            // Task that requires many machines (high time / takt ratio)
            { id: 'T1', standardTime: 300, requiredMachineId: 'MACHINE_A' }
        ]);
        const products = [{ path: 'test', demand: 100 }];

        const plantConfig: PlantConfig = {
            version: 1,
            lastModified: Date.now(),
            sectors: [],
            machines: [
                { id: 'MACHINE_A', name: 'Machine A', availableUnits: 1, category: 'costura', sectorId: 'SEC1' }
            ]
        };

        const analysis = analyzeMixBySector(result, products, 60, plantConfig, 0.85);

        // With 300s task and 60s takt at 85% efficiency, should require ~6 units
        // Only 1 available, so should have deficit
        expect(analysis.hasAnyDeficit).toBe(true);
    });
});
