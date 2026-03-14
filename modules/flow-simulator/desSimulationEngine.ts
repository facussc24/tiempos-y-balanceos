/**
 * DES Simulation Engine - Optimized Discrete Event Simulation
 * 
 * High-performance simulation engine using a priority queue (min-heap)
 * for event scheduling. Designed for instant mode execution in milliseconds.
 * 
 * Phase 10: Performance and Scalability
 * 
 * @module desSimulationEngine
 */

import { SimulationKPIs, createEmptyKPIs } from './flowTypes';
import { logger } from '../../utils/logger';

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Error thrown when DES engine receives invalid configuration.
 */
export class DESConfigError extends Error {
    public readonly field: string;
    constructor(field: string, message: string) {
        super(`Configuración DES inválida [${field}]: ${message}`);
        this.name = 'DESConfigError';
        this.field = field;
    }
}

/**
 * Validates DES configuration before engine construction.
 * Throws DESConfigError for structural issues, clamps numeric edge cases.
 * Returns a sanitized copy of the config.
 */
function validateDESConfig(config: DESConfig): DESConfig {
    if (!config.stations || config.stations.length === 0) {
        throw new DESConfigError('stations', 'No hay estaciones definidas');
    }

    if (config.totalPieces <= 0) {
        throw new DESConfigError('totalPieces', `totalPieces debe ser > 0, recibido: ${config.totalPieces}`);
    }

    if (config.wipLimit <= 0) {
        throw new DESConfigError('wipLimit', `wipLimit debe ser > 0, recibido: ${config.wipLimit}`);
    }

    // Clamp station-level values to safe minimums
    const sanitizedStations = config.stations.map(s => ({
        ...s,
        cycleTime: Math.max(0.01, s.cycleTime),   // Prevent instant completion
        operators: Math.max(1, s.operators),        // Prevent deadlock
        bufferCapacity: Math.max(0, s.bufferCapacity),
    }));

    return {
        ...config,
        stations: sanitizedStations,
        wipLimit: Math.max(1, config.wipLimit),
        variabilityPercent: Math.max(0, Math.min(100, config.variabilityPercent || 0)),
    };
}

// =============================================================================
// TYPES
// =============================================================================

/** Event types for the DES scheduler */
export type DESEventType =
    | 'PIECE_COMPLETE'      // Piece finishes processing at a station
    | 'PIECE_ARRIVE'        // Piece arrives at station queue
    | 'PIECE_START'         // Piece starts processing
| 'FAILURE_START'       // Machine breakdown (Phase 12)
    | 'FAILURE_END'         // Repair complete (Phase 12)
    | 'SIMULATION_END';     // End of simulation marker

/** A discrete event in the simulation */
export interface DESEvent {
    time: number;           // Event time in simulation seconds
    type: DESEventType;
    stationIndex: number;   // -1 for system events
    pieceId: number;        // -1 for system events
    priority: number;       // Lower = higher priority (for same-time events)
}

/** Station state for DES simulation */
export interface DESStationState {
    id: number;
    name: string;
    cycleTime: number;
    operators: number;
    activeCount: number;            // Pieces being processed
    queueCount: number;             // Pieces waiting in queue
    processCompletionTimes: number[]; // When each active piece finishes
    bufferPieces: number;
    bufferCapacity: number;
    isStarved: boolean;
    blocked: boolean;
    // Pre-computed values
    cycleTimeMs: number;            // cycleTime * 1000
    maxCapacity: number;            // operators + wipLimit

    // Phase 12 Extensions
    isDown: boolean;                // Mechanical failure
    failureConfig?: { mtbfMinutes: number; mttrMinutes: number };
}

/** Piece state for DES simulation */
export interface DESPieceState {
    id: number;
    stationIndex: number;   // -1 = input, stations.length = output
    status: 'queued' | 'processing' | 'completed';
    entryTime: number;
    completionTime?: number;
    cycleTimeMultiplier: number; // Product-specific cycle time multiplier
}

/** Result from instant simulation */
export interface DESSimulationResult {
    completedCount: number;
    elapsedTime: number;
    throughput: number;
    avgCycleTime: number;
    kpis: SimulationKPIs;
    executionTimeMs: number;    // Wall-clock time for benchmarking
    tickCount: number;
    peakMemoryMB?: number;
}

/** Configuration for DES engine */
/** Product mix mode for multi-product simulation */
export type DESProductMixMode = 'dominant' | 'random' | 'heijunka';

/** Product definition for DES simulation */
export interface DESProductDef {
    id: string;
    mixRatio: number;
    cycleTimeMultiplier: number;
}

export interface DESConfig {
    stations: Array<{
        id: number;
        name: string;
        cycleTime: number;
        operators: number;
        bufferCapacity: number;
        failureConfig?: { mtbfMinutes: number; mttrMinutes: number };
    }>;
    wipLimit: number;
    totalPieces: number;
    /** FIX 10: Variability percentage (0-20) for stochastic simulation */
    variabilityPercent?: number;
    /** FIX 10: Takt time in seconds for warm-up calculation */
    taktTimeSeconds?: number;
    /** Product mix mode for multi-product simulation */
    productMixMode?: DESProductMixMode;
    /** Product definitions with mix ratios and cycle time multipliers */
    products?: DESProductDef[];
}

// =============================================================================
// FIX 10: STOCHASTIC HELPERS
// =============================================================================

/**
 * Generate random number from Normal distribution using Box-Muller transform.
 * This creates realistic variation in cycle times.
 * 
 * @param mean - Mean value (e.g., station.cycleTime)
 * @param sigma - Standard deviation (e.g., cycleTime * variability%)
 * @returns Random value from N(mean, sigma)
 */
function gaussianRandom(mean: number, sigma: number): number {
    if (sigma === 0) return mean;
    // FIX: Math.random() can return exactly 0, and Math.log(0) = -Infinity
    // which propagates NaN through sqrt(-2 * -Infinity) → NaN → cycle time NaN
    // Guard with Number.MIN_VALUE (smallest positive float, ~5e-324)
    const u1 = Math.random() || Number.MIN_VALUE;
    const u2 = Math.random() || Number.MIN_VALUE;
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Guard against NaN from edge cases (defensive)
    if (!Number.isFinite(z)) return mean;
    // Clamp to prevent extreme outliers (±3 sigma)
    const clamped = Math.max(-3, Math.min(3, z));
    return Math.max(0.1, mean + sigma * clamped); // Never go below 0.1s
}

// =============================================================================
// MIN-HEAP PRIORITY QUEUE
// =============================================================================

/**
 * Efficient min-heap implementation for event scheduling.
 * O(log n) insert and extract operations.
 */
class EventHeap {
    private heap: DESEvent[] = [];

    get size(): number {
        return this.heap.length;
    }

    isEmpty(): boolean {
        return this.heap.length === 0;
    }

    clear(): void {
        this.heap = [];
    }

    /** Insert event with O(log n) complexity */
    insert(event: DESEvent): void {
        this.heap.push(event);
        this.bubbleUp(this.heap.length - 1);
    }

    /** Extract minimum event with O(log n) complexity */
    extractMin(): DESEvent | undefined {
        if (this.heap.length === 0) return undefined;

        const min = this.heap[0];
        const last = this.heap.pop()!;

        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }

        return min;
    }

    /** Peek at minimum without removing */
    peekMin(): DESEvent | undefined {
        return this.heap[0];
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;

            [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const length = this.heap.length;

        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < length && this.compare(this.heap[leftChild], this.heap[smallest]) < 0) {
                smallest = leftChild;
            }
            if (rightChild < length && this.compare(this.heap[rightChild], this.heap[smallest]) < 0) {
                smallest = rightChild;
            }

            if (smallest === index) break;

            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }

    /** Compare events: first by time, then by priority */
    private compare(a: DESEvent, b: DESEvent): number {
        if (a.time !== b.time) return a.time - b.time;
        return a.priority - b.priority;
    }
}

// =============================================================================
// DES SIMULATION ENGINE
// =============================================================================

/**
 * High-performance Discrete Event Simulation engine.
 * Uses event-driven simulation instead of tick-based for O(events) complexity.
 */
export class DESSimulationEngine {
    private eventQueue: EventHeap;
    private stations: DESStationState[];
    private pieces: Map<number, DESPieceState>;
    private kpis: SimulationKPIs;
    private config: DESConfig;
    // Counters and state
    private currentTime: number = 0;
    private completedCount: number = 0;
    private spawnedCount: number = 0;
    private pieceIdCounter: number = 0;
    /** Post-warmup throughput: pieces completed when warmup ended */
    private completedAtWarmup: number = 0;
    private warmupRecorded: boolean = false;
    /** Lead time samples from steady-state only (pieces entering after warmup) */
    private leadTimeSteadyCount: number = 0;

    // Product mix state
    private heijunkaSequence: number[] = []; // array of cycleTimeMultiplier values mapped by index
    private heijunkaIndex: number = 0;

    // Per-station queues: O(1) lookup instead of O(n) Map scan
    private stationQueues: number[][] = [];
    // Blocked piece tracking: stationIndex → { pieceId, completionTime }
    private blockedPieces: Map<number, { pieceId: number; completionTime: number }> = new Map();

    // Pre-computed constants
    private readonly wipLimit: number;
    private readonly totalPieces: number;
    /** FIX 10: Warm-up period in seconds - metrics not recorded before this */
    private readonly warmupTime: number;

    constructor(config: DESConfig) {
        // === INPUT VALIDATION ===
        const validatedConfig = validateDESConfig(config);

        this.config = validatedConfig;
        this.eventQueue = new EventHeap();
        this.pieces = new Map();
        this.wipLimit = validatedConfig.wipLimit;
        this.totalPieces = validatedConfig.totalPieces;

        // FIX 10: Calculate warm-up time = N_stations * TaktTime (Law of Little)
        const taktTime = validatedConfig.taktTimeSeconds || 60; // Default 60s if not provided
        this.warmupTime = validatedConfig.stations.length * taktTime;

        // Initialize stations with pre-computed values
        this.stations = validatedConfig.stations.map((s, index) => ({
            id: s.id,
            name: s.name,
            cycleTime: s.cycleTime,
            operators: s.operators,
            activeCount: 0,
            queueCount: 0,
            processCompletionTimes: [],
            bufferPieces: s.bufferCapacity,
            bufferCapacity: s.bufferCapacity,
            isStarved: false,
            blocked: false,
            // Pre-computed
            cycleTimeMs: s.cycleTime * 1000,
            maxCapacity: s.operators + validatedConfig.wipLimit,
            // Phase 12
            isDown: false,
            failureConfig: s.failureConfig,
        }));

        this.kpis = createEmptyKPIs(this.stations.length);

        // Initialize per-station queues for O(1) piece lookup
        this.stationQueues = this.stations.map(() => []);
        this.blockedPieces = new Map();

        // Initialize Heijunka sequence if needed
        if (validatedConfig.productMixMode === 'heijunka' && validatedConfig.products && validatedConfig.products.length > 0) {
            this.heijunkaSequence = this.generateHeijunkaSequence(validatedConfig.products, validatedConfig.totalPieces);
        }
    }

    /**
     * Get final station state
     */
    getStationsState(): DESStationState[] {
        return this.stations;
    }

    /**
     * Schedule an event in the priority queue.
     */
    private scheduleEvent(event: DESEvent): void {
        this.eventQueue.insert(event);
    }

    /**
     * Generate a Heijunka (leveled) sequence using Euclidean rhythm distribution.
     * Returns an array of cycleTimeMultiplier values in leveled order.
     */
    private generateHeijunkaSequence(products: DESProductDef[], totalPieces: number): number[] {
        if (products.length === 0 || totalPieces <= 0) return [];

        const sequence: number[] = [];
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
            sequence.push(products[bestIdx].cycleTimeMultiplier);
        }
        return sequence;
    }

    /**
     * Select the cycleTimeMultiplier for the next piece based on productMixMode.
     */
    private selectProductMultiplier(): number {
        const products = this.config.products;
        const mode = this.config.productMixMode;

        if (!products || products.length === 0 || !mode) return 1.0;

        switch (mode) {
            case 'dominant': {
                // Always use the product with highest mixRatio
                const dominant = products.reduce((a, b) => a.mixRatio > b.mixRatio ? a : b);
                return dominant.cycleTimeMultiplier;
            }
            case 'heijunka': {
                // Follow pre-generated leveled sequence
                if (this.heijunkaSequence.length === 0) return 1.0;
                const multiplier = this.heijunkaSequence[this.heijunkaIndex % this.heijunkaSequence.length];
                this.heijunkaIndex++;
                return multiplier;
            }
            case 'random':
            default: {
                // Probabilistic selection based on mixRatio
                const random = Math.random();
                let cumulative = 0;
                for (const product of products) {
                    cumulative += product.mixRatio;
                    if (random <= cumulative) {
                        return product.cycleTimeMultiplier;
                    }
                }
                return products[products.length - 1].cycleTimeMultiplier;
            }
        }
    }

    /**
     * Schedule initial piece arrivals up to WIP limit.
     */
    private scheduleInitialPieces(): void {
        const initialPieces = Math.min(this.wipLimit, this.totalPieces);
        for (let i = 0; i < initialPieces; i++) {
            this.pieceIdCounter++;
            this.spawnedCount++;

            const piece: DESPieceState = {
                id: this.pieceIdCounter,
                stationIndex: 0,
                status: 'queued',
                entryTime: 0,
                cycleTimeMultiplier: this.selectProductMultiplier(),
            };
            this.pieces.set(piece.id, piece);

            this.scheduleEvent({
                time: 0,
                type: 'PIECE_ARRIVE',
                stationIndex: 0,
                pieceId: piece.id,
                priority: 10,
            });
        }
    }

    /**
     * Process the next event from the queue.
     * Returns true if an event was processed, false if queue is empty.
     */
    private processNextEvent(): boolean {
        const event = this.eventQueue.extractMin();
        if (!event) return false;

        // Record time-based KPIs for the time delta
        const timeDelta = event.time - this.currentTime;
        if (timeDelta > 0) {
            this.recordTimeForKPIs(timeDelta);
        }

        // Snapshot completed count when crossing warm-up boundary
        if (!this.warmupRecorded && event.time >= this.warmupTime && this.currentTime < this.warmupTime) {
            this.completedAtWarmup = this.completedCount;
            this.warmupRecorded = true;
        }

        this.currentTime = event.time;

        // Dispatch event to appropriate handler
        switch (event.type) {
            case 'PIECE_ARRIVE':
                this.handlePieceArrive(event);
                break;
            case 'PIECE_START':
                this.handlePieceStart(event);
                break;
            case 'PIECE_COMPLETE':
                this.handlePieceComplete(event);
                break;
            case 'FAILURE_START':
                this.handleFailureStart(event);
                break;
            case 'FAILURE_END':
                this.handleFailureEnd(event);
                break;
            case 'SIMULATION_END':
                return false;
            default:
                logger.warn('DES', `Unknown event type: ${event.type}`);
        }

        return true;
    }

    /**
     * Run simulation to completion instantly.
     * Returns results with execution timing for benchmarking.
     */
    runInstant(): DESSimulationResult {
        const startTime = performance.now();

        // Schedule initial piece arrivals
        this.scheduleInitialPieces();

        // Phase 12: Schedule initial failures
        this.scheduleInitialFailures();

        // Process all events
        let tickCount = 0;
        const maxEvents = this.totalPieces * this.stations.length * 100; // Safety limit (increased for long starvation periods)

        while (!this.eventQueue.isEmpty() && tickCount < maxEvents) {
            const processed = this.processNextEvent();
            if (!processed) break;
            tickCount++;

            // Early exit if all pieces completed
            if (this.completedCount >= this.totalPieces) break;
        }

        const endTime = performance.now();
        const executionTimeMs = endTime - startTime;

        // Calculate final KPIs
        this.calculateFinalKPIs();

        const elapsedSeconds = this.currentTime;

        // Post-warmup throughput: exclude initialization transient for stable metric
        const steadyStateTime = elapsedSeconds - this.warmupTime;
        const steadyStatePieces = this.completedCount - this.completedAtWarmup;
        const throughput = steadyStateTime > 0 && steadyStatePieces > 0
            ? (steadyStatePieces / steadyStateTime) * 3600
            : (elapsedSeconds > 0 ? (this.completedCount / elapsedSeconds) * 3600 : 0);

        // Log performance
        logger.debug('DES', `Instant simulation: ${executionTimeMs.toFixed(2)}ms for ${this.completedCount} pieces, ${tickCount} events`);

        // FIX: Calculate average lead time from steady-state samples only
        if (this.leadTimeSteadyCount > 0) {
            this.kpis.avgLeadTime = this.kpis.totalLeadTime / this.leadTimeSteadyCount;
        }

        return {
            completedCount: this.completedCount,
            elapsedTime: elapsedSeconds,
            throughput,
            avgCycleTime: this.completedCount > 0 ? elapsedSeconds / this.completedCount : 0,
            kpis: this.kpis,
            executionTimeMs,
            tickCount,
        };
    }

    private handlePieceArrive(event: DESEvent): void {
        const station = this.stations[event.stationIndex];
        const piece = this.pieces.get(event.pieceId);
        if (!piece) return;

        station.queueCount++;
        this.stationQueues[event.stationIndex].push(event.pieceId);

        // Try to start processing immediately if capacity available
        this.tryStartProcessing(event.stationIndex);
    }

    private handlePieceStart(event: DESEvent): void {
        const station = this.stations[event.stationIndex];
        const piece = this.pieces.get(event.pieceId);
        if (!piece) return;

        // FIX: Prevent race condition between retry polling and replenishment event
        // If piece was already started by a competing event, ignore this one.
        if (piece.status === 'processing') return;

        // BETA: Infinite supply — material consumption disabled

        station.isStarved = false;

        piece.status = 'processing';

        // Apply product-specific cycle time multiplier
        const baseCycleTime = station.cycleTime * (piece.cycleTimeMultiplier ?? 1.0);

        // FIX 10: Apply stochastic variation if configured
        const variability = this.config.variabilityPercent || 0;
        const sigma = baseCycleTime * (variability / 100);
        const actualCycleTime = variability > 0
            ? gaussianRandom(baseCycleTime, sigma)
            : baseCycleTime;

        const completionTime = this.currentTime + actualCycleTime;
        station.processCompletionTimes.push(completionTime);

        // Schedule completion
        this.scheduleEvent({
            time: completionTime,
            type: 'PIECE_COMPLETE',
            stationIndex: event.stationIndex,
            pieceId: event.pieceId,
            priority: 5,
        });
    }

    private handlePieceComplete(event: DESEvent): void {
        const stationIndex = event.stationIndex;
        const station = this.stations[stationIndex];
        const piece = this.pieces.get(event.pieceId);
        if (!piece) return;

        // Check if this is the last station
        if (stationIndex === this.stations.length - 1) {
            // Piece truly completing - now safe to decrement activeCount
            const timeIndex = station.processCompletionTimes.indexOf(this.currentTime);
            if (timeIndex !== -1) {
                station.processCompletionTimes.splice(timeIndex, 1);
            }
            station.activeCount--;

            // Piece completed!
            piece.status = 'completed';
            piece.completionTime = this.currentTime;
            this.completedCount++;

            // FIX: Track lead time (entry → exit) for KPI reporting
            // Only count pieces that entered during steady state (after warmup)
            // to avoid contamination from the transient line-filling phase
            const leadTime = this.currentTime - piece.entryTime;
            if (leadTime >= 0 && piece.entryTime >= this.warmupTime) {
                this.kpis.totalLeadTime += leadTime;
                this.kpis.minLeadTime = Math.min(this.kpis.minLeadTime, leadTime);
                this.kpis.maxLeadTime = Math.max(this.kpis.maxLeadTime, leadTime);
                this.leadTimeSteadyCount++;
            }

            this.pieces.delete(event.pieceId); // Free memory

            // Try to spawn new piece if needed
            this.trySpawnNewPiece();

            // Notify upstream that capacity freed at last station
            this.tryUnblockUpstream(stationIndex);
        } else {
            // Move to next station
            const nextStation = this.stations[stationIndex + 1];
            const nextCapacity = nextStation.activeCount + nextStation.queueCount;

            if (nextCapacity < this.wipLimit) {
                // Can move - now safe to decrement activeCount
                const timeIndex = station.processCompletionTimes.indexOf(this.currentTime);
                if (timeIndex !== -1) {
                    station.processCompletionTimes.splice(timeIndex, 1);
                }
                station.activeCount--;

                // Can move to next station
                piece.stationIndex = stationIndex + 1;
                piece.status = 'queued';
                station.blocked = false;

                this.scheduleEvent({
                    time: this.currentTime,
                    type: 'PIECE_ARRIVE',
                    stationIndex: stationIndex + 1,
                    pieceId: event.pieceId,
                    priority: 10,
                });

                // Clear any stale blocked state and notify upstream
                this.blockedPieces.delete(stationIndex);
                this.tryUnblockUpstream(stationIndex);
            } else {
                // Blocked - register for notification instead of polling
                station.blocked = true;
                this.blockedPieces.set(stationIndex, {
                    pieceId: event.pieceId,
                    completionTime: this.currentTime,
                });
                // NO retry scheduled — tryUnblockUpstream will resolve when capacity frees
            }
        }

        // Try to start more processing at this station
        this.tryStartProcessing(stationIndex);
    }

    private tryStartProcessing(stationIndex: number): void {
        const station = this.stations[stationIndex];
        const queue = this.stationQueues[stationIndex];

        // Clear starvation when work becomes available
        if (station.queueCount > 0) {
            station.isStarved = false;
        }

        while (
            station.queueCount > 0 &&
            station.activeCount < station.operators &&
            !station.isDown // Phase 12 Check
        ) {
            // O(1) dequeue from per-station queue (replaces O(n) Map scan)
            if (queue.length === 0) break;
            const pieceId = queue.shift()!;
            // FIX: Decrement queueCount immediately after shift() to keep it in sync
            // with the physical queue. Previously, a failed piece lookup would skip the
            // decrement, causing queueCount > queue.length divergence.
            station.queueCount--;
            const pieceToStart = this.pieces.get(pieceId);
            if (!pieceToStart || pieceToStart.status !== 'queued') continue; // defensive guard

            station.activeCount++;

            // Schedule start event
            this.scheduleEvent({
                time: this.currentTime,
                type: 'PIECE_START',
                stationIndex: stationIndex,
                pieceId: pieceToStart.id,
                priority: 8,
            });
        }

        // FIX: Detect starvation — station has no work and is not the first station
        // (station 0 receives input from outside, so empty queue is normal between arrivals)
        station.isStarved = station.queueCount === 0
            && station.activeCount === 0
            && !station.blocked
            && !station.isDown
            && stationIndex > 0;
    }

    /**
     * Notify upstream station that capacity is available.
     * Replaces the 0.1s polling retry with O(1) event-driven notification.
     * When a station frees capacity, it checks if the previous station
     * has a blocked piece waiting, and if so, moves it immediately.
     */
    private tryUnblockUpstream(stationIndex: number): void {
        if (stationIndex <= 0) return;

        const upstreamIdx = stationIndex - 1;
        const blocked = this.blockedPieces.get(upstreamIdx);
        if (!blocked) return;

        const thisStation = this.stations[stationIndex];
        const nextCapacity = thisStation.activeCount + thisStation.queueCount;
        if (nextCapacity >= this.wipLimit) return;

        const upstreamStation = this.stations[upstreamIdx];
        const piece = this.pieces.get(blocked.pieceId);
        if (!piece) {
            this.blockedPieces.delete(upstreamIdx);
            return;
        }

        // Release from upstream station
        const timeIndex = upstreamStation.processCompletionTimes.indexOf(blocked.completionTime);
        if (timeIndex !== -1) {
            upstreamStation.processCompletionTimes.splice(timeIndex, 1);
        }
        upstreamStation.activeCount--;
        upstreamStation.blocked = false;
        this.blockedPieces.delete(upstreamIdx);

        // Move piece to this station
        piece.stationIndex = stationIndex;
        piece.status = 'queued';

        this.scheduleEvent({
            time: this.currentTime,
            type: 'PIECE_ARRIVE',
            stationIndex: stationIndex,
            pieceId: blocked.pieceId,
            priority: 10,
        });

        // Free operator in upstream → can process more queued pieces
        this.tryStartProcessing(upstreamIdx);

        // Propagate chain: check if there's another blocked piece further upstream
        this.tryUnblockUpstream(upstreamIdx);
    }

    private trySpawnNewPiece(): void {
        if (this.spawnedCount >= this.totalPieces) return;

        const firstStation = this.stations[0];
        const currentCapacity = firstStation.activeCount + firstStation.queueCount;

        if (currentCapacity < this.wipLimit) {
            this.pieceIdCounter++;
            this.spawnedCount++;

            const piece: DESPieceState = {
                id: this.pieceIdCounter,
                stationIndex: 0,
                status: 'queued',
                entryTime: this.currentTime,
                cycleTimeMultiplier: this.selectProductMultiplier(),
            };
            this.pieces.set(piece.id, piece);

            this.scheduleEvent({
                time: this.currentTime,
                type: 'PIECE_ARRIVE',
                stationIndex: 0,
                pieceId: piece.id,
                priority: 10,
            });
        }
    }

    private recordTimeForKPIs(timeDelta: number): void {
        // FIX 10: Skip KPI recording during warm-up period
        // This avoids contaminating metrics with the line-filling transient state
        if (this.currentTime < this.warmupTime) {
            return;
        }

        for (let i = 0; i < this.stations.length; i++) {
            const station = this.stations[i];

            if (station.isStarved) {
                this.kpis.stationStarvedTime[i] = (this.kpis.stationStarvedTime[i] || 0) + timeDelta;
            } else if (station.activeCount > 0) {
                this.kpis.stationActiveTime[i] = (this.kpis.stationActiveTime[i] || 0) + timeDelta;
            } else if (station.blocked) {
                this.kpis.stationBlockedTime[i] = (this.kpis.stationBlockedTime[i] || 0) + timeDelta;
            } else if (station.isDown) { // Phase 12: Downtime logic
                // We record downtime as "inactive" technically in APM logic, but here distinct
                // For now, let's treat it as blocked or idle depending on KPI def.
                // Actually, we should add stationDownTime to KPIs if not exists.
                // Since SimulationKPIs in flowTypes uses generic record, we can add tracking.
                // But typically downtime counts against Availability.
                // Let's assume Idle for OEE availability calculation "loss".
                this.kpis.stationIdleTime[i] = (this.kpis.stationIdleTime[i] || 0) + timeDelta;
            } else {
                this.kpis.stationIdleTime[i] = (this.kpis.stationIdleTime[i] || 0) + timeDelta;
            }
        }

        // Track WIP
        const totalWIP = this.pieces.size;
        if (totalWIP > this.kpis.peakWIP) {
            this.kpis.peakWIP = totalWIP;
        }
        this.kpis.wipSamples += totalWIP;
        this.kpis.wipSampleCount += 1;
    }

    private calculateFinalKPIs(): void {
        // Calculate utilization per station
        let totalActiveTime = 0;
        let totalIdleTime = 0;
        let totalPlannedTime = 0;

        for (let i = 0; i < this.stations.length; i++) {
            const activeTime = this.kpis.stationActiveTime[i] || 0;
            const idleTime = this.kpis.stationIdleTime[i] || 0;
            const blockedTime = this.kpis.stationBlockedTime[i] || 0;
            const starvedTime = this.kpis.stationStarvedTime[i] || 0;

            const totalTime = activeTime + idleTime + blockedTime + starvedTime;

            this.kpis.stationUtilization[i] = totalTime > 0
                ? (activeTime / totalTime) * 100
                : 0;

            // Accumulate for line-level OEE
            totalActiveTime += activeTime;
            totalIdleTime += idleTime;
            totalPlannedTime += totalTime;
        }

        // Find bottleneck
        let maxUtilization = 0;
        for (let i = 0; i < this.stations.length; i++) {
            if (this.kpis.stationUtilization[i] > maxUtilization) {
                maxUtilization = this.kpis.stationUtilization[i];
                this.kpis.bottleneckStationId = this.stations[i].id;
                this.kpis.bottleneckCycleTime = this.stations[i].cycleTime;
                this.kpis.bottleneckUtilization = maxUtilization;
            }
        }

        // Average WIP
        this.kpis.avgWIP = this.kpis.wipSampleCount > 0
            ? this.kpis.wipSamples / this.kpis.wipSampleCount
            : 0;

        // =====================================================================
        // Phase 12: OEE Calculation
        // =====================================================================
        // OEE = Availability × Performance × Quality
        //
        // Availability = (Run Time / Planned Production Time)
        //   Run Time = Planned Time - Unplanned Downtime (idle due to failures)
        //   Note: Starved and Blocked time are NOT downtime, they are capacity losses
        //
        // Performance = (Actual Output / Theoretical Max Output)
        //   Theoretical Max = Run Time / Bottleneck Cycle Time
        //
        // Quality = Good Count / Total Count (assumed 1.0, not modeled)
        // =====================================================================

        if (totalPlannedTime > 0) {
            // Availability: Planned Time minus unplanned stops (idle = failure/waiting)
            // In this model, idle time represents when station could work but isn't
            // Failures specifically contribute to idle time (see recordTimeForKPIs)
            const runTime = totalActiveTime +
                Object.values(this.kpis.stationBlockedTime).reduce((a, b) => a + b, 0) +
                Object.values(this.kpis.stationStarvedTime).reduce((a, b) => a + b, 0);

            this.kpis.availability = totalPlannedTime > 0
                ? (runTime / totalPlannedTime)
                : 1.0;

            // Performance: Actual throughput vs theoretical max
            // FIX: Use simulation elapsed time (post-warmup), NOT summed station-time.
            // runTime is summed across all N stations, so dividing by bottleneckCT
            // would give N× the actual theoretical max, making Performance always ~1/N.
            const bottleneckCT = this.kpis.bottleneckCycleTime ||
                (this.stations.length > 0 ? Math.max(0.01, ...this.stations.map(s => s.cycleTime)) : 1);
            const steadyStateElapsed = Math.max(0, this.currentTime - this.warmupTime);
            const steadyStatePieces = this.completedCount - this.completedAtWarmup;
            const theoreticalMaxPieces = bottleneckCT > 0 && steadyStateElapsed > 0
                ? steadyStateElapsed / bottleneckCT
                : 0;

            this.kpis.performance = theoreticalMaxPieces > 0
                ? Math.min(1.0, steadyStatePieces / theoreticalMaxPieces)
                : 1.0;

            // Quality: Perfect quality assumed (not modeled)
            this.kpis.quality = 1.0;

            // OEE = A × P × Q
            this.kpis.oee = this.kpis.availability * this.kpis.performance * this.kpis.quality;
        } else {
            this.kpis.availability = 1.0;
            this.kpis.performance = 1.0;
            this.kpis.quality = 1.0;
            this.kpis.oee = 1.0;
        }
    }


    // Phase 12: Failure Scheduling
    private scheduleInitialFailures(): void {
        for (let i = 0; i < this.stations.length; i++) {
            const station = this.stations[i];
            if (station.failureConfig) {
                this.scheduleNextFailure(i);
            }
        }
    }

    private scheduleNextFailure(stationIndex: number): void {
        const station = this.stations[stationIndex];
        if (!station.failureConfig) return;

        // Exponential distribution for failures
        // Time to next failure = -MTBF * ln(random)
        const mtbfSeconds = station.failureConfig.mtbfMinutes * 60;
        // Avoid infinite if random is 0
        const rand = Math.max(0.000001, Math.random());
        const timeToFailure = -mtbfSeconds * Math.log(rand);

        // Schedule relative to current time
        this.scheduleEvent({
            time: this.currentTime + timeToFailure,
            type: 'FAILURE_START',
            stationIndex: stationIndex,
            pieceId: -1,
            priority: 0, // Highest priority
        });
    }

    private handleFailureStart(event: DESEvent): void {
        const stationIndex = event.stationIndex;
        const station = this.stations[stationIndex];

        station.isDown = true;

        // Calculate repair time
        // Exponential distribution for repair
        // Repair time = -MTTR * ln(random)
        if (station.failureConfig) {
            const mttrSeconds = station.failureConfig.mttrMinutes * 60;
            const rand = Math.max(0.000001, Math.random());
            const repairTime = -mttrSeconds * Math.log(rand);

            // Schedule repair completion
            this.scheduleEvent({
                time: this.currentTime + repairTime,
                type: 'FAILURE_END',
                stationIndex: stationIndex,
                pieceId: -1,
                priority: 0,
            });
        }
    }

    private handleFailureEnd(event: DESEvent): void {
        const stationIndex = event.stationIndex;
        const station = this.stations[stationIndex];

        station.isDown = false;

        // Schedule next failure
        this.scheduleNextFailure(stationIndex);

        // Resume processing if possible
        this.tryStartProcessing(stationIndex);

        // Notify upstream that repaired station can accept pieces again
        this.tryUnblockUpstream(stationIndex);
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a DES simulation engine with the given configuration.
 * Use for instant simulation mode where performance is critical.
 */
export function createDESEngine(config: DESConfig): DESSimulationEngine {
    return new DESSimulationEngine(config);
}
