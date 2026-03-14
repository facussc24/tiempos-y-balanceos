/**
 * Heijunka Logic Module - Production Leveling Algorithm
 * Phase 4: Lean Logistics Suite
 * 
 * This module implements the Heijunka (leveling) calculation that transforms
 * batch production "AAA BBB CCC" into leveled production "A B A C A B..."
 * 
 * Key Concepts:
 * - Slots: Time intervals based on Pitch (from Mizusumashi)
 * - Leveling: Distribute demand uniformly across slots using Euclidean rhythm
 * - Validation: Ensure cycle times don't exceed pitch
 * 
 * Core sequencing algorithms are delegated to SequencingService for reuse.
 */

import {
    calculateSlots as coreCalculateSlots,
    calculateQuantityPerSlot as coreCalculateQuantityPerSlot,
    euclideanDistribute as coreEuclideanDistribute
} from '../../core/services/SequencingService';
import { formatTime } from '../../utils/formatting';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductDemand {
    /** Unique product identifier */
    productId: string;

    /** Display name */
    productName: string;

    /** Daily demand in units */
    dailyDemand: number;

    /** Cycle time in seconds (time to produce one unit) */
    cycleTimeSeconds: number;

    /** Color for visual display */
    color: string;

    /** Pieces per container/box (default: 50). Used for material delivery calculation. */
    packOut?: number;
}

export interface SlotAssignment {
    /** Product ID */
    productId: string;

    /** Product name */
    productName: string;

    /** Quantity to produce in this slot */
    quantity: number;

    /** Color for display */
    color: string;
}

export interface HeijunkaSlot {
    /** Slot index (0-based) */
    slotIndex: number;

    /** Start time (HH:MM format) */
    startTime: string;

    /** End time (HH:MM format) */
    endTime: string;

    /** Product assignments for this slot */
    assignments: SlotAssignment[];

    /** Total units in this slot */
    totalUnits: number;

    /** Materials list for Mizusumashi */
    materialsToDeliver: MaterialDelivery[];
}

export interface MaterialDelivery {
    productName: string;
    quantity: number;
    boxCount: number;
}

export interface HeijunkaResult {
    /** Total number of slots in the day */
    totalSlots: number;

    /** Pitch in minutes */
    pitchMinutes: number;

    /** Array of slots with assignments */
    slots: HeijunkaSlot[];

    /** Summary per product */
    productSummaries: ProductSummary[];

    /** Capacity validation results */
    capacityAlerts: CapacityAlert[];

    /** Overall feasibility */
    isFeasible: boolean;
}

export interface ProductSummary {
    productId: string;
    productName: string;
    color: string;
    totalDemand: number;
    totalAssigned: number;
    avgPerSlot: number;
}

export interface CapacityAlert {
    productId: string;
    productName: string;
    cycleTimeSeconds: number;
    pitchSeconds: number;
    severity: 'ok' | 'warning' | 'critical';
    message: string;
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Step A: Calculate total number of slots in the available time.
 * 
 * Slots = Available Time / Pitch
 * 
 * @param availableMinutes - Total production time (e.g., 480 min for 8 hours)
 * @param pitchMinutes - Pitch from Mizusumashi (e.g., 20 min)
 * @returns Number of slots
 * 
 * @see SequencingService.calculateSlots for core implementation
 */
export const calculateSlots = coreCalculateSlots;

/**
 * Step B: Calculate quantity per slot for a product.
 * 
 * Quantity per Slot = Demand / Total Slots
 * 
 * @param demand - Daily demand for the product
 * @param totalSlots - Number of time slots
 * @returns Average quantity per slot (can be fractional)
 * 
 * @see SequencingService.calculateQuantityPerSlot for core implementation
 */
export const calculateQuantityPerSlot = coreCalculateQuantityPerSlot;

/**
 * Step C: Generate leveled sequence using Euclidean rhythm distribution.
 * 
 * Instead of AAAA BBBB CCCC, produces A B A C A B A C...
 * Uses Bresenham-like algorithm for uniform distribution.
 * 
 * @param products - Array of products with demands
 * @param totalSlots - Number of time slots
 * @param startTime - Start time (HH:MM)
 * @param pitchMinutes - Duration of each slot
 * @returns Array of slots with leveled assignments
 */
export function generateHeijunkaSequence(
    products: ProductDemand[],
    totalSlots: number,
    startTime: string,
    pitchMinutes: number
): HeijunkaSlot[] {
    if (totalSlots <= 0 || products.length === 0) {
        return [];
    }

    // Parse start time
    const [startHour, startMinute] = startTime.split(':').map(Number);
    let currentMinutes = startHour * 60 + startMinute;

    // Initialize slots
    const slots: HeijunkaSlot[] = [];
    for (let i = 0; i < totalSlots; i++) {
        const slotStartTime = formatTime(currentMinutes);
        currentMinutes += pitchMinutes;
        const slotEndTime = formatTime(currentMinutes);

        slots.push({
            slotIndex: i,
            startTime: slotStartTime,
            endTime: slotEndTime,
            assignments: [],
            totalUnits: 0,
            materialsToDeliver: []
        });
    }

    // Distribute each product using Euclidean rhythm
    products.forEach(product => {
        const distribution = euclideanDistribute(product.dailyDemand, totalSlots);

        distribution.forEach((quantity, slotIndex) => {
            if (quantity > 0) {
                slots[slotIndex].assignments.push({
                    productId: product.productId,
                    productName: product.productName,
                    quantity,
                    color: product.color
                });
                slots[slotIndex].totalUnits += quantity;

                // Add material delivery info
                slots[slotIndex].materialsToDeliver.push({
                    productName: product.productName,
                    quantity,
                    // FIX: Guard against packOut=0 producing Infinity
                    boxCount: Math.ceil(quantity / Math.max(1, product.packOut || 50))
                });
            }
        });
    });

    return slots;
}

/**
 * Euclidean rhythm distribution algorithm.
 * Distributes 'total' items across 'slots' as uniformly as possible.
 * 
 * Uses Bresenham's line algorithm approach.
 * 
 * @param total - Total items to distribute
 * @param slots - Number of slots
 * @returns Array of quantities per slot
 * 
 * @see SequencingService.euclideanDistribute for core implementation
 */
export const euclideanDistribute = coreEuclideanDistribute;

/**
 * Validate capacity: check if any product's cycle time exceeds pitch.
 * 
 * @param products - Products with cycle times
 * @param pitchSeconds - Pitch in seconds
 * @returns Array of capacity alerts
 */
export function validateCapacity(
    products: ProductDemand[],
    pitchSeconds: number
): CapacityAlert[] {
    // FIX: Guard against pitchSeconds=0 producing Infinity ratio and NaN in .toFixed()
    const safePitchSeconds = pitchSeconds > 0 ? pitchSeconds : 1;
    return products.map(product => {
        const ratio = product.cycleTimeSeconds / safePitchSeconds;

        if (ratio > 1) {
            return {
                productId: product.productId,
                productName: product.productName,
                cycleTimeSeconds: product.cycleTimeSeconds,
                pitchSeconds,
                severity: 'critical' as const,
                message: `🔴 Ciclo (${formatSeconds(product.cycleTimeSeconds)}) > Pitch (${formatSeconds(pitchSeconds)}). Cuello de botella.`
            };
        } else if (ratio > 0.9) {
            return {
                productId: product.productId,
                productName: product.productName,
                cycleTimeSeconds: product.cycleTimeSeconds,
                pitchSeconds,
                severity: 'warning' as const,
                message: `⚠️ Ciclo muy cercano al Pitch (${(ratio * 100).toFixed(0)}%). Monitorear.`
            };
        } else {
            return {
                productId: product.productId,
                productName: product.productName,
                cycleTimeSeconds: product.cycleTimeSeconds,
                pitchSeconds,
                severity: 'ok' as const,
                message: `✅ OK - Capacidad ${(ratio * 100).toFixed(0)}% del Pitch`
            };
        }
    });
}

/**
 * Main function: Calculate complete Heijunka result.
 */
export function calculateHeijunka(
    products: ProductDemand[],
    availableMinutes: number,
    pitchMinutes: number,
    startTime: string = '08:00'
): HeijunkaResult {
    const totalSlots = calculateSlots(availableMinutes, pitchMinutes);
    const pitchSeconds = pitchMinutes * 60;

    // Generate leveled sequence
    const slots = generateHeijunkaSequence(products, totalSlots, startTime, pitchMinutes);

    // Validate capacity
    const capacityAlerts = validateCapacity(products, pitchSeconds);
    const hasCritical = capacityAlerts.some(a => a.severity === 'critical');

    // Build product summaries
    const productSummaries: ProductSummary[] = products.map(product => {
        const totalAssigned = slots.reduce((sum, slot) => {
            const assignment = slot.assignments.find(a => a.productId === product.productId);
            return sum + (assignment?.quantity || 0);
        }, 0);

        return {
            productId: product.productId,
            productName: product.productName,
            color: product.color,
            totalDemand: product.dailyDemand,
            totalAssigned,
            avgPerSlot: totalSlots > 0 ? totalAssigned / totalSlots : 0
        };
    });

    return {
        totalSlots,
        pitchMinutes,
        slots,
        productSummaries,
        capacityAlerts,
        isFeasible: !hasCritical
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format seconds to human readable.
 */
function formatSeconds(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
}

/**
 * Get a color for a product based on index.
 */
export function getProductColor(index: number): string {
    const colors = [
        '#3B82F6', // Blue
        '#10B981', // Green
        '#F59E0B', // Amber
        '#EF4444', // Red
        '#8B5CF6', // Purple
        '#EC4899', // Pink
        '#06B6D4', // Cyan
        '#84CC16', // Lime
    ];
    return colors[index % colors.length];
}
