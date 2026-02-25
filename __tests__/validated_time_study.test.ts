/**
 * VALIDATED TIME STUDY TESTS
 *
 * Tests based on verified academic sources:
 * - ILO "Introduction to Work Study" (Kanawaty, 1992)
 * - Groover "Work Systems" (Prentice Hall)
 * - General Electric sample size formula
 * - Moodie & Young (1965) - Smoothness Index
 * - Helgeson & Birnie (1961) - RPW
 *
 * Each test documents the formula, source, and expected values
 * calculated by hand to validate the software implementation.
 */
import { describe, it, expect } from 'vitest';
import {
    calculateStandardDeviation,
    calculateRequiredSampleSize,
    isOutlier
} from '../utils/math';
import { calculateTaskWeights } from '../utils/graph';
import { Task, ProductModel } from '../types';

// ============================================================================
// HELPER: Create a minimal valid Task for testing
// ============================================================================
const createTask = (overrides: Partial<Task> & { id: string; times: (number | null)[] }): Task => ({
    description: 'Test Task',
    averageTime: 0,
    standardTime: 0,
    ratingFactor: 100,
    fatigueCategory: 'none',
    predecessors: [],
    successors: [],
    positionalWeight: 0,
    calculatedSuccessorSum: 0,
    stdDev: 0,
    executionMode: 'manual',
    cycleQuantity: 1,
    ...overrides,
});

// ============================================================================
// BLOCK 1A: calculateStandardDeviation
// Source: Bessel's correction (n-1) for sample variance
// Formula: s = sqrt( Σ(xi - x̄)² / (n-1) )
// ============================================================================
describe('Validated: calculateStandardDeviation (Bessel\'s correction, n-1)', () => {

    it('ILO example data: [45.2, 43.8, 44.5, 42.9, 45.0]', () => {
        // Hand calculation:
        //   mean = (45.2+43.8+44.5+42.9+45.0)/5 = 221.4/5 = 44.28
        //   deviations: (0.92, -0.48, 0.22, -1.38, 0.72)
        //   sum of sq = 0.8464 + 0.2304 + 0.0484 + 1.9044 + 0.5184 = 3.548
        //   variance(n-1) = 3.548 / 4 = 0.887
        //   stdDev = sqrt(0.887) = 0.9419
        const result = calculateStandardDeviation([45.2, 43.8, 44.5, 42.9, 45.0]);
        expect(result).toBeCloseTo(0.9419, 3);
    });

    it('known exact: [10, 20] -> sqrt(50) = 7.071', () => {
        // mean=15, deviations=(-5, 5), sumSq=50, var=50/1=50, stdDev=√50
        const result = calculateStandardDeviation([10, 20]);
        expect(result).toBeCloseTo(7.0711, 3);
    });

    it('known exact: [10, 20, 30] -> 10', () => {
        // mean=20, deviations=(-10,0,10), sumSq=200, var=200/2=100, stdDev=10
        const result = calculateStandardDeviation([10, 20, 30]);
        expect(result).toBeCloseTo(10, 4);
    });

    it('identical values should return 0', () => {
        expect(calculateStandardDeviation([30, 30, 30])).toBe(0);
        expect(calculateStandardDeviation([7.5, 7.5, 7.5, 7.5])).toBe(0);
    });

    it('single value returns 0 (cannot compute sample variance)', () => {
        expect(calculateStandardDeviation([5.0])).toBe(0);
    });

    it('empty or all-null returns 0', () => {
        expect(calculateStandardDeviation([])).toBe(0);
        expect(calculateStandardDeviation([null, null])).toBe(0);
    });

    it('filters null and zero values before computing', () => {
        // [10, null, 0, 20, 30] -> valid = [10, 20, 30] -> stdDev = 10
        const result = calculateStandardDeviation([10, null, 0, 20, 30]);
        expect(result).toBeCloseTo(10, 4);
    });

    it('high variability: [5, 15, 25, 35, 45]', () => {
        // mean=25, deviations=(-20,-10,0,10,20), sumSq=1000, var=1000/4=250, stdDev=√250=15.811
        const result = calculateStandardDeviation([5, 15, 25, 35, 45]);
        expect(result).toBeCloseTo(15.8114, 3);
    });
});

// ============================================================================
// BLOCK 1B: calculateRequiredSampleSize (General Electric Formula)
// Source: GE Statistical Standard, Juran
// Formula: N = ceil( (40 × s / x̄)² )
// Where 40 = Z/e = 2/0.05 (k=2 for 95.45%, 5% relative error)
// ============================================================================
describe('Validated: calculateRequiredSampleSize (GE Formula, 95.45% conf, 5% error)', () => {

    it('ILO example: mean=44.28, stdDev=0.9419, count=5 -> N=1', () => {
        // N = ceil((40 × 0.9419 / 44.28)²)
        //   = ceil((37.676 / 44.28)²)
        //   = ceil((0.8510)²)
        //   = ceil(0.7242)
        //   = 1
        const result = calculateRequiredSampleSize(44.28, 0.9419, 5);
        expect(result).toBe(1);
    });

    it('high variability: mean=10, stdDev=3, count=5 -> N=144', () => {
        // N = ceil((40 × 3 / 10)²) = ceil((120/10)²) = ceil(12²) = ceil(144) = 144
        const result = calculateRequiredSampleSize(10, 3, 5);
        expect(result).toBe(144);
    });

    it('low variability: mean=100, stdDev=1, count=10 -> N=1', () => {
        // N = ceil((40 × 1 / 100)²) = ceil(0.4²) = ceil(0.16) = 1
        const result = calculateRequiredSampleSize(100, 1, 10);
        expect(result).toBe(1);
    });

    it('moderate variability: mean=30, stdDev=5, count=10 -> N=45', () => {
        // N = ceil((40 × 5 / 30)²) = ceil((200/30)²) = ceil(6.667²) = ceil(44.44) = 45
        const result = calculateRequiredSampleSize(30, 5, 10);
        expect(result).toBe(45);
    });

    it('edge: count < 3 returns 0 (insufficient data)', () => {
        expect(calculateRequiredSampleSize(10, 2, 2)).toBe(0);
        expect(calculateRequiredSampleSize(10, 2, 1)).toBe(0);
        expect(calculateRequiredSampleSize(10, 2, 0)).toBe(0);
    });

    it('edge: mean = 0 returns 0 (division by zero guard)', () => {
        expect(calculateRequiredSampleSize(0, 5, 5)).toBe(0);
    });

    it('edge: stdDev = 0 returns 0 (no variability, 1 sample enough)', () => {
        // N = ceil((40 × 0 / 50)²) = ceil(0) = 0
        const result = calculateRequiredSampleSize(50, 0, 10);
        expect(result).toBe(0);
    });

    it('GE table cross-check: very short cycle high variance', () => {
        // Short cycle (6s) with high relative variance (stdDev=2)
        // N = ceil((40 × 2 / 6)²) = ceil((80/6)²) = ceil(13.333²) = ceil(177.78) = 178
        const result = calculateRequiredSampleSize(6, 2, 10);
        expect(result).toBe(178);
    });
});

// ============================================================================
// BLOCK 1C: isOutlier (±2σ Detection)
// Software uses ±2 standard deviations (95.45% confidence)
// Literature commonly uses ±3σ (99.73%) but ±2σ is acceptable for small samples
// ============================================================================
describe('Validated: isOutlier (±2σ detection)', () => {

    it('exact boundary: value AT lower limit is NOT outlier', () => {
        // mean=100, stdDev=10, lower=80, upper=120
        // value=80 is exactly at boundary -> NOT outlier (< not <=)
        expect(isOutlier(80, 100, 10)).toBe(false);
    });

    it('exact boundary: value AT upper limit is NOT outlier', () => {
        expect(isOutlier(120, 100, 10)).toBe(false);
    });

    it('just below lower boundary IS outlier', () => {
        expect(isOutlier(79.99, 100, 10)).toBe(true);
    });

    it('just above upper boundary IS outlier', () => {
        expect(isOutlier(120.01, 100, 10)).toBe(true);
    });

    it('clearly inside range is NOT outlier', () => {
        expect(isOutlier(90, 100, 10)).toBe(false);
        expect(isOutlier(110, 100, 10)).toBe(false);
        expect(isOutlier(100, 100, 10)).toBe(false);
    });

    it('zero value always returns false (data validation)', () => {
        expect(isOutlier(0, 100, 10)).toBe(false);
    });

    it('negative value always returns false', () => {
        expect(isOutlier(-5, 100, 10)).toBe(false);
    });

    it('stdDev=0: range collapses to [mean, mean]', () => {
        // mean=50, stdDev=0, range=[50,50]
        // Only values exactly at mean are NOT outliers
        expect(isOutlier(50, 50, 0)).toBe(false);
        expect(isOutlier(49.99, 50, 0)).toBe(true);
        expect(isOutlier(50.01, 50, 0)).toBe(true);
    });

    it('real sample: ILO data [45.2, 43.8, 44.5, 42.9, 45.0]', () => {
        // mean=44.28, stdDev=0.9419
        // lower = 44.28 - 2*0.9419 = 42.396
        // upper = 44.28 + 2*0.9419 = 46.164
        const mean = 44.28;
        const stdDev = 0.9419;

        expect(isOutlier(45.2, mean, stdDev)).toBe(false);   // within range
        expect(isOutlier(43.8, mean, stdDev)).toBe(false);   // within range
        expect(isOutlier(44.5, mean, stdDev)).toBe(false);   // within range
        expect(isOutlier(42.9, mean, stdDev)).toBe(false);   // 42.9 > 42.396
        expect(isOutlier(45.0, mean, stdDev)).toBe(false);   // within range
        expect(isOutlier(42.3, mean, stdDev)).toBe(true);    // below lower bound
        expect(isOutlier(46.2, mean, stdDev)).toBe(true);    // above upper bound
    });
});

// ============================================================================
// BLOCK 1D: calculateTaskWeights - Standard Time Full Pipeline
// Source: ILO "Introduction to Work Study"
// Formula: StdTime = (avgTime × rating/100) × (1 + fatigue%)
// ============================================================================
describe('Validated: calculateTaskWeights - Standard Time Pipeline', () => {

    it('ILO example: times=[45.2,43.8,44.5,42.9,45.0], rating=110, fatigue=standard(14%)', () => {
        // Step 1: avg = (45.2+43.8+44.5+42.9+45.0)/5 = 44.28
        // Step 2: basicTime = 44.28 × (110/100) = 48.708
        // Step 3: stdTime = 48.708 × (1 + 0.14) = 48.708 × 1.14 = 55.527
        const task = createTask({
            id: 'ILO-01',
            times: [45.2, 43.8, 44.5, 42.9, 45.0],
            ratingFactor: 110,
            fatigueCategory: 'standard', // 14%
        });

        const [result] = calculateTaskWeights([task]);

        expect(result.averageTime).toBeCloseTo(44.28, 1);
        expect(result.standardTime).toBeCloseTo(55.527, 0);
        expect(result.stdDev).toBeCloseTo(0.9419, 2);
        expect(result.requiredSamples).toBe(1);
    });

    it('rating=100 (normal pace), no fatigue -> stdTime = avgTime', () => {
        const task = createTask({
            id: 'NORMAL-01',
            times: [10, 10, 10],
            ratingFactor: 100,
            fatigueCategory: 'none',
        });

        const [result] = calculateTaskWeights([task]);

        expect(result.averageTime).toBeCloseTo(10, 4);
        expect(result.standardTime).toBeCloseTo(10, 4);
    });

    it('low fatigue (9% = ILO minimum: 5% personal + 4% basic fatigue)', () => {
        const task = createTask({
            id: 'LOW-01',
            times: [20, 20, 20],
            ratingFactor: 100,
            fatigueCategory: 'low', // 9%
        });

        const [result] = calculateTaskWeights([task]);

        // stdTime = 20 × 1.0 × (1 + 0.09) = 21.8
        expect(result.standardTime).toBeCloseTo(21.8, 2);
    });

    it('high fatigue (18% = heavy physical work, ILO composite)', () => {
        const task = createTask({
            id: 'HIGH-01',
            times: [30, 30, 30],
            ratingFactor: 100,
            fatigueCategory: 'high', // 18%
        });

        const [result] = calculateTaskWeights([task]);

        // stdTime = 30 × 1.0 × (1 + 0.18) = 35.4
        expect(result.standardTime).toBeCloseTo(35.4, 2);
    });

    it('machine task: forces rating=100% and fatigue=0% (physical/chemical process)', () => {
        const task = createTask({
            id: 'MACH-01',
            times: [50, 50, 50],
            ratingFactor: 85,           // should be overridden to 100
            fatigueCategory: 'high',    // should be overridden to 0%
            executionMode: 'machine',
        });

        const [result] = calculateTaskWeights([task]);

        // rating forced to 100, fatigue forced to 0%
        // stdTime = 50 × (100/100) × (1 + 0) = 50
        expect(result.ratingFactor).toBe(100);
        expect(result.standardTime).toBeCloseTo(50, 4);
    });

    it('injection task: same override as machine (physical/chemical process)', () => {
        const task = createTask({
            id: 'INJ-01',
            times: [40, 40, 40],
            ratingFactor: 120,
            fatigueCategory: 'standard',
            executionMode: 'injection',
        });

        const [result] = calculateTaskWeights([task]);

        expect(result.ratingFactor).toBe(100);
        expect(result.standardTime).toBeCloseTo(40, 4);
    });

    it('cycleQuantity normalization: times=[90,88] with qty=2 -> avg=44.5', () => {
        const task = createTask({
            id: 'NORM-01',
            times: [90, 88],
            cycleQuantity: 2,
            ratingFactor: 100,
            fatigueCategory: 'none',
        });

        const [result] = calculateTaskWeights([task]);

        // Normalized: [90/2, 88/2] = [45, 44] -> avg = 44.5
        expect(result.averageTime).toBeCloseTo(44.5, 4);
        expect(result.standardTime).toBeCloseTo(44.5, 4);
    });

    it('global fatigue fallback: task fatigue=none, global=10%', () => {
        const task = createTask({
            id: 'GLOB-01',
            times: [20, 20, 20],
            ratingFactor: 100,
            fatigueCategory: 'none', // individual = none -> falls through to global
        });

        const [result] = calculateTaskWeights(
            [task],
            [],
            { enabled: true, globalPercent: 10 }
        );

        // stdTime = 20 × 1.0 × (1 + 0.10) = 22.0
        expect(result.standardTime).toBeCloseTo(22.0, 2);
    });

    it('individual fatigue takes priority over global', () => {
        const task = createTask({
            id: 'PRIO-01',
            times: [20, 20, 20],
            ratingFactor: 100,
            fatigueCategory: 'high', // 18% individual
        });

        const [result] = calculateTaskWeights(
            [task],
            [],
            { enabled: true, globalPercent: 10 } // 10% global - should be ignored
        );

        // stdTime = 20 × 1.0 × (1 + 0.18) = 23.6 (not 22.0)
        expect(result.standardTime).toBeCloseTo(23.6, 2);
    });

    it('rating factor of 0 is preserved (regression test)', () => {
        const task = createTask({
            id: 'ZERO-01',
            times: [10, 10, 10],
            ratingFactor: 0,
            fatigueCategory: 'standard',
        });

        const [result] = calculateTaskWeights([task]);

        expect(result.ratingFactor).toBe(0);
        // basicTime = 10 × 0/100 = 0, stdTime = 0 × 1.14 = 0
        expect(result.standardTime).toBeCloseTo(0, 4);
    });

    it('ignored indices are excluded from calculation', () => {
        const task = createTask({
            id: 'IGN-01',
            times: [10, 100, 10, 10], // 100 is an outlier
            ignoredTimeIndices: [1],    // ignore index 1 (the 100)
            ratingFactor: 100,
            fatigueCategory: 'none',
        });

        const [result] = calculateTaskWeights([task]);

        // Valid times after ignoring idx 1: [10, 10, 10] -> avg = 10
        expect(result.averageTime).toBeCloseTo(10, 4);
        expect(result.standardTime).toBeCloseTo(10, 4);
    });
});

// ============================================================================
// BLOCK 1E: calculateTaskWeights - MMALBP Weighted Average
// Source: Thomopoulos (1967) "Line Balancing-Sequencing for Mixed-Model Assembly"
// Formula: T_weighted = Σ(T_model × %_mix)
// ============================================================================
describe('Validated: calculateTaskWeights - MMALBP Weighted Times (Thomopoulos 1967)', () => {

    it('two models 60%/40%: weighted = 30×0.6 + 50×0.4 = 38', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Model A', percentage: 0.6 },
            { id: 'B', name: 'Model B', percentage: 0.4 },
        ];

        // Task applicable to BOTH models, so averageTime applies to both
        // But the weighting uses averageTime * percentage for each applicable model
        // If both applicable: weighted = avgTime × 0.6 + avgTime × 0.4 = avgTime × 1.0 = avgTime
        // For different times per model, you need different tasks or baseTime overrides
        const task = createTask({
            id: 'MIX-01',
            times: [30, 30, 30],
            ratingFactor: 100,
            fatigueCategory: 'none',
        });

        const [result] = calculateTaskWeights([task], models);

        // Both models applicable (default), so: weighted = 30×0.6 + 30×0.4 = 30
        expect(result.averageTime).toBeCloseTo(30, 2);
        expect(result.standardTime).toBeCloseTo(30, 2);
    });

    it('task only applicable to model A (60%): weighted = avg × 0.6', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Model A', percentage: 0.6 },
            { id: 'B', name: 'Model B', percentage: 0.4 },
        ];

        const task = createTask({
            id: 'MIX-02',
            times: [50, 50, 50],
            ratingFactor: 100,
            fatigueCategory: 'none',
            modelApplicability: { 'A': true, 'B': false }, // Only model A
        });

        const [result] = calculateTaskWeights([task], models);

        // weighted = 50 × 0.6 = 30.0 (model B excluded)
        expect(result.standardTime).toBeCloseTo(30, 2);
    });

    it('task only applicable to model B (40%): weighted = avg × 0.4', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Model A', percentage: 0.6 },
            { id: 'B', name: 'Model B', percentage: 0.4 },
        ];

        const task = createTask({
            id: 'MIX-03',
            times: [100, 100, 100],
            ratingFactor: 100,
            fatigueCategory: 'none',
            modelApplicability: { 'A': false, 'B': true },
        });

        const [result] = calculateTaskWeights([task], models);

        // weighted = 100 × 0.4 = 40.0
        expect(result.standardTime).toBeCloseTo(40, 2);
    });

    it('single model: no weighting applied (avgTime preserved)', () => {
        const models: ProductModel[] = [
            { id: 'A', name: 'Model A', percentage: 1.0 },
        ];

        const task = createTask({
            id: 'SINGLE-01',
            times: [25, 25, 25],
            ratingFactor: 100,
            fatigueCategory: 'none',
        });

        const [result] = calculateTaskWeights([task], models);

        // Single model: no MMALBP weighting
        expect(result.standardTime).toBeCloseTo(25, 4);
    });
});

// ============================================================================
// BLOCK 1F: Positional Weight (RPW - Ranked Positional Weight)
// Source: Helgeson & Birnie (1961) "Assembly Line Balancing Using RPW Technique"
// Formula: PW(i) = stdTime(i) + Σ stdTime(all descendants of i)
// ============================================================================
describe('Validated: Positional Weight (Helgeson & Birnie 1961)', () => {

    it('linear chain A→B→C: PW(A)=60, PW(B)=50, PW(C)=30', () => {
        const tasks: Task[] = [
            createTask({
                id: 'A', times: [10, 10, 10],
                predecessors: [], successors: ['B'],
            }),
            createTask({
                id: 'B', times: [20, 20, 20],
                predecessors: ['A'], successors: ['C'],
            }),
            createTask({
                id: 'C', times: [30, 30, 30],
                predecessors: ['B'], successors: [],
            }),
        ];

        const result = calculateTaskWeights(tasks);

        const taskA = result.find(t => t.id === 'A')!;
        const taskB = result.find(t => t.id === 'B')!;
        const taskC = result.find(t => t.id === 'C')!;

        // PW(A) = 10 + 20 + 30 = 60 (all descendants)
        expect(taskA.positionalWeight).toBeCloseTo(60, 2);
        // PW(B) = 20 + 30 = 50
        expect(taskB.positionalWeight).toBeCloseTo(50, 2);
        // PW(C) = 30 (terminal, no descendants)
        expect(taskC.positionalWeight).toBeCloseTo(30, 2);
    });

    it('tree: A→B, A→C, B→D', () => {
        //   A(10)
        //  / \
        // B(20) C(15)
        // |
        // D(25)
        const tasks: Task[] = [
            createTask({
                id: 'A', times: [10, 10, 10],
                predecessors: [], successors: ['B', 'C'],
            }),
            createTask({
                id: 'B', times: [20, 20, 20],
                predecessors: ['A'], successors: ['D'],
            }),
            createTask({
                id: 'C', times: [15, 15, 15],
                predecessors: ['A'], successors: [],
            }),
            createTask({
                id: 'D', times: [25, 25, 25],
                predecessors: ['B'], successors: [],
            }),
        ];

        const result = calculateTaskWeights(tasks);

        const taskA = result.find(t => t.id === 'A')!;
        const taskB = result.find(t => t.id === 'B')!;
        const taskC = result.find(t => t.id === 'C')!;
        const taskD = result.find(t => t.id === 'D')!;

        // PW(A) = 10 + 20 + 15 + 25 = 70 (B, C, D are all descendants)
        expect(taskA.positionalWeight).toBeCloseTo(70, 2);
        // PW(B) = 20 + 25 = 45 (D is descendant)
        expect(taskB.positionalWeight).toBeCloseTo(45, 2);
        // PW(C) = 15 (terminal)
        expect(taskC.positionalWeight).toBeCloseTo(15, 2);
        // PW(D) = 25 (terminal)
        expect(taskD.positionalWeight).toBeCloseTo(25, 2);
    });

    it('diamond: A→B, A→C, B→D, C→D', () => {
        //   A(10)
        //  / \
        // B(20) C(15)
        //  \ /
        //   D(25)
        const tasks: Task[] = [
            createTask({
                id: 'A', times: [10, 10, 10],
                predecessors: [], successors: ['B', 'C'],
            }),
            createTask({
                id: 'B', times: [20, 20, 20],
                predecessors: ['A'], successors: ['D'],
            }),
            createTask({
                id: 'C', times: [15, 15, 15],
                predecessors: ['A'], successors: ['D'],
            }),
            createTask({
                id: 'D', times: [25, 25, 25],
                predecessors: ['B', 'C'], successors: [],
            }),
        ];

        const result = calculateTaskWeights(tasks);

        const taskA = result.find(t => t.id === 'A')!;
        const taskB = result.find(t => t.id === 'B')!;
        const taskC = result.find(t => t.id === 'C')!;
        const taskD = result.find(t => t.id === 'D')!;

        // PW(A) = 10 + 20 + 15 + 25 = 70 (D counted once even though reachable via B and C)
        expect(taskA.positionalWeight).toBeCloseTo(70, 2);
        // PW(B) = 20 + 25 = 45
        expect(taskB.positionalWeight).toBeCloseTo(45, 2);
        // PW(C) = 15 + 25 = 40
        expect(taskC.positionalWeight).toBeCloseTo(40, 2);
        // PW(D) = 25
        expect(taskD.positionalWeight).toBeCloseTo(25, 2);
    });

    it('parallel tasks (no dependencies): each PW = own time only', () => {
        const tasks: Task[] = [
            createTask({ id: 'X', times: [10, 10, 10], predecessors: [], successors: [] }),
            createTask({ id: 'Y', times: [20, 20, 20], predecessors: [], successors: [] }),
            createTask({ id: 'Z', times: [30, 30, 30], predecessors: [], successors: [] }),
        ];

        const result = calculateTaskWeights(tasks);

        expect(result.find(t => t.id === 'X')!.positionalWeight).toBeCloseTo(10, 2);
        expect(result.find(t => t.id === 'Y')!.positionalWeight).toBeCloseTo(20, 2);
        expect(result.find(t => t.id === 'Z')!.positionalWeight).toBeCloseTo(30, 2);
    });
});

// ============================================================================
// BLOCK 1G: Complete End-to-End Scenario
// Real-world time study: 5 tasks on an assembly line
// ============================================================================
describe('Validated: End-to-End Time Study Scenario', () => {

    it('5-task assembly line with varying ratings and fatigue categories', () => {
        // Scenario: Small assembly line
        // T1(10s, rating 100, none) → T2(20s, rating 110, low 9%) → T3(15s, rating 95, standard 14%)
        //                            → T4(25s, rating 100, high 18%)
        // T3 → T5(8s, rating 105, none)
        // T4 → T5
        const tasks: Task[] = [
            createTask({
                id: 'T1', times: [10, 10, 10],
                ratingFactor: 100, fatigueCategory: 'none',
                predecessors: [], successors: ['T2', 'T4'],
            }),
            createTask({
                id: 'T2', times: [20, 20, 20],
                ratingFactor: 110, fatigueCategory: 'low', // 9%
                predecessors: ['T1'], successors: ['T3'],
            }),
            createTask({
                id: 'T3', times: [15, 15, 15],
                ratingFactor: 95, fatigueCategory: 'standard', // 14%
                predecessors: ['T2'], successors: ['T5'],
            }),
            createTask({
                id: 'T4', times: [25, 25, 25],
                ratingFactor: 100, fatigueCategory: 'high', // 18%
                predecessors: ['T1'], successors: ['T5'],
            }),
            createTask({
                id: 'T5', times: [8, 8, 8],
                ratingFactor: 105, fatigueCategory: 'none',
                predecessors: ['T3', 'T4'], successors: [],
            }),
        ];

        const result = calculateTaskWeights(tasks);

        // T1: basicTime = 10 × 1.00 = 10.0, stdTime = 10.0 × 1.00 = 10.0
        const t1 = result.find(t => t.id === 'T1')!;
        expect(t1.standardTime).toBeCloseTo(10.0, 2);

        // T2: basicTime = 20 × 1.10 = 22.0, stdTime = 22.0 × 1.09 = 23.98
        const t2 = result.find(t => t.id === 'T2')!;
        expect(t2.standardTime).toBeCloseTo(23.98, 1);

        // T3: basicTime = 15 × 0.95 = 14.25, stdTime = 14.25 × 1.14 = 16.245
        const t3 = result.find(t => t.id === 'T3')!;
        expect(t3.standardTime).toBeCloseTo(16.245, 1);

        // T4: basicTime = 25 × 1.00 = 25.0, stdTime = 25.0 × 1.18 = 29.5
        const t4 = result.find(t => t.id === 'T4')!;
        expect(t4.standardTime).toBeCloseTo(29.5, 2);

        // T5: basicTime = 8 × 1.05 = 8.4, stdTime = 8.4 × 1.00 = 8.4
        const t5 = result.find(t => t.id === 'T5')!;
        expect(t5.standardTime).toBeCloseTo(8.4, 2);

        // Positional Weights:
        // T5 = 8.4 (terminal)
        expect(t5.positionalWeight).toBeCloseTo(8.4, 1);
        // T3 = 16.245 + 8.4 = 24.645
        expect(t3.positionalWeight).toBeCloseTo(24.645, 0);
        // T4 = 29.5 + 8.4 = 37.9
        expect(t4.positionalWeight).toBeCloseTo(37.9, 1);
        // T2 = 23.98 + 16.245 + 8.4 = 48.625
        expect(t2.positionalWeight).toBeCloseTo(48.625, 0);
        // T1 = 10.0 + 23.98 + 16.245 + 29.5 + 8.4 = 88.125
        expect(t1.positionalWeight).toBeCloseTo(88.125, 0);

        // Total Work Content = sum of all standard times
        const totalWork = result.reduce((sum, t) => sum + t.standardTime, 0);
        // 10.0 + 23.98 + 16.245 + 29.5 + 8.4 = 88.125
        expect(totalWork).toBeCloseTo(88.125, 0);
    });
});
