import { Shift, Task, ProjectData, InjectionSimulationParams, InjectionScenario, Sector } from "../../types";
import { parseTime } from "../../utils/formatting";
import { RotaryInjectionStrategy } from "../../modules/strategies/RotaryStrategy";

export const calculateShiftNetMinutes = (shift: Shift): number => {
    const start = parseTime(shift.startTime);
    let end = parseTime(shift.endTime);

    // FIX: Guard against malformed shift times producing NaN
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

    // Handle overnight shifts
    if (end < start) {
        end += 24 * 60;
    }

    const gross = end - start;
    // FIX: Reject negative break durations to prevent silent data corruption
    const totalBreaks = shift.breaks.reduce((sum, b) => sum + Math.max(0, b.duration || 0), 0);
    return Math.max(0, gross - totalBreaks);
};

// --- LOGIC: OEE HIERARCHY ---
// Priority: Sector OEE > Station Config OEE > Global OEE
export const calculateStationOEE = (data: ProjectData, stationId: number, sectorId?: string): number => {
    // 1. Check if Sector OEE is active and applicable
    if (data.meta.useSectorOEE) {
        let activeSectorId = sectorId;

        // Fallback: If sector not provided, find via tasks (Legacy/Board logic)
        if (!activeSectorId) {
            const tasksInStation = data.assignments
                .filter(a => a.stationId === stationId)
                .map(a => data.tasks.find(t => t.id === a.taskId))
                .filter(Boolean) as Task[];
            activeSectorId = tasksInStation[0]?.sectorId;
        }

        const sector = data.sectors?.find(s => s.id === activeSectorId);

        // If sector has a validated OEE, enforce it (Decision #1)
        if (sector && sector.targetOee !== undefined) {
            return sector.targetOee;
        }
    }

    // 2. Fallback to Station Config (if Detailed Mode)
    if (!data.meta.useManualOEE) {
        const config = data.stationConfigs?.find(sc => sc.id === stationId);
        if (config) return config.oeeTarget;
    }

    // 3. Fallback to Global OEE
    return data.meta.manualOEE;
};

// Calculates Weighted OEE based on Standard Time Contribution of each Sector
// Formula: Sum(SectorOEE * (SectorTime / TotalTime))
export const calculateWeightedLineOEE = (data: ProjectData): number => {
    if (!data.meta.useSectorOEE) return data.meta.manualOEE;

    let totalStdTime = 0;
    const sectorTimes: Record<string, number> = {};
    const sectorOEEs: Record<string, number> = {};

    // 1. Initialize Sectors
    data.sectors?.forEach(s => {
        sectorTimes[s.id] = 0;
        sectorOEEs[s.id] = s.targetOee || data.meta.manualOEE; // Fallback to global if not set
    });
    // Virtual 'General' sector
    sectorTimes['general'] = 0;
    sectorOEEs['general'] = data.meta.manualOEE; // General tasks assume global target

    // 2. Accumulate Times
    data.tasks.forEach(t => {
        const time = t.standardTime || t.averageTime || 0;
        totalStdTime += time;
        const sId = t.sectorId && sectorTimes[t.sectorId] !== undefined ? t.sectorId : 'general';
        sectorTimes[sId] += time;
    });

    if (totalStdTime === 0) return data.meta.manualOEE;

    // 3. Calculate Weighted Average
    let weightedSum = 0;
    Object.keys(sectorTimes).forEach(sId => {
        const weight = sectorTimes[sId] / totalStdTime;
        weightedSum += (sectorOEEs[sId] * weight);
    });

    return weightedSum;
};

/**
 * Calculate adjusted demand accounting for expected scrap/defect rate.
 * 
 * This inflates the base demand to ensure enough production to meet
 * customer requirements after removing defects.
 * 
 * Formula: Adjusted_Demand = Base_Demand / (1 - scrapRate)
 * 
 * @param baseDemand - Original customer demand in pieces
 * @param scrapRate - Expected scrap/defect rate (0.00 - 0.20, clamped)
 * @returns Adjusted demand that accounts for expected losses
 * 
 * @example
 * // 3% scrap: need to produce 1030.93 to deliver 1000
 * calculateAdjustedDemand(1000, 0.03) // Returns 1030.93
 * 
 * @version 5.1.0 - Phase 1 Completion
 */
export const calculateAdjustedDemand = (
    baseDemand: number,
    scrapRate: number = 0
): number => {
    // Handle edge case: zero demand
    if (baseDemand <= 0) return 0;

    // Clamp scrap rate to valid range: 0% - 20%
    // Negative values make no sense, above 20% is unrealistic for production
    const clampedScrap = Math.max(0, Math.min(0.20, scrapRate));

    // If no scrap, return base demand unchanged
    if (clampedScrap === 0) return baseDemand;

    // Formula: To get X good pieces with Y% scrap, produce X / (1 - Y)
    // Example: 1000 pieces with 3% scrap = 1000 / 0.97 = 1030.93
    return baseDemand / (1 - clampedScrap);
};

/**

 * Calculate Takt Time with optional Setup Loss for batched production.
 * 
 * V8.1: Added setupLossPercent parameter to account for changeover time
 * in Mix/Heijunka scenarios where batch production consumes capacity.
 * 
 * Formula:
 *   nominalTakt = AvailableTime / Demand
 *   effectiveTakt = nominalTakt × OEE
 *   
 * With Setup Loss:
 *   netAvailableTime = AvailableTime × (1 - setupLossPercent)
 *   nominalTakt = netAvailableTime / Demand
 * 
 * @param shifts - Array of shift configurations
 * @param activeShiftsCount - Number of active shifts (1-3)
 * @param dailyDemand - Daily production target
 * @param oee - Overall Equipment Effectiveness (0-1)
 * @param setupLossPercent - Optional: % of time lost to changeovers (0-0.20)
 * @returns Object with nominal, effective Takt times and available minutes
 */
export const calculateTaktTime = (
    shifts: Shift[],
    activeShiftsCount: number,
    dailyDemand: number,
    oee: number,
    setupLossPercent: number = 0 // V8.1: Default 0 for backward compatibility
): {
    nominalSeconds: number;
    effectiveSeconds: number;
    totalAvailableMinutes: number;
    netAvailableMinutes: number; // V8.1: After setup loss deduction
    setupLossApplied: number;    // V8.1: Actual % applied (for display)
} => {
    let totalMinutes = 0;
    for (let i = 0; i < activeShiftsCount && i < shifts.length; i++) {
        totalMinutes += calculateShiftNetMinutes(shifts[i]);
    }

    if (dailyDemand <= 0 || totalMinutes <= 0) {
        return {
            nominalSeconds: 0,
            effectiveSeconds: 0,
            totalAvailableMinutes: totalMinutes,
            netAvailableMinutes: totalMinutes,
            setupLossApplied: 0
        };
    }

    // V8.1: Apply setup loss to reduce available time for batched production
    // Clamp to valid range: 0-20%
    const clampedSetupLoss = Math.max(0, Math.min(0.20, setupLossPercent));
    const netMinutes = totalMinutes * (1 - clampedSetupLoss);

    // Calculate Takt based on NET available time
    const nominalSeconds = (netMinutes * 60) / dailyDemand;
    // OEE must be 0 < oee ≤ 1; if unset or invalid, skip OEE adjustment (= 1)
    const safeOee = (oee > 0 && oee <= 1) ? oee : 1;
    const effectiveSeconds = nominalSeconds * safeOee;

    return {
        nominalSeconds,
        effectiveSeconds,
        totalAvailableMinutes: totalMinutes,
        netAvailableMinutes: netMinutes,
        setupLossApplied: clampedSetupLoss
    };
};

/**
 * Returns the effective shift config for a sector, falling back to project defaults.
 * If the sector has a shiftOverride, uses those values; otherwise uses the project config.
 */
export const getSectorShiftConfig = (
    sector: Sector,
    projectShifts: Shift[],
    projectActiveShifts: number
): { shifts: Shift[]; activeShifts: number } => {
    if (!sector.shiftOverride) {
        return { shifts: projectShifts, activeShifts: projectActiveShifts };
    }
    // FIX: Clamp activeShifts to available shifts length to prevent off-by-one
    const effectiveShifts = sector.shiftOverride.shifts ?? projectShifts;
    return {
        shifts: effectiveShifts,
        activeShifts: Math.max(1, Math.min(effectiveShifts.length, sector.shiftOverride.activeShifts))
    };
};

/**
 * Calculates Takt Time for a specific sector using its shift override (if any).
 * Delegates to calculateTaktTime with the resolved shift config.
 */
export const calculateSectorTaktTime = (
    sector: Sector,
    projectShifts: Shift[],
    projectActiveShifts: number,
    dailyDemand: number,
    oee: number,
    setupLossPercent: number = 0
): ReturnType<typeof calculateTaktTime> => {
    const { shifts, activeShifts } = getSectorShiftConfig(sector, projectShifts, projectActiveShifts);
    return calculateTaktTime(shifts, activeShifts, dailyDemand, oee, setupLossPercent);
};

export const calculateEffectiveStationTime = (tasks: Task[]): number => {
    const processedIds = new Set<string>();
    let totalTime = 0;

    // 1. Identify Machine/Injection Tasks (Containers) — excluding internal/background tasks
    const machineTasks = tasks.filter(t =>
        (t.executionMode === 'machine' || t.executionMode === 'injection') && !t.isMachineInternal
    );

    // Mark all isMachineInternal tasks as processed (they contribute 0s — run in background)
    tasks.forEach(t => {
        if (t.isMachineInternal) processedIds.add(t.id);
    });

    // Process Machine Groups
    machineTasks.forEach(mt => {
        const mtTime = mt.standardTime || mt.averageTime || 0;

        // Find concurrent manual tasks assigned TO THIS group of tasks
        // Note: In this context, we assume all 'tasks' passed to this function are in the same station.
        const concurrentManuals = tasks.filter(t =>
            !processedIds.has(t.id) &&
            (t.executionMode !== 'machine' && t.executionMode !== 'injection') && t.concurrentWith === mt.id
        );

        // Calculate Sum of Manual Tasks overlapping this machine
        const manualSum = concurrentManuals.reduce((sum, t) => sum + (t.standardTime || t.averageTime || 0), 0);

        // Dominant Element Logic: Max(Machine, ManualSum)
        totalTime += Math.max(mtTime, manualSum);

        // Mark as processed
        processedIds.add(mt.id);
        concurrentManuals.forEach(t => processedIds.add(t.id));
    });

    // 2. Add remaining independent tasks OR Broken Links
    tasks.forEach(t => {
        if (!processedIds.has(t.id)) {
            totalTime += (t.standardTime || t.averageTime || 0);
        }
    });

    return totalTime;
};

// Calculates the global Effective Work Content for the entire project
// Tasks in the same station benefit from concurrency. Unassigned tasks are summed raw.
export const calculateTotalEffectiveWorkContent = (data: ProjectData): number => {
    // 1. Group tasks by Station
    const stations: Record<number, Task[]> = {};
    const assignedTaskIds = new Set<string>();

    data.assignments.forEach(a => {
        if (!stations[a.stationId]) stations[a.stationId] = [];
        const t = data.tasks.find(task => task.id === a.taskId);
        if (t) {
            stations[a.stationId].push(t);
            assignedTaskIds.add(t.id);
        }
    });

    let totalEffectiveTime = 0;

    // 2. Sum effective time of configured stations (applying logic)
    Object.values(stations).forEach(stationTasks => {
        totalEffectiveTime += calculateEffectiveStationTime(stationTasks);
    });

    // 3. Add unassigned tasks (raw sum, assuming no concurrency benefit until assigned)
    // FIX: Exclude isMachineInternal tasks — they contribute 0 effective time
    // because they run concurrently inside the machine cycle
    data.tasks.forEach(t => {
        if (!assignedTaskIds.has(t.id) && !t.isMachineInternal) {
            totalEffectiveTime += (t.standardTime || t.averageTime || 0);
        }
    });

    return totalEffectiveTime;
};

// Calculates Total Workforce (Headcount)
// Sums up replicas only from stations that have tasks assigned.
export const calculateTotalHeadcount = (data: ProjectData): number => {
    const configuredStations = data.meta.configuredStations > 0 ? data.meta.configuredStations : 1;
    const configMap = new Map(data.stationConfigs?.map(c => [c.id, c]) ?? []);
    // Build set of station IDs that actually have tasks assigned
    const stationsWithTasks = new Set(data.assignments?.map(a => a.stationId).filter(Number.isFinite) ?? []);
    let totalHeadcount = 0;
    for (let i = 1; i <= configuredStations; i++) {
        if (!stationsWithTasks.has(i)) continue; // Skip empty stations
        const config = configMap.get(i);
        totalHeadcount += (config?.replicas && config.replicas > 0) ? config.replicas : 1;
    }
    return totalHeadcount;
};

export const calculateInjectionScenarios = (params: InjectionSimulationParams): InjectionScenario[] => {
    const strategy = new RotaryInjectionStrategy();
    return strategy.calculate(params);
};

// Helper to detect Overload and Recommend Actions
export const detectOverloadAndRecommend = (
    station: { effectiveTime: number; limit: number; replicas: number; tasks: Task[] },
    nominalSeconds: number
): {
    stationId: number;
    isOverload: boolean;
    currentLoad: number;
    limit: number;
    currentReplicas: number;
    recommendedReplicas: number;
    bottleneckType: 'machine' | 'manual';
    reason: string;
    recommendation: string;
} | null => {
    // Phase 17: Use nominalSeconds for capacity calculation (Total Capacity = Replicas * Nominal)
    const effectiveLimit = station.limit || nominalSeconds;

    // Check if station is overloaded (Capacity = Replicas * Limit)
    const capacity = station.replicas * effectiveLimit;
    const isOverload = station.effectiveTime > capacity;

    if (!isOverload) return null;

    // Calculate Manual Time (excluding Machine/Injection)
    const manualTime = station.tasks.reduce((sum, t) => {
        if (t.executionMode === 'injection' || t.executionMode === 'machine') return sum;
        if (t.isMachineInternal) return sum;
        return sum + (t.standardTime || t.averageTime || 0);
    }, 0);

    // Calculate Machine Time (Injection/Machine tasks only)
    const machineTime = station.tasks.reduce((sum, t) => {
        if (t.executionMode === 'injection' || t.executionMode === 'machine') {
            return sum + (t.standardTime || t.averageTime || 0);
        }
        return sum;
    }, 0);

    const hasMachine = machineTime > 0;

    // Classify bottleneck type:
    // RALBP: Machine time exceeds limit AND manual work already fits in limit (can't solve with operators)
    // ALWABP: Manual work exceeds limit (can solve with Multi-Manning)
    const manualExceedsLimit = manualTime > effectiveLimit;
    const machineExceedsLimit = machineTime > effectiveLimit;
    const isDominatedByMachine = hasMachine && machineExceedsLimit &&
        machineTime > manualTime && !manualExceedsLimit;

    const bottleneckType: 'machine' | 'manual' = isDominatedByMachine ? 'machine' : 'manual';

    // Calculate needed replicas for manual work
    const timeToCover = hasMachine ? manualTime : station.effectiveTime;
    const neededReplicas = timeToCover > 0
        ? Math.ceil(timeToCover / effectiveLimit)
        : station.replicas;

    // Generate conditional recommendation
    const recommendedReplicas = isDominatedByMachine ? station.replicas : Math.max(neededReplicas, 1);
    const recommendation = isDominatedByMachine
        ? "Reducir demanda o tiempo de máquina"
        : `Agregar operarios (${recommendedReplicas} op.)`;

    return {
        stationId: -1,
        isOverload: true,
        currentLoad: station.effectiveTime,
        limit: effectiveLimit,
        currentReplicas: station.replicas,
        recommendedReplicas: recommendedReplicas,
        bottleneckType: bottleneckType,
        reason: hasMachine
            ? `Sobrecarga: ${isDominatedByMachine ? 'Máquina' : 'Carga Manual'} (${Math.round(isDominatedByMachine ? machineTime : manualTime)}s) excede ciclo.`
            : "Sobrecarga: Tiempo Estación excede Takt.",
        recommendation: recommendation
    };
};
