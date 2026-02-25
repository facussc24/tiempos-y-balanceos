/**
 * Balancing Adapter
 *
 * Converts ProjectData from the balancing module into simulator-compatible
 * configuration. Single-pass parsing, no delta sync or hash tracking.
 *
 * @module balancingAdapter
 */

import type {
    ProjectData,
    Shift,
    Task,
    Sector,
} from '../../types';

import type { ProductType, MultiProductConfig } from './flowTypes';

// =============================================================================
// TYPES
// =============================================================================

export interface DemandConfig {
    dailyDemand: number;
    shiftCount: number;
    effectiveMinutesPerShift: number;
    calculatedTakt: number;
    demandPerShift: number;
}

export interface SimulatorStation {
    id: number;
    name: string;
    cycleTimeSeconds: number;
    operators: number;
    sectorId: string;
    sectorColor: string;
    sectorName: string;
    oee?: number;
}

export interface ShiftCalendar {
    shiftDurationMinutes: number;
    breaks: Array<{ startMinute: number; durationMinutes: number; name?: string }>;
    effectiveMinutes: number;
    startTime?: string;
}

export interface SimulatorConfig {
    stations: SimulatorStation[];
    shiftCalendar: ShiftCalendar;
    demandConfig: DemandConfig;
    multiProductConfig?: MultiProductConfig;
}

// =============================================================================
// SHIFT PARSING
// =============================================================================

export function parseShiftsToCalendar(shifts: Shift[], activeShifts: number = 1): ShiftCalendar {
    if (!shifts || shifts.length === 0) {
        return {
            shiftDurationMinutes: 510,
            breaks: [
                { startMinute: 150, durationMinutes: 15, name: 'Descanso 1' },
                { startMinute: 270, durationMinutes: 30, name: 'Almuerzo' },
                { startMinute: 420, durationMinutes: 15, name: 'Descanso 2' },
            ],
            effectiveMinutes: 450,
            startTime: '06:00',
        };
    }

    const primaryShift = shifts.slice(0, activeShifts)[0];

    let plannedMinutes = primaryShift.plannedMinutes;
    if (!plannedMinutes) {
        const [startH, startM] = primaryShift.startTime.split(':').map(Number);
        const [endH, endM] = primaryShift.endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        let endMin = endH * 60 + endM;
        if (endMin < startMin) endMin += 24 * 60;
        plannedMinutes = endMin - startMin;
    }

    const breaks = primaryShift.breaks.map(b => {
        const [breakH, breakM] = b.startTime.split(':').map(Number);
        const [shiftH, shiftM] = primaryShift.startTime.split(':').map(Number);
        const breakMin = breakH * 60 + breakM;
        const shiftStartMin = shiftH * 60 + shiftM;
        let startMinute = breakMin - shiftStartMin;
        if (startMinute < 0) startMinute += 24 * 60;

        return { startMinute, durationMinutes: b.duration, name: b.name };
    });

    const totalBreakMinutes = breaks.reduce((sum, b) => sum + b.durationMinutes, 0);

    return {
        shiftDurationMinutes: plannedMinutes,
        breaks,
        effectiveMinutes: plannedMinutes - totalBreakMinutes,
        startTime: primaryShift.startTime,
    };
}

// =============================================================================
// DEMAND PARSING
// =============================================================================

export function parseDemandConfig(data: ProjectData): DemandConfig {
    const dailyDemand = data.meta.dailyDemand || 100;
    const shiftCount = data.meta.activeShifts || 1;
    const calendar = parseShiftsToCalendar(data.shifts, shiftCount);
    const effectiveMinutesPerShift = calendar.effectiveMinutes;

    let availableSeconds = effectiveMinutesPerShift * 60 * shiftCount;
    if (data.meta.useManualOEE && data.meta.manualOEE) {
        availableSeconds *= data.meta.manualOEE;
    }

    const calculatedTakt = dailyDemand > 0 ? availableSeconds / dailyDemand : 60;

    return {
        dailyDemand,
        shiftCount,
        effectiveMinutesPerShift,
        calculatedTakt,
        demandPerShift: dailyDemand / shiftCount,
    };
}

// =============================================================================
// STATION PARSING
// =============================================================================

export function parseStationsFromBalancing(data: ProjectData): SimulatorStation[] {
    const { tasks, assignments, stationConfigs, sectors } = data;

    const taskMap = new Map<string, Task>(tasks.map(t => [t.id, t]));
    const sectorMap = new Map<string, Sector>(sectors.map(s => [s.id, s]));

    // Group assignments by station
    const stationAssignments = new Map<number, string[]>();
    for (const assignment of assignments) {
        const existing = stationAssignments.get(assignment.stationId) || [];
        existing.push(assignment.taskId);
        stationAssignments.set(assignment.stationId, existing);
    }

    const maxStationId = Math.max(
        ...Array.from(stationAssignments.keys()),
        ...stationConfigs.map(s => s.id),
        data.meta.configuredStations || 0
    );

    const stations: SimulatorStation[] = [];

    for (let stationId = 1; stationId <= maxStationId; stationId++) {
        const config = stationConfigs.find(s => s.id === stationId);
        const assignedTaskIds = stationAssignments.get(stationId) || [];

        // Calculate cycle time from assigned tasks
        let cycleTimeSeconds = config?.cycleTimeOverride ?? 0;
        if (!cycleTimeSeconds && assignedTaskIds.length > 0) {
            cycleTimeSeconds = assignedTaskIds.reduce((sum, taskId) => {
                const task = taskMap.get(taskId);
                return sum + (task?.standardTime || 0);
            }, 0);
        }
        if (!cycleTimeSeconds) cycleTimeSeconds = 30;

        // Determine sector from tasks
        let sectorId = '';
        let sectorColor = '#6366F1';
        let sectorName = 'Sin Sector';
        for (const taskId of assignedTaskIds) {
            const task = taskMap.get(taskId);
            if (task?.sectorId) {
                const sector = sectorMap.get(task.sectorId);
                if (sector) {
                    sectorId = sector.id;
                    sectorColor = sector.color;
                    sectorName = sector.name;
                    break;
                }
            }
        }

        const oee = config?.oeeTarget || data.meta.manualOEE || 0.85;
        const name = config?.name || `Estación ${stationId}`;

        stations.push({
            id: stationId,
            name,
            cycleTimeSeconds,
            operators: 1,
            sectorId,
            sectorColor,
            sectorName,
            oee,
        });
    }

    // Sort by sector sequence, then by station ID within the same sector
    stations.sort((a, b) => {
        const secA = sectorMap.get(a.sectorId)?.sequence ?? 999;
        const secB = sectorMap.get(b.sectorId)?.sequence ?? 999;
        if (secA !== secB) return secA - secB;
        return a.id - b.id;
    });

    return stations;
}

// =============================================================================
// MAIN PARSE FUNCTION
// =============================================================================

export function parseProjectToSimulator(config: { projectData: ProjectData }): SimulatorConfig {
    const { projectData: data } = config;

    const stations = parseStationsFromBalancing(data);
    const shiftCalendar = parseShiftsToCalendar(data.shifts, data.meta.activeShifts);
    const demandConfig = parseDemandConfig(data);

    // Multi-product config from active models
    let multiProductConfig: MultiProductConfig | undefined;
    const activeModels = data.meta.activeModels;
    if (activeModels && activeModels.length > 1) {
        const stationIds = stations.map(s => `station-${s.id}`);
        const products: ProductType[] = activeModels.map((model, index) => ({
            id: model.id,
            name: model.name,
            color: model.color || `hsl(${index * 60}, 70%, 50%)`,
            routeStations: stationIds,
            mixRatio: model.percentage || (1 / activeModels.length),
            cycleTimeMultiplier: 1.0,
            priority: index + 1,
        }));
        multiProductConfig = {
            products,
            dispatchingRule: 'fifo',
            interSectorBuffers: [],
            selectedProductFilter: null,
        };
    }

    return { stations, shiftCalendar, demandConfig, multiProductConfig };
}
