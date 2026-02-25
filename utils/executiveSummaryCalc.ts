/**
 * Executive Summary Calculation Engine
 * 
 * Computes per-sector capacity analysis across 1, 2, and 3 shift scenarios.
 * Reuses existing balancing infrastructure (calculateTaktTime, Shift definitions).
 * 
 * @module utils/executiveSummaryCalc
 * @version 1.0.0 - Phase 1 MVP
 */

import { ProjectData, Shift, Sector, Task, MachineType, Assignment } from '../types';
import { calculateTaktTime, calculateShiftNetMinutes } from '../core/balancing/simulation';
import XLSX from 'xlsx-js-style';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

/** Result for a single sector within a shift scenario */
export interface SectorSummary {
    sectorId: string;
    sectorName: string;
    sectorColor: string;
    /** Total standard time of all tasks in this sector (seconds) */
    totalStandardTime: number;
    /** Number of tasks in this sector (excludes machine-internal) */
    taskCount: number;
    /** Theoretical minimum operators = ceil(totalStdTime / taktTime) */
    operatorsRequired: number;
    /** Operators from actual balancing result (distinct stations assigned to this sector) */
    operatorsBalanced: number;
    /** Total headcount (sum of replicas for all assigned stations) */
    operatorsTotal: number;
    /** True if balancing data is available */
    hasBalancingData: boolean;
    /** Balancing efficiency = (theoretical / balanced) * 100. 100% = perfect */
    balancingEfficiency: number;
    /** Machine requirements per machine type */
    machines: MachineSummary[];
    /** Total machine units required across all types */
    totalMachinesRequired: number;
    /** Total machine units available across all types */
    totalMachinesAvailable: number;
    /** True if any machine type has a deficit */
    hasDeficit: boolean;
    /** Sector saturation as percentage (totalStdTime / (operators * taktTime) * 100) */
    saturation: number;
}

/** Machine requirement detail within a sector */
export interface MachineSummary {
    machineId: string;
    machineName: string;
    /** ceil(sumTaskTime / taktTime) */
    unitsRequired: number;
    /** From plantConfig inventory */
    unitsAvailable: number;
    /** required - available (positive = deficit) */
    gap: number;
    /** Saturation percentage per unit */
    saturationPerUnit: number;
    /** Task IDs that require this machine */
    taskIds: string[];
}

/** Complete result for a single shift scenario */
export interface ShiftScenarioResult {
    /** Number of active shifts (1, 2, or 3) */
    shiftCount: number;
    /** Takt time in seconds */
    taktTime: number;
    /** Effective takt time (with OEE) in seconds */
    effectiveTaktTime: number;
    /** Total available minutes for this shift count */
    availableMinutes: number;
    /** Daily demand (same for all scenarios) */
    dailyDemand: number;
    /** Per-sector breakdown */
    sectors: SectorSummary[];
    /** Global KPIs */
    totalOperatorsRequired: number;
    /** Total operators from actual balancing (if available) */
    totalOperatorsBalanced: number;
    /** True if any sector has balancing data */
    hasBalancingData: boolean;
    totalMachinesRequired: number;
    totalMachinesAvailable: number;
    totalDeficits: number;
    /** Theoretical daily output capacity (availableMinutes * 60 / maxSectorCycle) */
    theoreticalCapacity: number;
    /** Output per hour */
    piecesPerHour: number;
    /** Overall work content (sum of all standard times) */
    totalWorkContent: number;
    /** Bottleneck cycle time from actual balancing (slowest station, 0 if no balancing) */
    bottleneckCycleTime: number;
    /** True if bottleneck was calculated from real assignments */
    hasBottleneck: boolean;
}

/** Full executive summary across all shift scenarios */
export interface ExecutiveSummaryResult {
    /** Project reference name */
    projectName: string;
    /** Results for 1, 2, and 3 shifts */
    scenarios: ShiftScenarioResult[];
    /** Data quality warnings */
    warnings: string[];
    /** Timestamp of calculation */
    calculatedAt: string;
}

// ============================================================================
// Helper: Get effective task time
// FIX v10.1: standardTime already includes fatigue from graph.ts
// No need to re-apply getFatigueFactor (was causing DOUBLE-FATIGUE BUG)
// ============================================================================

/** Get effective task time: standardTime already includes fatigue */
const getEffectiveTaskTime = (task: Task): number => {
    const baseTime = task.standardTime || task.averageTime || 0;
    if (baseTime <= 0) return 0;
    return baseTime;
};

// ============================================================================
// Helper: Calculate bottleneck from actual balancing assignments
// ============================================================================

/**
 * Compute real bottleneck cycle time from station assignments.
 * Returns 0 if no balancing data exists.
 * The bottleneck is the slowest station (max effective cycle time).
 */
const calculateBottleneckFromAssignments = (data: ProjectData): number => {
    if (!data.assignments?.length || !data.stationConfigs?.length) return 0;

    const stationTimes = data.stationConfigs.map(config => {
        const stationTasks = data.assignments!
            .filter(a => a.stationId === config.id)
            .map(a => data.tasks.find(t => t.id === a.taskId))
            .filter(Boolean) as Task[];

        if (stationTasks.length === 0) return 0;

        const totalTime = stationTasks.reduce((sum, t) => sum + getEffectiveTaskTime(t), 0);

        // Divide by replicas (multi-manning reduces effective cycle time)
        return totalTime / (config.replicas || 1);
    });

    return stationTimes.length > 0 ? Math.max(...stationTimes) : 0;
};

// ============================================================================
// Core Calculation
// ============================================================================

/**
 * Calculate executive summary for a specific shift count.
 */
const calculateScenario = (
    data: ProjectData,
    shiftCount: number
): ShiftScenarioResult => {
    // 1. Calculate Takt Time for this shift scenario
    const oee = data.meta.useSectorOEE ? 1 : data.meta.manualOEE;
    const { nominalSeconds, effectiveSeconds, totalAvailableMinutes } = calculateTaktTime(
        data.shifts,
        Math.min(shiftCount, data.shifts.length), // Don't exceed defined shifts
        data.meta.dailyDemand,
        oee
    );

    const taktTime = nominalSeconds;
    const effectiveTaktTime = effectiveSeconds;
    const dailyDemand = data.meta.dailyDemand;

    // 2. Build machine inventory lookup
    const machineInventory = new Map<string, MachineType>();
    if (data.plantConfig?.machines) {
        for (const m of data.plantConfig.machines) {
            machineInventory.set(m.id, m);
        }
    }

    // 3. Group tasks by sector
    const sectors = data.sectors || [];
    const sectorMap = new Map<string, Task[]>();

    // Initialize with known sectors
    for (const sector of sectors) {
        sectorMap.set(sector.id, []);
    }

    // Distribute tasks
    for (const task of data.tasks) {
        const sId = task.sectorId || '__general__';
        if (!sectorMap.has(sId)) {
            sectorMap.set(sId, []);
        }
        sectorMap.get(sId)!.push(task);
    }

    // 3b. Build balancing lookup: count distinct stations per sector from assignments
    const stationsPerSector = new Map<string, Set<number>>();
    const hasAssignments = data.assignments && data.assignments.length > 0;
    if (hasAssignments) {
        for (const assignment of data.assignments) {
            const task = data.tasks.find(t => t.id === assignment.taskId);
            if (task && task.sectorId) {
                if (!stationsPerSector.has(task.sectorId)) {
                    stationsPerSector.set(task.sectorId, new Set());
                }
                stationsPerSector.get(task.sectorId)!.add(assignment.stationId);
            }
        }
    }

    // 4. Calculate per-sector metrics
    const sectorResults: SectorSummary[] = [];
    let globalTotalOps = 0;
    let globalTotalMachReq = 0;
    let globalTotalMachAvail = 0;
    let globalDeficits = 0;
    let totalWorkContent = 0;

    for (const [sectorId, tasks] of sectorMap) {
        if (tasks.length === 0) continue; // Skip empty sectors

        const sector = sectors.find(s => s.id === sectorId);
        const sectorName = sector?.name || 'General';
        const sectorColor = sector?.color || '#6b7280';

        // Use sector OEE if enabled
        let sectorTakt = taktTime;
        if (data.meta.useSectorOEE && sector?.targetOee) {
            sectorTakt = taktTime * (1 / sector.targetOee); // Sector OEE reduces effective takt
        }

        // Sum effective standard times (exclude machine-internal)
        const manualTasks = tasks.filter(t => !t.isMachineInternal);
        const totalStdTime = manualTasks.reduce((sum, t) => {
            return sum + getEffectiveTaskTime(t);
        }, 0);

        totalWorkContent += totalStdTime;

        // Operators required = ceil(totalStdTime / taktTime)
        const operatorsRequired = sectorTakt > 0
            ? Math.ceil(totalStdTime / sectorTakt)
            : 0;

        // Real balancing data: distinct stations assigned to this sector
        const balancedStations = stationsPerSector.get(sectorId);
        const operatorsBalanced = balancedStations ? balancedStations.size : 0;

        // Calculate total headcount (sum of replicas)
        let totalHeadcount = 0;
        if (balancedStations && data.stationConfigs) {
            for (const stationId of balancedStations) {
                const config = data.stationConfigs.find(s => s.id === stationId);
                totalHeadcount += (config?.replicas || 1);
            }
        }

        const sectorHasBalancing = hasAssignments && operatorsBalanced > 0;

        // Balancing efficiency: how close is the real assignment to the theoretical minimum
        const balancingEfficiency = sectorHasBalancing && operatorsBalanced > 0
            ? (operatorsRequired / operatorsBalanced) * 100
            : 0;

        globalTotalOps += operatorsRequired;

        // Saturation
        const saturation = operatorsRequired > 0 && sectorTakt > 0
            ? (totalStdTime / (operatorsRequired * sectorTakt)) * 100
            : 0;

        // Group tasks by required machine
        const machineGroups = new Map<string, Task[]>();
        for (const task of tasks) {
            if (task.requiredMachineId) {
                if (!machineGroups.has(task.requiredMachineId)) {
                    machineGroups.set(task.requiredMachineId, []);
                }
                machineGroups.get(task.requiredMachineId)!.push(task);
            }
        }

        // Calculate machine requirements
        const machines: MachineSummary[] = [];
        let sectorMachReq = 0;
        let sectorMachAvail = 0;
        let sectorHasDeficit = false;

        for (const [machineId, machineTasks] of machineGroups) {
            const machineType = machineInventory.get(machineId);
            const machineName = machineType?.name || machineId;
            const available = machineType?.availableUnits || 0;

            // Sum time for tasks using this machine
            const machineWorkTime = machineTasks.reduce((sum, t) => {
                return sum + getEffectiveTaskTime(t);
            }, 0);

            // Units required = ceil(totalWorkTime / taktTime)
            const unitsRequired = sectorTakt > 0
                ? Math.ceil(machineWorkTime / sectorTakt)
                : 0;

            const gap = unitsRequired - available;
            const satPerUnit = unitsRequired > 0 && sectorTakt > 0
                ? (machineWorkTime / (unitsRequired * sectorTakt)) * 100
                : 0;

            machines.push({
                machineId,
                machineName,
                unitsRequired,
                unitsAvailable: available,
                gap,
                saturationPerUnit: satPerUnit,
                taskIds: machineTasks.map(t => t.id),
            });

            sectorMachReq += unitsRequired;
            sectorMachAvail += available;
            if (gap > 0) {
                sectorHasDeficit = true;
                globalDeficits += gap;
            }
        }

        globalTotalMachReq += sectorMachReq;
        globalTotalMachAvail += sectorMachAvail;

        sectorResults.push({
            sectorId,
            sectorName,
            sectorColor,
            totalStandardTime: totalStdTime,
            taskCount: manualTasks.length,
            operatorsRequired,
            operatorsBalanced,
            operatorsTotal: sectorHasBalancing ? totalHeadcount : operatorsRequired,
            hasBalancingData: sectorHasBalancing,
            balancingEfficiency,
            machines,
            totalMachinesRequired: sectorMachReq,
            totalMachinesAvailable: sectorMachAvail,
            hasDeficit: sectorHasDeficit,
            saturation,
        });
    }

    // Sort sectors by sequence (matching sector definition order)
    sectorResults.sort((a, b) => {
        const idxA = sectors.findIndex(s => s.id === a.sectorId);
        const idxB = sectors.findIndex(s => s.id === b.sectorId);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    // 5. Bottleneck from real balancing
    const bottleneckCycleTime = calculateBottleneckFromAssignments(data);
    const hasBottleneck = bottleneckCycleTime > 0;

    // 6. Global KPIs — capacity is REAL OUTPUT based on bottleneck
    // If no balancing data exists, capacity = 0 (UI shows "Sin datos")
    const piecesPerHour = hasBottleneck && bottleneckCycleTime > 0
        ? 3600 / bottleneckCycleTime    // Real: how many pieces the line actually produces
        : 0;                             // No balancing → no real data
    const theoreticalCapacity = hasBottleneck && bottleneckCycleTime > 0
        ? Math.floor((totalAvailableMinutes * 60) / bottleneckCycleTime)
        : 0;

    // Total balanced operators = sum of distinct stations across all sectors
    const globalTotalOpsBalanced = sectorResults.reduce((sum, s) => sum + s.operatorsBalanced, 0);
    const globalHasBalancing = sectorResults.some(s => s.hasBalancingData);

    return {
        shiftCount,
        taktTime,
        effectiveTaktTime,
        availableMinutes: totalAvailableMinutes,
        dailyDemand,
        sectors: sectorResults,
        totalOperatorsRequired: globalTotalOps,
        totalOperatorsBalanced: globalTotalOpsBalanced,
        hasBalancingData: globalHasBalancing,
        totalMachinesRequired: globalTotalMachReq,
        totalMachinesAvailable: globalTotalMachAvail,
        totalDeficits: globalDeficits,
        theoreticalCapacity,
        piecesPerHour,
        totalWorkContent,
        bottleneckCycleTime,
        hasBottleneck,
    };
};

/**
 * Calculate the full Executive Summary across 1, 2, and 3 shift scenarios.
 * 
 * @param data - Current ProjectData
 * @returns ExecutiveSummaryResult with scenarios and warnings
 */
export const calculateExecutiveSummary = (data: ProjectData): ExecutiveSummaryResult => {
    const warnings: string[] = [];

    // Data quality checks
    if (!data.tasks || data.tasks.length === 0) {
        warnings.push('No hay tareas definidas. Defina tareas antes de generar el resumen.');
    }

    if (data.meta.dailyDemand <= 0) {
        warnings.push('La demanda diaria es 0. Configure la demanda en el Panel de Control.');
    }

    const tasksWithoutSector = data.tasks.filter(t => !t.sectorId);
    if (tasksWithoutSector.length > 0) {
        warnings.push(`${tasksWithoutSector.length} tarea(s) sin sector asignado. Asigne sectores para un análisis preciso.`);
    }

    const tasksWithoutTime = data.tasks.filter(t => (t.standardTime || t.averageTime || 0) <= 0);
    if (tasksWithoutTime.length > 0) {
        warnings.push(`${tasksWithoutTime.length} tarea(s) sin tiempo estándar. Los tiempos en 0 serán ignorados.`);
    }

    if (!data.plantConfig?.machines || data.plantConfig.machines.length === 0) {
        warnings.push('No hay máquinas configuradas en la planta. El análisis de gap no será preciso.');
    }

    // Determine max shifts we can calculate (based on defined shifts)
    const maxShifts = Math.min(3, data.shifts?.length || 1);

    // Calculate scenarios for each shift count
    const scenarios: ShiftScenarioResult[] = [];
    for (let s = 1; s <= maxShifts; s++) {
        scenarios.push(calculateScenario(data, s));
    }

    return {
        projectName: data.meta?.name || 'Sin Nombre',
        scenarios,
        warnings,
        calculatedAt: new Date().toISOString(),
    };
};

// ============================================================================
// Excel Export
// ============================================================================

/**
 * Export the executive summary scenario to an Excel file.
 * Reuses xlsx-js-style (same as utils/excel.ts).
 */
export const exportSummaryToExcel = (
    scenario: ShiftScenarioResult,
    projectName: string
): void => {
    const styles = {
        header: {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Arial' },
            fill: { fgColor: { rgb: '4338CA' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        cell: {
            font: { name: 'Arial', sz: 10 },
            alignment: { vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        cellCenter: {
            font: { name: 'Arial', sz: 10 },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        deficit: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'DC2626' } },
            fill: { fgColor: { rgb: 'FEF2F2' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        ok: {
            font: { name: 'Arial', sz: 10, color: { rgb: '16A34A' } },
            fill: { fgColor: { rgb: 'F0FDF4' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        title: {
            font: { bold: true, sz: 14, color: { rgb: '1E3A8A' } },
        },
        kpiLabel: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '334155' } },
        },
        kpiValue: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1E40AF' } },
            alignment: { horizontal: 'left' as const },
        },
        sectionHeader: {
            font: { bold: true, sz: 11, color: { rgb: '1E3A8A' } },
            fill: { fgColor: { rgb: 'EFF6FF' } },
        },
        satGreen: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '16A34A' } },
            fill: { fgColor: { rgb: 'F0FDF4' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        satAmber: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'D97706' } },
            fill: { fgColor: { rgb: 'FFFBEB' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        satRed: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'DC2626' } },
            fill: { fgColor: { rgb: 'FEF2F2' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        timestamp: {
            font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '94A3B8' } },
        },
    };

    // Helper: get saturation style based on value
    const getSatStyle = (sat: number) => {
        if (sat > 95) return styles.satRed;
        if (sat > 85) return styles.satAmber;
        return styles.satGreen;
    };

    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Resumen por Sector ---
    const rows: any[][] = [
        [{ v: `RESUMEN EJECUTIVO — ${projectName}`, s: styles.title }, '', '', '', '', '', '', ''],
        [{ v: `Generado: ${new Date().toLocaleString('es-AR')}`, s: styles.timestamp }],
        [],
        [{ v: 'CONFIGURACIÓN', s: styles.sectionHeader }, { v: '', s: styles.sectionHeader }],
        [{ v: 'Turnos activos:', s: styles.kpiLabel }, { v: scenario.shiftCount, s: styles.kpiValue }],
        [{ v: 'Demanda diaria:', s: styles.kpiLabel }, { v: `${scenario.dailyDemand} pzs`, s: styles.kpiValue }],
        [{ v: 'Takt Time:', s: styles.kpiLabel }, { v: `${scenario.taktTime.toFixed(1)} s`, s: styles.kpiValue }],
        [{ v: 'Takt Efectivo (OEE):', s: styles.kpiLabel }, { v: `${scenario.effectiveTaktTime.toFixed(1)} s`, s: styles.kpiValue }],
        [{ v: 'Piezas/Hora:', s: styles.kpiLabel }, { v: scenario.piecesPerHour.toFixed(1), s: styles.kpiValue }],
        [{ v: 'Capacidad teórica:', s: styles.kpiLabel }, { v: `${scenario.theoreticalCapacity} pzs/día`, s: styles.kpiValue }],
        [],
        [{ v: 'RECURSOS GLOBALES', s: styles.sectionHeader }, { v: '', s: styles.sectionHeader }],
        [{ v: 'Total operadores:', s: styles.kpiLabel }, { v: scenario.totalOperatorsRequired, s: styles.kpiValue }],
        [{ v: 'Máquinas requeridas:', s: styles.kpiLabel }, { v: scenario.totalMachinesRequired, s: styles.kpiValue }],
        [{ v: 'Máquinas disponibles:', s: styles.kpiLabel }, { v: scenario.totalMachinesAvailable, s: styles.kpiValue }],
        [{ v: 'Déficits:', s: styles.kpiLabel }, { v: scenario.totalDeficits, s: scenario.totalDeficits > 0 ? styles.deficit : styles.kpiValue }],
        [],
    ];

    // Sector table header
    const sectorHeader = [
        'Sector', 'Tareas', 'Contenido (s)', 'Operadores',
        'Máq. Requeridas', 'Máq. Disponibles', 'Gap', 'Saturación %',
    ];
    rows.push(sectorHeader.map(h => ({ v: h, s: styles.header })));

    // Sector rows
    for (const sec of scenario.sectors) {
        const gap = sec.totalMachinesRequired - sec.totalMachinesAvailable;
        rows.push([
            { v: sec.sectorName, s: styles.cell },
            { v: sec.taskCount, s: styles.cellCenter },
            { v: sec.totalStandardTime.toFixed(1), s: styles.cellCenter },
            { v: sec.operatorsRequired, s: styles.cellCenter },
            { v: sec.totalMachinesRequired, s: styles.cellCenter },
            { v: sec.totalMachinesAvailable, s: styles.cellCenter },
            { v: gap, s: gap > 0 ? styles.deficit : styles.ok },
            { v: `${sec.saturation.toFixed(1)}%`, s: getSatStyle(sec.saturation) },
        ]);
    }

    // Total row
    const totalGap = scenario.totalMachinesRequired - scenario.totalMachinesAvailable;
    rows.push([
        { v: 'TOTAL', s: { ...styles.header, fill: { fgColor: { rgb: '1E293B' } } } },
        { v: scenario.sectors.reduce((s, sec) => s + sec.taskCount, 0), s: styles.header },
        { v: scenario.totalWorkContent.toFixed(1), s: styles.header },
        { v: scenario.totalOperatorsRequired, s: styles.header },
        { v: scenario.totalMachinesRequired, s: styles.header },
        { v: scenario.totalMachinesAvailable, s: styles.header },
        { v: totalGap, s: { ...styles.header, font: { ...styles.header.font, color: { rgb: totalGap > 0 ? 'FCA5A5' : 'FFFFFF' } } } },
        { v: '', s: styles.header },
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 24 }, { wch: 10 }, { wch: 15 }, { wch: 13 },
        { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 14 },
    ];
    // Merge title row across all columns
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },  // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },  // Timestamp
    ];
    // Set row heights
    ws['!rows'] = rows.map((_, i) => {
        const headerRowIdx = rows.findIndex(r => r.length === 8 && r[0]?.v === 'Sector');
        if (i === 0) return { hpt: 28 }; // Title
        if (i === 1) return { hpt: 16 }; // Timestamp
        if (i === headerRowIdx) return { hpt: 22 }; // Table header
        return { hpt: 18 }; // Normal rows
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen Ejecutivo');

    // --- Sheet 2: Detalle de Máquinas ---
    const hasMachines = scenario.sectors.some(s => s.machines.length > 0);
    const machineRows: any[][] = [
        [{ v: 'DETALLE DE MÁQUINAS POR SECTOR', s: styles.title }],
        [],
    ];

    if (hasMachines) {
        const machHeader = ['Sector', 'Máquina', 'Requeridas', 'Disponibles', 'Gap', 'Saturación/Ud %'];
        machineRows.push(machHeader.map(h => ({ v: h, s: styles.header })));

        for (const sec of scenario.sectors) {
            for (const m of sec.machines) {
                machineRows.push([
                    { v: sec.sectorName, s: styles.cell },
                    { v: m.machineName, s: styles.cell },
                    { v: m.unitsRequired, s: styles.cellCenter },
                    { v: m.unitsAvailable, s: styles.cellCenter },
                    { v: m.gap, s: m.gap > 0 ? styles.deficit : styles.ok },
                    { v: `${m.saturationPerUnit.toFixed(1)}%`, s: styles.cellCenter },
                ]);
            }
        }
    } else {
        machineRows.push([{ v: 'No hay máquinas configuradas en la planta.', s: styles.kpiLabel }]);
        machineRows.push([{ v: 'Configure máquinas en Planta para ver el detalle.', s: { font: { name: 'Arial', sz: 10, color: { rgb: '94A3B8' } } } }]);
    }

    const wsMach = XLSX.utils.aoa_to_sheet(machineRows);
    wsMach['!cols'] = [
        { wch: 22 }, { wch: 28 }, { wch: 13 }, { wch: 13 }, { wch: 8 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMach, 'Detalle Máquinas');

    // Download — browser-compatible approach (XLSX.writeFile uses fs.writeFileSync which
    // Vite externalizes, producing a broken file). Use XLSX.write + Blob instead.
    const shiftLabel = scenario.shiftCount === 1 ? '1T' : scenario.shiftCount === 2 ? '2T' : '3T';
    const fileName = `${projectName}_Resumen_Ejecutivo_${shiftLabel}.xlsx`;
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay revoke to let the browser finish initiating the download
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        logger.error('ExecutiveSummary', 'Error exporting Excel', {}, err instanceof Error ? err : undefined);
    }
};

/**
 * Export the FULL executive summary (all shift scenarios) to a single Excel file.
 * Creates:
 *   - Sheet 1: Comparativa de Turnos (side-by-side)
 *   - Sheet 2+: Detalle per shift
 *   - Last sheet: Detalle de Máquinas consolidado
 */
export const exportFullSummaryToExcel = (
    summary: ExecutiveSummaryResult
): void => {
    const styles = {
        header: {
            font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Arial' },
            fill: { fgColor: { rgb: '4338CA' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        cell: {
            font: { name: 'Arial', sz: 10 },
            alignment: { vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        cellCenter: {
            font: { name: 'Arial', sz: 10 },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        title: {
            font: { bold: true, sz: 14, color: { rgb: '1E3A8A' } },
        },
        kpiLabel: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '334155' } },
        },
        kpiValue: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1E40AF' } },
            alignment: { horizontal: 'center' as const },
        },
        deficit: {
            font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'DC2626' } },
            fill: { fgColor: { rgb: 'FEF2F2' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        ok: {
            font: { name: 'Arial', sz: 10, color: { rgb: '16A34A' } },
            fill: { fgColor: { rgb: 'F0FDF4' } },
            alignment: { horizontal: 'center' as const, vertical: 'center' as const },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        },
        sectionHeader: {
            font: { bold: true, sz: 11, color: { rgb: '1E3A8A' } },
            fill: { fgColor: { rgb: 'EFF6FF' } },
        },
        timestamp: {
            font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '94A3B8' } },
        },
    };

    const wb = XLSX.utils.book_new();

    // --- Sheet 1: Comparativa de Turnos ---
    const compRows: any[][] = [
        [{ v: `COMPARATIVA DE TURNOS — ${summary.projectName}`, s: styles.title }],
        [{ v: `Generado: ${new Date().toLocaleString('es-AR')}`, s: styles.timestamp }],
        [],
    ];

    // KPI comparison table
    const kpiHeaders = ['Indicador', ...summary.scenarios.map(s => `${s.shiftCount} Turno${s.shiftCount > 1 ? 's' : ''}`)];
    compRows.push(kpiHeaders.map(h => ({ v: h, s: styles.header })));

    const kpiRows: [string, ...string[]][] = [
        ['Takt Time (s)', ...summary.scenarios.map(s => s.taktTime.toFixed(1))],
        ['Takt Efectivo (s)', ...summary.scenarios.map(s => s.effectiveTaktTime.toFixed(1))],
        ['Piezas/Hora', ...summary.scenarios.map(s => s.piecesPerHour.toFixed(1))],
        ['Capacidad Teórica (pzs/día)', ...summary.scenarios.map(s => s.theoreticalCapacity.toLocaleString())],
        ['Operadores Teóricos', ...summary.scenarios.map(s => String(s.totalOperatorsRequired))],
        ['Operadores Balanceo', ...summary.scenarios.map(s => s.hasBalancingData ? String(s.totalOperatorsBalanced) : 'N/A')],
        ['Máquinas Requeridas', ...summary.scenarios.map(s => String(s.totalMachinesRequired))],
        ['Máquinas Disponibles', ...summary.scenarios.map(s => String(s.totalMachinesAvailable))],
        ['Déficits', ...summary.scenarios.map(s => String(s.totalDeficits))],
    ];

    for (const row of kpiRows) {
        compRows.push([
            { v: row[0], s: styles.kpiLabel },
            ...row.slice(1).map(v => ({ v, s: styles.cellCenter })),
        ]);
    }

    const wsComp = XLSX.utils.aoa_to_sheet(compRows);
    wsComp['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    wsComp['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(3, summary.scenarios.length) } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(3, summary.scenarios.length) } },
    ];
    XLSX.utils.book_append_sheet(wb, wsComp, 'Comparativa Turnos');

    // --- Sheets 2-4: Detail per shift ---
    for (const scenario of summary.scenarios) {
        const sheetName = `Detalle ${scenario.shiftCount}T`;
        const rows: any[][] = [
            [{ v: `DETALLE ${scenario.shiftCount} TURNO${scenario.shiftCount > 1 ? 'S' : ''} — ${summary.projectName}`, s: styles.title }],
            [],
        ];

        // Sector header
        const sectorHeader = [
            'Sector', 'Tareas', 'Contenido (s)', 'Op. Teóricos',
            'Op. Balanceo', 'Eficiencia %', 'Máq. Req.', 'Máq. Disp.', 'Gap',
        ];
        rows.push(sectorHeader.map(h => ({ v: h, s: styles.header })));

        for (const sec of scenario.sectors) {
            const gap = sec.totalMachinesRequired - sec.totalMachinesAvailable;
            rows.push([
                { v: sec.sectorName, s: styles.cell },
                { v: sec.taskCount, s: styles.cellCenter },
                { v: sec.totalStandardTime.toFixed(1), s: styles.cellCenter },
                { v: sec.operatorsRequired, s: styles.cellCenter },
                { v: sec.hasBalancingData ? sec.operatorsBalanced : 'N/A', s: styles.cellCenter },
                { v: sec.hasBalancingData ? `${sec.balancingEfficiency.toFixed(0)}%` : 'N/A', s: styles.cellCenter },
                { v: sec.totalMachinesRequired, s: styles.cellCenter },
                { v: sec.totalMachinesAvailable, s: styles.cellCenter },
                { v: gap, s: gap > 0 ? styles.deficit : styles.ok },
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
            { wch: 14 }, { wch: 13 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // --- Last Sheet: Machine detail ---
    const machRows: any[][] = [
        [{ v: 'DETALLE DE MÁQUINAS — ESCENARIO 1 TURNO', s: styles.title }],
        [{ v: `Nota: Los requerimientos se calculan con el turno seleccionado. Las disponibilidades son fijas.`, s: styles.timestamp }],
        [],
    ];
    const scenario1 = summary.scenarios[0];
    const hasMachines = scenario1?.sectors.some(s => s.machines.length > 0);
    if (hasMachines) {
        const machHeader = ['Sector', 'Máquina', 'Requeridas', 'Disponibles', 'Gap', 'Sat/Ud %'];
        machRows.push(machHeader.map(h => ({ v: h, s: styles.header })));
        for (const sec of scenario1.sectors) {
            for (const m of sec.machines) {
                machRows.push([
                    { v: sec.sectorName, s: styles.cell },
                    { v: m.machineName, s: styles.cell },
                    { v: m.unitsRequired, s: styles.cellCenter },
                    { v: m.unitsAvailable, s: styles.cellCenter },
                    { v: m.gap, s: m.gap > 0 ? styles.deficit : styles.ok },
                    { v: `${m.saturationPerUnit.toFixed(1)}%`, s: styles.cellCenter },
                ]);
            }
        }
    } else {
        machRows.push([{ v: 'No hay máquinas configuradas.', s: styles.kpiLabel }]);
    }

    const wsMach = XLSX.utils.aoa_to_sheet(machRows);
    wsMach['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 13 }, { wch: 13 }, { wch: 8 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsMach, 'Máquinas');

    // Download
    const fileName = `${summary.projectName}_Resumen_Ejecutivo_COMPLETO.xlsx`;
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
        logger.error('ExecutiveSummary', 'Error exporting full Excel', {}, err instanceof Error ? err : undefined);
    }
};

/**
 * Export the Executive Summary to PDF via browser print dialog.
 * Generates a complete HTML report with styling and opens print dialog.
 */
export const exportSummaryToPDF = (
    summary: ExecutiveSummaryResult,
    activeScenarioIndex: number = 0
): void => {
    const scenario = summary.scenarios[activeScenarioIndex] || summary.scenarios[0];
    if (!scenario) return;

    // Build sector rows HTML
    const sectorRowsHTML = scenario.sectors.map(sec => {
        const satColor = sec.saturation > 100 ? '#dc2626' : sec.saturation > 85 ? '#ca8a04' : '#16a34a';
        const satWidth = Math.min(sec.saturation, 120);
        const gapVal = sec.totalMachinesRequired - sec.totalMachinesAvailable;
        const gapClass = gapVal > 0 ? 'deficit' : 'ok';

        return `
        <tr>
            <td>
                <span class="sector-badge" style="background: ${sec.sectorColor}20; color: ${sec.sectorColor}; border: 1px solid ${sec.sectorColor}40;">
                    ${sec.sectorName}
                </span>
            </td>
            <td class="mono right">${sec.totalStandardTime.toFixed(1)}s</td>
            <td class="center">${sec.operatorsRequired}</td>
            <td class="center">${sec.hasBalancingData ? `${sec.operatorsBalanced} <span class="eff">(${sec.balancingEfficiency.toFixed(0)}%)</span>` : '<span class="na">—</span>'}</td>
            <td class="center">${sec.totalMachinesRequired}</td>
            <td class="center">${sec.totalMachinesAvailable}</td>
            <td class="center ${gapClass}">${gapVal > 0 ? `−${gapVal}` : '✓'}</td>
            <td>
                <div class="sat-bar-container">
                    <div class="sat-bar" style="width: ${satWidth}%; background: ${satColor};"></div>
                    <span class="sat-label" style="color: ${satColor};">${sec.saturation.toFixed(0)}%</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Machine detail rows
    const hasMachines = scenario.sectors.some(s => s.machines.length > 0);
    const machineRowsHTML = hasMachines ? scenario.sectors.flatMap(sec =>
        sec.machines.map(m => {
            const gapClass = m.gap > 0 ? 'deficit' : 'ok';
            return `
            <tr>
                <td>${sec.sectorName}</td>
                <td>${m.machineName}</td>
                <td class="center">${m.unitsRequired}</td>
                <td class="center">${m.unitsAvailable}</td>
                <td class="center ${gapClass}">${m.gap > 0 ? `−${m.gap}` : '✓'}</td>
                <td class="center">${m.saturationPerUnit.toFixed(1)}%</td>
            </tr>`;
        })
    ).join('') : '';

    // Shift comparison rows
    const comparisonHTML = summary.scenarios.map(s => `
        <tr>
            <td class="center bold">${s.shiftCount}T</td>
            <td class="center mono">${s.taktTime.toFixed(1)}s</td>
            <td class="center mono">${s.effectiveTaktTime.toFixed(1)}s</td>
            <td class="center">${s.piecesPerHour.toFixed(0)}</td>
            <td class="center">${s.totalOperatorsRequired}</td>
            <td class="center">${s.hasBalancingData ? s.totalOperatorsBalanced : '—'}</td>
            <td class="center">${s.totalMachinesRequired}</td>
            <td class="center ${s.totalDeficits > 0 ? 'deficit' : 'ok'}">${s.totalDeficits > 0 ? `${s.totalDeficits} gaps` : '✓ OK'}</td>
        </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resumen Ejecutivo — ${summary.projectName}</title>
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1e293b; line-height: 1.4; }
        .page { max-width: 297mm; margin: 0 auto; }

        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4338ca; padding-bottom: 8px; margin-bottom: 12px; }
        .header h1 { font-size: 16pt; font-weight: 800; color: #1e293b; }
        .header .subtitle { font-size: 9pt; color: #64748b; margin-top: 2px; }
        .header .meta { text-align: right; font-size: 8pt; color: #94a3b8; }

        .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
        .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; }
        .kpi-box .label { font-size: 7pt; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
        .kpi-box .value { font-size: 16pt; font-weight: 700; color: #1e3a8a; margin-top: 2px; }
        .kpi-box .sub { font-size: 7pt; color: #94a3b8; margin-top: 1px; }
        .kpi-box.highlight { background: #ecfdf5; border-color: #a7f3d0; }
        .kpi-box.highlight .value { color: #059669; }
        .kpi-box.warning { background: #fef3c7; border-color: #fcd34d; }
        .kpi-box.warning .value { color: #d97706; }
        .kpi-box.danger { background: #fef2f2; border-color: #fca5a5; }
        .kpi-box.danger .value { color: #dc2626; }

        h2 { font-size: 11pt; font-weight: 700; color: #334155; margin: 12px 0 6px; border-left: 4px solid #4338ca; padding-left: 8px; }

        table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 12px; }
        th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; }
        td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
        .center { text-align: center; }
        .right { text-align: right; }
        .mono { font-family: 'Cascadia Code', 'Consolas', monospace; }
        .bold { font-weight: 700; }
        .deficit { color: #dc2626; font-weight: 700; background: #fef2f2; }
        .ok { color: #16a34a; font-weight: 600; }
        .na { color: #cbd5e1; }
        .eff { font-size: 7pt; color: #6366f1; }

        .sector-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: 600; font-size: 8pt; }

        .sat-bar-container { display: flex; align-items: center; gap: 6px; min-width: 100px; }
        .sat-bar { height: 8px; border-radius: 4px; min-width: 2px; }
        .sat-label { font-size: 8pt; font-weight: 700; white-space: nowrap; }

        tfoot td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1; }

        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 7pt; color: #94a3b8; }

        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div>
                <h1>📊 Resumen Ejecutivo</h1>
                <div class="subtitle">${summary.projectName} — Escenario ${scenario.shiftCount} Turno${scenario.shiftCount > 1 ? 's' : ''}</div>
            </div>
            <div class="meta">
                <div>Generado: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                <div>Demanda: ${scenario.dailyDemand.toLocaleString()} pzs/día</div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="kpi-box">
                <div class="label">Takt Time</div>
                <div class="value">${scenario.taktTime.toFixed(1)}s</div>
                <div class="sub">Efectivo: ${scenario.effectiveTaktTime.toFixed(1)}s</div>
            </div>
            <div class="kpi-box highlight">
                <div class="label">Piezas/Hora</div>
                <div class="value">${scenario.piecesPerHour.toFixed(0)}</div>
                <div class="sub">Cap. ${scenario.theoreticalCapacity.toLocaleString()} pzs/día</div>
            </div>
            <div class="kpi-box">
                <div class="label">Op. Teóricos</div>
                <div class="value">${scenario.totalOperatorsRequired}</div>
                <div class="sub">${scenario.sectors.length} sectores</div>
            </div>
            ${scenario.hasBalancingData ? `
            <div class="kpi-box">
                <div class="label">Op. Balanceo</div>
                <div class="value">${scenario.totalOperatorsBalanced}</div>
                <div class="sub">Ef. ${scenario.totalOperatorsBalanced > 0 ? ((scenario.totalOperatorsRequired / scenario.totalOperatorsBalanced) * 100).toFixed(0) : 0}%</div>
            </div>` : `
            <div class="kpi-box">
                <div class="label">Op. Balanceo</div>
                <div class="value">—</div>
                <div class="sub">Sin balanceo</div>
            </div>`}
            <div class="kpi-box ${scenario.totalDeficits > 0 ? 'danger' : 'highlight'}">
                <div class="label">Máquinas</div>
                <div class="value">${scenario.totalMachinesRequired}</div>
                <div class="sub">${scenario.totalDeficits > 0 ? `⚠ ${scenario.totalDeficits} déficits` : `✓ Disp: ${scenario.totalMachinesAvailable}`}</div>
            </div>
        </div>

        <h2>Análisis por Sector</h2>
        <table>
            <thead>
                <tr>
                    <th>Sector</th>
                    <th class="right">Contenido</th>
                    <th class="center">Op. Teóricos</th>
                    <th class="center">Op. Balanceo</th>
                    <th class="center">Máq. Req.</th>
                    <th class="center">Máq. Disp.</th>
                    <th class="center">Gap</th>
                    <th>Saturación</th>
                </tr>
            </thead>
            <tbody>${sectorRowsHTML}</tbody>
            <tfoot>
                <tr>
                    <td>TOTAL</td>
                    <td class="right mono">${scenario.totalWorkContent.toFixed(1)}s</td>
                    <td class="center">${scenario.totalOperatorsRequired}</td>
                    <td class="center">${scenario.hasBalancingData ? scenario.totalOperatorsBalanced : '—'}</td>
                    <td class="center">${scenario.totalMachinesRequired}</td>
                    <td class="center">${scenario.totalMachinesAvailable}</td>
                    <td class="center ${scenario.totalDeficits > 0 ? 'deficit' : 'ok'}">${scenario.totalDeficits > 0 ? `−${scenario.totalDeficits}` : '✓'}</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>

        <div class="two-col">
            <div>
                <h2>Comparativa de Turnos</h2>
                <table>
                    <thead>
                        <tr>
                            <th class="center">Turno</th>
                            <th class="center">Takt</th>
                            <th class="center">Takt Ef.</th>
                            <th class="center">Pzs/h</th>
                            <th class="center">Op. Teór.</th>
                            <th class="center">Op. Bal.</th>
                            <th class="center">Máq.</th>
                            <th class="center">Estado</th>
                        </tr>
                    </thead>
                    <tbody>${comparisonHTML}</tbody>
                </table>
            </div>

            ${hasMachines ? `
            <div>
                <h2>Detalle de Máquinas</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Sector</th>
                            <th>Máquina</th>
                            <th class="center">Req.</th>
                            <th class="center">Disp.</th>
                            <th class="center">Gap</th>
                            <th class="center">Sat/Ud</th>
                        </tr>
                    </thead>
                    <tbody>${machineRowsHTML}</tbody>
                </table>
            </div>` : ''}
        </div>

        <div class="footer">
            <div>Generado por Barack Mercosul — ${new Date().toLocaleDateString('es-AR')}</div>
            <div>Resumen Ejecutivo v2.0</div>
        </div>
    </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 300);
        };
    }
};
