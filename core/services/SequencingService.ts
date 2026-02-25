/**
 * SequencingService - Core Production Sequencing Algorithm
 * 
 * This service encapsulates the mathematical logic for production leveling (Heijunka).
 * It transforms batch production "AAA BBB CCC" into leveled production "A B A C A B..."
 * 
 * Key Algorithm: Euclidean Rhythm Distribution
 * Uses a Bresenham-like approach for uniform distribution of items across time slots.
 * 
 * This service is UI-agnostic and can be used by any module requiring sequencing logic.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for sequencing: a product with its demand.
 */
export interface SequencingProduct {
    /** Unique product identifier */
    id: string;

    /** Display name */
    name: string;

    /** Total demand (units to distribute) */
    demand: number;

    /** Optional color for visualization */
    color?: string;
}

/**
 * Output: assignment of a product to a slot.
 */
export interface SequencingAssignment {
    productId: string;
    productName: string;
    quantity: number;
    color?: string;
}

/**
 * A time slot with product assignments.
 */
export interface SequencingSlot {
    slotIndex: number;
    assignments: SequencingAssignment[];
    totalUnits: number;
}

// ============================================================================
// CORE ALGORITHMS
// ============================================================================

/**
 * Calculate total number of slots in the available time.
 * 
 * Formula: Slots = Available Time / Pitch
 * 
 * @param availableMinutes - Total production time (e.g., 480 min for 8 hours)
 * @param pitchMinutes - Pitch interval (e.g., 20 min)
 * @returns Number of slots (floored)
 */
export function calculateSlots(
    availableMinutes: number,
    pitchMinutes: number
): number {
    if (availableMinutes <= 0 || pitchMinutes <= 0) {
        return 0;
    }
    return Math.floor(availableMinutes / pitchMinutes);
}

/**
 * Calculate average quantity per slot for a given demand.
 * 
 * Formula: Quantity per Slot = Demand / Total Slots
 * 
 * @param demand - Total demand for the product
 * @param totalSlots - Number of time slots
 * @returns Average quantity per slot (can be fractional)
 */
export function calculateQuantityPerSlot(
    demand: number,
    totalSlots: number
): number {
    if (totalSlots <= 0) return 0;
    return demand / totalSlots;
}

/**
 * Euclidean rhythm distribution algorithm.
 * Distributes 'total' items across 'slots' as uniformly as possible.
 * 
 * Uses Bresenham's line algorithm approach for optimal spacing.
 * 
 * Example: euclideanDistribute(7, 3) => [3, 2, 2] or similar uniform pattern
 * Example: euclideanDistribute(3, 6) => [1, 0, 1, 0, 1, 0] (spread evenly)
 * 
 * @param total - Total items to distribute
 * @param slots - Number of slots
 * @returns Array of quantities per slot
 */
export function euclideanDistribute(total: number, slots: number): number[] {
    // Robust validation: handle NaN, Infinity, and invalid values
    if (!Number.isFinite(slots) || slots <= 0) return [];
    if (!Number.isFinite(total) || total <= 0) return new Array(Math.floor(slots)).fill(0);

    // Ensure integers
    const safeSlots = Math.floor(slots);
    const safeTotal = Math.round(total);

    const result = new Array(safeSlots).fill(0);
    const baseQuantity = Math.floor(safeTotal / safeSlots);
    const remainder = safeTotal - (baseQuantity * safeSlots);

    // Fill base quantity
    for (let i = 0; i < safeSlots; i++) {
        result[i] = baseQuantity;
    }

    // Distribute remainder uniformly using Bresenham-like approach
    if (remainder > 0) {
        const step = safeSlots / remainder;
        for (let i = 0; i < remainder; i++) {
            const index = Math.floor(i * step);
            result[index]++;
        }
    }

    return result;
}

/**
 * Generate a leveled production sequence for multiple products.
 * 
 * Instead of AAAA BBBB CCCC, produces balanced slots with A B A C A B A C...
 * Each product is distributed independently using Euclidean rhythm.
 * 
 * @param products - Array of products with demands
 * @param totalSlots - Number of time slots
 * @returns Array of slots with balanced product assignments
 */
export function generateSequence(
    products: SequencingProduct[],
    totalSlots: number
): SequencingSlot[] {
    if (totalSlots <= 0 || products.length === 0) {
        return [];
    }

    // Initialize empty slots
    const slots: SequencingSlot[] = [];
    for (let i = 0; i < totalSlots; i++) {
        slots.push({
            slotIndex: i,
            assignments: [],
            totalUnits: 0
        });
    }

    // Distribute each product using Euclidean rhythm
    products.forEach(product => {
        const distribution = euclideanDistribute(product.demand, totalSlots);

        distribution.forEach((quantity, slotIndex) => {
            if (quantity > 0) {
                slots[slotIndex].assignments.push({
                    productId: product.id,
                    productName: product.name,
                    quantity,
                    color: product.color
                });
                slots[slotIndex].totalUnits += quantity;
            }
        });
    });

    return slots;
}

/**
 * Generate a simple pattern string for display.
 * 
 * Example: Given products A, B, C with demands 3, 2, 1 across 6 slots,
 * produces something like: "A → B → A → C → A → B"
 * 
 * @param products - Array of products with demands
 * @param totalSlots - Number of time slots
 * @param separator - Separator between items (default: " → ")
 * @returns Pattern string for display
 */
export function generatePatternString(
    products: SequencingProduct[],
    totalSlots: number,
    separator: string = ' → '
): string {
    const slots = generateSequence(products, totalSlots);

    const patternParts: string[] = [];
    slots.forEach(slot => {
        // Take the dominant product in each slot (or combine if multiple)
        if (slot.assignments.length > 0) {
            const names = slot.assignments.map(a => a.productName);
            patternParts.push(names.join('+'));
        }
    });

    return patternParts.join(separator);
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const SequencingService = {
    calculateSlots,
    calculateQuantityPerSlot,
    euclideanDistribute,
    generateSequence,
    generatePatternString
};

export default SequencingService;
