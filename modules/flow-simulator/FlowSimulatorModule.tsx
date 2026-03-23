/**
 * Flow Simulator Module - Production Line Visualization
 *
 * Redesigned as a clean composition of focused components.
 * Two modes: Visual animation (tick-based) and Instant DES simulation.
 *
 * @module FlowSimulatorModule
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ProjectData, StationConfig, Task } from '../../types';
import './flow-simulator.css';
import {
    InventoryStatus,
    SimulationKPIs,
    createEmptyKPIs,
    SimulationEvent,
    MultiProductConfig,
    ProductType,
    createDefaultMultiProductConfig,
    DEFAULT_PRODUCTS,
    ProductMixMode,
} from './flowTypes';
import { createDESEngine, DESConfig } from './desSimulationEngine';
import { calculateTaktTime, calculateEffectiveStationTime } from '../../core/balancing/simulation';
import { useResolvedProject } from '../../hooks/useResolvedProject';
import { analyzeBufferNeeds } from '../../core/balancing/bufferLogic';
import { BlockingStarvingDashboard } from './BlockingStarvingDashboard';

import { SimulationControls, SIMULATION_SCENARIOS, type SimScenario } from './SimulationControls';
import { ProductionLine, type ProductionStation, type FlowingPiece } from './ProductionLine';
import { KPIDashboard } from './KPIDashboard';
import { StationDiagnosticPanel } from './StationDiagnosticPanel';

// =============================================================================
// HELPERS
// =============================================================================

const PIECE_COLORS = ['#fbbf24', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c'];

function getRandomColor(): string {
    return PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)];
}

function generateHeijunkaProductSequence(products: ProductType[], totalPieces: number): string[] {
    if (products.length === 0 || totalPieces <= 0) return [];
    const sequence: string[] = [];
    const demands = products.map(p => Math.round(p.mixRatio * totalPieces));
    const accumulators = products.map(() => 0);
    for (let i = 0; i < totalPieces; i++) {
        let bestIdx = 0;
        let bestScore = -Infinity;
        for (let j = 0; j < products.length; j++) {
            accumulators[j] += demands[j];
            if (accumulators[j] > bestScore) {
                bestScore = accumulators[j];
                bestIdx = j;
            }
        }
        accumulators[bestIdx] -= totalPieces;
        sequence.push(products[bestIdx].id);
    }
    return sequence;
}

// =============================================================================
// SIMULATION STATE
// =============================================================================

interface SimulationState {
    status: 'idle' | 'running' | 'paused' | 'completed';
    stations: ProductionStation[];
    pieces: FlowingPiece[];
    completedCount: number;
    totalToProcess: number;
    elapsedTime: number;
    throughput: number;
    avgCycleTime: number;
    kpis: SimulationKPIs;
    events: SimulationEvent[];
    multiProductConfig: MultiProductConfig | null;
}

// =============================================================================
// PROPS
// =============================================================================

interface Props {
    data: ProjectData;
    updateData?: (data: ProjectData) => void;
    rootHandle?: FileSystemDirectoryHandle | string | null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const FlowSimulatorModule: React.FC<Props> = ({ data, rootHandle }) => {
    const { resolvedData } = useResolvedProject(data, rootHandle);

    // === Config & Data Setup ===
    const taktMetrics = useMemo(() => {
        const demand = resolvedData.meta.dailyDemand || 1000;
        const activeShifts = resolvedData.meta.activeShifts || 1;
        const oee = resolvedData.meta.manualOEE || 0.85;

        if (!resolvedData.shifts || resolvedData.shifts.length === 0) {
            const fallbackMinutes = 480 * activeShifts;
            return { taktTime: (fallbackMinutes * 60 * oee) / demand, totalAvailableMinutes: fallbackMinutes };
        }

        const result = calculateTaktTime(resolvedData.shifts, activeShifts, demand, oee, resolvedData.meta.setupLossPercent || 0);
        return { taktTime: result.effectiveSeconds, totalAvailableMinutes: result.totalAvailableMinutes };
    }, [resolvedData.shifts, resolvedData.meta.dailyDemand, resolvedData.meta.activeShifts, resolvedData.meta.manualOEE, resolvedData.meta.setupLossPercent]);

    const taktTime = taktMetrics.taktTime;

    const bufferAnalysis = useMemo(() => {
        return analyzeBufferNeeds(
            resolvedData.stationConfigs || [],
            resolvedData.tasks || [],
            resolvedData.assignments || [],
            taktTime
        );
    }, [resolvedData.stationConfigs, resolvedData.tasks, resolvedData.assignments, taktTime]);

    // Build stations from project data
    const initialStations = useMemo((): ProductionStation[] => {
        const DEFAULT_BUFFER = 20;
        const configs = resolvedData.stationConfigs || [];

        // Tier 2: Derive stations from balancing assignments when no stationConfigs exist
        if (configs.length === 0) {
            const assignments = resolvedData.assignments || [];
            const tasks = resolvedData.tasks || [];
            const sectors = resolvedData.sectors || [];

            if (assignments.length > 0 && tasks.length > 0) {
                // Group assignments by stationId
                const stationMap = new Map<number, typeof tasks>();
                for (const a of assignments) {
                    const task = tasks.find(t => t.id === a.taskId);
                    if (!task) continue;
                    if (!stationMap.has(a.stationId)) stationMap.set(a.stationId, []);
                    stationMap.get(a.stationId)!.push(task);
                }

                const derived: ProductionStation[] = [];
                const sortedIds = [...stationMap.keys()].sort((a, b) => a - b);

                for (const stId of sortedIds) {
                    const stTasks = stationMap.get(stId)!;
                    const cycleTime = calculateEffectiveStationTime(stTasks);

                    // Derive sector from first task that has a sectorId
                    const firstWithSector = stTasks.find(t => t.sectorId);
                    const sector = firstWithSector?.sectorId
                        ? sectors.find(s => s.id === firstWithSector.sectorId)
                        : undefined;

                    derived.push({
                        id: stId,
                        name: `Estacion ${stId}`,
                        cycleTime: cycleTime || (taktTime > 0 ? taktTime * 0.9 : 45),
                        operators: 1,
                        sectorColor: sector?.color || '#8b5cf6',
                        sectorName: sector?.name || 'General',
                        wipQueue: 0,
                        activeItems: 0,
                        blocked: false,
                        processProgress: [],
                        bufferPieces: DEFAULT_BUFFER,
                        bufferCapacity: DEFAULT_BUFFER,
                        bufferStatus: 'ok' as InventoryStatus,
                        isStarved: false,
                    });
                }

                if (derived.length > 0) return derived;
            }

            // No configs, no assignments → empty (user must do balanceo first)
            return [];
        }

        const stations = configs.map((st: StationConfig, idx: number) => {
            const tasksInStation = resolvedData.assignments
                ?.filter(a => a.stationId === st.id)
                .map(a => resolvedData.tasks?.find(t => t.id === a.taskId))
                .filter(Boolean) || [];

            const firstTaskWithSector = tasksInStation.find(t => t?.sectorId);
            const sector = firstTaskWithSector?.sectorId
                ? resolvedData.sectors?.find(s => s.id === firstTaskWithSector.sectorId)
                : resolvedData.sectors?.[idx % (resolvedData.sectors?.length || 1)];

            const calculatedCycleTime = tasksInStation.length > 0
                ? calculateEffectiveStationTime(tasksInStation.filter(Boolean) as Task[])
                : 0;
            const cycleTime = st.effectiveTime || st.cycleTimeOverride || calculatedCycleTime || (taktTime > 0 ? taktTime * 0.9 : 45);
            const bufferCapacity = (st.logistics?.binCapacity || 10) * (st.logistics?.currentBins || 2);

            return {
                id: st.id,
                name: st.name || `E${idx + 1}`,
                cycleTime,
                operators: st.replicas || 1,
                sectorColor: sector?.color || '#8b5cf6',
                sectorName: sector?.name || 'General',
                sectorSequence: sector?.sequence ?? 999,
                wipQueue: 0,
                activeItems: 0,
                blocked: false,
                processProgress: [] as number[],
                bufferPieces: bufferCapacity,
                bufferCapacity,
                bufferStatus: 'ok' as InventoryStatus,
                isStarved: false,
            };
        });

        return stations.sort((a, b) => (a.sectorSequence ?? 999) - (b.sectorSequence ?? 999));
    }, [resolvedData.stationConfigs, resolvedData.sectors, resolvedData.assignments, resolvedData.tasks, taktTime]);

    // === State ===
    const [state, setState] = useState<SimulationState>({
        status: 'idle',
        stations: initialStations,
        pieces: [],
        completedCount: 0,
        totalToProcess: 50,
        elapsedTime: 0,
        throughput: 0,
        avgCycleTime: 0,
        kpis: createEmptyKPIs(initialStations.length),
        events: [],
        multiProductConfig: null,
    });

    const [speed, setSpeed] = useState(1);
    const [piecesToProcess, setPiecesToProcess] = useState(50);
    const [wipLimit, setWipLimit] = useState(3);
    const [variabilityPercent, setVariabilityPercent] = useState(5);

    // Refs for tick-hot values (avoid recreating tick callback)
    const speedRef = useRef(speed);
    const wipLimitRef = useRef(wipLimit);
    const variabilityRef = useRef(variabilityPercent);
    const productMixModeRef = useRef<ProductMixMode>('random');
    const heijunkaSequenceRef = useRef<string[]>([]);

    // Sync refs on change
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { wipLimitRef.current = wipLimit; }, [wipLimit]);
    useEffect(() => { variabilityRef.current = variabilityPercent; }, [variabilityPercent]);

    const intervalRef = useRef<number | null>(null);
    const pieceIdRef = useRef(0);
    const simulatedTimeRef = useRef<number>(0);
    const completionTimesRef = useRef<number[]>([]);
    const warmupSecondsRef = useRef<number>(0);
    const completedAtWarmupRef = useRef<number>(-1);
    const tickCountRef = useRef(0);

    const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
    const [showAdvancedControls, setShowAdvancedControls] = useState(false);
    const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
    const [productMixMode, _setProductMixMode] = useState<ProductMixMode>('random');
    const setProductMixMode = useCallback((mode: ProductMixMode) => { _setProductMixMode(mode); productMixModeRef.current = mode; }, []);
    const [heijunkaSequence, _setHeijunkaSequence] = useState<string[]>([]);
    const setHeijunkaSequence = useCallback((seq: string[]) => { _setHeijunkaSequence(seq); heijunkaSequenceRef.current = seq; }, []);
    const heijunkaIndexRef = useRef<number>(0);

    const selectedStation = useMemo(
        () => selectedStationId !== null ? state.stations.find(s => s.id === selectedStationId) ?? null : null,
        [selectedStationId, state.stations]
    );
    const selectedStationIndex = useMemo(
        () => selectedStationId !== null ? state.stations.findIndex(s => s.id === selectedStationId) : -1,
        [selectedStationId, state.stations]
    );

    // === Tick Logic (Visual Mode) ===
    // Each piece tracks: stationIndex, progress (0-100%), isMoving (transit between stations)
    // Pieces are deep-cloned each tick to avoid React state mutation issues
    const tick = useCallback(() => {
        setState(prev => {
            if (prev.status !== 'running') return prev;

            const currentSpeed = speedRef.current;
            const currentWipLimit = wipLimitRef.current;
            const currentVariability = variabilityRef.current;
            const currentProductMixMode = productMixModeRef.current;
            const currentHeijunkaSeq = heijunkaSequenceRef.current;

            const tickSeconds = 0.1 * currentSpeed;
            const numStations = prev.stations.length;

            // Deep clone stations and pieces to avoid mutating React state
            const stations: ProductionStation[] = prev.stations.map(s => ({
                ...s,
                processProgress: [...s.processProgress],
            }));
            const pieces: FlowingPiece[] = prev.pieces.map(p => ({ ...p }));
            let completedCount = prev.completedCount;
            const kpis = { ...prev.kpis };

            // --- A. Advance moving pieces (transit between stations) ---
            for (const piece of pieces) {
                if (piece.isMoving) {
                    piece.moveProgress += currentSpeed * 10;
                    if (piece.moveProgress >= 100) {
                        piece.isMoving = false;
                        piece.moveProgress = 100;
                        piece.inTransit = false;
                    }
                }
            }

            // --- B. Process pieces in stations (backwards to allow downstream movement) ---
            for (let i = numStations - 1; i >= 0; i--) {
                const station = stations[i];
                const isLastStation = i === numStations - 1;

                // Advance processing progress for pieces at this station
                const processingHere = pieces.filter(
                    p => p.stationIndex === i && !p.isMoving && p.isProcessing && !p.subjectToDelete
                );

                for (const piece of processingHere) {
                    if (piece.processSlot === undefined) continue;

                    // Assign duration on first tick of processing
                    if (piece.currentStationDuration === undefined) {
                        let baseDuration = station.cycleTime * piece.cycleTimeMultiplier;
                        if (currentVariability > 0) {
                            // FIX: Guard against Math.random()=0 → Math.log(0)=-Infinity → NaN
                            // Same fix as desSimulationEngine.ts gaussianRandom()
                            const u1 = Math.random() || Number.MIN_VALUE;
                            const u2 = Math.random() || Number.MIN_VALUE;
                            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                            const stdDev = baseDuration * (currentVariability / 100);
                            baseDuration = Number.isFinite(z)
                                ? Math.max(baseDuration * 0.5, baseDuration + z * stdDev)
                                : baseDuration;
                        }
                        piece.currentStationDuration = baseDuration;
                    }

                    // Advance progress
                    const increment = (tickSeconds / Math.max(0.1, piece.currentStationDuration)) * 100;
                    const slot = piece.processSlot;
                    if (slot < station.processProgress.length) {
                        station.processProgress[slot] = Math.min(100, station.processProgress[slot] + increment);
                    }
                }

                // Find pieces that finished processing (progress >= 100)
                const finishedPieces = processingHere.filter(
                    p => p.processSlot !== undefined &&
                         p.processSlot < station.processProgress.length &&
                         station.processProgress[p.processSlot] >= 100
                );

                if (finishedPieces.length > 0) {
                    // Check space at next station
                    const nextStation = isLastStation ? null : stations[i + 1];
                    const spaceAvailable = nextStation
                        ? Math.max(0, (nextStation.operators + currentWipLimit) - (nextStation.activeItems + nextStation.wipQueue))
                        : 9999;

                    const numToMove = Math.min(finishedPieces.length, spaceAvailable);

                    if (numToMove > 0) {
                        station.blocked = false;
                        const toMove = finishedPieces.slice(0, numToMove);
                        for (const piece of toMove) {
                            piece.isProcessing = false;
                            piece.currentStationDuration = undefined;
                            piece.processSlot = undefined;

                            if (nextStation) {
                                piece.stationIndex = i + 1;
                                piece.isMoving = true;
                                piece.moveProgress = 0;
                                piece.inTransit = true;
                                nextStation.wipQueue++;
                            } else {
                                // Last station - piece exits
                                piece.subjectToDelete = true;
                                completedCount++;
                                const finishTime = simulatedTimeRef.current * 1000;
                                completionTimesRef.current.push(finishTime - piece.entryTime);
                                if (completionTimesRef.current.length > 1000) completionTimesRef.current.shift();
                            }

                            station.activeItems = Math.max(0, station.activeItems - 1);
                        }

                        // Rebuild processProgress: keep only non-removed slots, reindex remaining pieces
                        const remainingProcessing = pieces.filter(
                            p => p.stationIndex === i && p.isProcessing && p.processSlot !== undefined && !p.subjectToDelete
                        );
                        const newProgress: number[] = [];
                        for (const rp of remainingProcessing) {
                            const oldProg = rp.processSlot! < station.processProgress.length
                                ? station.processProgress[rp.processSlot!]
                                : 0;
                            rp.processSlot = newProgress.length;
                            newProgress.push(oldProg);
                        }
                        station.processProgress = newProgress;
                    } else {
                        // No space downstream - station is blocked
                        station.blocked = true;
                    }
                } else {
                    station.blocked = false;
                }

                // Starvation tracking (for KPIs only, doesn't block processing)
                const anyPiecesHere = pieces.some(
                    p => p.stationIndex === i && !p.isMoving && !p.inTransit && !p.subjectToDelete
                );
                station.isStarved = !anyPiecesHere && station.activeItems === 0 && !station.blocked && i > 0;
            }

            // --- C. Pull queued pieces into processing slots ---
            for (let i = 0; i < numStations; i++) {
                const station = stations[i];
                const freeSlots = station.operators - station.activeItems;
                if (freeSlots <= 0) continue;

                const queuedPieces = pieces.filter(
                    p => p.stationIndex === i && !p.isMoving && !p.isProcessing && !p.inTransit && !p.subjectToDelete
                );
                const toPromote = Math.min(freeSlots, queuedPieces.length);
                for (let j = 0; j < toPromote; j++) {
                    const piece = queuedPieces[j];
                    piece.isProcessing = true;
                    piece.processSlot = station.processProgress.length;
                    station.processProgress.push(0);
                    station.activeItems++;
                    station.wipQueue = Math.max(0, station.wipQueue - 1);
                }
            }

            // --- D. Clean up completed pieces ---
            const activePieces = pieces.filter(p => !p.subjectToDelete);

            // --- E. Input: inject new pieces at station 0 ---
            const inputStation = stations[0];
            const totalInPipeline = completedCount + activePieces.length;

            if (totalInPipeline < prev.totalToProcess &&
                (inputStation.wipQueue + inputStation.activeItems < currentWipLimit)) {
                pieceIdRef.current++;

                let selectedProduct: ProductType | null = null;
                if (prev.multiProductConfig && prev.multiProductConfig.products.length > 0) {
                    const products = prev.multiProductConfig.products;
                    if (currentProductMixMode === 'dominant') {
                        selectedProduct = products.reduce((a, b) => a.mixRatio > b.mixRatio ? a : b);
                    } else if (currentProductMixMode === 'heijunka' && currentHeijunkaSeq.length > 0) {
                        const productId = currentHeijunkaSeq[heijunkaIndexRef.current % currentHeijunkaSeq.length];
                        selectedProduct = products.find(p => p.id === productId) || products[0];
                        heijunkaIndexRef.current++;
                    } else {
                        const random = Math.random();
                        let cumulative = 0;
                        for (const product of products) {
                            cumulative += product.mixRatio;
                            if (random <= cumulative) { selectedProduct = product; break; }
                        }
                        if (!selectedProduct) selectedProduct = products[0];
                    }
                }

                activePieces.push({
                    id: pieceIdRef.current,
                    stationIndex: 0,
                    isMoving: true,
                    moveProgress: 0,
                    color: selectedProduct ? selectedProduct.color : getRandomColor(),
                    isProcessing: false,
                    entryTime: simulatedTimeRef.current * 1000,
                    productId: selectedProduct ? selectedProduct.id : 'default',
                    cycleTimeMultiplier: selectedProduct ? selectedProduct.cycleTimeMultiplier : 1.0,
                });
                inputStation.wipQueue++;
            }

            // --- F. Metrics ---
            simulatedTimeRef.current += tickSeconds;
            const elapsed = simulatedTimeRef.current;

            const warmupSec = warmupSecondsRef.current;
            if (completedAtWarmupRef.current < 0 && elapsed >= warmupSec) {
                completedAtWarmupRef.current = completedCount;
            }

            let throughput: number;
            const steadyStateTime = elapsed - warmupSec;
            if (completedAtWarmupRef.current >= 0 && steadyStateTime > 5) {
                const steadyStatePieces = completedCount - completedAtWarmupRef.current;
                throughput = steadyStatePieces >= 1 ? (steadyStatePieces / steadyStateTime) * 3600 : 0;
            } else {
                throughput = elapsed > 1 ? (completedCount / elapsed) * 3600 : 0;
            }

            const avgCycle = completionTimesRef.current.length > 0
                ? completionTimesRef.current.reduce((a, b) => a + b, 0) / completionTimesRef.current.length / 1000
                : 0;

            // KPI tracking
            for (let i = 0; i < numStations; i++) {
                const station = stations[i];
                if (station.isStarved) {
                    kpis.stationStarvedTime[i] = (kpis.stationStarvedTime[i] || 0) + tickSeconds;
                } else if (station.activeItems > 0) {
                    kpis.stationActiveTime[i] = (kpis.stationActiveTime[i] || 0) + tickSeconds;
                } else if (station.blocked) {
                    kpis.stationBlockedTime[i] = (kpis.stationBlockedTime[i] || 0) + tickSeconds;
                } else {
                    kpis.stationIdleTime[i] = (kpis.stationIdleTime[i] || 0) + tickSeconds;
                }

                const totalTime = (kpis.stationActiveTime[i] || 0) + (kpis.stationIdleTime[i] || 0) + (kpis.stationBlockedTime[i] || 0) + (kpis.stationStarvedTime[i] || 0);
                kpis.stationUtilization[i] = totalTime > 0 ? ((kpis.stationActiveTime[i] || 0) / totalTime) * 100 : 0;
            }

            let maxUtilization = 0;
            let bottleneckId = -1;
            for (let i = 0; i < numStations; i++) {
                if (kpis.stationUtilization[i] > maxUtilization) {
                    maxUtilization = kpis.stationUtilization[i];
                    bottleneckId = i;
                }
            }
            if (bottleneckId >= 0) {
                kpis.bottleneckStationId = stations[bottleneckId].id;
                kpis.bottleneckCycleTime = stations[bottleneckId].cycleTime;
                kpis.bottleneckUtilization = maxUtilization;
            }

            const wipBetween: number[] = [];
            for (let i = 0; i < numStations - 1; i++) {
                const movingToNext = activePieces.filter(p => p.stationIndex === i + 1 && p.isMoving).length;
                wipBetween.push(stations[i + 1].wipQueue + movingToNext);
            }
            kpis.wipBetweenStations = wipBetween;

            const totalWIP = activePieces.length;
            if (totalWIP > kpis.peakWIP) kpis.peakWIP = totalWIP;
            kpis.wipSamples += totalWIP;
            kpis.wipSampleCount += 1;
            kpis.avgWIP = kpis.wipSampleCount > 0 ? kpis.wipSamples / kpis.wipSampleCount : 0;

            const isComplete = completedCount >= prev.totalToProcess;
            if (isComplete && intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            return {
                ...prev,
                stations,
                pieces: activePieces,
                completedCount,
                elapsedTime: elapsed,
                throughput,
                avgCycleTime: avgCycle,
                kpis,
                status: isComplete ? 'completed' : 'running',
            };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taktTime]);

    // Tick interval - tick is now stable (reads from refs)
    useEffect(() => {
        if (state.status === 'running') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = window.setInterval(tick, 100);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.status]);

    // === Handlers ===
    const handleStart = () => {
        if (state.status === 'idle' || state.status === 'completed') {
            pieceIdRef.current = 0;
            simulatedTimeRef.current = 0;
            completionTimesRef.current = [];
            warmupSecondsRef.current = initialStations.length * (taktTime || 60);
            completedAtWarmupRef.current = -1;

            if (productMixMode === 'heijunka') {
                const products = DEFAULT_PRODUCTS;
                const sequence = generateHeijunkaProductSequence(products, piecesToProcess);
                setHeijunkaSequence(sequence);
                heijunkaIndexRef.current = 0;
            }

            const multiProductInitial = createDefaultMultiProductConfig(
                initialStations.map(s => String(s.id))
            );

            setState(prev => ({
                ...prev,
                status: 'running',
                totalToProcess: piecesToProcess,
                stations: initialStations.map(s => ({ ...s, wipQueue: 0, activeItems: 0, processProgress: [], bufferPieces: s.bufferCapacity, bufferStatus: 'ok' as InventoryStatus, isStarved: false, blocked: false })),
                pieces: [],
                completedCount: 0,
                elapsedTime: 0,
                throughput: 0,
                avgCycleTime: 0,
                kpis: createEmptyKPIs(initialStations.length),
                events: [],
                multiProductConfig: multiProductInitial,
            }));
        } else {
            setState(prev => ({ ...prev, status: 'running' }));
        }
    };

    const handlePause = () => setState(prev => ({ ...prev, status: 'paused' }));

    const handleReset = () => {
        setState({
            status: 'idle',
            stations: initialStations,
            pieces: [],
            completedCount: 0,
            totalToProcess: piecesToProcess,
            elapsedTime: 0,
            throughput: 0,
            avgCycleTime: 0,
            kpis: createEmptyKPIs(initialStations.length),
            events: [],
            multiProductConfig: null,
        });
    };

    const handleInstantSimulation = useCallback(() => {
        const desConfig: DESConfig = {
            stations: initialStations.map(s => ({
                id: s.id,
                name: s.name,
                cycleTime: s.cycleTime,
                operators: s.operators,
                bufferCapacity: s.bufferCapacity,
            })),
            wipLimit,
            totalPieces: piecesToProcess,
            variabilityPercent,
            taktTimeSeconds: taktTime,
            productMixMode,
            products: DEFAULT_PRODUCTS.map(p => ({
                id: p.id,
                mixRatio: p.mixRatio,
                cycleTimeMultiplier: p.cycleTimeMultiplier,
            })),
        };

        const desEngine = createDESEngine(desConfig);
        const result = desEngine.runInstant();
        const desStations = desEngine.getStationsState();

        const finalStations = initialStations.map((s, idx) => {
            const desState = desStations[idx];
            return {
                ...s,
                wipQueue: desState?.queueCount || 0,
                activeItems: desState?.activeCount || 0,
                blocked: desState?.blocked || false,
                processProgress: [] as number[],
                bufferPieces: desState?.bufferPieces ?? s.bufferCapacity,
                bufferStatus: (desState?.isStarved ? 'critical' :
                    (desState?.bufferPieces ?? s.bufferCapacity) < s.bufferCapacity * 0.25 ? 'warning' : 'ok') as InventoryStatus,
                isStarved: desState?.isStarved || false,
            };
        });

        setState({
            status: 'completed',
            stations: finalStations,
            pieces: [],
            completedCount: result.completedCount,
            totalToProcess: piecesToProcess,
            elapsedTime: result.elapsedTime,
            throughput: result.throughput,
            avgCycleTime: result.avgCycleTime,
            kpis: result.kpis,
            events: [],
            multiProductConfig: null,
        });
    }, [initialStations, piecesToProcess, wipLimit, variabilityPercent, taktTime, productMixMode]);

    const applyScenario = (scenario: SimScenario) => {
        setPiecesToProcess(scenario.pieces);
        setSpeed(scenario.speed);
        setVariabilityPercent(scenario.variability);
        setWipLimit(scenario.wip);
        setSelectedScenarioId(scenario.id);
        setShowAdvancedControls(false);
    };

    // === RENDER ===
    return (
        <div className="flow-simulator-v2">
            <div className="flow-header">
                <div className="flow-header__title">
                    <span className="flow-header__icon">🏭</span>
                    <h1>Simulador de Flujo de Produccion</h1>
                </div>
            </div>

            {initialStations.length === 0 ? (
                <div className="flow-empty-state">
                    <div className="flow-empty-state__icon">⚙️</div>
                    <h2>Sin estaciones configuradas</h2>
                    <p>Para usar el simulador, primero realizá un balanceo de línea en el módulo de Balanceo.</p>
                </div>
            ) : (<>

            {/* Fragile line alert */}
            {bufferAnalysis.isFragileLine && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mx-4 mt-2 flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div className="flex-1">
                        <h3 className="font-bold text-amber-800 text-sm uppercase">
                            Riesgo Operativo Alto: Linea Fragil Detectada
                        </h3>
                        <p className="text-amber-700 text-xs mt-1">
                            Saturacion promedio: <strong>{(bufferAnalysis.lineEfficiency * 100).toFixed(0)}%</strong> sin buffers configurados.
                            Cualquier pequena demora detendra la linea.
                            <span className="font-semibold"> Recomendacion: Agregar buffers IPK de 1-2 unidades entre estaciones.</span>
                        </p>
                        {bufferAnalysis.recommendations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {bufferAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
                                    <span key={idx}
                                        className={`text-[10px] px-2 py-1 rounded font-bold ${rec.reason === 'bottleneck'
                                            ? 'bg-red-100 text-red-700 border border-red-300'
                                            : rec.reason === 'man_machine_interface'
                                                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                                                : 'bg-amber-100 text-amber-700 border border-amber-300'}`}
                                        title={rec.explanation}
                                    >
                                        Buffer después de {rec.stationName}: {rec.recommendedSize} pcs
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <SimulationControls
                status={state.status}
                speed={speed}
                piecesToProcess={piecesToProcess}
                wipLimit={wipLimit}
                variabilityPercent={variabilityPercent}
                productMixMode={productMixMode}
                selectedScenarioId={selectedScenarioId}
                showAdvancedControls={showAdvancedControls}
                completedCount={state.completedCount}
                elapsedTime={state.elapsedTime}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
                onInstantSimulation={handleInstantSimulation}
                onSpeedChange={setSpeed}
                onPiecesChange={setPiecesToProcess}
                onWipLimitChange={setWipLimit}
                onVariabilityChange={setVariabilityPercent}
                onProductMixModeChange={setProductMixMode}
                onScenarioApply={applyScenario}
                onToggleAdvanced={() => {
                    setShowAdvancedControls(!showAdvancedControls);
                    setSelectedScenarioId(null);
                }}
            />

            <ProductionLine
                stations={state.stations}
                pieces={state.pieces}
                taktTime={taktTime}
                completedCount={state.completedCount}
                totalToProcess={state.totalToProcess}
                throughput={state.throughput}
                status={state.status}
                selectedStationId={selectedStationId}
                onStationClick={(id) => setSelectedStationId(prev => prev === id ? null : id)}
            />

            <KPIDashboard
                kpis={state.kpis}
                stations={state.stations}
                elapsedTime={state.elapsedTime}
                throughput={state.throughput}
                avgCycleTime={state.avgCycleTime}
                taktTime={taktTime}
                status={state.status}
            />

            {(state.status === 'completed' || state.status === 'paused') && state.stations.length > 0 && (
                <BlockingStarvingDashboard
                    stations={state.stations.map(s => ({
                        id: s.id,
                        name: s.name,
                    }))}
                    kpis={state.kpis}
                    elapsedTime={state.elapsedTime}
                    isComplete={state.status === 'completed'}
                />
            )}

            {selectedStation && selectedStationIndex >= 0 && (
                <StationDiagnosticPanel
                    station={selectedStation}
                    stationIndex={selectedStationIndex}
                    kpis={state.kpis}
                    elapsedTime={state.elapsedTime}
                    taktTime={taktTime}
                    onClose={() => setSelectedStationId(null)}
                />
            )}

            </>)}
        </div>
    );
};
