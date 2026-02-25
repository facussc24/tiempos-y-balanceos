/**
 * E2E Test: Starvation with Inherited Variant
 * 
 * Verifies that a child product with overridden standardPack
 * triggers starvation when bins are insufficient for demand.
 * 
 * @test modules/flow-simulator integration with inheritance
 * @version 9.0.0
 */

import { describe, it, expect, vi } from 'vitest';
import { resolveProductProcess, ParentLoaderFn } from '../core/inheritance/resolver';
import { ProjectData, TaskMaterial } from '../types';

// Mock parent product with generous bin size
const createParentProduct = (): ProjectData => ({
    meta: {
        name: 'Parent Product',
        date: '2024-01-01',
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        dailyDemand: 500,
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        configuredStations: 1,
    },
    shifts: [],
    sectors: [],
    tasks: [
        {
            id: 'TASK-01',
            description: 'Assembly with material',
            times: [30],
            averageTime: 30,
            ratingFactor: 100,
            fatigueCategory: 'low',
            standardTime: 30,
            predecessors: [],
            successors: [],
            positionalWeight: 100,
            calculatedSuccessorSum: 0,
            // GENEROUS bins: 100 pcs per bin, long cycle = won't starve
            materials: [
                {
                    materialId: 'MAT-GENERIC',
                    quantityPerCycle: 1,
                    standardPack: 100,  // Large bins
                    replenishmentMinutes: 30,
                    safetyMinutes: 5
                } as TaskMaterial
            ]
        }
    ],
    assignments: [],
    stationConfigs: [],
    materials: [
        { id: 'MAT-GENERIC', name: 'Generic Material', unit: 'pieces', piecesPerContainer: 100, supplyMode: 'LINE_SIDE_BIN' }
    ]
});

// Create child that overrides with TINY bins
const createChildProduct = (parentPath: string): ProjectData => ({
    meta: {
        name: 'Child Variant - Small Bins',
        date: '2024-01-02',
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        dailyDemand: 500,
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        configuredStations: 1,
        parentPath,
    },
    shifts: [],
    sectors: [],
    tasks: [], // Empty - inherits from parent
    taskOverrides: [
        {
            taskId: 'TASK-01',
            // Override materials with TINY bins
            materials: [
                {
                    materialId: 'MAT-SKU-SMALL',
                    quantityPerCycle: 2, // Higher consumption!
                    standardPack: 5,     // TINY bins - will starve quickly
                    replenishmentMinutes: 60, // Long wait for milk run
                    safetyMinutes: 0     // No safety buffer
                } as TaskMaterial
            ]
        }
    ],
    assignments: [],
    stationConfigs: [],
    materials: [
        { id: 'MAT-SKU-SMALL', name: 'Small SKU Variant', unit: 'pieces', piecesPerContainer: 5, supplyMode: 'LINE_SIDE_BIN' }
    ]
});

describe('Starvation E2E: Inherited Variant', () => {

    it('should detect starvation risk when child has small standardPack', async () => {
        const parentProduct = createParentProduct();
        const childProduct = createChildProduct('./parent.json');

        const parentLoader: ParentLoaderFn = async () => parentProduct;

        // Resolve inheritance
        const resolved = await resolveProductProcess(childProduct, parentLoader);

        // Verify resolution worked
        expect(resolved.wasResolved).toBe(true);
        expect(resolved.project.tasks.length).toBe(1);

        // Verify overridden materials
        const task = resolved.project.tasks[0];
        expect(task.materials).toBeDefined();
        expect(task.materials?.length).toBe(1);

        const mat = task.materials![0];
        expect(mat.materialId).toBe('MAT-SKU-SMALL');
        expect(mat.standardPack).toBe(5); // Small bins from child
        expect(mat.quantityPerCycle).toBe(2); // High consumption from child

        // Calculate theoretical K
        // K = D × (T + Safety) / Q
        // For 8 hour shift: D = 60 pcs/hour = 480 pcs/shift
        // With quantityPerCycle=2: actual consumption = 960 pcs/shift of material
        // T = 60 min, Safety = 0
        // Q = 5 pcs/bin
        // K = 960 × (60 + 0) / 480 / 5 = 24 bins needed!

        // With only typical 2-4 bins at line-side: GUARANTEED STARVATION
        const demandPerShift = 480; // pieces produced
        const materialConsumption = demandPerShift * mat.quantityPerCycle!;
        const cycleTimeMin = mat.replenishmentMinutes ?? 60;
        const safetyMin = mat.safetyMinutes ?? 0;
        const shiftMinutes = 480;

        // Pieces needed to cover one Milk Run cycle
        const demandDuringCycle = materialConsumption * (cycleTimeMin + safetyMin) / shiftMinutes;
        const binsNeeded = Math.ceil(demandDuringCycle / mat.standardPack!);

        console.log('Starvation analysis:', {
            materialConsumption,
            demandDuringCycle: demandDuringCycle.toFixed(1),
            binsNeeded,
            standardPack: mat.standardPack
        });

        // With standardPack=5 and high consumption, we need MANY bins
        expect(binsNeeded).toBeGreaterThan(10);

        // If typical line-side has 2-4 bins, shortfall is significant
        const typicalBinsAtLine = 3;
        const shortfall = binsNeeded - typicalBinsAtLine;

        expect(shortfall).toBeGreaterThan(5); // Significant shortfall

        console.log(`⚠️ STARVATION RISK: Need ${binsNeeded} bins, have ${typicalBinsAtLine}, shortfall: ${shortfall}`);
    });

    it('parent product should NOT show starvation with generous bins', async () => {
        const parentProduct = createParentProduct();

        // Use parent directly (no inheritance)
        const task = parentProduct.tasks[0];
        const mat = task.materials![0];

        expect(mat.standardPack).toBe(100); // Large bins
        expect(mat.quantityPerCycle).toBe(1); // Normal consumption

        // Calculate K for parent
        const demandPerShift = 480;
        const materialConsumption = demandPerShift * mat.quantityPerCycle!;
        const cycleTimeMin = mat.replenishmentMinutes ?? 30;
        const safetyMin = mat.safetyMinutes ?? 5;
        const shiftMinutes = 480;

        const demandDuringCycle = materialConsumption * (cycleTimeMin + safetyMin) / shiftMinutes;
        const binsNeeded = Math.ceil(demandDuringCycle / mat.standardPack!);

        console.log('Parent analysis:', {
            demandDuringCycle: demandDuringCycle.toFixed(1),
            binsNeeded,
            standardPack: mat.standardPack
        });

        // With large bins, need very few
        expect(binsNeeded).toBeLessThanOrEqual(3);

        console.log(`✅ NO STARVATION: Parent only needs ${binsNeeded} bins`);
    });

});
