/**
 * Product Inheritance Tests
 * 
 * Tests for the resolver service that merges parent products
 * with child overrides at runtime.
 * 
 * @module __tests__/product_inheritance
 */
import { describe, it, expect, vi } from 'vitest';
import {
    resolveProductProcess,
    validateInheritance,
    ResolvedProduct,
    ParentLoaderFn
} from '../core/inheritance/resolver';
import { ProjectData, Task, TaskOverride, FatigueCategory, TaskMaterial } from '../types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Creates a minimal valid ProjectData for testing
 */
function createMockProject(overrides: Partial<ProjectData> = {}): ProjectData {
    return {
        meta: {
            name: 'Test Project',
            date: '2026-01-01',
            client: 'Test Client',
            version: '1.0',
            engineer: 'Test Engineer',
            activeShifts: 1,
            manualOEE: 0.85,
            useManualOEE: true,
            dailyDemand: 1000,
            configuredStations: 1,
            ...overrides.meta
        },
        shifts: overrides.shifts || [],
        sectors: overrides.sectors || [],
        tasks: overrides.tasks || [],
        assignments: overrides.assignments || [],
        stationConfigs: overrides.stationConfigs || [],
        materials: overrides.materials,
        taskOverrides: overrides.taskOverrides
    };
}

/**
 * Creates a minimal valid Task for testing
 */
function createMockTask(overrides: Partial<Task>): Task {
    return {
        id: overrides.id || 'TASK-001',
        description: overrides.description || 'Test Task',
        times: overrides.times || [30],
        averageTime: overrides.averageTime || 30,
        ratingFactor: overrides.ratingFactor || 100,
        fatigueCategory: overrides.fatigueCategory || ('standard' as FatigueCategory),
        standardTime: overrides.standardTime || 30,
        predecessors: overrides.predecessors || [],
        successors: overrides.successors || [],
        positionalWeight: overrides.positionalWeight || 0,
        calculatedSuccessorSum: overrides.calculatedSuccessorSum || 0,
        materials: overrides.materials,
        ...overrides
    };
}

/**
 * Creates a mock loader function that returns the provided project
 */
function createMockLoader(responses: Record<string, ProjectData>): ParentLoaderFn {
    return async (path: string) => {
        const project = responses[path];
        if (!project) {
            throw new Error(`Mock loader: File not found: ${path}`);
        }
        return project;
    };
}

// =============================================================================
// TEST CASES
// =============================================================================

describe('Product Inheritance Resolver', () => {

    // -------------------------------------------------------------------------
    // TEST 1: Padre simple sin overrides
    // -------------------------------------------------------------------------
    describe('Case 1: Project without parentPath', () => {
        it('should return project unchanged when parentPath is not set', async () => {
            const project = createMockProject({
                tasks: [
                    createMockTask({ id: 'T1', description: 'Task One', standardTime: 30 }),
                    createMockTask({ id: 'T2', description: 'Task Two', standardTime: 45 })
                ]
            });

            const mockLoader = vi.fn();
            const result = await resolveProductProcess(project, mockLoader);

            expect(result.wasResolved).toBe(false);
            expect(result.overridesApplied).toBe(0);
            expect(result.warnings).toHaveLength(0);
            expect(result.project.tasks).toHaveLength(2);
            expect(mockLoader).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // TEST 2: Hijo sobrescribe standardTime
    // -------------------------------------------------------------------------
    describe('Case 2: Child overrides standardTime', () => {
        it('should apply standardTime override from child', async () => {
            const parentProject = createMockProject({
                tasks: [
                    createMockTask({ id: 'CLIP-CABLES', description: 'Clipar Mazo', standardTime: 30 }),
                    createMockTask({ id: 'T2', description: 'Other Task', standardTime: 45 })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    name: 'Child Project',
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'CLIP-CABLES', standardTime: 35 }
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            expect(result.wasResolved).toBe(true);
            expect(result.overridesApplied).toBe(1);
            expect(result.project.tasks).toHaveLength(2);

            const clipTask = result.project.tasks.find(t => t.id === 'CLIP-CABLES');
            expect(clipTask?.standardTime).toBe(35); // Overridden

            const otherTask = result.project.tasks.find(t => t.id === 'T2');
            expect(otherTask?.standardTime).toBe(45); // Inherited
        });
    });

    // -------------------------------------------------------------------------
    // TEST 3: Hijo sobrescribe materials[]
    // -------------------------------------------------------------------------
    describe('Case 3: Child overrides materials', () => {
        it('should completely replace materials array with child override', async () => {
            const parentMaterials: TaskMaterial[] = [
                { materialId: 'SKU-L', quantityPerCycle: 1 }
            ];

            const childMaterials: TaskMaterial[] = [
                { materialId: 'SKU-R', quantityPerCycle: 1 }
            ];

            const parentProject = createMockProject({
                tasks: [
                    createMockTask({
                        id: 'CLIP-CABLES',
                        description: 'Clipar Mazo',
                        materials: parentMaterials
                    })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'CLIP-CABLES', materials: childMaterials }
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            const clipTask = result.project.tasks.find(t => t.id === 'CLIP-CABLES');
            expect(clipTask?.materials).toEqual(childMaterials);
            expect(clipTask?.materials?.[0].materialId).toBe('SKU-R');
        });
    });

    // -------------------------------------------------------------------------
    // TEST 4: Hijo excluye tarea (excluded: true)
    // -------------------------------------------------------------------------
    describe('Case 4: Child excludes inherited task', () => {
        it('should exclude task when override has excluded=true', async () => {
            const parentProject = createMockProject({
                tasks: [
                    createMockTask({ id: 'T1', description: 'Keep This' }),
                    createMockTask({ id: 'T2', description: 'Remove This' }),
                    createMockTask({ id: 'T3', description: 'Keep This Too' })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'T2', excluded: true }
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            expect(result.project.tasks).toHaveLength(2);
            expect(result.project.tasks.map(t => t.id)).toEqual(['T1', 'T3']);
            expect(result.overridesApplied).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // TEST 5: Override a tarea inexistente genera warning
    // -------------------------------------------------------------------------
    describe('Case 5: Override for non-existent task', () => {
        it('should generate warning for orphan override', async () => {
            const parentProject = createMockProject({
                tasks: [
                    createMockTask({ id: 'T1', description: 'Existing Task' })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'NON-EXISTENT', standardTime: 100 }
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toContain('NON-EXISTENT');
            expect(result.warnings[0]).toContain('did not match');
            expect(result.project.tasks).toHaveLength(1); // Only parent task
        });
    });

    // -------------------------------------------------------------------------
    // TEST 6: Hijo agrega tarea nueva (no es override)
    // -------------------------------------------------------------------------
    describe('Case 6: Child adds new task', () => {
        it('should preserve child-only tasks not in parent', async () => {
            const parentProject = createMockProject({
                tasks: [
                    createMockTask({ id: 'T1', description: 'Parent Task' })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [
                    createMockTask({ id: 'CHILD-ONLY', description: 'New Task in Child' })
                ],
                taskOverrides: []
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            expect(result.project.tasks).toHaveLength(2);
            expect(result.project.tasks.map(t => t.id)).toContain('T1');
            expect(result.project.tasks.map(t => t.id)).toContain('CHILD-ONLY');
        });
    });

    // -------------------------------------------------------------------------
    // TEST 7: Detección de ciclo (A→B→A)
    // -------------------------------------------------------------------------
    describe('Case 7: Cycle detection', () => {
        it('should throw error when inheritance cycle is detected', async () => {
            const projectA = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    name: 'Project A',
                    parentPath: './projectB.json'
                }
            });

            const projectB = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    name: 'Project B',
                    parentPath: './projectA.json'  // Cycle!
                }
            });

            const loader = createMockLoader({
                './projectA.json': projectA,
                './projectB.json': projectB
            });

            await expect(resolveProductProcess(projectA, loader))
                .rejects.toThrow('Cycle detected');
        });
    });

    // -------------------------------------------------------------------------
    // TEST 8: Orden estable de tareas
    // -------------------------------------------------------------------------
    describe('Case 8: Stable task order', () => {
        it('should preserve parent task order after merge', async () => {
            const parentProject = createMockProject({
                tasks: [
                    createMockTask({ id: 'T1', description: 'First' }),
                    createMockTask({ id: 'T2', description: 'Second' }),
                    createMockTask({ id: 'T3', description: 'Third' }),
                    createMockTask({ id: 'T4', description: 'Fourth' })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'T3', standardTime: 99 } // Override middle task
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            const taskIds = result.project.tasks.map(t => t.id);
            expect(taskIds).toEqual(['T1', 'T2', 'T3', 'T4']); // Order preserved
        });
    });

    // -------------------------------------------------------------------------
    // TEST 9: Override parcial (solo standardTime, materials heredados)
    // -------------------------------------------------------------------------
    describe('Case 9: Partial override preserves other fields', () => {
        it('should preserve parent materials when only standardTime is overridden', async () => {
            const parentMaterials: TaskMaterial[] = [
                { materialId: 'MAT-001', quantityPerCycle: 5 }
            ];

            const parentProject = createMockProject({
                tasks: [
                    createMockTask({
                        id: 'T1',
                        description: 'Task with Materials',
                        standardTime: 30,
                        materials: parentMaterials
                    })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'T1', standardTime: 50 } // Only override time
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            const task = result.project.tasks[0];
            expect(task.standardTime).toBe(50); // Overridden
            expect(task.materials).toEqual(parentMaterials); // Preserved from parent
        });
    });

    // -------------------------------------------------------------------------
    // TEST 10: Múltiples overrides
    // -------------------------------------------------------------------------
    describe('Case 10: Multiple overrides applied', () => {
        it('should apply multiple overrides correctly', async () => {
            const parentProject = createMockProject({
                tasks: [
                    createMockTask({ id: 'T1', standardTime: 10 }),
                    createMockTask({ id: 'T2', standardTime: 20 }),
                    createMockTask({ id: 'T3', standardTime: 30 }),
                    createMockTask({ id: 'T4', standardTime: 40 })
                ]
            });

            const childProject = createMockProject({
                meta: {
                    ...createMockProject().meta,
                    parentPath: './parent.json'
                },
                tasks: [],
                taskOverrides: [
                    { taskId: 'T1', standardTime: 11 },
                    { taskId: 'T2', excluded: true },
                    { taskId: 'T3', standardTime: 33, materials: [{ materialId: 'NEW', quantityPerCycle: 1 }] }
                ]
            });

            const loader = createMockLoader({ './parent.json': parentProject });
            const result = await resolveProductProcess(childProject, loader);

            expect(result.overridesApplied).toBe(3);
            expect(result.project.tasks).toHaveLength(3); // T2 excluded

            const t1 = result.project.tasks.find(t => t.id === 'T1');
            const t3 = result.project.tasks.find(t => t.id === 'T3');
            const t4 = result.project.tasks.find(t => t.id === 'T4');

            expect(t1?.standardTime).toBe(11);
            expect(t3?.standardTime).toBe(33);
            expect(t3?.materials?.[0].materialId).toBe('NEW');
            expect(t4?.standardTime).toBe(40); // Unchanged
        });
    });

});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('validateInheritance', () => {

    it('should return valid=true for project without parent', async () => {
        const project = createMockProject();
        const result = await validateInheritance(project, vi.fn());

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should report orphan overrides as warnings', async () => {
        const parentProject = createMockProject({
            tasks: [createMockTask({ id: 'T1' })]
        });

        const childProject = createMockProject({
            meta: {
                ...createMockProject().meta,
                parentPath: './parent.json'
            },
            taskOverrides: [
                { taskId: 'MISSING', standardTime: 100 }
            ]
        });

        const loader = createMockLoader({ './parent.json': parentProject });
        const result = await validateInheritance(childProject, loader);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('MISSING');
    });

});
