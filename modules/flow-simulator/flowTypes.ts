/**
 * Flow Simulator Types
 *
 * Core types for the flow simulation module.
 * Lean version: only types actually used in production.
 *
 * @module flowTypes
 */

// =============================================================================
// INVENTORY STATUS
// =============================================================================

export type InventoryStatus = 'ok' | 'warning' | 'critical';

// =============================================================================
// SIMULATION KPIS
// =============================================================================

/**
 * Comprehensive KPIs for simulation analysis
 */
export interface SimulationKPIs {
    // Per-station metrics (keyed by station index)
    stationUtilization: Record<number, number>;
    stationActiveTime: Record<number, number>;
    stationIdleTime: Record<number, number>;
    stationBlockedTime: Record<number, number>;
    stationStarvedTime: Record<number, number>;

    // Lead time metrics
    totalLeadTime: number;
    avgLeadTime: number;
    minLeadTime: number;
    maxLeadTime: number;

    // WIP metrics
    wipBetweenStations: number[];
    peakWIP: number;
    avgWIP: number;
    wipSamples: number;
    wipSampleCount: number;

    // Bottleneck detection
    bottleneckStationId: number;
    bottleneckCycleTime: number;
    bottleneckUtilization: number;

    // OEE Metrics
    oee?: number;
    availability?: number;
    performance?: number;
    quality?: number;

    // Logistics summary
    totalConsumed: number;
    totalStarvationEvents: number;
}

/**
 * Create empty KPIs structure initialized for N stations
 */
export function createEmptyKPIs(stationCount: number): SimulationKPIs {
    const stationUtilization: Record<number, number> = {};
    const stationActiveTime: Record<number, number> = {};
    const stationIdleTime: Record<number, number> = {};
    const stationBlockedTime: Record<number, number> = {};
    const stationStarvedTime: Record<number, number> = {};

    for (let i = 0; i < stationCount; i++) {
        stationUtilization[i] = 0;
        stationActiveTime[i] = 0;
        stationIdleTime[i] = 0;
        stationBlockedTime[i] = 0;
        stationStarvedTime[i] = 0;
    }

    return {
        stationUtilization,
        stationActiveTime,
        stationIdleTime,
        stationBlockedTime,
        stationStarvedTime,
        totalLeadTime: 0,
        avgLeadTime: 0,
        minLeadTime: Infinity,
        maxLeadTime: 0,
        wipBetweenStations: new Array(Math.max(stationCount - 1, 0)).fill(0),
        peakWIP: 0,
        avgWIP: 0,
        wipSamples: 0,
        wipSampleCount: 0,
        bottleneckStationId: -1,
        bottleneckCycleTime: 0,
        bottleneckUtilization: 0,
        totalConsumed: 0,
        totalStarvationEvents: 0,
    };
}

// =============================================================================
// SIMULATION EVENTS
// =============================================================================

export type SimulationEventType =
    | 'PIECE_ENTER_LINE'
    | 'START_PROCESS'
    | 'END_PROCESS'
    | 'PIECE_ENTER_QUEUE'
    | 'PIECE_EXIT_LINE'
    | 'STATION_BLOCKED'
    | 'STATION_UNBLOCKED';

export interface SimulationEvent {
    timestamp: number;
    type: SimulationEventType;
    pieceId?: number;
    stationId?: string;
    data?: Record<string, unknown>;
}

// =============================================================================
// MULTI-PRODUCT SUPPORT
// =============================================================================

export type ProductMixMode = 'dominant' | 'random' | 'heijunka';

export interface ProductType {
    id: string;
    name: string;
    color: string;
    routeStations: string[];
    mixRatio: number;
    cycleTimeMultiplier: number;
    priority: number;
}

export interface MultiProductConfig {
    products: ProductType[];
    dispatchingRule: 'fifo' | 'priority_sku' | 'shortest_queue';
    interSectorBuffers: never[];
    selectedProductFilter: string | null;
}

export const DEFAULT_PRODUCTS: ProductType[] = [
    {
        id: 'product-a',
        name: 'Producto A',
        color: '#3b82f6',
        routeStations: [],
        mixRatio: 0.6,
        cycleTimeMultiplier: 1.0,
        priority: 1,
    },
    {
        id: 'product-b',
        name: 'Producto B',
        color: '#f59e0b',
        routeStations: [],
        mixRatio: 0.4,
        cycleTimeMultiplier: 1.2,
        priority: 2,
    },
];

export function createDefaultMultiProductConfig(stationIds: string[]): MultiProductConfig {
    return {
        products: DEFAULT_PRODUCTS.map(p => ({
            ...p,
            routeStations: stationIds,
        })),
        dispatchingRule: 'fifo',
        interSectorBuffers: [],
        selectedProductFilter: null,
    };
}
