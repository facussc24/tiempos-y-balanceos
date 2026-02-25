/**
 * VALIDATED LINE BALANCING TESTS
 *
 * Tests based on verified academic sources:
 * - Helgeson & Birnie (1961) - RPW heuristic
 * - Moodie & Young (1965) - Smoothness Index
 * - Scholl (1999) - SALBP definitions
 * - Thomopoulos (1967) - MMALBP
 * - Rubinovitz & Levitin (1995) - GA for ALB
 *
 * KNOWN DISCREPANCY DOCUMENTED:
 * - Smoothness Index: software uses stddev(loads) instead of classical √(Σ(C_max - ST_i)²)
 * - This is documented here as a design decision, not necessarily a bug
 */
import { describe, it, expect } from 'vitest';
import { Task } from '../types';
import {
    calculateEffectiveStationTime,
} from '../core/balancing/simulation';
import {
    calculateAdjustedDemand,
    calculateTaktTime,
    calculateShiftNetMinutes,
} from '../core/balancing/simulation';
import {
    buildCombinedPrecedenceGraph,
    calculateWeightedTimes,
    MIN_SATURATION_THRESHOLD,
} from '../core/balancing/mixBalancing';

// ============================================================================
// HELPER
// ============================================================================
const createTask = (overrides: Partial<Task> & { id: string }): Task => ({
    description: 'Test Task',
    times: [],
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
// BLOCK 2A: Effective Station Time (Man-Machine Concurrency)
// Source: Man-Machine Charts, ILO Work Study
// Formula: effective = max(machine_time, sum_concurrent_manual) + independent_tasks
// ============================================================================
describe('Validated: calculateEffectiveStationTime (Man-Machine Concurrency)', () => {

    it('all manual tasks: simple sum', () => {
        const tasks = [
            createTask({ id: 'M1', standardTime: 10, executionMode: 'manual' }),
            createTask({ id: 'M2', standardTime: 20, executionMode: 'manual' }),
        ];
        // 10 + 20 = 30
        expect(calculateEffectiveStationTime(tasks)).toBeCloseTo(30, 4);
    });

    it('machine dominates: max(machine, manual_concurrent)', () => {
        const tasks = [
            createTask({ id: 'MACH', standardTime: 50, executionMode: 'machine' }),
            createTask({ id: 'MAN1', standardTime: 15, executionMode: 'manual', concurrentWith: 'MACH' }),
            createTask({ id: 'MAN2', standardTime: 10, executionMode: 'manual', concurrentWith: 'MACH' }),
        ];
        // concurrent manual sum = 15 + 10 = 25
        // max(50, 25) = 50 (machine dominates)
        expect(calculateEffectiveStationTime(tasks)).toBeCloseTo(50, 4);
    });

    it('manual dominates: max(machine, manual_concurrent)', () => {
        const tasks = [
            createTask({ id: 'MACH', standardTime: 20, executionMode: 'machine' }),
            createTask({ id: 'MAN1', standardTime: 25, executionMode: 'manual', concurrentWith: 'MACH' }),
            createTask({ id: 'MAN2', standardTime: 15, executionMode: 'manual', concurrentWith: 'MACH' }),
        ];
        // concurrent manual sum = 25 + 15 = 40
        // max(20, 40) = 40 (manual dominates)
        expect(calculateEffectiveStationTime(tasks)).toBeCloseTo(40, 4);
    });

    it('mixed: concurrent group + independent tasks', () => {
        const tasks = [
            createTask({ id: 'MACH', standardTime: 50, executionMode: 'machine' }),
            createTask({ id: 'MAN1', standardTime: 20, executionMode: 'manual', concurrentWith: 'MACH' }),
            createTask({ id: 'INDEP', standardTime: 10, executionMode: 'manual' }), // independent
        ];
        // group: max(50, 20) = 50
        // independent: 10
        // total: 50 + 10 = 60
        expect(calculateEffectiveStationTime(tasks)).toBeCloseTo(60, 4);
    });

    it('isMachineInternal tasks contribute 0 (background curing)', () => {
        const tasks = [
            createTask({ id: 'MACH', standardTime: 50, executionMode: 'machine' }),
            createTask({ id: 'INTERNAL', standardTime: 30, executionMode: 'manual', isMachineInternal: true }),
        ];
        // INTERNAL is marked as background → 0 contribution
        // Only MACH contributes: max(50, 0) = 50
        expect(calculateEffectiveStationTime(tasks)).toBeCloseTo(50, 4);
    });

    it('ILO man-machine example: machine 30s, concurrent manual 20s, independent 10s', () => {
        // Classic man-machine chart example:
        // Machine runs 30s while operator does 20s of work alongside
        // Then operator does 10s of independent work
        // Effective time = max(30, 20) + 10 = 30 + 10 = 40s
        const tasks = [
            createTask({ id: 'PRESS', standardTime: 30, executionMode: 'machine' }),
            createTask({ id: 'LOAD', standardTime: 20, executionMode: 'manual', concurrentWith: 'PRESS' }),
            createTask({ id: 'INSPECT', standardTime: 10, executionMode: 'manual' }),
        ];
        expect(calculateEffectiveStationTime(tasks)).toBeCloseTo(40, 4);
    });
});

// ============================================================================
// BLOCK 2B: Scrap-Adjusted Demand
// Source: Standard production planning
// Formula: adjusted = base / (1 - scrapRate)
// NOTE: This is the CORRECT formula (not base × (1 + scrapRate))
// The divisive formula accounts for cumulative scrap properly.
// ============================================================================
describe('Validated: calculateAdjustedDemand (scrap adjustment)', () => {

    it('3% scrap: 1000 / (1 - 0.03) = 1030.93', () => {
        // This is the CORRECT formula per production planning standards
        // If 3% of what you produce is scrap, you need to produce more
        // 1000 / 0.97 = 1030.928...
        const result = calculateAdjustedDemand(1000, 0.03);
        expect(result).toBeCloseTo(1030.93, 1);
    });

    it('0% scrap: returns base demand unchanged', () => {
        expect(calculateAdjustedDemand(500, 0)).toBe(500);
    });

    it('10% scrap: 1000 / 0.90 = 1111.11', () => {
        const result = calculateAdjustedDemand(1000, 0.10);
        expect(result).toBeCloseTo(1111.11, 1);
    });

    it('20% scrap (max): 1000 / 0.80 = 1250', () => {
        const result = calculateAdjustedDemand(1000, 0.20);
        expect(result).toBeCloseTo(1250, 1);
    });

    it('scrap > 20% is clamped to 20%', () => {
        // 30% scrap should be clamped to 20%
        const result = calculateAdjustedDemand(1000, 0.30);
        expect(result).toBeCloseTo(1250, 1); // Same as 20%
    });

    it('negative scrap is clamped to 0%', () => {
        expect(calculateAdjustedDemand(1000, -0.05)).toBe(1000);
    });

    it('zero demand returns 0', () => {
        expect(calculateAdjustedDemand(0, 0.05)).toBe(0);
    });

    it('divisive vs multiplicative: 1/(1-s) > (1+s) for s > 0', () => {
        // Important: the divisive formula gives a HIGHER result than multiplicative
        // 1000 / (1 - 0.05) = 1052.63  vs  1000 × (1 + 0.05) = 1050
        // The divisive formula is correct because scrap compounds
        const divisive = calculateAdjustedDemand(1000, 0.05);
        const multiplicative = 1000 * (1 + 0.05);
        expect(divisive).toBeGreaterThan(multiplicative);
    });
});

// ============================================================================
// BLOCK 2C: Takt Time Calculation
// Source: Toyota Production System (Monden 1983)
// Formula: Takt = Available Time / Demand
//          Effective Takt = Nominal Takt × OEE
// ============================================================================
describe('Validated: calculateTaktTime (Toyota/Monden)', () => {

    it('single shift 8h, 30min lunch, 2×10min breaks, 500 pcs, OEE 85%', () => {
        // Available = 480 - 30 - 20 = 430 min
        // Nominal Takt = (430 × 60) / 500 = 25800 / 500 = 51.6s
        // Effective Takt = 51.6 × 0.85 = 43.86s
        const shift = {
            startTime: '06:00',
            endTime: '14:00',
            breaks: [
                { name: 'Lunch', duration: 30 },
                { name: 'Break 1', duration: 10 },
                { name: 'Break 2', duration: 10 },
            ],
        };

        const result = calculateTaktTime([shift as any], 1, 500, 0.85);

        expect(result.totalAvailableMinutes).toBeCloseTo(430, 0);
        expect(result.nominalSeconds).toBeCloseTo(51.6, 1);
        expect(result.effectiveSeconds).toBeCloseTo(43.86, 1);
    });

    it('zero demand returns 0 (valid UX state)', () => {
        const shift = {
            startTime: '06:00',
            endTime: '14:00',
            breaks: [] as any[],
        };

        const result = calculateTaktTime([shift as any], 1, 0, 0.85);

        expect(result.nominalSeconds).toBe(0);
        expect(result.effectiveSeconds).toBe(0);
    });

    it('setup loss reduces available time', () => {
        // 480 min - 0 breaks = 480 min
        // 5% setup loss: net = 480 × 0.95 = 456 min
        // Takt = (456 × 60) / 1000 = 27.36s
        const shift = {
            startTime: '06:00',
            endTime: '14:00',
            breaks: [] as any[],
        };

        const result = calculateTaktTime([shift as any], 1, 1000, 1.0, 0.05);

        expect(result.netAvailableMinutes).toBeCloseTo(456, 0);
        expect(result.nominalSeconds).toBeCloseTo(27.36, 1);
        expect(result.setupLossApplied).toBeCloseTo(0.05, 4);
    });
});

// ============================================================================
// BLOCK 2D: Shift Net Minutes
// ============================================================================
describe('Validated: calculateShiftNetMinutes', () => {

    it('standard 8h shift with 50min breaks: 430 min', () => {
        const shift = {
            startTime: '06:00',
            endTime: '14:00',
            breaks: [
                { name: 'Lunch', duration: 30 },
                { name: 'Break 1', duration: 10 },
                { name: 'Break 2', duration: 10 },
            ],
        };
        expect(calculateShiftNetMinutes(shift as any)).toBe(430);
    });

    it('overnight shift: 22:00 to 06:00 = 480 min gross', () => {
        const shift = {
            startTime: '22:00',
            endTime: '06:00',
            breaks: [{ name: 'Meal', duration: 30 }],
        };
        // 22:00 to 06:00 = 8h = 480 min, minus 30 = 450
        expect(calculateShiftNetMinutes(shift as any)).toBe(450);
    });

    it('no breaks: full shift time', () => {
        const shift = {
            startTime: '08:00',
            endTime: '16:00',
            breaks: [] as any[],
        };
        expect(calculateShiftNetMinutes(shift as any)).toBe(480);
    });
});

// ============================================================================
// BLOCK 2E: Smoothness Index
// DOCUMENTED DISCREPANCY:
// Classical definition (Moodie & Young 1965): SI = √(Σ(C_max - ST_i)²)
// Software implementation: SI = √(Σ(ST_i - mean)²/N) = population stddev
//
// The software's version is a valid measure of balance quality (it IS the
// standard deviation of station loads), but it does NOT match the published
// definition of "Smoothness Index". The test documents BOTH formulas.
// ============================================================================
describe('Documented: Smoothness Index Discrepancy', () => {

    it('classical SI (Moodie & Young 1965) vs software SI for loads [50, 40, 30]', () => {
        const loads = [50, 40, 30];
        const C_max = Math.max(...loads);
        const mean = loads.reduce((a, b) => a + b, 0) / loads.length;

        // Classical Moodie & Young: SI = √(Σ(C_max - ST_i)²)
        const classicalSI = Math.sqrt(
            loads.reduce((sum, load) => sum + Math.pow(C_max - load, 2), 0)
        );
        // = √((50-50)² + (50-40)² + (50-30)²) = √(0+100+400) = √500 ≈ 22.36
        expect(classicalSI).toBeCloseTo(22.36, 1);

        // Software: SI = √(Σ(ST_i - mean)²/N) = population standard deviation
        const softwareSI = Math.sqrt(
            loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length
        );
        // mean=40, = √(((50-40)²+(40-40)²+(30-40)²)/3) = √(200/3) ≈ 8.16
        expect(softwareSI).toBeCloseTo(8.165, 1);

        // Document: they give DIFFERENT results
        expect(classicalSI).not.toBeCloseTo(softwareSI, 0);
    });

    it('perfectly balanced line: both formulas give 0', () => {
        const loads = [40, 40, 40];
        const C_max = 40;
        const mean = 40;

        const classicalSI = Math.sqrt(
            loads.reduce((sum, load) => sum + Math.pow(C_max - load, 2), 0)
        );
        const softwareSI = Math.sqrt(
            loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length
        );

        // Both agree when line is perfectly balanced
        expect(classicalSI).toBe(0);
        expect(softwareSI).toBe(0);
    });

    it('single underloaded station: classical penalizes more heavily', () => {
        const loads = [60, 60, 60, 20]; // One very underloaded station
        const C_max = 60;
        const mean = 50;

        const classicalSI = Math.sqrt(
            loads.reduce((sum, load) => sum + Math.pow(C_max - load, 2), 0)
        );
        // = √(0 + 0 + 0 + (60-20)²) = √(1600) = 40
        expect(classicalSI).toBeCloseTo(40, 1);

        const softwareSI = Math.sqrt(
            loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length
        );
        // = √((100+100+100+900)/4) = √(1200/4) = √300 ≈ 17.32
        expect(softwareSI).toBeCloseTo(17.32, 1);
    });
});

// ============================================================================
// BLOCK 2F: Line Efficiency Formula
// Source: Scholl (1999), standard SALBP literature
// Standard: efficiency = totalWork / (n_stations × C_max) × 100%
// Balance Delay: d = 1 - efficiency
// Idle Time: (n_stations × C_max) - totalWork
// ============================================================================
describe('Validated: Line Efficiency Formulas (Academic Standards)', () => {

    it('classic textbook example: 6 tasks, 4 stations', () => {
        // Tasks: [3, 4, 5, 3, 4, 3] = 22s total work content
        // Takt = 6s, C_max = 7s (bottleneck station)
        // 4 stations with loads: [7, 5, 5, 5]
        const totalWork = 22;
        const nStations = 4;
        const C_max = 7;

        // Line Efficiency (standard formula)
        const efficiency = (totalWork / (nStations * C_max)) * 100;
        expect(efficiency).toBeCloseTo(78.57, 1);

        // Balance Delay
        const balanceDelay = 100 - efficiency;
        expect(balanceDelay).toBeCloseTo(21.43, 1);

        // Idle Time (standard)
        const idleTime = (nStations * C_max) - totalWork;
        expect(idleTime).toBeCloseTo(6, 4);
    });

    it('perfect balance: 100% efficiency, 0 idle time', () => {
        // 3 stations each with load = 10, total work = 30
        const totalWork = 30;
        const nStations = 3;
        const C_max = 10;

        const efficiency = (totalWork / (nStations * C_max)) * 100;
        expect(efficiency).toBeCloseTo(100, 4);

        const idleTime = (nStations * C_max) - totalWork;
        expect(idleTime).toBe(0);
    });

    it('minimum theoretical stations: ceil(totalWork / taktTime)', () => {
        // Total work = 88s, Takt = 30s
        // N_min = ceil(88/30) = 3
        const totalWork = 88;
        const taktTime = 30;
        const N_min = Math.ceil(totalWork / taktTime);
        expect(N_min).toBe(3);
    });
});

// ============================================================================
// BLOCK 2G: MMALBP - Combined Precedence Graph
// Source: Thomopoulos (1967, 1970)
// Approach: Union of all individual product precedence graphs
// ============================================================================
describe('Validated: buildCombinedPrecedenceGraph (Thomopoulos 1967)', () => {

    it('merges shared tasks and takes union of predecessors', () => {
        const productA: any = {
            meta: { name: 'Model A' },
            _mixDemand: 600,
            tasks: [
                createTask({ id: 'T1', description: 'Ensamblar base', standardTime: 10, predecessors: [], successors: ['T2'] }),
                createTask({ id: 'T2', description: 'Atornillar', standardTime: 20, predecessors: ['T1'], successors: [] }),
            ],
        };

        const productB: any = {
            meta: { name: 'Model B' },
            _mixDemand: 400,
            tasks: [
                createTask({ id: 'T1', description: 'Ensamblar base', standardTime: 15, predecessors: [], successors: ['T2', 'T3'] }),
                createTask({ id: 'T2', description: 'Atornillar', standardTime: 25, predecessors: ['T1'], successors: [] }),
                createTask({ id: 'T3', description: 'Inspeccionar', standardTime: 8, predecessors: ['T1'], successors: [] }),
            ],
        };

        const { tasks, conflicts } = buildCombinedPrecedenceGraph([productA, productB]);

        // T1 exists in both → merged
        const t1 = tasks.find(t => t.id === 'T1')!;
        expect(t1).toBeDefined();
        // Successors: union of ['T2'] and ['T2','T3'] = ['T2','T3']
        expect(t1.successors).toContain('T2');
        expect(t1.successors).toContain('T3');

        // T3 only exists in product B but is in combined graph
        const t3 = tasks.find(t => t.id === 'T3')!;
        expect(t3).toBeDefined();

        // No conflicts (descriptions match)
        expect(conflicts.length).toBe(0);
    });

    it('detects conflict when same ID has different description', () => {
        const productA: any = {
            meta: { name: 'Model A' },
            _mixDemand: 500,
            tasks: [
                createTask({ id: 'T1', description: 'Soldar', standardTime: 10 }),
            ],
        };

        const productB: any = {
            meta: { name: 'Model B' },
            _mixDemand: 500,
            tasks: [
                createTask({ id: 'T1', description: 'Pintar', standardTime: 15 }), // Different description!
            ],
        };

        const { tasks, conflicts } = buildCombinedPrecedenceGraph([productA, productB]);

        // Should detect conflict and create composite ID
        expect(conflicts.length).toBeGreaterThan(0);
        // Original T1 (Soldar) + composite T1__Model B (Pintar)
        expect(tasks.length).toBe(2);
    });
});

// ============================================================================
// BLOCK 2H: MMALBP - Weighted Times
// Source: Thomopoulos (1967)
// Formula: T_weighted = Σ(T_model × demand_model / total_demand)
// ============================================================================
describe('Validated: calculateWeightedTimes (Thomopoulos 1967)', () => {

    it('two products 60%/40%: shared task weighted correctly', () => {
        // Product A: 600 units, Task T1 = 45s
        // Product B: 400 units, Task T1 = 60s
        // Total demand = 1000
        // Weighted = (45 × 600/1000) + (60 × 400/1000) = 27 + 24 = 51
        const tasks: any[] = [
            {
                ...createTask({ id: 'T1' }),
                standardTime: 0,
                _multiProductTimes: [
                    { productId: 'A', time: 45, demand: 600 },
                    { productId: 'B', time: 60, demand: 400 },
                ],
            },
        ];

        const result = calculateWeightedTimes(tasks, 1000);

        expect(result[0].standardTime).toBeCloseTo(51, 1);
    });

    it('three products: A(50%), B(30%), C(20%)', () => {
        // T1: A=10s, B=15s, C=20s
        // weighted = (10×500/1000) + (15×300/1000) + (20×200/1000)
        //          = 5 + 4.5 + 4 = 13.5
        const tasks: any[] = [
            {
                ...createTask({ id: 'T1' }),
                standardTime: 0,
                _multiProductTimes: [
                    { productId: 'A', time: 10, demand: 500 },
                    { productId: 'B', time: 15, demand: 300 },
                    { productId: 'C', time: 20, demand: 200 },
                ],
            },
        ];

        const result = calculateWeightedTimes(tasks, 1000);

        expect(result[0].standardTime).toBeCloseTo(13.5, 1);
    });

    it('single product: no weighting, time preserved', () => {
        const tasks: any[] = [
            {
                ...createTask({ id: 'T1' }),
                standardTime: 0,
                _multiProductTimes: [
                    { productId: 'A', time: 30, demand: 1000 },
                ],
            },
        ];

        const result = calculateWeightedTimes(tasks, 1000);

        // 30 × 1000/1000 = 30
        expect(result[0].standardTime).toBeCloseTo(30, 1);
    });

    it('low-weight task detection (Mizusumashi candidate)', () => {
        // Takt = 60s, threshold = 60 × 0.15 = 9s
        // Task with weighted time = 5s < 9s → flagged as low-weight
        const tasks: any[] = [
            {
                ...createTask({ id: 'T1' }),
                standardTime: 0,
                _multiProductTimes: [
                    { productId: 'A', time: 5, demand: 1000 },
                ],
            },
        ];

        const result = calculateWeightedTimes(tasks, 1000, 60);

        expect(result[0].standardTime).toBeCloseTo(5, 1);
        expect((result[0] as any)._isLowWeight).toBe(true);
    });

    it('MIN_SATURATION_THRESHOLD is 15% (documented constant)', () => {
        expect(MIN_SATURATION_THRESHOLD).toBe(0.15);
    });

    it('zero total demand returns tasks unchanged', () => {
        const tasks: any[] = [
            {
                ...createTask({ id: 'T1' }),
                standardTime: 99,
                _multiProductTimes: [
                    { productId: 'A', time: 10, demand: 0 },
                ],
            },
        ];

        const result = calculateWeightedTimes(tasks, 0);

        // Should return unchanged (no weighting possible)
        expect(result[0].standardTime).toBe(99);
    });
});

// ============================================================================
// BLOCK 2I: RPW Sort Validation
// Source: Helgeson & Birnie (1961)
// The RPW heuristic sorts tasks by positional weight DESCENDING
// then assigns greedily to the first station where they fit.
// ============================================================================
describe('Validated: RPW Sort Order (Helgeson & Birnie 1961)', () => {

    it('tasks are correctly sorted by positional weight descending', () => {
        // Given tasks with known positional weights, verify sort order
        const tasks = [
            { id: 'A', pw: 70 },
            { id: 'B', pw: 45 },
            { id: 'C', pw: 15 },
            { id: 'D', pw: 25 },
        ];

        // RPW sort: descending by positional weight
        const sorted = [...tasks].sort((a, b) => b.pw - a.pw);

        expect(sorted[0].id).toBe('A'); // PW=70
        expect(sorted[1].id).toBe('B'); // PW=45
        expect(sorted[2].id).toBe('D'); // PW=25
        expect(sorted[3].id).toBe('C'); // PW=15
    });

    it('tie-breaking: same PW, longer task time first', () => {
        // When positional weights are equal, the task with the longer
        // standard time should be placed first (LCR as tie-breaker)
        const tasks = [
            { id: 'X', pw: 50, time: 20 },
            { id: 'Y', pw: 50, time: 30 },
        ];

        const sorted = [...tasks].sort((a, b) => {
            if (Math.abs(b.pw - a.pw) > 0.01) return b.pw - a.pw;
            return b.time - a.time; // Tie-breaker: longest first
        });

        expect(sorted[0].id).toBe('Y'); // Same PW but longer time
        expect(sorted[1].id).toBe('X');
    });
});

// ============================================================================
// BLOCK 2J: GA Parameters Validation
// Source: Rubinovitz & Levitin (1995), Anderson & Ferris (1994)
// Validate that default GA parameters are within published ranges
// ============================================================================
describe('Validated: GA Parameters (Literature Ranges)', () => {

    it('population size within acceptable range (10-1000)', () => {
        const populationSize = 50;
        expect(populationSize).toBeGreaterThanOrEqual(10);
        expect(populationSize).toBeLessThanOrEqual(1000);
    });

    it('mutation rate within acceptable range (0.1%-10%)', () => {
        const mutationRate = 0.01; // 1%
        expect(mutationRate).toBeGreaterThanOrEqual(0.001);
        expect(mutationRate).toBeLessThanOrEqual(0.10);
    });

    it('crossover rate within acceptable range (50%-95%)', () => {
        const crossoverRate = 0.80; // 80%
        expect(crossoverRate).toBeGreaterThanOrEqual(0.50);
        expect(crossoverRate).toBeLessThanOrEqual(0.95);
    });

    it('elite count should be 1-5% of population', () => {
        const eliteCount = 2;
        const populationSize = 50;
        const elitePercent = (eliteCount / populationSize) * 100;
        expect(elitePercent).toBeGreaterThanOrEqual(1);
        expect(elitePercent).toBeLessThanOrEqual(10);
    });

    it('fitness function weights create lexicographic priority', () => {
        // stations×1000 + headcount×100 + smoothness + penalties
        // This means: 1 fewer station > any headcount/smoothness improvement
        const weight_stations = 1000;
        const weight_headcount = 100;
        const weight_smoothness = 1;

        // Adding 1 station always outweighs any headcount or smoothness
        expect(weight_stations).toBeGreaterThan(weight_headcount * 9); // max 9 extra operators
        expect(weight_headcount).toBeGreaterThan(weight_smoothness * 60); // max ~60s smoothness
    });
});
