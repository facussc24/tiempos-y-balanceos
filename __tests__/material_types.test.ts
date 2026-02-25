/**
 * Material Types - Unit Tests
 * 
 * Validates the new material and consumable type definitions
 * for simulation v1.0
 */

import { describe, it, expect } from 'vitest';
import type {
    Material,
    MaterialSupplyMode,
    TaskMaterial,
    ContinuousConsumable,
    StationMaterialBuffer,
    Task,
    StationConfig,
    ProjectData,
} from '../types';

describe('Material Types', () => {
    describe('Material interface', () => {
        it('should define a material with required fields', () => {
            const screw: Material = {
                id: 'MAT-001',
                name: 'Tornillo M6x20',
                unit: 'pieces',
                piecesPerContainer: 100,
                supplyMode: 'LINE_SIDE_BIN',
            };

            expect(screw.id).toBe('MAT-001');
            expect(screw.unit).toBe('pieces');
            expect(screw.supplyMode).toBe('LINE_SIDE_BIN');
        });

        it('should accept optional fields', () => {
            const tape: Material = {
                id: 'MAT-002',
                name: 'Cinta Aislante 50mm',
                unit: 'meters',
                piecesPerContainer: 50,
                supplyMode: 'LINE_SIDE_ROLL',
                supplierPartNumber: 'TAPE-50-BLK',
                costPerUnit: 0.05,
                alertThreshold: 0.25,
            };

            expect(tape.supplierPartNumber).toBe('TAPE-50-BLK');
            expect(tape.costPerUnit).toBe(0.05);
            expect(tape.alertThreshold).toBe(0.25);
        });

        it('should support all supply modes', () => {
            const modes: MaterialSupplyMode[] = [
                'LINE_SIDE_BIN',
                'LINE_SIDE_ROLL',
                'BULK_UNLIMITED',
            ];

            modes.forEach(mode => {
                const mat: Material = {
                    id: `TEST-${mode}`,
                    name: `Test ${mode}`,
                    unit: 'pieces',
                    piecesPerContainer: 10,
                    supplyMode: mode,
                };
                expect(mat.supplyMode).toBe(mode);
            });
        });
    });

    describe('TaskMaterial interface', () => {
        it('should link material to task with quantity', () => {
            const taskMat: TaskMaterial = {
                materialId: 'MAT-001',
                quantityPerCycle: 4,
            };

            expect(taskMat.materialId).toBe('MAT-001');
            expect(taskMat.quantityPerCycle).toBe(4);
        });
    });

    describe('ContinuousConsumable interface', () => {
        it('should define meters per cycle for rolls', () => {
            const consumable: ContinuousConsumable = {
                materialId: 'MAT-002',
                metersPerCycle: 0.3,
            };

            expect(consumable.materialId).toBe('MAT-002');
            expect(consumable.metersPerCycle).toBe(0.3);
        });
    });

    describe('StationMaterialBuffer interface', () => {
        it('should define buffer configuration', () => {
            const buffer: StationMaterialBuffer = {
                materialId: 'MAT-001',
                boxesOnRackInitial: 3,
                boxesTarget: 5,
                reorderPolicy: 'KANBAN',
                replenishmentPolicy: 'MILK_RUN',
            };

            expect(buffer.boxesOnRackInitial).toBe(3);
            expect(buffer.boxesTarget).toBe(5);
            expect(buffer.reorderPolicy).toBe('KANBAN');
            expect(buffer.replenishmentPolicy).toBe('MILK_RUN');
        });

        it('should support alertAutonomyMinutes for rolls', () => {
            const buffer: StationMaterialBuffer = {
                materialId: 'MAT-002',
                boxesOnRackInitial: 2,
                boxesTarget: 4,
                reorderPolicy: 'MIN_MAX',
                replenishmentPolicy: 'ANDON_CALL',
                alertAutonomyMinutes: 15,
            };

            expect(buffer.alertAutonomyMinutes).toBe(15);
        });
    });

    describe('Task extension', () => {
        it('should accept materials array', () => {
            const taskWithMaterials: Partial<Task> = {
                id: 'OP-001',
                description: 'Ensamblar componente',
                materials: [
                    { materialId: 'MAT-001', quantityPerCycle: 4 },
                    { materialId: 'MAT-003', quantityPerCycle: 2 },
                ],
            };

            expect(taskWithMaterials.materials).toHaveLength(2);
            expect(taskWithMaterials.materials![0].quantityPerCycle).toBe(4);
        });

        it('should accept continuousConsumables array', () => {
            const taskWithConsumables: Partial<Task> = {
                id: 'OP-002',
                description: 'Aplicar cinta',
                continuousConsumables: [
                    { materialId: 'MAT-002', metersPerCycle: 0.3 },
                ],
            };

            expect(taskWithConsumables.continuousConsumables).toHaveLength(1);
            expect(taskWithConsumables.continuousConsumables![0].metersPerCycle).toBe(0.3);
        });

        it('should remain backward compatible (no materials)', () => {
            const oldTask: Partial<Task> = {
                id: 'OP-OLD',
                description: 'Legacy task',
                // No materials or continuousConsumables
            };

            expect(oldTask.materials).toBeUndefined();
            expect(oldTask.continuousConsumables).toBeUndefined();
        });
    });

    describe('StationConfig extension', () => {
        it('should accept materialBuffers dictionary', () => {
            const station: Partial<StationConfig> = {
                id: 1,
                name: 'Estación 1',
                oeeTarget: 0.85,
                materialBuffers: {
                    'MAT-001': {
                        materialId: 'MAT-001',
                        boxesOnRackInitial: 3,
                        boxesTarget: 5,
                        reorderPolicy: 'KANBAN',
                        replenishmentPolicy: 'MILK_RUN',
                    },
                },
            };

            expect(station.materialBuffers).toBeDefined();
            expect(station.materialBuffers!['MAT-001'].boxesTarget).toBe(5);
        });

        it('should remain backward compatible (no materialBuffers)', () => {
            const oldStation: Partial<StationConfig> = {
                id: 1,
                oeeTarget: 0.85,
                // No materialBuffers
            };

            expect(oldStation.materialBuffers).toBeUndefined();
        });
    });

    describe('ProjectData extension', () => {
        it('should accept materials catalog', () => {
            const project: Partial<ProjectData> = {
                meta: {
                    name: 'Test Project',
                    date: '2026-01-29',
                    client: 'Test',
                    version: '1.0',
                    engineer: 'AI',
                    activeShifts: 1,
                    dailyDemand: 100,
                    manualOEE: 1,
                    useManualOEE: true,
                    configuredStations: 1
                },
                materials: [
                    {
                        id: 'MAT-001',
                        name: 'Tornillo M6x20',
                        unit: 'pieces',
                        piecesPerContainer: 100,
                        supplyMode: 'LINE_SIDE_BIN',
                    },
                ],
                shifts: [],
                sectors: [],
                tasks: [],
                assignments: [],
                stationConfigs: [],
            };

            expect(project.materials).toHaveLength(1);
            expect(project.materials![0].id).toBe('MAT-001');
        });

        it('should remain backward compatible (no materials)', () => {
            const oldProject: Partial<ProjectData> = {
                meta: {
                    name: 'Old Project',
                    date: '2026-01-29',
                    client: 'Test',
                    version: '1.0',
                    engineer: 'AI',
                    activeShifts: 1,
                    dailyDemand: 100,
                    manualOEE: 1,
                    useManualOEE: true,
                    configuredStations: 1

                },
                shifts: [],
                sectors: [],
                tasks: [],
                assignments: [],
                stationConfigs: [],
                // No materials
            };

            expect(oldProject.materials).toBeUndefined();
        });
    });
});
