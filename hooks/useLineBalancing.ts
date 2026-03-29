import { useState, useMemo, useCallback } from 'react';
import { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { ProjectData, Task, StationConfig } from '../types';
import { toast } from '../components/ui/Toast';
import { logger } from '../utils/logger';
import {
    calculateTaktTime,
    calculateStationOEE,
    parseNumberInput,
    calculateEffectiveStationTime,
    calculateTotalHeadcount,
    calculateTotalManualWork,
    calculateLineSaturation,
    calculateAvailableTimeVsTakt,
    calculateSaturationVsTakt,
    calculateSectorTaktTime
} from '../utils';
import { detectCycles, calculateTaskWeights } from '../utils/graph';
import {
    SimulationResult
} from '../core/balancing/engine';
import { runGeneticAlgorithm } from '../core/balancing/geneticAlgorithm';
import { validateMachineResources, MachineValidationResult } from '../core/balancing/machineValidation';
import { usePlantAssets } from './usePlantAssets'; // V4.0: Use Global Assets for Validation


interface ConcurrencyWarning {
    type: 'moving_manual' | 'moving_machine';
    taskDesc: string;
    linkedTaskDesc: string;
    timePenalty: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export const useLineBalancing = (data: ProjectData, updateData: (data: ProjectData) => void) => {
    // --- STATE ---
    const [draggedTask, setDraggedTask] = useState<string | null>(null);
    const [dragOverStation, setDragOverStation] = useState<number | null>(null);
    const [configStationId, setConfigStationId] = useState<number | null>(null);
    const [stationOeeInput, setStationOeeInput] = useState("0.85");

    // Optimization Modal State
    const [optimizationResults, setOptimizationResults] = useState<SimulationResult[] | null>(null);
    const [showPriorityTable, setShowPriorityTable] = useState(false);

    // Concurrency Warning State
    const [warningState, setWarningState] = useState<ConcurrencyWarning | null>(null);

    // Sector Collapsing State for Board
    const [collapsedBoardSectors, setCollapsedBoardSectors] = useState<Set<string>>(new Set());

    // BUG-01 FIX: Clear Balance Confirmation Modal State (replaces native confirm())
    const [showClearBalanceConfirm, setShowClearBalanceConfirm] = useState(false);

    // Phase 27: Multi-Pass Optimization Progress State
    const [, setOptimizationProgress] = useState<{
        current: number;
        total: number;
        isOptimizing: boolean;
    } | null>(null);

    // Phase 29: Genetic Algorithm Progress State
    const [gaProgress, setGAProgress] = useState<{
        generation: number;
        totalGenerations: number;
        bestFitness: number;
        phase: 'initializing' | 'evolving' | 'complete';
    } | null>(null);

    // V4.2 FIX: Use Global Plant Assets for Validation (Real-time Availability)
    const { machines: globalMachines } = usePlantAssets();
    const machinesList = globalMachines || [];

    const sectorsList = data.sectors || [];

    // --- CALCULATIONS ---
    const { nominalSeconds, effectiveSeconds } = useMemo(() => calculateTaktTime(
        data.shifts,
        data.meta.activeShifts,
        data.meta.dailyDemand,
        data.meta.useSectorOEE ? 1 : data.meta.manualOEE,
        data.meta.setupLossPercent || 0
    ), [
        data.shifts,
        data.meta.activeShifts,
        data.meta.dailyDemand,
        data.meta.useSectorOEE,
        data.meta.manualOEE,
        data.meta.setupLossPercent
    ]);

    const validAssignedIds = data.assignments.map(a => a.stationId).filter(Number.isFinite);
    const maxAssigned = validAssignedIds.length > 0 ? Math.max(...validAssignedIds) : 1;
    const rawConfigured = data.meta.configuredStations;
    const configuredStations = Math.max(maxAssigned, Number.isFinite(rawConfigured) && rawConfigured > 0 ? rawConfigured : 1);

    const taskMap = useMemo(() => new Map(data.tasks.map(t => [t.id, t])), [data.tasks]);

    // Station Data Calculation
    const stationData = useMemo(() => {
        const stations: Record<number, {
            id: number;
            time: number;
            rawEffectiveTime: number;
            absorbedTime: number;
            tasks: string[];
            limit: number;
            oee: number;
            replicas: number;
            sectorId?: string;
        }> = {};

        // Initialize Stations
        const configMap = new Map(data.stationConfigs?.map(c => [c.id, c]) ?? []);
        for (let i = 1; i <= configuredStations; i++) {
            const config = configMap.get(i);
            const oee = calculateStationOEE(data, i);
            const replicas = config?.replicas && config.replicas > 0 ? config.replicas : 1;

            stations[i] = {
                id: i,
                time: 0,
                rawEffectiveTime: 0,
                absorbedTime: 0,
                tasks: [],
                limit: nominalSeconds * oee,
                oee,
                replicas
            };
        }

        // [R-03] ORPHAN DETECTION: Integity Check
        const missingTaskIds: string[] = [];

        // First Pass: Distribute Tasks
        data.assignments.forEach(a => {
            const exists = taskMap.has(a.taskId);
            if (!exists) {
                missingTaskIds.push(a.taskId);
                return; // Skip assignment
            }

            if (!stations[a.stationId]) {
                const oee = calculateStationOEE(data, a.stationId);
                const config = configMap.get(a.stationId);
                const replicas = config?.replicas && config.replicas > 0 ? config.replicas : 1;

                stations[a.stationId] = {
                    id: a.stationId,
                    time: 0,
                    rawEffectiveTime: 0,
                    absorbedTime: 0,
                    tasks: [],
                    limit: nominalSeconds * oee,
                    oee,
                    replicas
                };
            }
            stations[a.stationId].tasks.push(a.taskId);
        });

        // [R-03] Alert if corruption detected
        if (missingTaskIds.length > 0) {
            logger.error('useLineBalancing', `Data Integrity Error: Found ${missingTaskIds.length} orphan assignments`, { missingTaskIds });
        }

        // Second Pass: Calculate Metrics with NET TIME Logic (Internal=0)
        Object.values(stations).forEach(st => {
            const tasksInStation = st.tasks.map(tid => taskMap.get(tid)).filter(Boolean) as Task[];

            // Calculate Raw Sum (Gross) for "Absorbed" calculation
            let rawSum = 0;
            tasksInStation.forEach(t => rawSum += (t.standardTime || t.averageTime || 0));

            // UNIFIED FIX: Use calculateEffectiveStationTime for TCR
            // This ensures Balanceo and ReportCenter use the same algorithm
            const effectiveStationTime = calculateEffectiveStationTime(tasksInStation);

            st.rawEffectiveTime = effectiveStationTime;

            // TCR = Effective Time / Replicas (multi-manning divides manual work)
            st.time = effectiveStationTime / st.replicas;

            st.absorbedTime = Math.max(0, rawSum - effectiveStationTime);

            if (tasksInStation.length > 0) {
                st.sectorId = tasksInStation[0].sectorId;
                if (data.meta.useSectorOEE) {
                    // FIX: Pass sectorId to get correct target
                    st.oee = calculateStationOEE(data, st.id, st.sectorId);
                    st.limit = nominalSeconds * st.oee;
                }

                // Per-sector shift override: recalculate limit using sector's own Takt
                const sector = st.sectorId ? (data.sectors || []).find(s => s.id === st.sectorId) : undefined;
                if (sector?.shiftOverride && data.meta.dailyDemand > 0) {
                    const sectorTakt = calculateSectorTaktTime(
                        sector, data.shifts, data.meta.activeShifts,
                        data.meta.dailyDemand, st.oee, data.meta.setupLossPercent || 0
                    );
                    st.limit = sectorTakt.effectiveSeconds;
                }
            }
        });

        return Object.values(stations).sort((a, b) => a.id - b.id);
    }, [data.assignments, taskMap, configuredStations, data.meta.manualOEE, data.meta.useManualOEE, data.meta.useSectorOEE, data.meta.setupLossPercent, data.stationConfigs, nominalSeconds, data.sectors]);

    // Per-sector Takt map for chart/tooltip consumption
    const sectorTaktMap: Record<string, number> = useMemo(() => {
        const map: Record<string, number> = {};
        (data.sectors || []).forEach(s => {
            if (s.shiftOverride && data.meta.dailyDemand > 0) {
                const oee = data.meta.useSectorOEE
                    ? (s.targetOee ?? data.meta.manualOEE)
                    : data.meta.manualOEE;
                const takt = calculateSectorTaktTime(
                    s, data.shifts, data.meta.activeShifts,
                    data.meta.dailyDemand, oee, data.meta.setupLossPercent || 0
                );
                map[s.id] = takt.nominalSeconds;
            }
        });
        return map;
    }, [data.sectors, data.shifts, data.meta.activeShifts, data.meta.dailyDemand, data.meta.manualOEE, data.meta.useSectorOEE, data.meta.setupLossPercent]);

    // Chart Data — sorted by sector to group bars visually
    const saturationData = useMemo(() => {
        const mapped = stationData.map(st => {
            const withinLimit = Math.min(st.time, st.limit);
            const overload = Math.max(0, st.time - st.limit);
            // Idle = remaining capacity within the station's limit.
            // If overloaded (time > limit), there is NO idle capacity — show 0.
            // The reference lines (OEE green, Takt red) provide visual context above the bars.
            const idle = overload > 0 ? 0 : Math.max(0, st.limit - st.time);

            const sector = (data.sectors || []).find(s => s.id === st.sectorId);
            const barColor = sector ? sector.color : "#3b82f6";

            // Phase 3: Extract curing data for injection stations
            const tasksInStation = st.tasks.map(tid => taskMap.get(tid)).filter(Boolean) as Task[];
            const injectionTask = tasksInStation.find(t => t.executionMode === 'injection' && t.injectionParams);

            let curingTime = 0;
            let injectionTime = 0;
            let curingOperations: { name: string; type: 'internal' | 'external'; time: number }[] = [];

            if (injectionTask?.injectionParams) {
                curingTime = injectionTask.injectionParams.pCuringTime || 0;
                injectionTime = injectionTask.injectionParams.pInyectionTime || 0;
                curingOperations = (injectionTask.injectionParams.manualOperations || []).map(op => ({
                    name: op.description || 'Operación',
                    type: op.type || 'internal',
                    time: op.time || 0
                }));
            }

            return {
                name: `Est. ${st.id}`,
                stationId: st.id,
                withinLimit,
                overload,
                absorbed: st.absorbedTime,
                idle,
                totalTime: st.time,
                limit: st.limit,
                nominal: nominalSeconds,
                replicas: st.replicas,
                rawEffective: st.rawEffectiveTime,
                barColor,
                sectorName: sector?.name || "General",
                sectorId: st.sectorId || '',
                // Phase 3: Curing visualization data
                curingTime,
                injectionTime,
                curingOperations,
                // Per-sector shift override Takt (for tooltip)
                sectorTakt: st.sectorId && sectorTaktMap[st.sectorId] ? sectorTaktMap[st.sectorId] : undefined
            };
        });
        // Group bars by sector, then by station ID within each sector
        return mapped.sort((a, b) => {
            if (a.sectorName !== b.sectorName) return a.sectorName.localeCompare(b.sectorName);
            return a.stationId - b.stationId;
        });
    }, [stationData, data.sectors, taskMap, nominalSeconds, sectorTaktMap]);

    const unassignedTasks = useMemo(() => {
        const assignedIds = new Set(data.assignments.map(a => a.taskId));
        return data.tasks.filter(t => !assignedIds.has(t.id));
    }, [data.tasks, data.assignments]);

    const {
        yAxisDomainMax,
        realCycleTime,
        machineCycleTime,
        totalManualWork,
        totalHeadcount,
        efficiencyLine,
        saturationVsTakt,
        efficiency,
        totalIdleTimePerCycle,
        dailyLostHours
    } = useMemo(() => {
        // Chart Scaling (guard against empty arrays producing -Infinity)
        const timeValues = saturationData.length > 0
            ? [...saturationData.map(d => d.totalTime + (d.absorbed / d.replicas)), ...saturationData.map(d => d.limit)]
                .filter(Number.isFinite)
            : [];
        const chartMaxVal = Math.max(nominalSeconds || 0, ...timeValues, 0);
        const _yAxisDomainMax = Math.max(10, Math.ceil(Math.max(chartMaxVal, nominalSeconds) * 1.15));

        // Metrics
        const _totalHeadcount = calculateTotalHeadcount(data);

        // EXPERT FIX v2: Saturación = Trabajo MANUAL / Ciclo Real
        const validStationTimes = stationData.map(s => s.time).filter(Number.isFinite);
        const _realCycleTime = validStationTimes.length > 0 ? Math.max(...validStationTimes) : 0;

        // Calcular Ciclo Máquina (para Doble TCR visual)
        const _machineCycleTime = data.tasks.reduce((max, t) => {
            if (t.executionMode === 'injection' || t.executionMode === 'machine') {
                return Math.max(max, t.standardTime || 0);
            }
            return max;
        }, 0);

        // PROTECTED FORMULA: Manual Work Only
        const _totalManualWork = calculateTotalManualWork(data.tasks);

        // PROTECTED FORMULA: Saturation (Manual / HC * Cycle)
        const _efficiencyLine = calculateLineSaturation(_totalManualWork, _totalHeadcount, _realCycleTime);

        // Utilización vs Takt: Manual / (HC * Takt)
        const _saturationVsTakt = calculateSaturationVsTakt(_totalManualWork, _totalHeadcount, nominalSeconds);

        // 1. Cumplimiento de Demanda (Service Level)
        let _efficiency: number;
        if (_realCycleTime <= 0) {
            _efficiency = 100;
        } else if (_realCycleTime <= nominalSeconds) {
            _efficiency = 100;
        } else {
            _efficiency = (nominalSeconds / _realCycleTime) * 100;
        }

        // PROTECTED FORMULA: Available Time = Takt - Real Cycle
        const _totalIdleTimePerCycle = calculateAvailableTimeVsTakt(nominalSeconds, _realCycleTime);

        // Pérdida diaria (solo cuando hay margen positivo, no déficit)
        const _dailyLostHours = _totalIdleTimePerCycle > 0
            ? (_totalIdleTimePerCycle * data.meta.dailyDemand) / 3600
            : 0;

        return {
            yAxisDomainMax: _yAxisDomainMax,
            realCycleTime: _realCycleTime,
            machineCycleTime: _machineCycleTime,
            totalManualWork: _totalManualWork,
            totalHeadcount: _totalHeadcount,
            efficiencyLine: _efficiencyLine,
            saturationVsTakt: _saturationVsTakt,
            efficiency: _efficiency,
            totalIdleTimePerCycle: _totalIdleTimePerCycle,
            dailyLostHours: _dailyLostHours
        };
    }, [saturationData, stationData, data.tasks, data.meta, nominalSeconds]);

    // V4.2 RC-ALBP: Machine Resource Validation
    const machineValidation: MachineValidationResult = useMemo(() =>
        validateMachineResources(data.assignments, data.tasks, machinesList),
        [data.assignments, data.tasks, machinesList]
    );

    // --- DRAG PREVIEW ---
    const dragPreview = useMemo(() => {
        if (!draggedTask || dragOverStation === null) return null;
        const station = stationData.find(s => s.id === dragOverStation);
        const task = data.tasks.find(t => t.id === draggedTask);
        if (!station || !task) return null;

        const taskTime = task.standardTime || task.averageTime || 0;
        // Don't add time for machine-internal tasks (absorbed)
        const addedTime = task.isMachineInternal ? 0 : taskTime / station.replicas;
        const previewTime = station.time + addedTime;
        const previewSaturation = station.limit > 0 ? (previewTime / station.limit) * 100 : 0;
        const wouldOverload = previewTime > station.limit;

        return {
            stationId: dragOverStation,
            previewTime,
            previewSaturation,
            delta: addedTime,
            wouldOverload,
        };
    }, [draggedTask, dragOverStation, stationData, data.tasks]);

    // --- ACTIONS ---

    const openStationConfig = useCallback((id: number, currentOee: number) => {
        setStationOeeInput(currentOee.toString());
        setConfigStationId(id);
    }, []);

    const updateStationReplicas = useCallback((stationId: number, delta: number) => {
        const config = data.stationConfigs?.find(c => c.id === stationId);
        const currentReplicas = config?.replicas || 1;
        const newReplicas = Math.max(1, currentReplicas + delta);

        const newConfigs = data.stationConfigs ? [...data.stationConfigs] : [];
        const idx = newConfigs.findIndex(c => c.id === stationId);

        if (idx >= 0) {
            newConfigs[idx] = { ...newConfigs[idx], replicas: newReplicas };
        } else {
            newConfigs.push({ id: stationId, oeeTarget: calculateStationOEE(data, stationId), replicas: newReplicas });
        }

        updateData({ ...data, stationConfigs: newConfigs });
    }, [data, updateData]);

    const saveStationConfig = () => {
        if (configStationId !== null) {
            const valOee = parseNumberInput(stationOeeInput);
            const finalOee = (valOee > 1 && valOee <= 100) ? valOee / 100 : valOee;

            const newConfigs = data.stationConfigs ? [...data.stationConfigs] : [];
            const idx = newConfigs.findIndex(c => c.id === configStationId);
            if (idx >= 0) {
                newConfigs[idx] = { ...newConfigs[idx], oeeTarget: finalOee };
            } else {
                newConfigs.push({ id: configStationId, oeeTarget: finalOee, replicas: 1 });
            }

            updateData({ ...data, stationConfigs: newConfigs });
            setConfigStationId(null);
        }
    };

    const addStation = useCallback(() => {
        updateData({ ...data, meta: { ...data.meta, configuredStations: configuredStations + 1 } });
    }, [data, updateData, configuredStations]);

    // Find empty stations (highest-numbered first) for removal
    const emptyStationIds = useMemo(() => {
        const empty: number[] = [];
        for (let i = configuredStations; i >= 1; i--) {
            const hasTasks = data.assignments.some(a => a.stationId === i);
            if (!hasTasks) empty.push(i);
        }
        return empty;
    }, [configuredStations, data.assignments]);

    const removeEmptyStation = useCallback(() => {
        if (emptyStationIds.length === 0) {
            toast.warning('Sin Estaciones Vacías', 'Todas las estaciones tienen tareas asignadas. Mové las tareas primero.');
            return;
        }

        // Remove the highest-numbered empty station
        const stationToRemove = emptyStationIds[0];

        // Renumber all stations above the removed one
        const newAssignments = data.assignments.map(a => ({
            ...a,
            stationId: a.stationId > stationToRemove ? a.stationId - 1 : a.stationId
        }));

        // Renumber station configs (remove the deleted one, shift higher IDs down)
        const newConfigs = (data.stationConfigs || [])
            .filter(c => c.id !== stationToRemove)
            .map(c => ({
                ...c,
                id: c.id > stationToRemove ? c.id - 1 : c.id
            }));

        updateData({
            ...data,
            assignments: newAssignments,
            stationConfigs: newConfigs,
            meta: { ...data.meta, configuredStations: configuredStations - 1 }
        });

        toast.success('Estación Eliminada', `Estación ${stationToRemove} eliminada y renumerada.`);
    }, [data, updateData, configuredStations, emptyStationIds]);

    // Keep setStationCount for the + button on the board view
    const setStationCount = (count: number) => {
        if (count > configuredStations) {
            addStation();
        }
        // For decrement, use removeEmptyStation() instead
    };


    const performAssignment = (taskId: string, stationId: number) => {
        const newAssignments = data.assignments.filter(a => a.taskId !== taskId);
        newAssignments.push({ taskId, stationId });
        updateData({ ...data, assignments: newAssignments });
    };

    /** Assign multiple tasks at once (avoids stale state from forEach + setState) */
    const performBulkAssignment = (taskIds: string[], stationId: number) => {
        const taskIdSet = new Set(taskIds);
        const newAssignments = data.assignments.filter(a => !taskIdSet.has(a.taskId));
        taskIds.forEach(id => newAssignments.push({ taskId: id, stationId }));
        updateData({ ...data, assignments: newAssignments });
    };

    const unassignTask = useCallback((taskId: string) => {
        const newAssignments = data.assignments.filter(a => a.taskId !== taskId);
        updateData({ ...data, assignments: newAssignments });
    }, [data, updateData]);

    // BUG-01 FIX: Replaced native confirm() with modal-based confirmation
    const clearBalance = () => {
        setShowClearBalanceConfirm(true);
    };

    const confirmClearBalance = () => {
        updateData({ ...data, assignments: [], stationConfigs: [], meta: { ...data.meta, configuredStations: 0 } });
        setShowClearBalanceConfirm(false);
        toast.success('Balance Limpiado', 'Todas las tareas fueron removidas de las estaciones');
    };

    const cancelClearBalance = () => {
        setShowClearBalanceConfirm(false);
    };

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setDraggedTask(event.active.id as string);
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        if (!over) {
            setDragOverStation(null);
            return;
        }
        const overId = over.id.toString();
        if (overId.startsWith('station-')) {
            setDragOverStation(Number(overId.replace('station-', '')));
        } else {
            setDragOverStation(null);
        }
    }, []);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedTask(null);
        setDragOverStation(null);

        if (!over) return;

        const taskId = active.id as string;
        // Station IDs are prefixed with "station-" to prevent ID collisions with tasks
        const targetStationId = Number(over.id.toString().replace('station-', ''));

        if (isNaN(targetStationId)) return;

        const movingTask = data.tasks.find(t => t.id === taskId);

        // RC1 FIX: Machine Type Conflict Detection
        // Check if moving task requires a specific machine type
        if (movingTask?.requiredMachineId) {
            // Get tasks already assigned to target station
            const stationTasks = data.assignments
                .filter(a => a.stationId === targetStationId)
                .map(a => data.tasks.find(t => t.id === a.taskId))
                .filter(Boolean) as Task[];

            // Check if station already has a different machine type
            const stationMachineType = stationTasks.find(t => t.requiredMachineId)?.requiredMachineId;

            if (stationMachineType && stationMachineType !== movingTask.requiredMachineId) {
                // Machine type conflict! Show toast and reject assignment
                const movingMachineName = machinesList.find(m => m.id === movingTask.requiredMachineId)?.name || movingTask.requiredMachineId;
                const stationMachineName = machinesList.find(m => m.id === stationMachineType)?.name || stationMachineType;

                toast.error(
                    'Conflicto de Máquina',
                    `No se puede asignar "${movingTask.id}": Requiere ${movingMachineName}, pero la Estación ${targetStationId} ya tiene ${stationMachineName}.`
                );
                return; // REJECT assignment
            }
        }

        // Warning Logic Case 1

        // FIX: Sector Constraint Validation
        // Matches engine.ts L871 logic - tasks from different sectors cannot share a station
        if (!data.meta.disableSectorAffinity && movingTask?.sectorId) {
            const stationTasks = data.assignments
                .filter(a => a.stationId === targetStationId && a.taskId !== taskId)
                .map(a => data.tasks.find(t => t.id === a.taskId))
                .filter(Boolean) as Task[];

            const stationSector = stationTasks.find(t => t.sectorId)?.sectorId;

            if (stationSector && stationSector !== movingTask.sectorId) {
                const taskSectorName = data.sectors?.find(s => s.id === movingTask.sectorId)?.name || movingTask.sectorId;
                const stationSectorName = data.sectors?.find(s => s.id === stationSector)?.name || stationSector;

                toast.error(
                    'Restricción de Sector',
                    `No se puede asignar tarea de "${taskSectorName}" a una estación de "${stationSectorName}".`
                );
                return; // REJECT assignment
            }
        }

        // Zoning Constraint Validation (must_include / must_exclude)
        const zoningConstraints = data.zoningConstraints || [];
        if (zoningConstraints.length > 0) {
            const stationTaskIds = new Set(
                data.assignments
                    .filter(a => a.stationId === targetStationId && a.taskId !== taskId)
                    .map(a => a.taskId)
            );

            for (const constraint of zoningConstraints) {
                const isInvolved = constraint.taskA === taskId || constraint.taskB === taskId;
                if (!isInvolved) continue;

                const partnerId = constraint.taskA === taskId ? constraint.taskB : constraint.taskA;
                const partnerInTarget = stationTaskIds.has(partnerId);

                if (constraint.type === 'must_exclude' && partnerInTarget) {
                    toast.error(
                        'Restricción de Zona',
                        `"${taskId}" y "${partnerId}" no pueden estar en la misma estación.${constraint.reason ? ` Razón: ${constraint.reason}` : ''}`
                    );
                    return;
                }

                if (constraint.type === 'must_include') {
                    const partnerAssignment = data.assignments.find(a => a.taskId === partnerId);
                    if (partnerAssignment && partnerAssignment.stationId !== targetStationId) {
                        toast.warning(
                            'Restricción de Zona',
                            `"${taskId}" y "${partnerId}" deben estar juntas. "${partnerId}" está en Est. ${partnerAssignment.stationId}.`
                        );
                    }
                }
            }
        }

        if (movingTask?.concurrentWith) {
            const machineId = movingTask.concurrentWith;
            const machineAssignment = data.assignments.find(a => a.taskId === machineId);
            if (machineAssignment && machineAssignment.stationId !== targetStationId) {
                const machineTask = data.tasks.find(t => t.id === machineId);
                const penalty = movingTask.standardTime || movingTask.averageTime || 0;

                setWarningState({
                    type: 'moving_manual',
                    taskDesc: `${movingTask.id} (Máquina)`,
                    linkedTaskDesc: `${machineTask?.id} (Máquina)`,
                    timePenalty: penalty,
                    onConfirm: () => {
                        performAssignment(taskId, targetStationId);
                        setWarningState(null);
                    },
                    onCancel: () => setWarningState(null)
                });
                return;
            }
        }

        // Warning Logic Case 2
        if (movingTask?.executionMode === 'machine') {
            const children = data.tasks.filter(t => t.concurrentWith === movingTask.id);
            const childrenAssignments = data.assignments.filter(a => children.some(c => c.id === a.taskId));
            const oldAssignment = data.assignments.find(a => a.taskId === taskId);
            const oldStationId = oldAssignment?.stationId;
            const childrenLeftBehind = childrenAssignments.filter(a => a.stationId === oldStationId);

            if (childrenLeftBehind.length > 0 && oldStationId !== targetStationId) {
                const penalty = children.filter(c => childrenLeftBehind.some(a => a.taskId === c.id))
                    .reduce((sum, t) => sum + (t.standardTime || t.averageTime || 0), 0);

                setWarningState({
                    type: 'moving_machine',
                    taskDesc: `${movingTask.id} (Máquina)`,
                    linkedTaskDesc: `${childrenLeftBehind.length} tareas manuales`,
                    timePenalty: penalty,
                    onConfirm: () => {
                        performAssignment(taskId, targetStationId);
                        setWarningState(null);
                    },
                    onCancel: () => setWarningState(null)
                });
                return;
            }
        }

        // Precedence Constraint Validation (warn, don't reject — user may have reasons)
        if (movingTask?.predecessors && movingTask.predecessors.length > 0) {
            for (const predId of movingTask.predecessors) {
                const predAssign = data.assignments.find(a => a.taskId === predId);
                if (predAssign && predAssign.stationId > targetStationId) {
                    toast.warning(
                        'Precedencia Invertida',
                        `"${taskId}" tiene predecesora "${predId}" en Est. ${predAssign.stationId} (posterior). Esto puede violar restricciones de precedencia.`
                    );
                    break;
                }
            }
        }
        if (movingTask?.successors && movingTask.successors.length > 0) {
            for (const succId of movingTask.successors) {
                const succAssign = data.assignments.find(a => a.taskId === succId);
                if (succAssign && succAssign.stationId < targetStationId) {
                    toast.warning(
                        'Precedencia Invertida',
                        `"${taskId}" tiene sucesora "${succId}" en Est. ${succAssign.stationId} (anterior). Esto puede violar restricciones de precedencia.`
                    );
                    break;
                }
            }
        }

        // RC1 FIX: Also add time overflow warning toast (optional)
        // FIX: Use same logic as dragPreview — account for replicas and machine-internal tasks
        const targetStation = stationData.find(s => s.id === targetStationId);
        const currentStationTime = targetStation?.time || 0;
        const taskTime = movingTask?.standardTime || movingTask?.averageTime || 0;
        const addedTime = movingTask?.isMachineInternal ? 0 : taskTime / (targetStation?.replicas || 1);
        const newStationTime = currentStationTime + addedTime;

        if (newStationTime > nominalSeconds * 1.1) {
            // More than 10% over Takt - show warning but allow
            toast.warning(
                'Estación Sobrecargada',
                `La Estación ${targetStationId} quedará al ${((newStationTime / nominalSeconds) * 100).toFixed(0)}% de capacidad.`
            );
        }

        performAssignment(taskId, targetStationId);
    };

    const handleOptimization = () => {
        // Validación 1: Takt Time definido
        if (nominalSeconds <= 0) {
            logger.warn('useLineBalancing', 'Optimization attempt without Takt Time');
            // Optional: You could add a toast here if we had a toast system. 
            // For now, valid not to block or just return silently with log.
            return;
        }

        // Validación 2: Hay tareas para optimizar
        if (data.tasks.length === 0) {
            logger.warn('useLineBalancing', 'Optimization attempt without tasks');
            return;
        }

        // Safety: Recalculate task weights to ensure standardTime is properly normalized
        // (prevents stale values from causing all-zero optimization when cycleQuantity > 1)
        const freshTasks = calculateTaskWeights(data.tasks, data.meta.activeModels || [], data.meta.fatigueCompensation);

        // Validación 3: Tiempos Válidos (FIXED: Filter instead of Block)
        // Permite tareas con averageTime si falta standardTime. Ignora tareas con tiempo <= 0.
        const validTasks = freshTasks.filter(t => {
            const time = t.standardTime || t.averageTime || 0;
            return time > 0;
        });

        const invalidCount = freshTasks.length - validTasks.length;
        if (invalidCount > 0) {
            const msg = `Se ignoraron ${invalidCount} tareas con tiempo 0 durante la optimización.`;
            logger.warn('useLineBalancing', msg);
            toast.warning('Aviso de Optimización', msg);

            if (validTasks.length === 0) {
                toast.error('Error de Optimización', 'No hay tareas con tiempos válidos para procesar.');
                return;
            }
        }

        // Validación 4: No hay dependencias circulares (en las tareas válidas)
        const hasCycles = detectCycles(validTasks);
        if (hasCycles) {
            toast.error('Error Crítico', 'Se detectaron dependencias circulares. Revise las conexiones.');
            logger.error('useLineBalancing', 'Circular dependency detected');
            return;
        }

        // Prepare Data Snapshot for Simulation (Valid Tasks + Live Assets)
        const simulationData: ProjectData = {
            ...data,
            tasks: validTasks,
            plantConfig: {
                version: data.plantConfig?.version ?? 1,
                lastModified: data.plantConfig?.lastModified ?? Date.now(),
                sectors: data.plantConfig?.sectors ?? [],
                machines: machinesList // Global Asset Injection
            }
        };

        try {
            // Phase 5: Check balancing mode and objective passed via Data Snapshot
            // The unified engine now handles Strategy Selection (SALBP-1 vs SALBP-2 vs Smoothing)

            // Phase 29: Genetic Algorithm Optimization
            const gaConfig = {
                populationSize: 50,
                generations: 100,
                mutationRate: 0.02,
                eliteCount: 2,
                crossoverRate: 0.8
            };

            // Show GA start toast
            toast.info('Optimización Avanzada', `Ejecutando algoritmo genético: ${gaConfig.populationSize} soluciones × ${gaConfig.generations} generaciones...`);

            // Set initial GA progress
            setGAProgress({
                generation: 0,
                totalGenerations: gaConfig.generations,
                bestFitness: Infinity,
                phase: 'initializing'
            });

            // Run Genetic Algorithm
            const gaResult = runGeneticAlgorithm(
                simulationData,
                nominalSeconds,
                effectiveSeconds,
                {
                    ...gaConfig,
                    machines: machinesList, // Phase 30: Pass machine inventory for validation
                    onProgress: (gen, total, bestFitness) => {
                        setGAProgress({
                            generation: gen,
                            totalGenerations: total,
                            bestFitness,
                            phase: 'evolving'
                        });
                    }
                }
            );

            // Get the best result from GA
            const result = gaResult.bestResult;
            result.isRecommended = true;

            // Add improvement info from GA
            if (gaResult.improvementVsGreedy) {
                result.improvementVsBaseline = {
                    stationsSaved: gaResult.improvementVsGreedy.stationsSaved,
                    efficiencyGain: gaResult.improvementVsGreedy.efficiencyGain
                };
            }

            // Clear progress and show results (include alternatives if distinct)
            setGAProgress(null);
            setOptimizationProgress(null);
            const allResults = [result, ...gaResult.alternativeResults];
            setOptimizationResults(allResults);

            // Show improvement toast
            if (gaResult.improvementVsGreedy) {
                const { stationsSaved, headcountSaved } = gaResult.improvementVsGreedy;
                if (stationsSaved > 0 || headcountSaved > 0) {
                    toast.success('Optimización Exitosa',
                        `${stationsSaved > 0 ? `Ahorró ${stationsSaved} estación(es)` : ''}${stationsSaved > 0 && headcountSaved > 0 ? ' y ' : ''}${headcountSaved > 0 ? `${headcountSaved} operario(s)` : ''} vs método secuencial.`
                    );
                }
            } else {
                toast.info('Optimización Completa', 'El algoritmo genético confirmó la solución óptima.');
            }
        } catch (e: unknown) {
            setGAProgress(null);
            setOptimizationProgress(null);
            logger.error('useLineBalancing', 'Critical optimization error', { error: String(e) });
            toast.error('Error del Optimizador', `Fallo interno: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const applySimulation = (res: SimulationResult) => {
        try {
            // FIX: Normalize IDs to ensure contiguous stations (1..N).
            const usedIds = Array.from(new Set(res.assignments.map(a => a.stationId))).filter(Number.isFinite).sort((a, b) => a - b);
            const idMap = new Map<number, number>();
            usedIds.forEach((oldId, index) => idMap.set(oldId, index + 1));

            const normalizedAssignments = res.assignments.map(a => ({
                ...a,
                stationId: idMap.get(a.stationId)!
            }));

            // [R-02] SMART MERGE STRATEGY
            // We want to apply the NEW structure (Tasks -> Stations), but PRESERVE existing configuration (OEE).

            // 1. Start with existing configs as a base look-up, but we will rebuild the array to match the new line structure.
            const previousConfigs = data.stationConfigs || [];
            const newConfigs: StationConfig[] = [];

            // 2. Iterate over the Proposed Configs (from Simulation)
            // The simulation dictates the *Physical Structure* (How many stations, how many replicas).
            res.proposedConfigs.forEach(proposed => {
                const newStationId = idMap.get(proposed.id);
                if (!newStationId) return; // Should not happen

                // Find if we already had a config for this Station ID (e.g. Station 1)
                const existing = previousConfigs.find(c => c.id === newStationId);

                // MERGE LOGIC:
                // - ID: New ID.
                // - Replicas: Must come from Simulation (Proposed), because the optimization balanced workload based on THIS replica count.
                // - OEE Target: If User defined one previously, KEEP IT. Otherwise use Proposed (Default).
                //   Exception: If Proposed OEE is different because of a Sector Change (Hard Constraint), we might want to respect proposed...
                //   But usually `calculateStationOEE` handles that. If the user forced a Manual Override (Station Config), we respect it.

                newConfigs.push({
                    id: newStationId,
                    replicas: proposed.replicas, // Enforce Physics
                    oeeTarget: existing ? existing.oeeTarget : proposed.oeeTarget // Preserve User Preference
                });
            });

            const newMeta = { ...data.meta, configuredStations: res.stationsCount };

            updateData({
                ...data,
                assignments: normalizedAssignments, // Use Normalized
                stationConfigs: newConfigs, // Use Smart Merged
                meta: newMeta
            });
            setOptimizationResults(null);
        } catch (e) {
            toast.error('Error Crítico', `No se pudieron aplicar los cambios: ${e}`);
        }
    };

    const toggleBoardSectorCollapse = (sectorId: string) => {
        const newCollapsed = new Set(collapsedBoardSectors);
        if (newCollapsed.has(sectorId)) {
            newCollapsed.delete(sectorId);
        } else {
            newCollapsed.add(sectorId);
        }
        setCollapsedBoardSectors(newCollapsed);
    };

    return {
        // State
        draggedTask,
        gaProgress,
        configStationId,
        stationOeeInput,
        optimizationResults,
        showPriorityTable,
        warningState,
        collapsedBoardSectors,
        showClearBalanceConfirm, // BUG-01 FIX: For ConfirmModal in parent

        // Data
        nominalSeconds,
        effectiveSeconds,
        configuredStations,
        stationData,
        saturationData,
        yAxisDomainMax,
        unassignedTasks,
        totalHeadcount,
        efficiency,
        efficiencyLine, // Saturación vs Ciclo Real
        saturationVsTakt, // Utilización vs Takt — métrica accionable
        realCycleTime,
        machineCycleTime,
        totalManualWork, // Crystal Box: numerador correcto para Saturación
        totalIdleTimePerCycle,
        dailyLostHours,
        sectorsList,
        machinesList,
        sectorTaktMap,
        // V4.2 RC-ALBP: Machine Validation
        machineValidation,

        // Drag Preview
        dragOverStation,
        dragPreview,

        // Actions
        setConfigStationId,
        setStationOeeInput,
        setOptimizationResults,
        setShowPriorityTable,
        setWarningState,
        openStationConfig,
        saveStationConfig,
        updateStationReplicas,
        setStationCount,
        addStation,
        removeEmptyStation,
        emptyStationIds,
        unassignTask,
        clearBalance,
        confirmClearBalance,   // BUG-01 FIX: For ConfirmModal onConfirm
        cancelClearBalance,    // BUG-01 FIX: For ConfirmModal onClose
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleOptimization,
        applySimulation,
        toggleBoardSectorCollapse,
        performAssignment,
        performBulkAssignment
    };
};
