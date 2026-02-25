/**
 * Quality Checkpoint: JSON Inheritance Fusion Test
 * 
 * User's specific test case:
 * - padre.json: Task "Soldar" with time=100, material=A
 * - hijo.json: References padre.json, overrides material=B (keeps time)
 * - Expected: time=100 (inherited), material=B (overridden)
 */
import { describe, it, expect } from 'vitest';
import { resolveProductProcess, ParentLoaderFn } from '../core/inheritance/resolver';
import { ProjectData, Task, FatigueCategory, TaskMaterial } from '../types';

// =============================================================================
// TEST FIXTURES: Exact scenario from user request
// =============================================================================

const PADRE_JSON: ProjectData = {
    meta: {
        name: 'Padre',
        date: '2026-01-01',
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        dailyDemand: 1000,
        configuredStations: 1
    },
    shifts: [],
    sectors: [],
    tasks: [
        {
            id: 'SOLDAR',
            description: 'Soldar componente',
            times: [100],
            averageTime: 100,
            ratingFactor: 100,
            fatigueCategory: 'standard' as FatigueCategory,
            standardTime: 100,  // <-- tiempo: 100
            predecessors: [],
            successors: [],
            positionalWeight: 0,
            calculatedSuccessorSum: 0,
            materials: [{ materialId: 'A', quantityPerCycle: 1 }]  // <-- material: A
        }
    ],
    assignments: [],
    stationConfigs: []
};

const HIJO_JSON: ProjectData = {
    meta: {
        name: 'Hijo',
        date: '2026-01-01',
        client: 'Test',
        version: '1.0',
        engineer: 'Test',
        activeShifts: 1,
        manualOEE: 0.85,
        useManualOEE: true,
        dailyDemand: 1000,
        configuredStations: 1,
        parentPath: './padre.json'  // <-- Referencia al padre
    },
    shifts: [],
    sectors: [],
    tasks: [],  // <-- Sin tareas propias, hereda del padre
    assignments: [],
    stationConfigs: [],
    taskOverrides: [
        {
            taskId: 'SOLDAR',
            // NO incluye standardTime - debe heredar 100
            materials: [{ materialId: 'B', quantityPerCycle: 1 }]  // <-- Override: material B
        }
    ]
};

// =============================================================================
// USER'S EXACT TEST CASE
// =============================================================================

describe('Quality Checkpoint: JSON Inheritance Fusion', () => {

    it('CRITICAL: tiempo heredado + material sobreescrito = Milk Run Ready', async () => {
        // Mock loader that returns padre.json
        const mockLoader: ParentLoaderFn = async (path: string) => {
            if (path === './padre.json') {
                return PADRE_JSON;
            }
            throw new Error(`Unknown file: ${path}`);
        };

        // Execute resolution
        const result = await resolveProductProcess(HIJO_JSON, mockLoader);

        // ASSERTIONS
        expect(result.wasResolved).toBe(true);
        expect(result.overridesApplied).toBe(1);

        // Find the SOLDAR task
        const soldarTask = result.project.tasks.find(t => t.id === 'SOLDAR');
        expect(soldarTask).toBeDefined();

        // ===== USER'S VALIDATION CRITERIA =====

        // 1. tiempo: 100 (heredado del padre)
        expect(soldarTask!.standardTime).toBe(100);
        console.log('✅ tiempo: 100 - HEREDADO CORRECTAMENTE');

        // 2. material: B (sobreescrito por hijo)
        expect(soldarTask!.materials).toBeDefined();
        expect(soldarTask!.materials!.length).toBe(1);
        expect(soldarTask!.materials![0].materialId).toBe('B');
        console.log('✅ material: B - SOBREESCRITO CORRECTAMENTE');

        // 3. Milk Run should see the correct SKU
        console.log('✅ MILK RUN READY: El consumo de material será SKU-B, no SKU-A');
    });

    it('Regression: Override only time, keep parent materials', async () => {
        const hijoOnlyTime: ProjectData = {
            ...HIJO_JSON,
            taskOverrides: [
                {
                    taskId: 'SOLDAR',
                    standardTime: 150  // Override solo tiempo
                    // materials NO incluido - debe heredar del padre
                }
            ]
        };

        const mockLoader: ParentLoaderFn = async () => PADRE_JSON;
        const result = await resolveProductProcess(hijoOnlyTime, mockLoader);

        const soldarTask = result.project.tasks.find(t => t.id === 'SOLDAR');

        // tiempo sobreescrito
        expect(soldarTask!.standardTime).toBe(150);

        // material heredado (A, no B)
        expect(soldarTask!.materials![0].materialId).toBe('A');
        console.log('✅ Partial override: tiempo=150, material=A (heredado)');
    });

});
