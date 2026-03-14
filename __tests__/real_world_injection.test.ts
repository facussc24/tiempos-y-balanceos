/**
 * Real-World PU Injection Molding Scenarios — Automotive Industry
 *
 * Sources:
 * - US Patent 20140371337A1 (PU foam cure times)
 * - Covestro RIM/Bayfill technical data
 * - Euromoulders Automotive Seating guide
 * - Hennecke WKH oval conveyors
 * - CompositesWorld LFI/SRIM demold data
 * - Chem-Trend PU molding process guide
 * - Shoplogix OEE in automotive (60-75% avg, 85% world-class)
 *
 * These 4 scenarios cover the main PU automotive products:
 *   A) Seat cushion — high volume, long cure, many cavities
 *   B) Headrest — low volume, integral skin, comfortable takt
 *   C) Bumper energy absorber — RIM/RRIM, medium volume
 *   D) Dashboard NVH pad — fast cure, tight takt, high volume
 */

import { calculateInjectionMetrics, CavityCalculationInput } from '../core/math/injection';
import { ManualOperation } from '../types';

// Helper to create manual operations
const mkOp = (id: string, desc: string, time: number, type: 'internal' | 'external'): ManualOperation => ({
    id, description: desc, time, type
});

describe('Real-World PU Injection Scenarios', () => {

    // ============================================================================
    // SCENARIO A: Seat Cushion (Almohadón de asiento)
    // High volume, long cure (240s), flexible PU foam on carousel
    // ============================================================================
    describe('A: Seat Cushion — High Volume Carousel', () => {
        const manualOps: ManualOperation[] = [
            mkOp('a1', 'Desmoldante (spray release)', 15, 'internal'),
            mkOp('a2', 'Colocar inserto (wire frame)', 20, 'internal'),
            mkOp('a3', 'Limpieza molde', 10, 'internal'),
            mkOp('a4', 'Retirar pieza (demold)', 12, 'external'),
            mkOp('a5', 'Inspección visual', 8, 'external'),
            mkOp('a6', 'Cortar rebaba (trim flash)', 15, 'external'),
        ];

        const input: CavityCalculationInput = {
            puInyTime: 8,
            puCurTime: 240,
            activeShifts: 2,
            dailyDemand: 800,
            oee: 0.78,
            availableSeconds: 52200, // 2 shifts × 8h - 2×45min lunch
            manualOps,
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        };

        it('should calculate correct N* (saturation point)', () => {
            const result = calculateInjectionMetrics(input);
            // N* = ceil(1 + 240/8) = ceil(31) = 31
            expect(result.inputs.nStar).toBe(31);
        });

        it('should calculate correct takt time', () => {
            const result = calculateInjectionMetrics(input);
            // takt = (52200 × 0.78) / 800 = 50.895s
            expect(result.inputs.taktTime).toBeCloseTo(50.895, 1);
        });

        it('should select N=7 as minimum feasible (N=6 exceeds takt)', () => {
            const result = calculateInjectionMetrics(input);
            // N=6: realCycle ≈ 53.83s > 50.895s (NOT feasible)
            // N=7: realCycle ≈ 47.29s ≤ 50.895s (FEASIBLE)
            expect(result.inputs.activeN).toBe(7);
        });

        it('should verify N=6 is NOT feasible', () => {
            const result = calculateInjectionMetrics(input);
            const scenario6 = result.chartData.find(d => d.n === 6);
            expect(scenario6).toBeDefined();
            expect(scenario6!.realCycle).toBeGreaterThan(50.895);
        });

        it('should verify N=7 IS feasible', () => {
            const result = calculateInjectionMetrics(input);
            const scenario7 = result.chartData.find(d => d.n === 7);
            expect(scenario7).toBeDefined();
            expect(scenario7!.realCycle).toBeLessThanOrEqual(50.895);
        });

        it('should produce reasonable hourly output at N=7', () => {
            const result = calculateInjectionMetrics(input);
            // At N=7, realCycle ≈ 47.3s → hourly ≈ 3600/47.3 ≈ 76 pz/h
            expect(result.metrics.hourlyOutput).toBeGreaterThan(60);
            expect(result.metrics.hourlyOutput).toBeLessThan(100);
        });

        it('should have single machine feasibility at N=7', () => {
            const result = calculateInjectionMetrics(input);
            const scenario7 = result.chartData.find(d => d.n === 7);
            expect(scenario7!.isSingleMachineFeasible).toBe(true);
        });
    });

    // ============================================================================
    // SCENARIO B: Headrest (Cabecera integral skin)
    // Low volume, integral skin PU, single shift, comfortable takt
    // ============================================================================
    describe('B: Headrest — Low Volume, Integral Skin', () => {
        const manualOps: ManualOperation[] = [
            mkOp('b1', 'Desmoldante', 12, 'internal'),
            mkOp('b2', 'Colocar funda cosida (load cover)', 25, 'internal'),
            mkOp('b3', 'Colocar varilla (adjustment rod)', 8, 'internal'),
            mkOp('b4', 'Retirar cabecera (demold)', 10, 'external'),
            mkOp('b5', 'Inspección + embalaje', 12, 'external'),
        ];

        const input: CavityCalculationInput = {
            puInyTime: 6,
            puCurTime: 180,
            activeShifts: 1,
            dailyDemand: 150,
            oee: 0.82,
            availableSeconds: 26100, // 1 shift × 8h - 45min lunch
            manualOps,
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        };

        it('should calculate takt time for low demand', () => {
            const result = calculateInjectionMetrics(input);
            // takt = (26100 × 0.82) / 150 = 142.68s
            expect(result.inputs.taktTime).toBeCloseTo(142.68, 1);
        });

        it('should select N=2 (N=1 exceeds takt, N=2 fits comfortably)', () => {
            const result = calculateInjectionMetrics(input);
            // N=1: realCycle ≈ 208s > 142.68s
            // N=2: realCycle ≈ 107s ≤ 142.68s
            expect(result.inputs.activeN).toBe(2);
        });

        it('should NOT over-allocate cavities despite high N*', () => {
            const result = calculateInjectionMetrics(input);
            // N* = 31 but demand only needs N=2
            expect(result.inputs.nStar).toBe(31);
            expect(result.inputs.activeN).toBe(2);
        });

        it('should produce hourly output matching low demand', () => {
            const result = calculateInjectionMetrics(input);
            // At N=2, realCycle ≈ 107s → hourly ≈ 33.6 pz/h
            // Daily need: 150 / 7.25h = 20.7 pz/h (we overshoot = good)
            expect(result.metrics.hourlyOutput).toBeGreaterThan(20);
            expect(result.metrics.hourlyOutput).toBeLessThan(50);
        });
    });

    // ============================================================================
    // SCENARIO C: Bumper Energy Absorber (Absorbedor de energía para paragolpe)
    // RIM/RRIM, semi-rigid foam, medium volume
    // ============================================================================
    describe('C: Bumper Energy Absorber — RIM/RRIM', () => {
        const manualOps: ManualOperation[] = [
            mkOp('c1', 'Desmoldante', 10, 'internal'),
            mkOp('c2', 'Colocar fascia (bumper skin)', 18, 'internal'),
            mkOp('c3', 'Retirar conjunto (demold)', 8, 'external'),
            mkOp('c4', 'Verificar espesor (thickness check)', 6, 'external'),
            mkOp('c5', 'Colocar en rack', 5, 'external'),
        ];

        const input: CavityCalculationInput = {
            puInyTime: 5,
            puCurTime: 90,
            activeShifts: 2,
            dailyDemand: 500,
            oee: 0.80,
            availableSeconds: 52200,
            manualOps,
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        };

        it('should calculate N* for short cure RIM process', () => {
            const result = calculateInjectionMetrics(input);
            // N* = ceil(1 + 90/5) = 19
            expect(result.inputs.nStar).toBe(19);
        });

        it('should select N=2 for medium demand', () => {
            const result = calculateInjectionMetrics(input);
            // takt = (52200 × 0.80) / 500 = 83.52s
            // N=1: realCycle ≈ 114s > 83.52s
            // N=2: realCycle ≈ 59.5s ≤ 83.52s
            expect(result.inputs.activeN).toBe(2);
        });

        it('should have single machine feasibility at N=2', () => {
            const result = calculateInjectionMetrics(input);
            const scenario2 = result.chartData.find(d => d.n === 2);
            expect(scenario2!.isSingleMachineFeasible).toBe(true);
        });
    });

    // ============================================================================
    // SCENARIO D: Dashboard NVH Pad (Relleno de panel de instrumentos)
    // Fast cure (60s), tight takt, very high volume
    // ============================================================================
    describe('D: Dashboard NVH Pad — Tight Takt, Fast Cure', () => {
        const manualOps: ManualOperation[] = [
            mkOp('d1', 'Desmoldante', 8, 'internal'),
            mkOp('d2', 'Colocar substrato (dashboard panel)', 10, 'internal'),
            mkOp('d3', 'Retirar pieza (demold)', 5, 'external'),
            mkOp('d4', 'Control visual rápido', 4, 'external'),
        ];

        const input: CavityCalculationInput = {
            puInyTime: 3,
            puCurTime: 60,
            activeShifts: 2,
            dailyDemand: 1200,
            oee: 0.82,
            availableSeconds: 52200,
            manualOps,
            manualTimeOverride: null,
            headcountMode: 'auto',
            userHeadcountOverride: 1,
            cavityMode: 'auto',
        };

        it('should have tight takt time', () => {
            const result = calculateInjectionMetrics(input);
            // takt = (52200 × 0.82) / 1200 = 35.67s
            expect(result.inputs.taktTime).toBeCloseTo(35.67, 1);
        });

        it('should select N=3 (N=2 barely misses takt, N=3 fits)', () => {
            const result = calculateInjectionMetrics(input);
            // N=2: realCycle ≈ 37.5s > 35.67s (misses by ~2s)
            // N=3: realCycle ≈ 26.0s ≤ 35.67s
            expect(result.inputs.activeN).toBe(3);
        });

        it('should verify N=2 boundary failure (misses by ~2s)', () => {
            const result = calculateInjectionMetrics(input);
            const scenario2 = result.chartData.find(d => d.n === 2);
            expect(scenario2).toBeDefined();
            expect(scenario2!.realCycle).toBeGreaterThan(35);
            expect(scenario2!.realCycle).toBeLessThan(40); // Misses narrowly
        });

        it('should produce high hourly output at N=3', () => {
            const result = calculateInjectionMetrics(input);
            // At N=3, realCycle ≈ 26s → hourly ≈ 138 pz/h
            expect(result.metrics.hourlyOutput).toBeGreaterThan(100);
            expect(result.metrics.hourlyOutput).toBeLessThan(200);
        });
    });

    // ============================================================================
    // CROSS-SCENARIO VALIDATION
    // ============================================================================
    describe('Cross-Scenario Validation', () => {
        it('longer cure + shorter injection → higher N*', () => {
            // Seat cushion (240/8) has higher N* than bumper (90/5)
            const seatResult = calculateInjectionMetrics({
                puInyTime: 8, puCurTime: 240, activeShifts: 2, dailyDemand: 800,
                oee: 0.78, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            const bumperResult = calculateInjectionMetrics({
                puInyTime: 5, puCurTime: 90, activeShifts: 2, dailyDemand: 500,
                oee: 0.80, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            expect(seatResult.inputs.nStar).toBeGreaterThan(bumperResult.inputs.nStar);
        });

        it('higher demand → more cavities needed', () => {
            // Same machine params, different demand
            const lowDemand = calculateInjectionMetrics({
                puInyTime: 5, puCurTime: 90, activeShifts: 2, dailyDemand: 200,
                oee: 0.80, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            const highDemand = calculateInjectionMetrics({
                puInyTime: 5, puCurTime: 90, activeShifts: 2, dailyDemand: 2000,
                oee: 0.80, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            expect(highDemand.inputs.activeN).toBeGreaterThanOrEqual(lowDemand.inputs.activeN);
        });

        it('external ops increase the minimum N needed', () => {
            const noOps = calculateInjectionMetrics({
                puInyTime: 8, puCurTime: 240, activeShifts: 2, dailyDemand: 800,
                oee: 0.78, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            const withExtOps = calculateInjectionMetrics({
                puInyTime: 8, puCurTime: 240, activeShifts: 2, dailyDemand: 800,
                oee: 0.78, availableSeconds: 52200,
                manualOps: [
                    mkOp('x1', 'External op 1', 15, 'external'),
                    mkOp('x2', 'External op 2', 20, 'external'),
                ],
                manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            // External ops add to cycle time, so more cavities may be needed
            expect(withExtOps.inputs.activeN).toBeGreaterThanOrEqual(noOps.inputs.activeN);
        });

        it('manual cavity mode overrides auto selection', () => {
            const result = calculateInjectionMetrics({
                puInyTime: 5, puCurTime: 90, activeShifts: 2, dailyDemand: 500,
                oee: 0.80, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1,
                cavityMode: 'manual', userSelectedN: 5,
            });
            expect(result.inputs.activeN).toBe(5);
        });
    });

    // ============================================================================
    // REALCYCLE STORAGE BUG REGRESSION (Critical Fix)
    // Validates that realCycle stored in injectionParams is PER-PIECE, not loop time
    // ============================================================================
    describe('realCycle semantic correctness', () => {
        it('chartData.realCycle should be per-piece (not loop time)', () => {
            const result = calculateInjectionMetrics({
                puInyTime: 5, puCurTime: 90, activeShifts: 2, dailyDemand: 500,
                oee: 0.80, availableSeconds: 52200,
                manualOps: [], manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            const scenario4 = result.chartData.find(d => d.n === 4);
            expect(scenario4).toBeDefined();
            // cyclePerPiece = 5 + 90/4 = 27.5s
            // realCycle should be close to cyclePerPiece (maybe slightly higher with manual ops)
            // It should NOT be n * cyclePerPiece (= 110s)
            expect(scenario4!.realCycle).toBeLessThan(40); // Per-piece
            expect(scenario4!.realCycle).toBeGreaterThan(20);
        });

        it('realCycleTime in CavityCalculationResult should be per-piece', () => {
            const result = calculateInjectionMetrics({
                puInyTime: 8, puCurTime: 240, activeShifts: 2, dailyDemand: 800,
                oee: 0.78, availableSeconds: 52200,
                manualOps: [mkOp('x1', 'Demold', 12, 'external')],
                manualTimeOverride: null,
                headcountMode: 'auto', userHeadcountOverride: 1, cavityMode: 'auto',
            });
            const activeN = result.inputs.activeN;
            const selectedScenario = result.chartData.find(d => d.n === activeN);

            // The selectedData.realCycle should be << 240s (which is just the cure time)
            // It should be the per-piece cycle, not the loop time
            expect(selectedScenario!.realCycle).toBeLessThan(result.inputs.taktTime + 5);
        });
    });
});
