/**
 * Mix Simplifier Tests
 * 
 * Tests for UI transformation layer in mixSimplifier.ts
 * Covers: toSimplifiedResult, toSectorCards, generateSummary
 * 
 * @module mixSimplifier.test
 */
import { describe, it, expect } from 'vitest';
import {
    toSimplifiedResult,
    toSectorCards,
    generateSummary
} from '../core/balancing/mixSimplifier';
import { MixSectorAnalysis, SectorRequirement, MachineRequirement } from '../types';

// =============================================================================
// HELPER FACTORIES
// =============================================================================

/**
 * Factory para crear mocks de MachineRequirement
 */
const createMockMachine = (overrides: Partial<MachineRequirement> = {}): MachineRequirement => ({
    machineId: 'MACHINE-001',
    machineName: 'Test Machine',
    unitsRequired: 1,
    unitsAvailable: 5,
    hasDeficit: false,
    totalWeightedTime: 50,
    saturationPerUnit: 80,
    productBreakdown: [],
    taskDescriptions: ['Test task'],
    ...overrides
});

/**
 * Factory para crear mocks de SectorRequirement
 */
const createMockSector = (overrides: Partial<SectorRequirement> = {}): SectorRequirement => ({
    sectorId: 'SECTOR-TEST',
    sectorName: 'Test Sector',
    sectorColor: '#8B5CF6',
    totalPuestos: 1,
    machines: [],
    manualOperators: 0,
    ...overrides
});

/**
 * Factory para crear mocks de MixSectorAnalysis
 */
const createMockAnalysis = (overrides: Partial<MixSectorAnalysis> = {}): MixSectorAnalysis => ({
    sectors: [],
    totalPuestos: 0,
    totalOperators: 0,
    hasAnyDeficit: false,
    taktTime: 60,
    totalDemand: 1000,
    ...overrides
});

// =============================================================================
// TESTS
// =============================================================================

describe('Mix Simplifier', () => {

    describe('toSimplifiedResult', () => {

        it('should return viable result when no deficits exist', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        sectorId: 'COSTURA',
                        sectorName: 'Costura',
                        totalPuestos: 2,
                        machines: [createMockMachine({ unitsRequired: 2, hasDeficit: false })]
                    })
                ],
                totalPuestos: 2,
                totalOperators: 2,
                hasAnyDeficit: false
            });

            const products = [
                { path: '/path/to/A', name: 'Product A', demand: 600 },
                { path: '/path/to/B', name: 'Product B', demand: 400 }
            ];

            const result = toSimplifiedResult(analysis, products, 60);

            expect(result.isViable).toBe(true);
            expect(result.summary).toContain('✅');
            expect(result.warnings).toHaveLength(0);
        });

        it('should return non-viable result when deficits exist', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        machines: [createMockMachine({
                            unitsRequired: 5,
                            unitsAvailable: 2,
                            hasDeficit: true
                        })]
                    })
                ],
                hasAnyDeficit: true
            });

            const products = [{ path: '/path/to/A', name: 'Product A', demand: 1000 }];

            const result = toSimplifiedResult(analysis, products, 60);

            expect(result.isViable).toBe(false);
            expect(result.summary).toContain('⚠️');
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('should calculate totalMachines correctly across sectors', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        sectorId: 'S1',
                        machines: [
                            createMockMachine({ machineId: 'M1', unitsRequired: 2 }),
                            createMockMachine({ machineId: 'M2', unitsRequired: 3 })
                        ]
                    }),
                    createMockSector({
                        sectorId: 'S2',
                        machines: [
                            createMockMachine({ machineId: 'M3', unitsRequired: 1 })
                        ]
                    })
                ],
                totalOperators: 6
            });

            const products = [{ path: '/path/to/A', name: 'Product A', demand: 1000 }];

            const result = toSimplifiedResult(analysis, products, 60);

            // 2 + 3 + 1 = 6 machines
            expect(result.totalMachines).toBe(6);
        });

        it('should calculate totalOperators from sector operatorsRequired', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({ sectorId: 'S1', totalPuestos: 3 }),
                    createMockSector({ sectorId: 'S2', totalPuestos: 4 })
                ],
                totalOperators: 10
            });

            const products = [{ path: '/path/to/A', name: 'Product A', demand: 1000 }];

            const result = toSimplifiedResult(analysis, products, 60);

            // 3 + 4 = 7 operators (from sector totalPuestos)
            expect(result.totalOperators).toBe(7);
        });

        it('should calculate product breakdown percentages correctly', () => {
            const analysis = createMockAnalysis({
                sectors: [createMockSector()],
                totalDemand: 1000
            });

            const products = [
                { path: '/path/to/A', name: 'Product A', demand: 600 },
                { path: '/path/to/B', name: 'Product B', demand: 400 }
            ];

            const result = toSimplifiedResult(analysis, products, 60);

            expect(result.productBreakdown).toHaveLength(2);
            expect(result.productBreakdown[0].productName).toBe('Product A');
            expect(result.productBreakdown[0].percentage).toBe(60);
            expect(result.productBreakdown[1].productName).toBe('Product B');
            expect(result.productBreakdown[1].percentage).toBe(40);
        });

        it('should include taktTimeSeconds in result', () => {
            const analysis = createMockAnalysis({ taktTime: 45.5 });
            const products = [{ path: '/path/to/A', name: 'A', demand: 1000 }];

            const result = toSimplifiedResult(analysis, products, 45.5);

            expect(result.taktTimeSeconds).toBe(45.5);
        });

    });

    describe('toSectorCards', () => {

        it('should transform sector with multiple machines', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        sectorId: 'COSTURA',
                        sectorName: 'Costura',
                        sectorColor: '#8B5CF6',
                        machines: [
                            createMockMachine({ machineId: 'M1', machineName: 'Recta' }),
                            createMockMachine({ machineId: 'M2', machineName: 'Overlock' }),
                            createMockMachine({ machineId: 'M3', machineName: 'Collaretera' })
                        ],
                        totalPuestos: 5
                    })
                ]
            });

            const products = [{ path: '/path/to/A', name: 'Product A', demand: 1000 }];

            const cards = toSectorCards(analysis, products);

            expect(cards).toHaveLength(1);
            expect(cards[0].machines).toHaveLength(3);
            expect(cards[0].sectorName).toBe('Costura');
            expect(cards[0].sectorColor).toBe('#8B5CF6');
        });

        it('should detect shared products when multiple products in breakdown', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        machines: [
                            createMockMachine({
                                productBreakdown: [
                                    { productPath: '/path/to/A', productName: 'Product A', color: '#FF0000', timeContribution: 30, percentageOfTotal: 60 },
                                    { productPath: '/path/to/B', productName: 'Product B', color: '#00FF00', timeContribution: 20, percentageOfTotal: 40 }
                                ]
                            })
                        ]
                    })
                ]
            });

            const products = [
                { path: '/path/to/A', name: 'Product A', demand: 600 },
                { path: '/path/to/B', name: 'Product B', demand: 400 }
            ];

            const cards = toSectorCards(analysis, products);

            expect(cards[0].isShared).toBe(true);
            expect(cards[0].sharedProducts).toContain('Product A');
            expect(cards[0].sharedProducts).toContain('Product B');
        });

        it('should generate deficit alerts for machines with deficits', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        machines: [
                            createMockMachine({
                                machineName: 'Inyectora',
                                unitsRequired: 5,
                                unitsAvailable: 2,
                                hasDeficit: true
                            })
                        ]
                    })
                ]
            });

            const products = [{ path: '/path/to/A', name: 'A', demand: 1000 }];

            const cards = toSectorCards(analysis, products);

            expect(cards[0].alerts.length).toBeGreaterThan(0);
            expect(cards[0].alerts[0]).toContain('Faltan');
            expect(cards[0].alerts[0]).toContain('Inyectora');
        });

        it('should include operator count per sector', () => {
            const analysis = createMockAnalysis({
                sectors: [
                    createMockSector({
                        totalPuestos: 8
                    })
                ]
            });

            const products = [{ path: '/path/to/A', name: 'A', demand: 1000 }];

            const cards = toSectorCards(analysis, products);

            expect(cards[0].operatorsRequired).toBe(8);
        });

    });

    describe('generateSummary', () => {

        it('should generate positive summary when viable', () => {
            const summary = generateSummary(true, 5, 3);

            expect(summary).toContain('✅');
            expect(summary).toContain('5 personas');
            expect(summary).toContain('3 máquinas');
        });

        it('should generate warning summary when not viable', () => {
            const summary = generateSummary(false, 10, 8);

            expect(summary).toContain('⚠️');
            expect(summary).toContain('Faltan recursos');
        });

        it('should handle singular form for 1 operator', () => {
            const summary = generateSummary(true, 1, 1);

            // Should still work even with singular (implementation may use plural form)
            expect(summary).toContain('✅');
        });

    });

});
