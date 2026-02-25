import { useMemo } from 'react';
import { parseNumberInput } from '../../../utils';
import { useInjectionState } from './useInjectionState';
import { calculateInjectionMetrics } from '../../../core/math/injection';

export const useCavityCalculator = (
    state: ReturnType<typeof useInjectionState>,
    dailyDemand: number,
    activeShifts: number,
    oee: number,
    availableSeconds?: number  // FIX Bug #3: Pre-calculated from real shift config
) => {
    // 1. PARSE INPUTS (Pure UI Concern)
    const puInyTime = parseNumberInput(state.puInyTimeStr);
    const puCurTime = parseNumberInput(state.puCurTimeStr);
    const userHeadcountOverride = parseNumberInput(state.userHeadcountStr);
    const manualOverride = state.manualTimeOverrideStr !== null ? parseNumberInput(state.manualTimeOverrideStr) : null;

    // 2. DELEGATE TO CORE MATH (Sealed Logic)
    const result = useMemo(() => {
        return calculateInjectionMetrics({
            puInyTime,
            puCurTime,
            activeShifts,
            dailyDemand,
            oee,
            availableSeconds,  // FIX Bug #3: Pass real shift config
            manualOps: state.manualOps,
            manualTimeOverride: manualOverride,
            headcountMode: state.headcountMode,
            userHeadcountOverride,
            userSelectedN: state.userSelectedN,
            cavityMode: state.cavityMode
        });
    }, [
        puInyTime, puCurTime, activeShifts, dailyDemand, oee, availableSeconds,
        state.manualOps, manualOverride, state.headcountMode,
        userHeadcountOverride, state.userSelectedN, state.cavityMode
    ]);

    // 3. MAP OUTPUT TO UI FORMAT (ViewModel)
    return {
        puInyTime,
        puCurTime,
        effectiveManualTime: result.inputs.effectiveManualTime,
        userHeadcountOverride,
        isUsingDefaultManual: result.inputs.isUsingDefaultManual,
        activeN: result.inputs.activeN,
        validation: result.validation,
        chartData: result.chartData,
        selectedData: result.selectedData,
        metrics: {
            taktTime: result.inputs.taktTime,
            realCycleTime: result.selectedData?.realCycle || 1,
            hourlyOutput: result.metrics.hourlyOutput,
            nStar: result.inputs.nStar,
            isBottleneckLabor: result.metrics.isBottleneckLabor,
            isCurrentFeasible: result.metrics.isCurrentFeasible,
            realSaturation: result.metrics.realSaturation,
            machinePortionPct: result.metrics.machinePortionPct,
            operatorDelay: result.selectedData?.waitOp || 0,
            activeHeadcount: result.metrics.activeHeadcount,
            currentEffectiveManualTime: result.inputs.effectiveManualTime, // Approximate mapping
            lostOutput: result.metrics.lostOutput,
            machineLimitCycle: result.selectedData?.cyclePerPiece || 1,
            manualLimitCycle: result.selectedData?.manualLimitCycle || 1,
            activeShifts,
            dailyDemand,
            oee,
            manualOps: state.manualOps
        },
        manualOps: state.manualOps
    };
};
