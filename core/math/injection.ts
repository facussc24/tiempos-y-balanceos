import { ManualOperation, InjectionSimulationParams, InjectionScenario } from '../../types';
import { RotaryInjectionStrategy } from '../../modules/strategies/RotaryStrategy';
import { validateInjectionParams } from '../../modules/validation/injectionValidation'; // Re-export or move later? For now import from legacy location
import { BUSINESS_RULES } from '../config/constants';

// Define Input/Output interfaces for the Pure Function
export interface CavityCalculationInput {
    puInyTime: number;
    puCurTime: number;
    activeShifts: number;
    dailyDemand: number;
    oee: number;
    availableSeconds?: number;  // FIX Bug #3: Pre-calculated from real shift config
    manualOps: ManualOperation[];
    manualTimeOverride: number | null;
    headcountMode: 'auto' | 'manual';
    userHeadcountOverride: number;
    userSelectedN?: number;
    cavityMode: 'auto' | 'manual';
    activeN?: number; // Optional, derived if not passed
}

export interface CavityCalculationResult {
    // Inputs (Normalized)
    inputs: {
        effectiveManualTime: number;
        isUsingDefaultManual: boolean;
        activeN: number;
        taktTime: number;
        availableSeconds: number;
        nStar: number;
    };

    // Validation
    validation: {
        isValid: boolean;
        errors: any[];
    };

    // Chart Data (Scenarios)
    chartData: InjectionScenario[];

    // Selected Scenario Data (Metrics)
    selectedData: InjectionScenario | undefined;

    metrics: {
        hourlyOutput: number;
        maxTheoreticalOutput: number;
        lostOutput: number;
        realSaturation: number;
        isBottleneckLabor: boolean;
        machinePortionPct: number;
        activeHeadcount: number;
        isCurrentFeasible: boolean;
    };
}

/**
 * PURE FUNCTION: Core Injection Calc Logic
 * "The Sealed Box" - No React, No Side Effects.
 */
export const calculateInjectionMetrics = (params: CavityCalculationInput): CavityCalculationResult => {
    const {
        puInyTime, puCurTime, activeShifts, dailyDemand, oee,
        manualOps = [], manualTimeOverride, headcountMode, userHeadcountOverride,
        cavityMode, userSelectedN
    } = params;

    // 1. NORMALIZE INPUTS
    const calculatedManualTime = manualOps.reduce((acc, op) => acc + op.time, 0);
    const effectiveManualTime = manualTimeOverride !== null
        ? manualTimeOverride
        : (calculatedManualTime > 0 ? calculatedManualTime : BUSINESS_RULES.DEFAULT_MANUAL_TIME_SECONDS);
    const isUsingDefaultManual = (manualTimeOverride === null && calculatedManualTime === 0);

    // Takt Time (FIX Bug #3: Use passed availableSeconds if provided, else fallback to constant)
    const availableSeconds = params.availableSeconds ?? (activeShifts * BUSINESS_RULES.SECONDS_IN_SHIFT);
    const safeOee = oee > 0 ? oee : BUSINESS_RULES.DEFAULT_OEE_GLOBAL;
    const taktTime = dailyDemand > 0 ? (availableSeconds * safeOee) / dailyDemand : 0;

    // N* (Saturation Point)
    // N* = 1 + (t_cur / t_iny)
    const nStar = Math.ceil(1 + (puCurTime / (puInyTime || 1)));

    // 2. SCENARIO CALCULATION (Strategy Pattern) — generated BEFORE auto-N selection
    // so we can pick the minimum N based on REAL cycle (including manual ops)
    const strategy = new RotaryInjectionStrategy();
    const chartData = strategy.calculate({
        puInyTime,
        puCurTime,
        manualOps,
        manualTimeOverride,
        taktTime,
        headcountMode,
        userHeadcountOverride,
        activeShifts,
        oee,
        cycleQuantity: 1,
        availableSeconds
    });

    // 3. AUTO-CAVITY LOGIC (uses real cycle from scenarios)
    // Old formula: N_min = Ceil(Curing / Takt) — WRONG: ignores injection time + external ops
    // New: find first N where realCycle (including all constraints) ≤ taktTime
    let autoOptimalN: number;
    if (taktTime <= 0 || chartData.length === 0) {
        autoOptimalN = 1;
    } else {
        const feasible = chartData.find(d => d.realCycle <= taktTime);
        // If no scenario meets takt, pick highest N (lowest cycle) as best effort
        autoOptimalN = feasible
            ? feasible.n
            : chartData[chartData.length - 1].n;
    }
    const activeN = (cavityMode === 'auto' ? autoOptimalN : userSelectedN) || 1;

    // 4. VALIDATION
    const validation = validateInjectionParams({
        puInyTime, puCurTime, activeShifts, manualOps,
        manualTimeOverride, taktTime, headcountMode,
        userHeadcountOverride, oee, cycleQuantity: activeN
    });

    // 5. DERIVED METRICS
    const selectedData = chartData.find(d => d.n === activeN);

    // Safe extract with defaults
    const realCycleTime = selectedData?.realCycle || 1;
    const machineLimitCycle = selectedData?.cyclePerPiece || 1;
    const manualLimitCycle = selectedData?.manualLimitCycle || 1;

    const isCurrentFeasible = !!selectedData;

    const activeHeadcount = headcountMode === 'manual'
        ? (userHeadcountOverride > 0 ? userHeadcountOverride : 1)
        : Math.max(1, Math.ceil(selectedData?.reqOperators || 1));

    const hourlyOutput = realCycleTime > 0 ? (BUSINESS_RULES.SECONDS_IN_HOUR / realCycleTime) : 0;
    const maxTheoreticalOutput = machineLimitCycle > 0 ? (BUSINESS_RULES.SECONDS_IN_HOUR / machineLimitCycle) : 0;
    const lostOutput = maxTheoreticalOutput - hourlyOutput;

    const machinesCount = selectedData?.machinesNeeded || 1;
    // Note: Reusing currentEffectiveManualTime logic from hook
    const currentEffectiveManualTime = selectedData?.manualTime || effectiveManualTime;
    const totalManualLoad = currentEffectiveManualTime * machinesCount;

    const realSaturation = (activeHeadcount * realCycleTime) > 0
        ? (totalManualLoad / (activeHeadcount * realCycleTime)) * 100
        : 0;

    const isBottleneckLabor = manualLimitCycle > (machineLimitCycle + 0.01);
    const machinePortionPct = realCycleTime > 0 ? (machineLimitCycle / realCycleTime) * 100 : 0;

    return {
        inputs: {
            effectiveManualTime,
            isUsingDefaultManual,
            activeN,
            taktTime,
            availableSeconds,
            nStar
        },
        validation,
        chartData,
        selectedData,
        metrics: {
            hourlyOutput,
            maxTheoreticalOutput,
            lostOutput,
            realSaturation,
            isBottleneckLabor,
            machinePortionPct,
            activeHeadcount,
            isCurrentFeasible
        }
    };
};
