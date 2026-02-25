/**
 * V4 Mix Mode Audit Test Suite
 * 
 * This file contains the specific test cases from the V4 Audit Plan:
 * 3.1 Weighted Time Calculation
 * 3.2 Graph Union (Precedence)
 * 3.3 Heijunka Sequencing
 * 
 * @version Audit V4.0
 */
import { describe, it, expect } from 'vitest';
import {
    buildCombinedPrecedenceGraph,
    calculateWeightedTimes,
    generateHeijunkaSequence
} from '../core/balancing/mixBalancing';
import { ProjectData, Task } from '../types';

// Helper to create minimal tasks
function createTask(id: string, time: number, predecessors: string[] = [], successors: string[] = []): Task {
    return {
        id,
        description: `Task ${id}`,
        times: [time],
        averageTime: time,
        standardTime: time,
        ratingFactor: 100,
        fatigueCategory: 'standard',
        executionMode: 'manual',
        predecessors,
        successors,
        modelApplicability: {}
    } as Task;
}

// Helper to create minimal ProjectData
function createProject(name: string, tasks: Task[], demand: number): ProjectData {
    const project: ProjectData = {
        meta: {
            name,
            date: '',
            client: '',
            version: '1',
            engineer: '',
            activeShifts: 1,
            dailyDemand: demand,
            manualOEE: 0.85,
            useManualOEE: true,
            configuredStations: 1
        },
        shifts: [],
        sectors: [],
        tasks,
        assignments: [],
        stationConfigs: []
    };
    (project as any)._mixDemand = demand;
    return project;
}

describe('V4 Audit - Section 3.1: Weighted Time Calculation', () => {

    it('AUDIT 3.1: User Test Case - Prod A (10s) + Prod B (20s), equal demand = 15s', () => {
        /**
         * User Scenario:
         * Producto A (Demanda 100): Tarea 1 = 10s
         * Producto B (Demanda 100): Tarea 1 = 20s
         * Cálculo Esperado: (10 × 0.5) + (20 × 0.5) = 15s
         */
        const taskA = createTask('T1', 10);
        const taskB = createTask('T1', 20);

        const productA = createProject('Producto A', [taskA], 100);
        const productB = createProject('Producto B', [taskB], 100);

        const { tasks } = buildCombinedPrecedenceGraph([productA, productB]);
        const weighted = calculateWeightedTimes(tasks, 200); // total demand

        const task1 = weighted.find(t => t.id === 'T1');

        expect(task1).toBeDefined();
        expect(task1!.standardTime).toBe(15); // (10*0.5) + (20*0.5) = 15
    });

    it('AUDIT 3.1b: Unequal demand - Prod A 67%, Prod B 33%', () => {
        /**
         * From docstring example:
         * Product A: 45s, demand 600 (67%)
         * Product B: 60s, demand 300 (33%)
         * Weighted = (45 × 0.67) + (60 × 0.33) ≈ 50s
         */
        const taskA = createTask('T1', 45);
        const taskB = createTask('T1', 60);

        const productA = createProject('Producto A', [taskA], 600);
        const productB = createProject('Producto B', [taskB], 300);

        const { tasks } = buildCombinedPrecedenceGraph([productA, productB]);
        const weighted = calculateWeightedTimes(tasks, 900);

        const task1 = weighted.find(t => t.id === 'T1');

        expect(task1).toBeDefined();
        // (45 * 600/900) + (60 * 300/900) = 30 + 20 = 50
        expect(task1!.standardTime).toBe(50);
    });

    it('AUDIT 3.1c: Zero demand edge case', () => {
        const taskA = createTask('T1', 10);
        const productA = createProject('Producto A', [taskA], 0);

        const { tasks } = buildCombinedPrecedenceGraph([productA]);
        const weighted = calculateWeightedTimes(tasks, 0);

        // Should not crash, should return original time
        expect(weighted[0].standardTime).toBe(10);
    });
});

describe('V4 Audit - Section 3.2: Graph Union (Precedences)', () => {

    it('AUDIT 3.2: User Test Case - Union of graphs A->B and A->C', () => {
        /**
         * User Scenario:
         * Prod A: 1 -> 2
         * Prod B: 1 -> 3
         * Result: Task 1 is predecessor of BOTH 2 AND 3
         */
        const taskA1 = createTask('T1', 10, [], ['T2']);
        const taskA2 = createTask('T2', 10, ['T1'], []);

        const taskB1 = createTask('T1', 15, [], ['T3']);
        const taskB3 = createTask('T3', 12, ['T1'], []);

        const productA = createProject('Producto A', [taskA1, taskA2], 100);
        const productB = createProject('Producto B', [taskB1, taskB3], 100);

        const { tasks } = buildCombinedPrecedenceGraph([productA, productB]);

        const task1 = tasks.find(t => t.id === 'T1');
        const task2 = tasks.find(t => t.id === 'T2');
        const task3 = tasks.find(t => t.id === 'T3');

        expect(task1).toBeDefined();
        expect(task2).toBeDefined();
        expect(task3).toBeDefined();

        // Task 1 should have both T2 and T3 as successors (union)
        expect(task1!.successors).toContain('T2');
        expect(task1!.successors).toContain('T3');

        // Task 2 and Task 3 should have T1 as predecessor
        expect(task2!.predecessors).toContain('T1');
        expect(task3!.predecessors).toContain('T1');
    });

    it('AUDIT 3.2b: Isolated tasks remain isolated', () => {
        /**
         * Verify: A task that only exists in one product
         * should NOT inherit precedences from other products
         */
        const taskA1 = createTask('T1', 10, [], ['T2']);
        const taskA2 = createTask('T2', 10, ['T1'], []);

        // T4 is ONLY in product B, no relation to A's graph
        const taskB4 = createTask('T4', 20, [], []);

        const productA = createProject('Producto A', [taskA1, taskA2], 100);
        const productB = createProject('Producto B', [taskB4], 100);

        const { tasks } = buildCombinedPrecedenceGraph([productA, productB]);

        const task4 = tasks.find(t => t.id === 'T4');

        expect(task4).toBeDefined();
        expect(task4!.predecessors).toHaveLength(0); // T4 should have no predecessors
        expect(task4!.successors).toHaveLength(0);   // T4 should have no successors
    });
});

describe('V4 Audit - Section 3.3: Heijunka Sequencing', () => {

    it('AUDIT 3.3: User Test Case - Demand A=100, B=50 (2:1) -> A-A-B', () => {
        /**
         * V8.2: Changed to batch format per expert decision
         * User Scenario:
         * Demanda A=100, B=50 (Relación 2:1)
         * New Format: Batch sequence instead of A-A-B
         */
        const products = [
            { name: 'Producto A', demand: 100 },
            { name: 'Producto B', demand: 50 }
        ];

        const { sequence, rationale } = generateHeijunkaSequence(products);

        // V8.2: Should produce batch format
        expect(sequence).toContain('Lote');
        expect(rationale).toContain('Producción por lotes');
    });

    it('AUDIT 3.3b: Clear names - V8.2 batch format', () => {
        const products = [
            { name: 'Alpha', demand: 100 },
            { name: 'Beta', demand: 50 }
        ];

        const { sequence, rationale } = generateHeijunkaSequence(products);

        // V8.2: Batch format - sorted by demand
        expect(sequence).toContain('Lote Alpha');
        expect(sequence).toContain('Cambio');
        expect(rationale).toContain('%');
    });

    it('AUDIT 3.3c: Equal demand -> batch with cambio', () => {
        const products = [
            { name: 'X', demand: 100 },
            { name: 'Y', demand: 100 }
        ];

        const { sequence } = generateHeijunkaSequence(products);

        // V8.2: Batch format with Cambio between
        expect(sequence).toContain('Lote');
        expect(sequence).toContain('Cambio');
    });

    it('AUDIT 3.3d: Single product - batch format', () => {
        const products = [
            { name: 'Solo', demand: 100 }
        ];

        const { sequence, rationale } = generateHeijunkaSequence(products);

        expect(sequence).toContain('Lote Solo');
        expect(rationale).toContain('solo modelo');
    });

    it('AUDIT 3.3e: Empty products', () => {
        const { sequence, rationale } = generateHeijunkaSequence([]);

        expect(sequence).toBe('');
        expect(rationale).toContain('No hay productos');
    });
});

describe('V4 Audit - Section 5: Stress Testing', () => {

    it('AUDIT 5.1: High Volume - 20 products', () => {
        const products: ProjectData[] = [];

        for (let i = 1; i <= 20; i++) {
            const task = createTask(`T1`, 10 + i);
            products.push(createProject(`Product${i}`, [task], 100));
        }

        const startTime = Date.now();
        const { tasks } = buildCombinedPrecedenceGraph(products);
        const weighted = calculateWeightedTimes(tasks, 2000);
        const elapsed = Date.now() - startTime;

        expect(weighted).toHaveLength(1); // All share T1
        expect(elapsed).toBeLessThan(1000); // Should complete in < 1 second
    });

    it('AUDIT 5.2: Long names - 255 character product names', () => {
        const longName = 'A'.repeat(255);
        const task = createTask('T1', 10);
        const product = createProject(longName, [task], 100);

        const { tasks } = buildCombinedPrecedenceGraph([product]);

        expect(tasks).toHaveLength(1);
        // Should not crash
    });

    it('AUDIT 5.3: Empty mix - no products', () => {
        const { tasks } = buildCombinedPrecedenceGraph([]);
        const weighted = calculateWeightedTimes(tasks, 0);

        expect(tasks).toHaveLength(0);
        expect(weighted).toHaveLength(0);
    });
});
